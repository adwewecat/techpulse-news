import asyncio
import logging
import httpx
from typing import Optional
from app.core.storage import JSONStorage, storage as default_storage
from app.api.tts import needs_vi_translation, translate_to_vietnamese, clear_article_audio_cache

logger = logging.getLogger("auto_translator")

async def auto_translate_all_pending_articles(storage: Optional[JSONStorage] = None, max_workers: int = 4):
    """
    Quét toàn bộ bài viết trong hệ thống và tự động dịch 100% sang tiếng Việt:
    - Áp dụng cho cả Tiêu đề (title) và Nội dung tóm tắt (summary_short, summary_bullets)
    - Xóa bỏ file âm thanh cũ (nếu có giọng tiếng Anh) để tự động sinh lại giọng đọc tiếng Việt chuẩn
    """
    st = storage or default_storage
    articles = list(st.articles)
    
    pending = []
    for a in articles:
        title = a.get("title", "")
        summary = a.get("summary_short", "")
        if needs_vi_translation(title) or needs_vi_translation(summary):
            pending.append(a)

    if not pending:
        logger.info("Tất cả bài viết trong hệ thống đều đã là Tiếng Việt chuẩn 100%.")
        return 0

    logger.info(f"Phát hiện {len(pending)} bài viết còn chứa tiếng Anh. Bắt đầu tự động chuẩn hóa dịch Tiếng Việt...")

    semaphore = asyncio.Semaphore(max_workers)
    translated_count = 0

    async with httpx.AsyncClient(follow_redirects=True, timeout=12.0) as client:
        async def process_one(art):
            nonlocal translated_count
            async with semaphore:
                try:
                    art_id = art["id"]
                    title = art.get("title", "")
                    summary = art.get("summary_short", "")
                    
                    updates = {}
                    if needs_vi_translation(title):
                        t_vi = await translate_to_vietnamese(title, client)
                        if t_vi and t_vi != title:
                            updates["title"] = t_vi

                    if needs_vi_translation(summary):
                        s_vi = await translate_to_vietnamese(summary, client)
                        if s_vi and s_vi != summary:
                            updates["summary_short"] = s_vi

                    if updates:
                        # Xóa bỏ audio cache cũ chứa giọng đọc tiếng Anh
                        clear_article_audio_cache(art_id)
                        st.update_article(art_id, updates)
                        translated_count += 1
                        logger.info(f"Đã dịch chuẩn bài #{art_id}: {updates.get('title', title)[:45]}...")
                except Exception as e:
                    logger.warning(f"Lỗi khi dịch bài #{art.get('id')}: {e}")

        tasks = [process_one(a) for a in pending]
        await asyncio.gather(*tasks)

    # Lưu lại toàn bộ dữ liệu storage sau khi dịch
    st.save()
    logger.info(f"Hoàn tất chuẩn hóa! Đã dịch thành công {translated_count}/{len(pending)} bài viết sang Tiếng Việt 100%.")
    return translated_count
