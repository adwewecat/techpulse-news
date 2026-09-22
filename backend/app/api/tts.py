import re
import os
import json
import asyncio
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.storage import get_storage, JSONStorage

logger = logging.getLogger("tts")

router = APIRouter(prefix="/api/tts", tags=["Text-to-Speech"])

# Bộ nhớ đệm Audio RAM để phản hồi tức thì
AUDIO_CACHE: Dict[str, bytes] = {}

AUDIO_CACHE_DIR = settings.DATA_FILE.parent / "audio_cache"
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://translate.google.com/"
}

# Danh sách các giọng đọc Tiếng Việt Neural siêu chuẩn & chất lượng cao
VOICE_OPTIONS = [
    {
        "id": "vi-VN-HoaiMyNeural",
        "name": "Hoài My (Nữ - Truyền cảm)",
        "gender": "female",
        "badge": "Chuẩn MC",
        "provider": "edge-tts"
    },
    {
        "id": "vi-VN-NamMinhNeural",
        "name": "Nam Minh (Nam - Trầm ấm)",
        "gender": "male",
        "badge": "Thời sự",
        "provider": "edge-tts"
    },
    {
        "id": "google-vi",
        "name": "Google Nữ (Cơ bản)",
        "gender": "female",
        "badge": "Google",
        "provider": "google-tts"
    }
]

DEFAULT_VOICE = "vi-VN-HoaiMyNeural"

VI_STOPWORDS = {
    'và', 'của', 'là', 'các', 'những', 'được', 'trong', 'người', 'ngày', 'cho',
    'với', 'có', 'về', 'đã', 'đang', 'sẽ', 'tại', 'theo', 'nhiều', 'này',
    'đến', 'từ', 'không', 'một', 'ra', 'khi', 'sau', 'lại', 'làm', 'như', 'năm'
}

EN_STOPWORDS = {
    'the', 'of', 'and', 'to', 'in', 'is', 'that', 'for', 'it', 'as', 'was',
    'with', 'on', 'at', 'by', 'from', 'this', 'are', 'be', 'has', 'have',
    'had', 'an', 'which', 'will', 'about', 'can', 'their', 'more', 'how', 'why',
    'after', 'years', 'space', 'border', 'new', 'what', 'who', 'where'
}

def is_english_text(text: str) -> bool:
    """Xác định chính xác văn bản có phải tiếng Anh hay không"""
    if not text:
        return False
    # Kiểm tra các ký tự có dấu thanh đặc trưng tiếng Việt
    vi_special_chars = sum(1 for c in text.lower() if c in "ơưấầẩẫậắằẳẵặếềểễệốồổỗộớờởỡợứừửữựđ")
    if vi_special_chars >= 2:
        return False

    words = [re.sub(r'[^a-zA-Z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]', '', w.lower()) for w in text.split()]
    words = [w for w in words if len(w) > 1]
    if not words:
        return False

    en_matches = sum(1 for w in words if w in EN_STOPWORDS)
    vi_matches = sum(1 for w in words if w in VI_STOPWORDS)

    if en_matches >= 2 and vi_matches <= 1:
        return True
    if en_matches > vi_matches and vi_special_chars == 0:
        return True
    return False

async def translate_to_vietnamese(text: str, client: httpx.AsyncClient) -> str:
    """Dịch tiêu đề hoặc nội dung tiếng Anh sang Tiếng Việt chuẩn xác 100%"""
    if not text or not is_english_text(text):
        return text

    try:
        url = "https://translate.googleapis.com/translate_a/single"
        params = {
            "client": "gtx",
            "sl": "auto",
            "tl": "vi",
            "dt": "t",
            "q": text[:3500]
        }
        res = await client.get(url, params=params, timeout=8.0)
        if res.status_code == 200:
            data = res.json()
            translated = "".join([part[0] for part in data[0] if part and part[0]])
            if translated and not is_english_text(translated):
                return translated.strip()
    except Exception as e:
        logger.warning(f"Error translating text: {e}")
    return text

def split_text_for_tts(text: str, max_length: int = 170) -> List[str]:
    """Tách văn bản thành các đoạn ngắn tự nhiên để gửi tới TTS API (cho Google TTS fallback)"""
    clean = re.sub(r'\s+', ' ', text).strip()
    if not clean:
        return []

    sentences = re.split(r'([.!?;:\n]+)', clean)
    chunks = []
    current = ""

    for s in sentences:
        if not s:
            continue
        if len(current) + len(s) <= max_length:
            current += s
        else:
            if current.strip():
                chunks.append(current.strip())
            if len(s) > max_length:
                sub_parts = re.split(r'([,]+)', s)
                sub_curr = ""
                for sp in sub_parts:
                    if len(sub_curr) + len(sp) <= max_length:
                        sub_curr += sp
                    else:
                        if sub_curr.strip():
                            chunks.append(sub_curr.strip())
                        sub_curr = sp
                if sub_curr.strip():
                    current = sub_curr
                else:
                    current = ""
            else:
                current = s

    if current.strip():
        chunks.append(current.strip())

    return [c for c in chunks if len(c.strip()) > 0]

async def fetch_google_tts_chunk(chunk: str, client: httpx.AsyncClient) -> bytes:
    url = "https://translate.google.com/translate_tts"
    params = {
        "ie": "UTF-8",
        "tl": "vi",
        "client": "tw-ob",
        "q": chunk
    }
    for attempt in range(2):
        try:
            res = await client.get(url, params=params, headers=HEADERS, timeout=6.0)
            if res.status_code == 200 and len(res.content) > 100:
                return res.content
        except Exception:
            pass
        if attempt == 0:
            await asyncio.sleep(0.2)
    return b""

async def synthesize_speech(script: str, voice: str, client: httpx.AsyncClient) -> bytes:
    """
    Sinh file âm thanh chất lượng cao:
    - Ưu tiên Microsoft Edge Neural TTS (vi-VN-HoaiMyNeural hoặc vi-VN-NamMinhNeural)
    - Tự động fallback sang Google TTS nếu có bất kỳ sự cố mạng nào
    """
    clean_script = script.strip()
    if not clean_script:
        return b""

    # 1. Thử phát giọng đọc Microsoft Edge Neural
    if voice in ("vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"):
        try:
            import edge_tts
            communicate = edge_tts.Communicate(clean_script, voice)
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])
            if len(audio_data) > 500:
                return bytes(audio_data)
        except Exception as e:
            logger.warning(f"Edge TTS ({voice}) lỗi hoặc timeout, chuyển sang Google TTS: {e}")

    # 2. Fallback sang Google TTS chunks
    chunks = split_text_for_tts(clean_script)
    if not chunks:
        chunks = [clean_script]

    tasks = [fetch_google_tts_chunk(c, client) for c in chunks]
    results = await asyncio.gather(*tasks)

    merged_audio = bytearray()
    for r in results:
        if r:
            merged_audio.extend(r)

    return bytes(merged_audio)

@router.get("/voices")
async def get_available_voices():
    """Lấy danh sách các giọng đọc Tiếng Việt có sẵn"""
    return VOICE_OPTIONS

@router.get("/article/{article_id}")
async def get_article_speech(
    article_id: int,
    rank: Optional[int] = Query(None, description="Thứ tự tin (ví dụ: Tin số 1)"),
    voice: Optional[str] = Query(DEFAULT_VOICE, description="Tùy chọn giọng đọc: vi-VN-HoaiMyNeural, vi-VN-NamMinhNeural, google-vi"),
    storage: JSONStorage = Depends(get_storage)
):
    """
    Sinh file âm thanh MP3 giọng Tiếng Việt tự nhiên 100%:
    - Đọc: Tin số X: Tiêu đề, Nội dung tóm tắt đầy đủ
    - Tự động dịch sang Tiếng Việt nếu là tin quốc tế
    - Tùy chọn giọng đọc Nam / Nữ theo sở thích
    - Lưu RAM & Disk cache phản hồi tức thì (< 0.01s)
    """
    valid_voice_ids = {v["id"] for v in VOICE_OPTIONS}
    selected_voice = voice if voice in valid_voice_ids else DEFAULT_VOICE

    cache_key = f"art_{article_id}_r_{rank}_{selected_voice}"
    
    # 1. Kiểm tra RAM cache
    if cache_key in AUDIO_CACHE:
        return Response(
            content=AUDIO_CACHE[cache_key],
            media_type="audio/mpeg",
            headers={"Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
        )

    # 2. Kiểm tra Disk Cache
    disk_file = AUDIO_CACHE_DIR / f"{cache_key}.mp3"
    if disk_file.exists():
        try:
            cached_bytes = disk_file.read_bytes()
            if len(cached_bytes) > 500:
                AUDIO_CACHE[cache_key] = cached_bytes
                return Response(
                    content=cached_bytes,
                    media_type="audio/mpeg",
                    headers={"Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
                )
        except Exception:
            pass

    art = storage.get_article_by_id(article_id)
    if not art:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    # 3. Lấy nội dung tóm tắt sẵn có trong JSON storage (đảm bảo câu hoàn chỉnh, không cụt ngủn)
    summary_text = (art.get("summary_short") or "").strip()
    
    # Nếu summary_text bị cắt cụt với dấu "...", kiểm tra content_raw hoặc xử lý câu hoàn chỉnh
    if not summary_text or summary_text.rstrip().endswith(("...", "…", "..")):
        content_raw = (art.get("content_raw") or "").strip()
        if content_raw and len(content_raw) > len(summary_text):
            raw_sents = [s.strip() for s in re.split(r'(?<=[.!?])\s+', content_raw) if len(s.strip()) > 25 and not s.strip().endswith(("...", "…", ".."))]
            if raw_sents:
                summary_text = " ".join(raw_sents[:3])
        
        # Nếu vẫn còn câu cụt dở dang ở cuối, loại bỏ vế cụt và chốt câu trọn vẹn
        if summary_text.rstrip().endswith(("...", "…", "..")):
            parts = [p.strip() for p in re.split(r'(?<=[.!?])\s+', summary_text) if len(p.strip()) > 15]
            complete_parts = [p for p in parts if not p.rstrip().endswith(("...", "…", ".."))]
            if complete_parts:
                summary_text = " ".join(complete_parts)
            else:
                summary_text = re.sub(r'[\s.…]+$', '', summary_text) + "."
    
    if not summary_text:
        summary_text = art.get("title", "")

    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        # Nếu vẫn còn sót bài tiếng Anh (tin quốc tế), dịch sang Tiếng Việt trước khi đọc
        title_vi = await translate_to_vietnamese(art.get("title", ""), client)
        summary_vi = await translate_to_vietnamese(summary_text, client)

        # Lời thoại tiếng Việt tự nhiên, liền mạch (bỏ 'Nguồn...', bỏ 'Tóm tắt:')
        title_clean = title_vi.strip().rstrip(".,;:!?")
        summary_clean = summary_vi.strip()

        # Loại bỏ các cụm từ thừa nếu có trong summary
        summary_clean = re.sub(r'^(tóm tắt|tóm tắt bài viết|tóm tắt nội dung)[\s:]+', '', summary_clean, flags=re.IGNORECASE).strip()
        summary_clean = re.sub(r'^(nguồn|nguồn báo)[\s:]+[^,.]+[.,\s]+', '', summary_clean, flags=re.IGNORECASE).strip()

        # Đảm bảo câu tóm tắt súc tích, mạch lạc (tối đa 2-3 câu trọn vẹn, không quá dài)
        sents = [s.strip() for s in re.split(r'(?<=[.!?])\s+', summary_clean) if len(s.strip()) > 15]
        if len(sents) > 3:
            summary_clean = " ".join(sents[:3])

        if rank:
            if summary_clean and summary_clean != title_clean:
                full_script = f"Tin số {rank}: {title_clean}, {summary_clean}"
            else:
                full_script = f"Tin số {rank}: {title_clean}."
        else:
            if summary_clean and summary_clean != title_clean:
                full_script = f"{title_clean}, {summary_clean}"
            else:
                full_script = f"{title_clean}."

        # Nếu dùng giọng Neural (Hoài My hoặc Nam Minh), stream trực tiếp xuống client để phát ngay lập tức
        if selected_voice in ("vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"):
            try:
                import edge_tts
                communicate = edge_tts.Communicate(full_script, selected_voice)

                async def audio_streamer():
                    accumulated = bytearray()
                    try:
                        async for chunk in communicate.stream():
                            if chunk["type"] == "audio":
                                data = chunk["data"]
                                accumulated.extend(data)
                                yield data
                        if len(accumulated) > 500:
                            final = bytes(accumulated)
                            AUDIO_CACHE[cache_key] = final
                            try:
                                disk_file.write_bytes(final)
                            except Exception:
                                pass
                    except Exception as err:
                        logger.warning(f"Lỗi khi stream audio: {err}")

                return StreamingResponse(
                    audio_streamer(),
                    media_type="audio/mpeg",
                    headers={
                        "Content-Type": "audio/mpeg",
                        "Accept-Ranges": "bytes",
                        "Cache-Control": "public, max-age=86400"
                    }
                )
            except Exception as e:
                logger.warning(f"Edge TTS stream error: {e}")

        final_bytes = await synthesize_speech(full_script, selected_voice, client)

        if not final_bytes or len(final_bytes) < 300:
            raise HTTPException(status_code=500, detail="Không thể tạo âm thanh Tiếng Việt")

        # Lưu RAM và Disk Cache
        if len(AUDIO_CACHE) > 300:
            AUDIO_CACHE.clear()
        AUDIO_CACHE[cache_key] = final_bytes
        try:
            disk_file.write_bytes(final_bytes)
        except Exception:
            pass

        return Response(
            content=final_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Type": "audio/mpeg",
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400"
            }
        )

@router.get("/deep-analysis/{article_id}")
async def get_deep_analysis_speech(
    article_id: int,
    voice: Optional[str] = Query(DEFAULT_VOICE, description="Tùy chọn giọng đọc"),
    storage: JSONStorage = Depends(get_storage)
):
    """
    Sinh file âm thanh MP3 giọng Tiếng Việt tự nhiên 100% cho bản phân tích chuyên sâu đa chiều:
    - Bối cảnh gốc rễ
    - Bản chất sự việc & động cơ
    - Tác động ngắn hạn & dài hạn
    - Lời khuyên hành động
    """
    valid_voice_ids = {v["id"] for v in VOICE_OPTIONS}
    selected_voice = voice if voice in valid_voice_ids else DEFAULT_VOICE

    cache_key = f"deep_speech_{article_id}_{selected_voice}"
    if cache_key in AUDIO_CACHE:
        return Response(
            content=AUDIO_CACHE[cache_key],
            media_type="audio/mpeg",
            headers={"Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
        )

    disk_file = AUDIO_CACHE_DIR / f"{cache_key}.mp3"
    if disk_file.exists():
        try:
            cached_bytes = disk_file.read_bytes()
            if len(cached_bytes) > 500:
                AUDIO_CACHE[cache_key] = cached_bytes
                return Response(
                    content=cached_bytes,
                    media_type="audio/mpeg",
                    headers={"Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
                )
        except Exception:
            pass

    art = storage.get_article_by_id(article_id)
    if not art:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    analysis_data = None
    if art.get("deep_analysis"):
        try:
            analysis_data = json.loads(art["deep_analysis"])
        except Exception:
            pass

    if not analysis_data:
        from app.services.deep_analyzer import analyze_article_deeply
        analysis_data = await analyze_article_deeply(article_id, storage)

    overview = analysis_data.get("overview", "")
    deep_text = analysis_data.get("deep_analysis", "")
    impacts = analysis_data.get("impacts", {})
    short_term = impacts.get("short_term", "") if isinstance(impacts, dict) else ""
    long_term = impacts.get("long_term", "") if isinstance(impacts, dict) else ""
    takeaway = analysis_data.get("actionable_takeaway", "")

    title = art.get("title", "")
    script_parts = [
        f"Bản phân tích chuyên sâu sự kiện: {title}.",
        f"Tổng quan bối cảnh: {overview}.",
        f"Bản chất cốt lõi: {deep_text}.",
    ]
    if short_term:
        script_parts.append(f"Tác động trước mắt: {short_term}.")
    if long_term:
        script_parts.append(f"Chiến lược dài hạn: {long_term}.")
    if takeaway:
        script_parts.append(f"Kết luận hành động: {takeaway}.")

    full_script = " ".join(script_parts)

    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        full_script_vi = await translate_to_vietnamese(full_script, client)

        final_bytes = await synthesize_speech(full_script_vi, selected_voice, client)

        if not final_bytes or len(final_bytes) < 300:
            raise HTTPException(status_code=500, detail="Không thể tạo âm thanh Tiếng Việt cho bản phân tích")

        if len(AUDIO_CACHE) > 200:
            AUDIO_CACHE.clear()
        AUDIO_CACHE[cache_key] = final_bytes
        try:
            disk_file.write_bytes(final_bytes)
        except Exception:
            pass

        return Response(
            content=final_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Type": "audio/mpeg",
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400"
            }
        )
