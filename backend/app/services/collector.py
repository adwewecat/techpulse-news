import asyncio
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import urlparse

import httpx
import feedparser
from bs4 import BeautifulSoup
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.storage import storage, JSONStorage
from app.services.sources import NEWS_SOURCES, get_sources_for_mode
from app.services.ai_processor import process_article_ai
from app.services.deduplicator import find_duplicate_cluster
from app.services.hot_scoring import calculate_hot_score, recalculate_all_scores

logger = logging.getLogger("collector")
logging.basicConfig(level=logging.INFO)

scheduler = AsyncIOScheduler()
is_crawling_active = False

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*"
}

def clean_no_url(text: str) -> str:
    """Lọc sạch mọi URL, link web, và các nhãn rác khỏi văn bản"""
    if not text:
        return ""
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    text = re.sub(r'\b(url bài viết|url bình luận|xem chi tiết tại|link bài|nguồn bài|bình luận)\s*:\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\b\w+\.(?:html|php|asp|jsp|pdf)\b', '', text, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', text).strip()

def clean_html(raw_html: str) -> Tuple[str, Optional[str]]:
    """Loại bỏ HTML tags và rút trích URL hình ảnh đầu tiên nếu có"""
    if not raw_html:
        return "", None
    soup = BeautifulSoup(raw_html, "html.parser")
    
    img_url = None
    img_tag = soup.find("img")
    if img_tag and img_tag.get("src"):
        img_url = img_tag["src"]

    text = soup.get_text(separator=" ", strip=True)
    return clean_no_url(text), img_url

def parse_published_date(entry: Any) -> datetime:
    """Chuyển đổi ngày giờ RSS về UTC datetime chuẩn"""
    now = datetime.utcnow()
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6])
        if hasattr(entry, "updated_parsed") and entry.updated_parsed:
            return datetime(*entry.updated_parsed[:6])
    except Exception:
        pass
    return now

def extract_image_url(entry: Any, fallback_img: Optional[str] = None) -> Optional[str]:
    if hasattr(entry, "enclosures") and entry.enclosures:
        for enc in entry.enclosures:
            if enc.get("type", "").startswith("image/") or enc.get("href", "").endswith((".jpg", ".png", ".webp", ".jpeg")):
                return enc.get("href")

    if hasattr(entry, "media_content") and entry.media_content:
        for media in entry.media_content:
            if "url" in media:
                return media["url"]

    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        for thumb in entry.media_thumbnail:
            if "url" in thumb:
                return thumb["url"]

    return fallback_img

async def fetch_article_body_text(url: str, client: httpx.AsyncClient) -> str:
    """Cào nhanh các đoạn văn hoàn chỉnh bài báo nếu RSS chỉ có tóm tắt ngắn hoặc rác"""
    try:
        res = await client.get(url, headers=HEADERS, timeout=5.0)
        if res.status_code == 200:
            soup = BeautifulSoup(res.content, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "figure", "figcaption"]):
                tag.decompose()
            
            container = (
                soup.find(class_=lambda c: c and any(k in str(c) for k in ["xfBody", "thread-content", "bbWrapper"])) or
                soup.find(class_=re.compile(r"fck_detail|detail-content|content-detail|article-body|article__body|post-content|entry-content|story-body|detail__content|news-content|the-article-body", re.I)) or
                soup.find("article") or
                soup.find("main")
            )
            if not container:
                container = soup.body or soup

            raw_text = container.get_text(separator="\n", strip=True)
            clean_paras = []
            for line in raw_text.splitlines():
                line = clean_no_url(line.strip())
                if len(line) >= 30 and not any(skip in line.lower() for skip in [
                    "facebook.com", "quảng cáo", "báo xấu", "chia sẻ bài viết", 
                    "nguồn:", "bình luận", "theo dõi tin", "phản hồi:"
                ]):
                    if not any(line in existing or existing in line for existing in clean_paras):
                        clean_paras.append(line)
                if len(clean_paras) >= 5:
                    break
            
            if clean_paras:
                return " ".join(clean_paras)[:2500]
    except Exception:
        pass
    return ""

async def fetch_feed(client: httpx.AsyncClient, source: Dict[str, Any]) -> List[Dict[str, Any]]:
    try:
        response = await client.get(source["url"], headers=HEADERS, timeout=12.0)
        if response.status_code != 200:
            logger.warning(f"Failed to fetch {source['name']}: HTTP {response.status_code}")
            return []
        
        feed = feedparser.parse(response.content)
        parsed_items = []

        for entry in feed.entries[:15]:
            title = clean_no_url(getattr(entry, "title", "").strip())
            link = getattr(entry, "link", "").strip()
            if not title or not link or len(title) < 8:
                continue

            raw_summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
            summary_text, html_img = clean_html(raw_summary)
            image = extract_image_url(entry, html_img)
            pub_date = parse_published_date(entry)

            parsed_items.append({
                "title": title,
                "url": link,
                "summary": summary_text,
                "image_url": image,
                "published_at": pub_date,
                "source": source
            })

        return parsed_items
    except Exception as e:
        logger.error(f"Error fetching feed {source['name']} ({source['url']}): {e}")
        return []

async def pre_generate_audio_for_new_articles(articles: List[Dict[str, Any]], storage: JSONStorage):
    """
    Tự động tạo trước file âm thanh ngay sau khi quét tin:
    - Chạy nền song song với semaphore 3
    - Lưu sẵn vào disk cache (.mp3)
    - Người dùng bấm nghe là có ngay lập tức (0s đợi)
    """
    if not articles:
        return
    logger.info(f"Bắt đầu tự động tạo trước file âm thanh cho {len(articles)} tin tức mới...")
    from app.api.tts import synthesize_and_cache_article
    sem = asyncio.Semaphore(3)
    async with httpx.AsyncClient(timeout=15.0) as client:
        async def _synth(art, rank):
            async with sem:
                try:
                    await synthesize_and_cache_article(
                        article_id=art["id"],
                        rank=rank,
                        voice="vi-VN-HoaiMyNeural",
                        storage=storage,
                        client=client
                    )
                except Exception as err:
                    logger.warning(f"Lỗi tạo audio bài #{rank} (ID {art.get('id')}): {err}")

        tasks = [_synth(art, idx + 1) for idx, art in enumerate(articles[:25])]
        await asyncio.gather(*tasks, return_exceptions=True)
    logger.info("Hoàn tất tạo trước âm thanh cho các tin tức!")

async def run_crawl_cycle(storage_instance: Optional[JSONStorage] = None, mode: str = "all") -> Optional[Dict[str, Any]]:
    """
    Chu kỳ thu thập tin tức:
    - Hỗ trợ các chế độ quét:
      + ai_tech: Tin A.I & Công nghệ (tìm 20 tin hot nhất)
      + hot_vn: Tin tổng hợp hot Việt Nam (tìm 20 tin hot nhất)
      + hot_world: Tin tổng hợp hot quốc tế (tìm 20 tin hot nhất)
      + trending: Tin trending tổng hợp Việt Nam + Quốc tế (tìm 20 tin hot nhất)
      + all: Quét toàn bộ nguồn
    - Tự động loại bỏ nội dung rác/chỉ có link
    - Dịch 100% tiếng Việt cho tin nước ngoài
    - Ngay sau khi quét xong, lập tức tạo file âm thanh ngầm
    - Dọn dẹp tin tức quá 2 ngày (48 giờ)
    """
    global is_crawling_active
    if is_crawling_active:
        logger.info("Crawl cycle is already in progress. Skipping.")
        return None

    is_crawling_active = True
    st = storage_instance or storage
    sources_to_crawl = get_sources_for_mode(mode)

    log = st.add_crawl_log({
        "started_at": datetime.utcnow().isoformat(),
        "status": "running",
        "sources_crawled": 0,
        "articles_found": 0,
        "articles_new": 0,
        "mode": mode
    })

    try:
        logger.info(f"Bắt đầu chu kỳ quét tin tức (Chế độ: {mode}) từ {len(sources_to_crawl)} nguồn...")
        newly_saved_articles = []

        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, verify=False, timeout=12.0) as client:
            tasks = [fetch_feed(client, src) for src in sources_to_crawl]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            all_incoming = []
            for res in results:
                if isinstance(res, list):
                    all_incoming.extend(res)

            total_found = len(all_incoming)
            # Sắp xếp theo ngày xuất bản
            all_incoming.sort(key=lambda x: x["published_at"])

            for item in all_incoming:
                if st.exists_url(item["url"]):
                    continue

                src = item["source"]
                title = clean_no_url(item["title"])
                summary_raw = clean_no_url(item["summary"])

                # Nếu tóm tắt quá ngắn (< 60 ký tự) hoặc có dấu cắt cụt, cào bài báo gốc
                if len(summary_raw) < 80 or summary_raw.rstrip().endswith(("...", "…", "..", "---")):
                    body_extra = await fetch_article_body_text(item["url"], client)
                    if body_extra and len(body_extra) > len(summary_raw):
                        summary_raw = clean_no_url(body_extra)

                # LỌC BỎ NỘI DUNG RÁC: Nếu sau khi cào tóm tắt vẫn dưới 45 ký tự hoặc chỉ có link, bỏ qua bài viết
                if len(summary_raw) < 45 and len(title) < 20:
                    continue

                # Dịch sang Tiếng Việt 100% nếu là tin nước ngoài hoặc chứa tiếng Anh
                from app.api.tts import needs_vi_translation, translate_to_vietnamese
                is_world = src.get("region") == "world" or src.get("category") in ("tech_world", "hot_world")

                if is_world or needs_vi_translation(title):
                    title = await translate_to_vietnamese(title, client)

                if is_world or needs_vi_translation(summary_raw):
                    summary_raw = await translate_to_vietnamese(summary_raw, client)

                title = clean_no_url(title)
                summary_raw = clean_no_url(summary_raw)

                # Nếu sau khi dịch vẫn không có nội dung thực chất
                if len(summary_raw) < 30:
                    continue

                # 1. Pipeline AI: Lọc rác + Tóm tắt + Auto-tags
                is_spam, tldr, bullets, tags = process_article_ai(title, summary_raw)
                if is_spam:
                    continue

                tldr = clean_no_url(tldr)
                if is_world or needs_vi_translation(tldr):
                    tldr = await translate_to_vietnamese(tldr, client)
                    tldr = clean_no_url(tldr)

                clean_bullets = []
                for b in bullets:
                    b_clean = clean_no_url(b)
                    if is_world or needs_vi_translation(b_clean):
                        b_clean = await translate_to_vietnamese(b_clean, client)
                    if b_clean and len(b_clean) > 10:
                        clean_bullets.append(clean_no_url(b_clean))
                bullets = clean_bullets

                # 2. Detect trùng & Gom cụm Story
                cluster = find_duplicate_cluster(
                    storage=st,
                    title=title,
                    summary=summary_raw,
                    region=src["region"]
                )

                is_primary = True
                source_count = 1

                if cluster:
                    new_src_count = cluster.get("source_count", 1) + 1
                    st.update_cluster(cluster["id"], {
                        "source_count": new_src_count,
                        "last_seen_at": datetime.utcnow().isoformat()
                    })
                    source_count = new_src_count
                    is_primary = False
                    cluster_id = cluster["id"]
                else:
                    new_cluster = st.add_cluster({
                        "headline": title,
                        "region": src["region"],
                        "category": src["category"],
                        "source_count": 1,
                        "first_seen_at": item["published_at"].isoformat() if isinstance(item["published_at"], datetime) else item["published_at"],
                        "last_seen_at": datetime.utcnow().isoformat(),
                        "hot_score": 0.0,
                        "velocity_score": 0.0,
                        "badge": "new"
                    })
                    cluster_id = new_cluster["id"]
                    cluster = new_cluster

                # 3. Chấm độ nóng ban đầu
                is_ai = any("ai" in str(t).lower() or "trí tuệ nhân tạo" in str(t).lower() for t in tags) or src["category"] in ("tech_vn", "tech_world") or "ai" in src["id"]
                hot_sc, vel_sc, badge = calculate_hot_score(
                    source_count=source_count,
                    source_tier=src["tier"],
                    published_at=item["published_at"],
                    is_ai_tech=is_ai
                )

                # 4. Lưu bài viết vào JSON Storage
                saved_art = st.add_article({
                    "cluster_id": cluster_id,
                    "title": title,
                    "url": item["url"],
                    "source_name": src["name"],
                    "source_domain": src["domain"],
                    "source_tier": src["tier"],
                    "region": src["region"],
                    "category": src["category"],
                    "summary_short": tldr,
                    "summary_bullets": json.dumps(bullets, ensure_ascii=False),
                    "content_raw": summary_raw,
                    "image_url": item["image_url"],
                    "tags": json.dumps(tags, ensure_ascii=False),
                    "published_at": item["published_at"].isoformat() if isinstance(item["published_at"], datetime) else item["published_at"],
                    "hot_score": hot_sc,
                    "velocity_score": vel_sc,
                    "badge": badge,
                    "is_spam": False,
                    "is_primary": is_primary
                })

                # Riêng tin công nghệ: Tự động phân tích sâu & đối chiếu nguồn bổ sung
                if src["category"] in ("tech_vn", "tech_world") or is_ai:
                    try:
                        from app.services.tech_enricher import enrich_tech_article_deeply
                        await enrich_tech_article_deeply(saved_art, st, client)
                    except Exception as enrich_err:
                        logger.warning(f"Lỗi phân tích sâu tin công nghệ {saved_art.get('id')}: {enrich_err}")

                if cluster:
                    c_badge = cluster.get("badge", "new")
                    new_badge = badge if (badge in ("hot", "trending") or c_badge != "hot") else c_badge
                    st.update_cluster(cluster["id"], {
                        "hot_score": max(cluster.get("hot_score", 0.0), hot_sc),
                        "velocity_score": max(cluster.get("velocity_score", 0.0), vel_sc),
                        "badge": new_badge
                    })

                newly_saved_articles.append(saved_art)

        new_articles_count = len(newly_saved_articles)

        # 5. Cập nhật lại toàn bộ điểm số nóng theo thời gian thực
        recalculate_all_scores(st)

        # 6. Cập nhật tin đặc biệt gộp TP.HCM (Thời tiết & Giá vàng Mi Hồng 9999)
        try:
            from app.services.special_feeds import upsert_special_feeds
            await upsert_special_feeds(st)
        except Exception as sf_err:
            logger.warning(f"Lỗi khi cập nhật tin đặc biệt: {sf_err}")

        # 7. Tự động xóa tin tức cũ quá 2 ngày (48h) để tránh phình dữ liệu
        try:
            del_arts, del_logs = st.cleanup_old_articles(days=2)
            if del_arts > 0:
                logger.info(f"Đã tự động xóa {del_arts} bài cũ quá 2 ngày (48h) và dọn audio cache.")
        except Exception as cl_err:
            logger.warning(f"Lỗi khi dọn dẹp tin quá 48h: {cl_err}")

        # Cập nhật Log
        st.update_crawl_log(log["id"], {
            "finished_at": datetime.utcnow().isoformat(),
            "sources_crawled": len(sources_to_crawl),
            "articles_found": total_found,
            "articles_new": new_articles_count,
            "status": "success",
            "error_message": None
        })

        # 8. LẬP TỨC TẠO FILE ÂM THANH NGẦM CHO CÁC TIN MỚI & TIN NỔI BẬT NHẤT
        top_articles_for_audio = st.get_top_6h_articles(limit=20)
        asyncio.create_task(pre_generate_audio_for_new_articles(top_articles_for_audio, st))

        logger.info(
            f"Hoàn thành quét tin (Chế độ: {mode}): {total_found} tin quét được, "
            f"{new_articles_count} bài mới được xử lý & lưu JSON."
        )
        return st.get_latest_crawl_log()

    except Exception as e:
        logger.error(f"Lỗi trong chu kỳ quét tin: {e}", exc_info=True)
        st.update_crawl_log(log["id"], {
            "finished_at": datetime.utcnow().isoformat(),
            "status": "failed",
            "error_message": str(e)
        })
        return st.get_latest_crawl_log()
    finally:
        is_crawling_active = False

def start_scheduler():
    """Khởi động Background Scheduler chạy mỗi 30 phút"""
    if not scheduler.running:
        scheduler.add_job(
            run_crawl_cycle,
            trigger=IntervalTrigger(minutes=settings.CRAWL_INTERVAL_MINUTES),
            id="news_crawl_job",
            name="News Collector Job (Every 30m)",
            replace_existing=True
        )
        scheduler.start()
        logger.info(f"Scheduler đã kích hoạt: Quét tin mỗi {settings.CRAWL_INTERVAL_MINUTES} phút.")
