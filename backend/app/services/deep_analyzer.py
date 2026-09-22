import json
import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
import httpx
from bs4 import BeautifulSoup

from app.core.storage import JSONStorage, storage as default_storage, parse_dt
from app.services.ai_processor import gemini_client
from app.services.collector import fetch_article_body_text, HEADERS

logger = logging.getLogger("deep_analyzer")

async def gather_related_sources_data(storage: JSONStorage, article: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Tìm kiếm tất cả các nguồn đưa tin liên quan trong hệ thống:
    1. Các bài cùng cụm sự kiện (StoryCluster)
    2. Các bài cùng chủ đề/từ khóa từ các nguồn khác
    """
    related_list = []
    art_id = article.get("id")
    seen_ids = {art_id}

    # 1. Các bài cùng cluster
    cluster_id = article.get("cluster_id")
    if cluster_id:
        cluster_articles = storage.get_cluster_articles(cluster_id, exclude_article_id=art_id)
        for rel in cluster_articles:
            r_id = rel.get("id")
            if r_id not in seen_ids:
                seen_ids.add(r_id)
                related_list.append({
                    "id": r_id,
                    "title": rel.get("title", ""),
                    "source_name": rel.get("source_name", ""),
                    "source_domain": rel.get("source_domain", ""),
                    "summary": rel.get("summary_short") or rel.get("content_raw") or "",
                    "url": rel.get("url", ""),
                    "published_at": rel.get("published_at")
                })

    # 2. Nếu ít hơn 2 nguồn đối chiếu, tìm thêm bài viết có tiêu đề tương đồng trong 7 ngày
    if len(related_list) < 2:
        words = [w for w in re.findall(r'\w+', article.get("title", "")) if len(w) > 3]
        if words:
            top_words = sorted(words, key=len, reverse=True)[:2]
            candidates = []
            with storage.lock:
                for a in storage.articles:
                    if a.get("id") in seen_ids:
                        continue
                    if a.get("source_domain") == article.get("source_domain"):
                        continue
                    t = a.get("title", "").lower()
                    if any(w.lower() in t for w in top_words):
                        candidates.append(a)

            candidates.sort(key=lambda x: parse_dt(x.get("published_at")), reverse=True)
            for extra in candidates[:3]:
                e_id = extra.get("id")
                if e_id not in seen_ids:
                    seen_ids.add(e_id)
                    related_list.append({
                        "id": e_id,
                        "title": extra.get("title", ""),
                        "source_name": extra.get("source_name", ""),
                        "source_domain": extra.get("source_domain", ""),
                        "summary": extra.get("summary_short") or extra.get("content_raw") or "",
                        "url": extra.get("url", ""),
                        "published_at": extra.get("published_at")
                    })

    return related_list

def generate_fallback_deep_analysis(article: Dict[str, Any], related: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Bản phân tích dự phòng giàu ngữ cảnh khi không có API LLM hoặc quota bận"""
    perspectives = [
        {
            "source": article.get("source_name", ""),
            "perspective": f"Nhấn mạnh vào diễn biến trực tiếp: {article.get('title', '')}"
        }
    ]
    for r in related[:3]:
        perspectives.append({
            "source": r["source_name"],
            "perspective": f"Bổ sung góc nhìn liên quan: {r['title']}"
        })

    bullets = []
    summary_bullets = article.get("summary_bullets")
    if summary_bullets:
        if isinstance(summary_bullets, list):
            bullets = summary_bullets
        else:
            try:
                bullets = json.loads(summary_bullets)
            except Exception:
                bullets = [article.get("summary_short") or article.get("title", "")]
    if not bullets:
        bullets = [article.get("summary_short") or article.get("title", "")]

    overview_text = article.get("summary_short") or ""
    content_raw = article.get("content_raw", "")
    if content_raw and len(content_raw) > 250:
        paras = [p.strip() for p in content_raw.split("\n") if len(p.strip()) > 50]
        if len(paras) >= 2:
            key_paras = [p for p in paras if any(k in p.lower() for k in ["nguy cơ", "từ chức", "bước ngoặt", "kêu gọi", "phản đối", "openai", "anthropic", "google", "microsoft", "apple", "nvidia", "trump"])]
            if key_paras:
                overview_text = " ".join(key_paras[:3])
            else:
                overview_text = " ".join(paras[:3])
    if not overview_text:
        overview_text = f"Sự kiện {article.get('title', '')} đang thu hút sự chú ý đặc biệt từ giới công nghệ và truyền thông quốc tế."

    return {
        "overview": overview_text,
        "key_facts": bullets[:4],
        "multi_source_perspectives": perspectives,
        "deep_analysis": (
            f"Sự việc được đưa tin bởi {article.get('source_name', '')} phản ánh xu thế biến chuyển nhanh chóng trong lĩnh vực {article.get('category', '')}. "
            f"Việc có {max(1, len(related) + 1)} cơ quan truyền thông cùng theo dõi và đưa tin cho thấy tầm ảnh hưởng đáng kể đối với thị trường và cộng đồng độc giả quan tâm."
        ),
        "impacts": {
            "short_term": "Tác động tức thì đến nhận thức người dùng và điều chỉnh chiến lược ngắn hạn của các tổ chức liên quan.",
            "long_term": "Góp phần định hình xu hướng phát triển và tiêu chuẩn cạnh tranh mới trong ngành."
        },
        "unanswered_questions": [
            "Các bên liên quan sẽ đưa ra phản hồi chính thức hoặc lộ trình tiếp theo như thế nào?",
            "Mức độ ảnh hưởng thực tế tới người tiêu dùng Việt Nam và thị trường quốc tế?"
        ],
        "actionable_takeaway": "Cần tiếp tục theo dõi sát sao các cập nhật tiếp theo từ các nguồn báo chính thống để có cái nhìn đa chiều và ra quyết định chính xác."
    }

async def analyze_article_deeply(
    article_id: int, 
    storage: Optional[JSONStorage] = None, 
    force_refresh: bool = False
) -> Dict[str, Any]:
    """
    Sinh báo cáo phân tích chuyên sâu đa nguồn & bối cảnh toàn diện
    """
    st = storage or default_storage
    article = st.get_article_by_id(article_id)
    if not article:
        raise ValueError("Không tìm thấy bài viết")

    # 1. Trả về ngay nếu đã có phân tích sẵn trong cache DB
    if article.get("deep_analysis") and not force_refresh:
        try:
            cached_data = json.loads(article["deep_analysis"])
            related_items = await gather_related_sources_data(st, article)
            cached_data["related_articles"] = related_items
            cached_data["article_id"] = article["id"]
            cached_data["title"] = article.get("title", "")
            cached_data["source_name"] = article.get("source_name", "")
            cached_data["url"] = article.get("url", "")
            cached_data["generated_at"] = article.get("deep_analysis_updated_at") or article.get("created_at")
            return cached_data
        except Exception as e:
            logger.warning(f"Lỗi parse deep_analysis cache: {e}")

    # 2. Đảm bảo có nội dung bài viết chi tiết
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        content_raw = article.get("content_raw") or ""
        if len(content_raw) < 250:
            scraped = await fetch_article_body_text(article["url"], client)
            if scraped and len(scraped) > len(content_raw):
                st.update_article(article["id"], {"content_raw": scraped})
                article["content_raw"] = scraped

        # 3. Thu thập các nguồn đối chiếu
        related_sources = await gather_related_sources_data(st, article)

    # 4. Chuẩn bị dữ liệu gửi tới Gemini Flash
    related_text_parts = []
    for idx, r in enumerate(related_sources[:4], 1):
        related_text_parts.append(f"[{idx}] Nguồn: {r['source_name']}\nTiêu đề: {r['title']}\nTóm tắt: {r['summary'][:400]}")
    related_text_block = "\n\n".join(related_text_parts) if related_text_parts else "Chưa có thêm nguồn báo đối chiếu khác trong hệ thống."

    full_body = (article.get("content_raw") or article.get("summary_short") or article.get("title", ""))[:3000]

    prompt = f"""Bạn là một chuyên gia phân tích chiến lược, công nghệ và truyền thông quốc tế cấp cao.
Hãy đọc kỹ bài viết được độc giả ĐÁNH DẤU SAO QUAN TÂM sau đây cùng các nguồn báo chí đối chiếu để thực hiện một bản PHÂN TÍCH CHUYÊN SÂU ĐA CHIỀU (Deep-dive Multi-Source Intelligence Brief):

[BÀI VIẾT CHÍNH]:
- Tiêu đề: {article.get('title')}
- Nguồn: {article.get('source_name')}
- Chuyên mục: {article.get('category')} | Khu vực: {article.get('region')}
- Nội dung chi tiết:
{full_body}

[CÁC NGUỒN BÁO CHÍ ĐỐI CHIẾU]:
{related_text_block}

YÊU CẦU ĐỊNH DẠNG:
Trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm Markdown code block ```json ... ```) theo cấu trúc chuẩn xác:
{{
  "overview": "Tóm tắt chuyên sâu đa nguồn và giải thích cặn kẽ bản chất sự việc, bối cảnh lịch sử, nguyên nhân gốc rễ và bước ngoặt sự kiện (đặc biệt giải thích rõ vì sao có mốc thời gian chấn động, nguy cơ bắt đầu từ đâu và xung đột giữa các bên) (3-4 câu tiếng Việt sắc bén, chuẩn xác, đầy đủ thông tin nhất)",
  "key_facts": [
    "Sự kiện hoặc số liệu định lượng cốt lõi 1",
    "Sự kiện hoặc số liệu định lượng cốt lõi 2",
    "Sự kiện hoặc số liệu định lượng cốt lõi 3",
    "Sự kiện hoặc số liệu định lượng cốt lõi 4"
  ],
  "multi_source_perspectives": [
    {{
      "source": "{article.get('source_name')}",
      "perspective": "Góc nhìn hoặc trọng tâm mà nguồn này tập trung nhấn mạnh"
    }}
  ],
  "deep_analysis": "Phân tích bản chất sâu xa: Động cơ các bên liên quan, tác động cấu trúc công nghệ/kinh tế, xung đột lợi ích nếu có và điều cốt lõi ẩn sau tiêu đề truyền thông (200-350 từ)",
  "impacts": {{
    "short_term": "Tác động trước mắt trong ngắn hạn (người tiêu dùng, thị trường, giá cả, hoạt động doanh nghiệp...)",
    "long_term": "Tác động chiến lược dài hạn (xu thế công nghệ, chính sách pháp lý, thay đổi cấu trúc ngành...)"
  }},
  "unanswered_questions": [
    "Câu hỏi mở quan trọng 1 mà độc giả cần tiếp tục theo dõi trong thời gian tới",
    "Câu hỏi mở quan trọng 2"
  ],
  "actionable_takeaway": "Bài học đúc kết ngắn gọn và lời khuyên hành động dành cho độc giả / nhà phát triển / người quan tâm"
}}
"""

    analysis_result = None

    if gemini_client:
        models_to_try = ["gemini-3.6-flash", "gemini-2.0-flash", "gemini-flash-latest"]
        for m_name in models_to_try:
            try:
                logger.info(f"Đang sinh phân tích chuyên sâu bài #{article['id']} bằng {m_name}...")
                response = gemini_client.models.generate_content(
                    model=m_name,
                    contents=prompt,
                )
                raw_text = (response.text or "").strip()
                if raw_text.startswith("```"):
                    raw_text = re.sub(r"^```[a-zA-Z]*\n", "", raw_text)
                    raw_text = re.sub(r"\n```$", "", raw_text).strip()

                parsed = json.loads(raw_text)
                if isinstance(parsed, dict) and "overview" in parsed:
                    analysis_result = parsed
                    logger.info(f"Thành công sinh phân tích chuyên sâu bài #{article['id']} bằng model {m_name}")
                    break
            except Exception as e:
                logger.warning(f"Lỗi khi gọi model {m_name} cho bài #{article['id']}: {e}")

    if not analysis_result:
        analysis_result = generate_fallback_deep_analysis(article, related_sources)

    now_iso = datetime.utcnow().isoformat()
    st.update_article(article["id"], {
        "deep_analysis": json.dumps(analysis_result, ensure_ascii=False),
        "deep_analysis_updated_at": now_iso
    })

    analysis_result["article_id"] = article["id"]
    analysis_result["title"] = article.get("title", "")
    analysis_result["source_name"] = article.get("source_name", "")
    analysis_result["url"] = article.get("url", "")
    analysis_result["related_articles"] = related_sources
    analysis_result["generated_at"] = now_iso

    return analysis_result
