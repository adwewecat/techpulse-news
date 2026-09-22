import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks

from app.core.storage import get_storage, JSONStorage
from app.services.sources import NEWS_SOURCES
from app.services.collector import run_crawl_cycle, is_crawling_active, scheduler

router = APIRouter(prefix="/api/collector", tags=["Collector"])

@router.post("/trigger")
async def trigger_collector(background_tasks: BackgroundTasks):
    """
    Kích hoạt tiến trình quét tin tức ngay lập tức từ giao diện người dùng
    """
    if is_crawling_active:
        return {
            "status": "already_running",
            "message": "Tiến trình quét tin đang hoạt động, vui lòng chờ..."
        }

    # Chạy background task
    background_tasks.add_task(run_crawl_cycle)

    return {
        "status": "started",
        "message": "Đã bắt đầu tiến trình quét tin tức mới!",
        "sources_count": len(NEWS_SOURCES)
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
            "error_message": last_log.get("error_message")
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
