import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, BackgroundTasks, Query

from app.core.storage import get_storage, JSONStorage
from app.services.sources import NEWS_SOURCES, get_sources_for_mode
from app.services.collector import run_crawl_cycle, is_crawling_active, scheduler

router = APIRouter(prefix="/api/collector", tags=["Collector"])

@router.post("/trigger")
async def trigger_collector(
    background_tasks: BackgroundTasks,
    mode: Optional[str] = Query("all", description="Chế độ quét: ai_tech | hot_vn | hot_world | trending | all")
):
    """
    Kích hoạt tiến trình quét tin tức theo chế độ được chọn:
    - ai_tech: Tin A.I, trí tuệ nhân tạo, công nghệ (tìm 20 tin hot nhất)
    - hot_vn: Tin tổng hợp hot Việt Nam (tìm 20 tin hot nhất)
    - hot_world: Tin tổng hợp hot quốc tế (tìm 20 tin hot nhất)
    - trending: Tin trending tổng hợp Việt Nam + Quốc tế (tìm 20 tin hot nhất)
    - all: Quét toàn bộ nguồn
    """
    if is_crawling_active:
        return {
            "status": "already_running",
            "message": "Tiến trình quét tin đang hoạt động, vui lòng chờ..."
        }

    sources = get_sources_for_mode(mode)

    # Chạy background task với chế độ quét đã chọn
    background_tasks.add_task(run_crawl_cycle, None, mode)

    mode_titles = {
        "ai_tech": "Tin A.I, Trí tuệ nhân tạo & Công nghệ",
        "hot_vn": "Tin tổng hợp Hot Việt Nam",
        "hot_world": "Tin tổng hợp Hot Quốc Tế",
        "trending": "Tin Trending Tổng Hợp VN + Quốc Tế",
        "all": "Toàn bộ nguồn tin"
    }

    return {
        "status": "started",
        "mode": mode,
        "mode_title": mode_titles.get(mode, mode),
        "message": f"Đã bắt đầu tiến trình quét '{mode_titles.get(mode, mode)}'!",
        "sources_count": len(sources)
    }

@router.get("/status")
def get_collector_status(storage: JSONStorage = Depends(get_storage)):
    """
    Lấy trạng thái thu thập tin tức, thời điểm quét gần nhất, số bài viết
    """
    last_log = storage.get_latest_crawl_log()
    total_articles = len([a for a in storage.articles if not a.get("is_spam", False)])

    log_dict = None
    if last_log:
        log_dict = {
            "id": last_log.get("id"),
            "started_at": last_log.get("started_at"),
            "finished_at": last_log.get("finished_at"),
            "sources_crawled": last_log.get("sources_crawled", 0),
            "articles_found": last_log.get("articles_found", 0),
            "articles_new": last_log.get("articles_new", 0),
            "status": last_log.get("status", "success"),
            "error_message": last_log.get("error_message"),
            "mode": last_log.get("mode", "all")
        }

    # Thời gian lần quét kế tiếp từ APScheduler
    next_run = None
    try:
        job = scheduler.get_job("news_crawl_job")
        if job and job.next_run_time:
            next_run = job.next_run_time
    except Exception:
        pass

    last_run_time = last_log.get("finished_at") if last_log else None

    return {
        "is_running": is_crawling_active,
        "last_run": last_run_time,
        "next_run": next_run,
        "sources_count": len(NEWS_SOURCES),
        "total_articles": total_articles,
        "last_log": log_dict
    }
