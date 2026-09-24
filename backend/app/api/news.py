from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.storage import get_storage, JSONStorage
from app.schemas.article import ArticleOut, NewsListResponse, DeepAnalysisResponse
from app.services.hot_scoring import calculate_hot_score
from app.services.deep_analyzer import analyze_article_deeply

router = APIRouter(prefix="/api/news", tags=["News"])

def enrich_article_out(storage: JSONStorage, art: Dict[str, Any]) -> ArticleOut:
    rel_articles = []
    source_count = 1
    cid = art.get("cluster_id")
    if cid:
        cluster = storage.get_cluster_by_id(cid)
        if cluster:
            source_count = cluster.get("source_count", 1)
        rel_articles = storage.get_cluster_articles(cid, exclude_article_id=art.get("id"))
    return ArticleOut.from_orm_custom(art, related_articles=rel_articles, source_count=source_count)

@router.get("", response_model=NewsListResponse)
def get_news_list(
    region: Optional[str] = Query(None, description="Khu vực: vietnam | world"),
    category: Optional[str] = Query(None, description="Danh mục: hot_vn | tech_vn | tech_world"),
    badge: Optional[str] = Query(None, description="Huy hiệu: hot | trending | new"),
    tag: Optional[str] = Query(None, description="Lọc theo tag chủ đề"),
    search: Optional[str] = Query(None, description="Tìm kiếm tiêu đề hoặc nội dung"),
    only_primary: bool = Query(True, description="Chỉ hiển thị bài viết tiêu biểu của mỗi cụm"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    storage: JSONStorage = Depends(get_storage)
):
    articles, total = storage.get_articles(
        region=region,
        category=category,
        badge=badge,
        tag=tag,
        search=search,
        only_primary=only_primary,
        page=page,
        limit=limit
    )

    enriched_items = [enrich_article_out(storage, art) for art in articles]
    offset = (page - 1) * limit

    return NewsListResponse(
        items=enriched_items,
        total=total,
        page=page,
        limit=limit,
        has_more=(offset + limit) < total
    )

from pydantic import BaseModel

class UserSyncRequest(BaseModel):
    user_id: str
    read_ids: List[int]

class UserReadRequest(BaseModel):
    user_id: str
    article_id: int

@router.get("/top-6h", response_model=List[ArticleOut])
def get_top_6h_news(
    region: Optional[str] = Query(None, description="Khu vực: vietnam | world"),
    limit: int = Query(30, ge=1, le=100),
    user_id: Optional[str] = Query(None, description="Mã người dùng ẩn danh để loại trừ tin đã đọc"),
    exclude_read: bool = Query(True, description="Chỉ lấy tin người dùng chưa đọc"),
    storage: JSONStorage = Depends(get_storage)
):
    """
    Mục đặc biệt: 🔥 30 tin nổi bật nhất 6 giờ qua (lọc trùng lặp)
    Nếu truyền user_id và exclude_read=True: Tự động loại trừ các tin mà thiết bị/người dùng này đã đọc,
    đảm bảo khi load lại trang luôn có 30 tin MỚI CHƯA ĐỌC, không bị lặp lại tin cũ.
    """
    exclude_ids = None
    if user_id and exclude_read:
        read_list = storage.get_user_read_ids(user_id)
        if read_list:
            exclude_ids = set(read_list)

    results = storage.get_top_6h_articles(region=region, limit=limit, exclude_ids=exclude_ids)
    return [enrich_article_out(storage, art) for art in results]

@router.get("/top20", response_model=List[ArticleOut])
def get_top20_by_category(
    mode: str = Query("ai_tech", description="Chuyên mục: ai_tech | hot_vn | hot_world | trending | all"),
    limit: int = Query(20, ge=1, le=50),
    user_id: Optional[str] = Query(None, description="Mã người dùng/khách để loại trừ tin đã đọc"),
    exclude_read: bool = Query(True, description="Loại trừ tin đã đọc"),
    storage: JSONStorage = Depends(get_storage)
):
    """
    Lấy 20 tin nổi bật nhất theo 4 chuyên mục chọn lọc khi quét:
    + ai_tech: Tin A.I, trí tuệ nhân tạo, công nghệ (tìm 20 tin hot nhất)
    + hot_vn: Tin tổng hợp hot Việt Nam (tìm 20 tin hot nhất)
    + hot_world: Tin tổng hợp hot quốc tế (tìm 20 tin hot nhất)
    + trending: Tin trending tổng hợp Việt Nam + Quốc tế (tìm 20 tin hot nhất)
    """
    exclude_ids = None
    if user_id and exclude_read:
        read_list = storage.get_user_read_ids(user_id)
        if read_list:
            exclude_ids = set(read_list)

    results = storage.get_category_top20(mode=mode, limit=limit, exclude_ids=exclude_ids)
    return [enrich_article_out(storage, art) for art in results]

@router.post("/user/read")
def mark_user_read_endpoint(req: UserReadRequest, storage: JSONStorage = Depends(get_storage)):
    """Đánh dấu một bài viết là đã đọc cho thiết bị/người dùng ẩn danh"""
    storage.mark_user_read(req.user_id, req.article_id)
    return {"status": "ok", "user_id": req.user_id, "article_id": req.article_id}

@router.post("/user/unread")
def mark_user_unread_endpoint(req: UserReadRequest, storage: JSONStorage = Depends(get_storage)):
    """Hoàn tác trạng thái đã đọc của một bài viết"""
    storage.mark_user_unread(req.user_id, req.article_id)
    return {"status": "ok", "user_id": req.user_id, "article_id": req.article_id}

@router.post("/user/sync")
def sync_user_reads_endpoint(req: UserSyncRequest, storage: JSONStorage = Depends(get_storage)):
    """Đồng bộ danh sách tin đã đọc giữa client và server (merge 2 chiều)"""
    merged_ids = storage.sync_user_reads(req.user_id, req.read_ids)
    return {"status": "ok", "user_id": req.user_id, "read_ids": merged_ids, "total": len(merged_ids)}

@router.get("/user/reads")
def get_user_reads_endpoint(user_id: str = Query(...), storage: JSONStorage = Depends(get_storage)):
    """Lấy toàn bộ danh sách ID bài viết đã đọc của người dùng/thiết bị"""
    read_ids = storage.get_user_read_ids(user_id)
    return {"user_id": user_id, "read_ids": read_ids, "total": len(read_ids)}

@router.get("/user/read-articles", response_model=List[ArticleOut])
def get_user_read_articles_endpoint(
    user_id: str = Query(...),
    limit: int = Query(50, ge=1, le=100),
    storage: JSONStorage = Depends(get_storage)
):
    """Lấy danh sách các bài viết người dùng đã đọc"""
    articles = storage.get_user_read_articles(user_id, limit=limit)
    return [enrich_article_out(storage, art) for art in articles]

@router.delete("/user/reads")
def clear_user_reads_endpoint(user_id: str = Query(...), storage: JSONStorage = Depends(get_storage)):
    """Đặt lại toàn bộ lịch sử đọc của người dùng/thiết bị"""
    storage.clear_user_reads(user_id)
    return {"status": "ok", "user_id": user_id, "message": "Đã làm mới danh sách tin đã đọc"}

@router.get("/trending", response_model=List[ArticleOut])
def get_trending_news(
    region: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=20),
    storage: JSONStorage = Depends(get_storage)
):
    """
    Mục: ⚡ Tin Đang Tăng (Trending) có tốc độ lan truyền nhanh nhất
    """
    results = storage.get_trending_articles(region=region, limit=limit)
    return [enrich_article_out(storage, art) for art in results]

@router.get("/starred", response_model=List[ArticleOut])
def get_starred_articles(storage: JSONStorage = Depends(get_storage)):
    """
    Lấy danh sách các tin đã được người dùng đánh dấu sao quan tâm.
    """
    articles = storage.get_starred_articles()
    return [enrich_article_out(storage, art) for art in articles]

@router.get("/{article_id}", response_model=ArticleOut)
def get_article_detail(article_id: int, storage: JSONStorage = Depends(get_storage)):
    art = storage.get_article_by_id(article_id)
    if not art:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    new_view = art.get("view_count", 0) + 1
    storage.update_article(article_id, {"view_count": new_view})
    art["view_count"] = new_view

    return enrich_article_out(storage, art)

@router.post("/{article_id}/click")
def track_article_click(article_id: int, storage: JSONStorage = Depends(get_storage)):
    """
    Ghi nhận lượt click / đọc nhanh của độc giả trên website.
    Lập tức tái tính toán Hot Score và cập nhật thứ hạng bài viết.
    """
    art = storage.get_article_by_id(article_id)
    if not art:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    new_click = art.get("click_count", 0) + 1
    cid = art.get("cluster_id")
    cluster = storage.get_cluster_by_id(cid) if cid else None
    src_count = cluster.get("source_count", 1) if cluster else 1

    h_sc, v_sc, badge = calculate_hot_score(
        source_count=src_count,
        source_tier=art.get("source_tier", 1.0),
        published_at=art.get("published_at"),
        click_count=new_click,
        view_count=art.get("view_count", 0)
    )

    storage.update_article(article_id, {
        "click_count": new_click,
        "hot_score": h_sc,
        "velocity_score": v_sc,
        "badge": badge
    })

    return {
        "status": "success",
        "click_count": new_click,
        "hot_score": h_sc,
        "badge": badge
    }

@router.post("/{article_id}/star")
async def toggle_article_star(
    article_id: int, 
    starred: Optional[bool] = Query(None),
    storage: JSONStorage = Depends(get_storage)
):
    """
    Đánh dấu sao cho tin (quan tâm / bookmark) hoặc hủy đánh dấu.
    Khi đánh dấu sao (starred=True):
    - Tự động chạy phân tích chuyên sâu đa nguồn & bối cảnh toàn diện.
    - Cập nhật tóm tắt ngắn (summary_short) thành bản tóm tắt chuyên sâu giải thích cặn kẽ bản chất sự việc.
    - Xóa bộ nhớ đệm âm thanh (AUDIO_CACHE) để khi bấm nghe đọc Tiếng Việt sẽ phát ngay bản tóm tắt chuyên sâu mới này.
    - Trả về đối tượng ArticleOut đầy đủ để frontend cập nhật hiển thị ngay lập tức.
    """
    art = storage.get_article_by_id(article_id)
    if not art:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết")

    new_starred = starred if starred is not None else not art.get("is_starred", False)
    storage.update_article(article_id, {"is_starred": new_starred})
    art["is_starred"] = new_starred

    if new_starred:
        try:
            # 1. Chạy phân tích chuyên sâu đa nguồn & nâng cấp tóm tắt
            deep_res = await analyze_article_deeply(article_id=art["id"], storage=storage, force_refresh=False)
            if deep_res and deep_res.get("overview"):
                storage.update_article(article_id, {"summary_short": deep_res["overview"]})
                art["summary_short"] = deep_res["overview"]
        except Exception:
            pass

        # 2. Xóa cache audio cũ của bài viết này để nghe bản tóm tắt mới
        try:
            from app.api.tts import AUDIO_CACHE
            keys_to_del = [k for k in list(AUDIO_CACHE.keys()) if f"art_{art['id']}_" in k or f"deep_analysis_{art['id']}" in k]
            for k in keys_to_del:
                AUDIO_CACHE.pop(k, None)
        except Exception:
            pass

    enriched = enrich_article_out(storage, art)
    return {
        "status": "success",
        "article_id": art["id"],
        "is_starred": art["is_starred"],
        "article": enriched
    }

@router.post("/{article_id}/deep-analysis", response_model=DeepAnalysisResponse)
async def get_or_create_deep_analysis(
    article_id: int, 
    force_refresh: bool = Query(False),
    storage: JSONStorage = Depends(get_storage)
):
    """
    Bản Phân Tích Chuyên Sâu Đa Chiều (Deep-Dive Multi-Source Synthesis):
    - Đào sâu bối cảnh, nguồn gốc và động cơ
    - Tìm kiếm và đối chiếu góc nhìn từ các nguồn báo khác trong hệ thống
    - Dự báo tác động ngắn hạn & dài hạn
    - Rút ra bài học hành động và câu hỏi mở
    """
    try:
        data = await analyze_article_deeply(article_id=article_id, storage=storage, force_refresh=force_refresh)
        return data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi sinh phân tích chuyên sâu: {e}")

@router.post("/cleanup-read")
def cleanup_old_read_data(
    days: int = Query(3, ge=1, le=90),
    storage: JSONStorage = Depends(get_storage)
):
    """
    Chính sách lưu trữ: Giới hạn lưu trữ tối đa 3 ngày (D, D-1, D-2). D-3 trở đi xóa.
    Tự động dọn dẹp các bài viết cũ hơn 3 ngày nhưng BẢO TOÀN tuyệt đối các tin đã đánh dấu sao quan tâm.
    """
    deleted_articles, deleted_logs = storage.cleanup_old_articles(days=days)
    return {
        "status": "success",
        "days": days,
        "deleted_articles": deleted_articles,
        "deleted_logs": deleted_logs,
        "message": f"Đã dọn dẹp tin tức cũ hơn {days} ngày (bảo toàn các tin đã đánh dấu sao quan tâm)"
    }
