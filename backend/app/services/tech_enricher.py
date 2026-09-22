import json
import logging
import re
from typing import Dict, Any, List, Optional
import httpx

from app.core.storage import JSONStorage, storage as default_storage, is_tech_article
from app.services.ai_processor import gemini_client, clean_sentence_dots, split_sentences

logger = logging.getLogger("tech_enricher")

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

    # 2. Tìm thêm bài công nghệ có cùng từ khóa chủ đạo (Apple, iPhone, Nvidia, OpenAI, AI, Samsung, Chip, Viettel,...)
    title = article.get("title", "")
    key_terms = re.findall(r'\b[A-Za-z0-9\-]{3,}\b', title)
    tech_keywords = [w.lower() for w in key_terms if w.lower() not in ["cho", "trong", "tren", "nhung", "theo", "voi", "viet", "nam", "the", "and", "for", "with"]]

    if len(related) < 3 and tech_keywords:
        with storage.lock:
            for a in storage.articles:
                if a.get("id") in seen_ids or not is_tech_article(a):
                    continue
                a_title = a.get("title", "").lower()
                # Kiểm tra trùng khớp từ khóa
                matches = sum(1 for kw in tech_keywords if kw in a_title)
                if matches >= 2 or (len(tech_keywords) == 1 and tech_keywords[0] in a_title):
                    seen_ids.add(a["id"])
                    related.append(a)
                if len(related) >= 4:
                    break

    return related

def synthesize_tech_explanation_nlp(article: Dict[str, Any], related: List[Dict[str, Any]]) -> str:
    """Tổng hợp phân tích sâu đa nguồn bằng NLP nội bộ khi không dùng LLM"""
    title = article.get("title", "")
    primary_text = article.get("content_raw") or article.get("summary_short") or title
    primary_sents = split_sentences(primary_text)
    
    selected_sents = []
    # Lấy 1-2 câu cốt lõi từ bài chính
    if primary_sents:
        selected_sents.extend(primary_sents[:2])
    else:
        selected_sents.append(title)

    # Lấy thông tin bổ sung từ các nguồn đối chiếu
    for rel in related[:2]:
        r_text = rel.get("content_raw") or rel.get("summary_short") or rel.get("title", "")
        r_sents = split_sentences(r_text)
        for s in r_sents:
            # Chọn câu chứa thông tin kỹ thuật, số liệu hoặc đánh giá mới
            if len(s) > 35 and not any(s in ex or ex in s for ex in selected_sents):
                selected_sents.append(f"Theo {rel.get('source_name', 'nguồn đối chiếu')}, {s[0].lower() + s[1:] if s else s}")
                break
        if len(selected_sents) >= 4:
            break

    # Đảm bảo các câu sạch sẽ, tròn câu
    cleaned = [clean_sentence_dots(s) for s in selected_sents]
    return " ".join(cleaned)

def synthesize_tech_explanation_gemini(article: Dict[str, Any], related: List[Dict[str, Any]]) -> Optional[str]:
    """Sử dụng Gemini để phân tích sâu, đối chiếu đa nguồn và giải thích cặn kẽ bản chất công nghệ"""
    if not gemini_client:
        return None

    title = article.get("title", "")
    main_body = (article.get("content_raw") or article.get("summary_short") or title)[:1800]
    
    related_blocks = []
    for idx, r in enumerate(related[:3], 1):
        r_text = (r.get("content_raw") or r.get("summary_short") or r.get("title", ""))[:600]
        related_blocks.append(f"[{idx}] Nguồn {r.get('source_name')}: {r.get('title')}\nNội dung: {r_text}")
    
    related_context = "\n\n".join(related_blocks) if related_blocks else "Không có nguồn đối chiếu khác."

    prompt = f"""Bạn là một chuyên gia phân tích công nghệ cao cấp. Hãy đọc tin tức công nghệ sau cùng các nguồn tin đối chiếu để viết một bản TÓM TẮT PHÂN TÍCH SÂU ĐA NGUỒN (khoảng 3 đến 4 câu văn hoàn chỉnh, mạch lạc bằng tiếng Việt):
1. Nêu rõ bản chất công nghệ/sản phẩm mới vừa được công bố hoặc diễn ra.
2. Giải thích sâu: Công nghệ này hoạt động ra sao, có đột phá gì về thông số/kỹ thuật so với trước đây.
3. Đối chiếu và tổng hợp thêm chi tiết từ các nguồn báo khác (nêu rõ góc nhìn nếu có).
4. Tác động thực tế và ý nghĩa đối với thị trường hoặc người dùng.

[BÀI VIẾT CHÍNH]:
Tiêu đề: {title}
Nguồn: {article.get('source_name')}
Nội dung: {main_body}

[CÁC NGUỒN ĐỐI CHIẾU]:
{related_context}

Yêu cầu:
- Trả về trực tiếp đoạn văn 3-4 câu tiếng Việt tự nhiên, không chèn tiêu đề [TÓM TẮT], không dùng gạch đầu dòng, không cắt cụt bằng dấu ba chấm.
"""
    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )
        res_text = (response.text or "").strip()
        if res_text and len(res_text) > 80:
            return clean_sentence_dots(res_text)
    except Exception as e:
        logger.warning(f"Lỗi gọi Gemini cho Tech Deep Enrichment: {e}")

    return None

def enrich_tech_article_deeply(article: Dict[str, Any], storage: Optional[JSONStorage] = None, use_gemini: bool = False) -> Dict[str, Any]:
    """Phân tích sâu và tổng hợp đa nguồn cho một bài viết công nghệ"""
    st = storage or default_storage
    if not is_tech_article(article):
        return article

    related = gather_tech_related_sources(st, article)
    
    enriched_summary = None
    if use_gemini:
        enriched_summary = synthesize_tech_explanation_gemini(article, related)
    
    if not enriched_summary:
        enriched_summary = synthesize_tech_explanation_nlp(article, related)

    if enriched_summary and len(enriched_summary) > len(article.get("summary_short", "")):
        sents = split_sentences(enriched_summary)
        bullets = [clean_sentence_dots(s) for s in sents[:3]]
        
        updates = {
            "summary_short": enriched_summary,
            "summary_bullets": json.dumps(bullets, ensure_ascii=False),
            "is_tech_enriched": True
        }
        st.update_article(article["id"], updates)
        article["summary_short"] = enriched_summary
        article["summary_bullets"] = json.dumps(bullets, ensure_ascii=False)
        article["is_tech_enriched"] = True

    return article
