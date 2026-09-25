import json
import logging
import re
from typing import Dict, Any, List, Optional
import httpx

from app.core.storage import JSONStorage, storage as default_storage, is_tech_article
from app.services.ai_processor import gemini_client, clean_sentence_dots, split_sentences

logger = logging.getLogger("tech_enricher")

def clean_no_url(text: str) -> str:
    """Lọc sạch mọi URL hoặc link rác khỏi văn bản"""
    if not text:
        return ""
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    text = re.sub(r'\b(url bài viết|url bình luận|bình luận|nguồn bài)\s*:\s*', '', text, flags=re.IGNORECASE)
    return text.strip()

def gather_tech_related_sources(storage: JSONStorage, article: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Thu thập tất cả các bài viết cùng sự kiện hoặc cùng chủ đề công nghệ từ các nguồn khác"""
    art_id = article.get("id")
    cluster_id = article.get("cluster_id")
    seen_ids = {art_id}
    related = []

    # 1. Các bài cùng StoryCluster
    if cluster_id:
        cluster_articles = storage.get_cluster_articles(cluster_id, exclude_article_id=art_id)
        for rel in cluster_articles:
            r_id = rel.get("id")
            if r_id not in seen_ids:
                seen_ids.add(r_id)
                related.append(rel)

    # 2. Tìm thêm bài công nghệ có cùng từ khóa chủ đạo
    title = article.get("title", "")
    key_terms = re.findall(r'\b[A-Za-z0-9\-]{3,}\b', title)
    tech_keywords = [w.lower() for w in key_terms if w.lower() not in ["cho", "trong", "tren", "nhung", "theo", "voi", "viet", "nam", "the", "and", "for", "with"]]

    if len(related) < 3 and tech_keywords:
        with storage.lock:
            for a in storage.articles:
                if a.get("id") in seen_ids or not is_tech_article(a):
                    continue
                a_title = a.get("title", "").lower()
                matches = sum(1 for kw in tech_keywords if kw in a_title)
                if matches >= 2 or (len(tech_keywords) == 1 and tech_keywords[0] in a_title):
                    seen_ids.add(a["id"])
                    related.append(a)
                if len(related) >= 4:
                    break

    return related

async def synthesize_tech_explanation_nlp(
    article: Dict[str, Any], 
    related: List[Dict[str, Any]], 
    client: Optional[httpx.AsyncClient] = None
) -> str:
    """Tổng hợp phân tích sâu đa nguồn bằng NLP nội bộ, đảm bảo 100% tiếng Việt chuẩn"""
    from app.api.tts import translate_to_vietnamese, needs_vi_translation

    title = clean_no_url(article.get("title", ""))
    primary_text = clean_no_url(article.get("summary_short") or article.get("content_raw") or title)
    primary_sents = split_sentences(primary_text)

    should_close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=8.0)
        should_close_client = True

    selected_sents = []
    try:
        if primary_sents:
            for s in primary_sents[:2]:
                s_c = clean_no_url(s)
                if needs_vi_translation(s_c):
                    s_c = await translate_to_vietnamese(s_c, client)
                if s_c:
                    selected_sents.append(s_c)
        else:
            t_c = title
            if needs_vi_translation(t_c):
                t_c = await translate_to_vietnamese(t_c, client)
            if t_c:
                selected_sents.append(t_c)

        # Lấy thông tin bổ sung từ các nguồn đối chiếu
        for rel in related[:2]:
            r_text = clean_no_url(rel.get("summary_short") or rel.get("title", ""))
            r_sents = split_sentences(r_text)
            for s in r_sents:
                s_clean = clean_no_url(s)
                if len(s_clean) > 35 and not any(s_clean in ex or ex in s_clean for ex in selected_sents):
                    # BẮT BUỘC: Dịch sang tiếng Việt nếu câu đối chiếu chứa tiếng Anh
                    if needs_vi_translation(s_clean):
                        s_clean = await translate_to_vietnamese(s_clean, client)
                    if s_clean and not needs_vi_translation(s_clean):
                        src_name = rel.get('source_name', 'nguồn đối chiếu')
                        selected_sents.append(f"Theo {src_name}, {s_clean[0].lower() + s_clean[1:] if s_clean else s_clean}")
                        break
            if len(selected_sents) >= 4:
                break
    finally:
        if should_close_client:
            await client.aclose()

    cleaned = [clean_sentence_dots(s) for s in selected_sents if len(s.strip()) > 15]
    return " ".join(cleaned)

async def enrich_tech_article_deeply(
    article: Dict[str, Any], 
    storage: Optional[JSONStorage] = None, 
    client: Optional[httpx.AsyncClient] = None
) -> Dict[str, Any]:
    """Phân tích sâu và tổng hợp đa nguồn cho bài viết công nghệ, đảm bảo 100% tiếng Việt"""
    st = storage or default_storage
    if not is_tech_article(article):
        return article

    from app.api.tts import translate_to_vietnamese, needs_vi_translation

    updates = {}
    should_close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=8.0)
        should_close_client = True

    try:
        # Dịch tiêu đề nếu còn chứa tiếng Anh
        title_raw = article.get("title", "")
        if needs_vi_translation(title_raw):
            title_vi = await translate_to_vietnamese(title_raw, client)
            if title_vi and title_vi != title_raw:
                updates["title"] = title_vi
                article["title"] = title_vi

        related = gather_tech_related_sources(st, article)
        if related:
            enriched_summary = await synthesize_tech_explanation_nlp(article, related, client)
            if enriched_summary:
                sents = split_sentences(enriched_summary)
                bullets = [clean_sentence_dots(s) for s in sents[:3]]
                updates["summary_short"] = enriched_summary
                updates["summary_bullets"] = json.dumps(bullets, ensure_ascii=False)
                updates["is_tech_enriched"] = True
                article["summary_short"] = enriched_summary
                article["summary_bullets"] = json.dumps(bullets, ensure_ascii=False)
                article["is_tech_enriched"] = True
    finally:
        if should_close_client:
            await client.aclose()

    if updates:
        st.update_article(article["id"], updates)

    return article
