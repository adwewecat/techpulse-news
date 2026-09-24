import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.storage import storage
from app.api import news, collector, stats, tts
from app.services.collector import start_scheduler, run_crawl_cycle

logger = logging.getLogger("app")
logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo dữ liệu JSON Storage
    logger.info("Đang nạp dữ liệu từ JSON Storage...")
    try:
        storage.load()
        count = len(storage.articles)
        logger.info(f"Đã nạp thành công {count} bài viết từ JSON Storage!")

        # 1. Tự động dọn dẹp các tin quá 3 ngày (D-3) và file audio cache thừa ngay khi khởi động
        del_arts, _ = storage.cleanup_old_articles(days=3)
        if del_arts > 0:
            logger.info(f"Đã dọn dẹp {del_arts} bài viết cũ quá 3 ngày (D-3) và dọn audio cache.")

        # 2. Cập nhật ngay tin đặc biệt theo giờ: Thời tiết TP.HCM (Hôm nay D & Ngày mai D+1) và Giá vàng Mi Hồng
        from app.services.special_feeds import upsert_special_feeds
        await upsert_special_feeds(storage)
    except Exception as e:
        logger.error(f"Lỗi khi nạp dữ liệu storage hoặc tin đặc biệt: {e}")
        count = len(storage.articles)

    # Bật tiến trình quét tự động 30 phút
    start_scheduler()

    # Tự động quét tin tức mới khi khởi động nếu dữ liệu đã quá 20 phút hoặc chưa có tin
    last_log = storage.get_latest_crawl_log()
    need_crawl = False
    if count == 0 or not last_log or not last_log.get("finished_at"):
        need_crawl = True
    else:
        try:
            from datetime import datetime, timezone
            last_finished = last_log["finished_at"].replace("Z", "+00:00")
            last_time = datetime.fromisoformat(last_finished)
            if last_time.tzinfo is None:
                last_time = last_time.replace(tzinfo=timezone.utc)
            now_utc = datetime.now(timezone.utc)
            if (now_utc - last_time).total_seconds() > 20 * 60:
                need_crawl = True
        except Exception:
            need_crawl = True

    if need_crawl:
        logger.info("Dữ liệu tin tức đã quá 20 phút. Tự động kích hoạt cào tin ngầm trên nền...")
        asyncio.create_task(run_crawl_cycle())

    yield
    logger.info("Backend ứng dụng đang tắt...")

app = FastAPI(
    title="AI News Aggregator API",
    description="Hệ thống tổng hợp & phân tích tin tức thông minh (Việt Nam & Thế Giới) với thuật toán chấm độ nóng đa chiều và tóm tắt AI",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Cấu hình CORS để Frontend React kết nối thuận tiện
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gắn các Routers API
app.include_router(news.router)
app.include_router(collector.router)
app.include_router(stats.router)
app.include_router(tts.router)

@app.get("/")
def root():
    return {
        "app": "AI News Aggregator API",
        "version": "1.0.0",
        "storage": "JSON File Storage",
        "articles_count": len(storage.articles),
        "status": "online",
        "docs": "/docs"
    }
