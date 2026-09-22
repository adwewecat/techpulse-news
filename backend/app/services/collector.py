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
from app.services.sources import NEWS_SOURCES
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

def clean_html(raw_html: str) -> Tuple[str, Optional[str]]:
    """Loại bỏ HTML tags và rút trích URL hình ảnh đầu tiên nếu có"""
    if not raw_html:
        return "", None
    soup = BeautifulSoup(raw_html, "html.parser")
    
    # Tìm ảnh trong HTML
    img_url = None
    img_tag = soup.find("img")
    if img_tag and img_tag.get("src"):
        img_url = img_tag["src"]

    text = soup.get_text(separator=" ", strip=True)
    return text, img_url

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
    # Kiểm tra enclosures
    if hasattr(entry, "enclosures") and entry.enclosures:
        for enc in entry.enclosures:
            if enc.get("type", "").startswith("image/") or enc.get("href", "").endswith((".jpg", ".png", ".webp", ".jpeg")):
                return enc.get("href")

    # Kiểm tra media_content
    if hasattr(entry, "media_content") and entry.media_content:
        for media in entry.media_content:
            if "url" in media:
                return media["url"]

    # Kiểm tra media_thumbnail
    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        for thumb in entry.media_thumbnail:
            if "url" in thumb:
                return thumb["url"]

    if fallback_img:
        return fallback_img
    return None

async def fetch_article_body_text(url: str, client: httpx.AsyncClient) -> str:
    """Cào nhanh các đoạn văn hoàn chỉnh bài báo nếu RSS chỉ có tóm tắt ngắn hoặc bị cắt cụt (...)"""
    try:
        res = await client.get(url, headers=HEADERS, timeout=7.0)
        if res.status_code == 200:
            soup = BeautifulSoup(res.content, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "figure", "figcaption"]):
                tag.decompose()
            
            # Tìm container chính của bài báo
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
                line = line.strip()
                if len(line) >= 30 and not any(skip in line.lower() for skip in [
                    "facebook.com", "quảng cáo", "báo xấu", "chia sẻ bài viết", 
                    "nguồn:", "bình luận", "theo dõi tin", "phản hồi:"
                ]):
                    # Tránh dòng trùng lặp
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

        for entry in feed.entries[:25]:  # Lấy tối đa 25 tin mới nhất mỗi nguồn
            title = getattr(entry, "title", "").strip()
            link = getattr(entry, "link", "").strip()
            if not title or not link:
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

async def run_crawl_cycle(storage_instance: Optional[JSONStorage] = None) -> Optional[Dict[str, Any]]:
    """
    Chu kỳ thu thập tin tức:
    1. Cào song song các nguồn RSS (giữ HTTP Client mở xuyên suốt)
    2. Lọc rác & xử lý NLP (Tóm tắt, tags)
    3. Detect trùng & Gom cụm (Clustering)
    4. Chấm điểm độ nóng & gán huy hiệu
    5. Lưu vào JSON Storage an toàn
    6. Cập nhật lại toàn bộ điểm nóng trong 48h
    """
    global is_crawling_active
    if is_crawling_active:
        logger.info("Crawl cycle is already in progress. Skipping.")
        return None

    is_crawling_active = True
    st = storage_instance or storage
    log = st.add_crawl_log({
        "started_at": datetime.utcnow().isoformat(),
        "status": "running",
        "sources_crawled": 0,
        "articles_found": 0,
        "articles_new": 0
    })

    try:
        logger.info("Bắt đầu chu kỳ quét tin tức mới từ các nguồn...")
        # GIỮ AsyncClient MỞ CHO TOÀN BỘ QUÁ TRÌNH QUÉT & CÀO NỘI DUNG CHI TIẾT
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, verify=False, timeout=12.0) as client:
            tasks = [fetch_feed(client, src) for src in NEWS_SOURCES]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            total_found = 0
            new_articles_count = 0

            # Tập hợp tất cả các tin thu thập được
            all_incoming = []
            for res in results:
                if isinstance(res, list):
                    all_incoming.extend(res)

            total_found = len(all_incoming)

            # Sắp xếp theo ngày xuất bản để xử lý tin cũ trước, tin mới sau (giúp gom cụm chính xác)
            all_incoming.sort(key=lambda x: x["published_at"])

            for item in all_incoming:
                # Kiểm tra xem bài đã tồn tại trong JSON storage chưa
                if st.exists_url(item["url"]):
                    continue

                src = item["source"]
                title = item["title"]
                summary_raw = item["summary"]

                # Nếu tóm tắt RSS quá ngắn (< 250 ký tự) hoặc bị cắt cụt với dấu "...", cào thêm bài báo gốc
                if len(summary_raw) < 250 or summary_raw.rstrip().endswith(("...", "…", "..", "---")):
                    body_extra = await fetch_article_body_text(item["url"], client)
                    if body_extra and len(body_extra) > len(summary_raw):
                        summary_raw = body_extra

                # Tự động dịch sang Tiếng Việt nếu là tin quốc tế hoặc văn bản tiếng Anh
                from app.api.tts import is_english_text, translate_to_vietnamese
                if src.get("region") == "world" or src.get("category") == "tech_world" or is_english_text(title) or is_english_text(summary_raw):
                    if is_english_text(title):
                        title = await translate_to_vietnamese(title, client)
                    if is_english_text(summary_raw):
                        summary_raw = await translate_to_vietnamese(summary_raw, client)

                # 1. Pipeline AI: Lọc rác + Tóm tắt + Auto-tags
                is_spam, tldr, bullets, tags = process_article_ai(title, summary_raw)
                if is_spam:
                    continue

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
                    # Đã có cụm sự kiện tương ứng
                    new_src_count = cluster.get("source_count", 1) + 1
                    st.update_cluster(cluster["id"], {
                        "source_count": new_src_count,
                        "last_seen_at": datetime.utcnow().isoformat()
                    })
                    source_count = new_src_count
                    is_primary = False
                    cluster_id = cluster["id"]
                else:
                    # Tạo cụm sự kiện mới
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
                        enrich_tech_article_deeply(saved_art, st)
                    except Exception as enrich_err:
                        logger.warning(f"Lỗi phân tích sâu tin công nghệ {saved_art.get('id')}: {enrich_err}")

                # Cập nhật điểm nóng cho StoryCluster
                if cluster:
                    c_badge = cluster.get("badge", "new")
                    new_badge = badge if (badge in ("hot", "trending") or c_badge != "hot") else c_badge
                    st.update_cluster(cluster["id"], {
                        "hot_score": max(cluster.get("hot_score", 0.0), hot_sc),
                        "velocity_score": max(cluster.get("velocity_score", 0.0), vel_sc),
                        "badge": new_badge
                    })

                new_articles_count += 1

        # 5. Cập nhật lại toàn bộ điểm số nóng theo thời gian thực
        recalculate_all_scores(st)

        # 6. Cập nhật tin đặc biệt: Thời tiết TP.HCM D+1 & Giá vàng hôm nay
        try:
            from app.services.special_feeds import upsert_special_feeds
            await upsert_special_feeds(st)
        except Exception as sf_err:
            logger.warning(f"Lỗi khi cập nhật tin đặc biệt: {sf_err}")

        # Cập nhật Log
        st.update_crawl_log(log["id"], {
            "finished_at": datetime.utcnow().isoformat(),
            "sources_crawled": len(NEWS_SOURCES),
            "articles_found": total_found,
            "articles_new": new_articles_count,
            "status": "success",
            "error_message": None
        })

        logger.info(
            f"Hoàn thành quét tin: {total_found} tin quét được, "
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
