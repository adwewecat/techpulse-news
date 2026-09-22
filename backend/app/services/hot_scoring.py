import math
from datetime import datetime, timedelta
from typing import Tuple, Optional, Any
from app.core.storage import JSONStorage, parse_dt, storage as default_storage

LAMBDA_DECAY = 0.0385  # Half-life khoảng 18 giờ

def calculate_hot_score(
    source_count: int,
    source_tier: float,
    published_at: Any,
    click_count: int = 0,
    view_count: int = 0,
    velocity_rate: float = 1.0,
    is_ai_tech: bool = False,
    now: datetime = None
) -> Tuple[float, float, str]:
    """
    Thuật toán tính điểm độ nóng đa chiều:
    - Số nguồn đưa tin
    - Tốc độ xuất hiện (velocity)
    - Mức độ uy tín của nguồn
    - Lượt tương tác click / đọc trên website
    - Ưu tiên công nghệ & AI
    - Độ suy giảm theo thời gian (Time decay)
    
    Trả về: (hot_score, velocity_score, badge)
    """
    if now is None:
        now = datetime.utcnow()

    pub_dt = parse_dt(published_at)

    # Tính độ lệch thời gian theo giờ
    delta_seconds = (now - pub_dt).total_seconds()
    delta_hours = max(0.0, delta_seconds / 3600.0)

    # 1. Điểm số lượng nguồn (Tối đa 40 điểm)
    # 1 nguồn = 15đ, 2 nguồn = 28đ, 3 nguồn = 36đ, >=4 nguồn = 40đ
    source_score = min(40.0, 15.0 + (source_count - 1) * 12.0) if source_count > 1 else 15.0

    # 2. Điểm uy tín nguồn (1.0 -> 1.6 quy ra 16 -> 26 điểm)
    tier_score = source_tier * 16.0

    # 3. Điểm tương tác độc giả trên website (Clicks & Views)
    engagement_raw = (click_count * 2.5) + (view_count * 0.5)
    engagement_score = min(25.0, math.log1p(engagement_raw) * 7.5)

    # 4. Điểm tốc độ bùng nổ (Velocity score)
    if delta_hours <= 1.0:
        vel_base = 35.0 * velocity_rate
    elif delta_hours <= 3.0:
        vel_base = 25.0 * velocity_rate
    elif delta_hours <= 6.0:
        vel_base = 18.0 * velocity_rate
    elif delta_hours <= 12.0:
        vel_base = 10.0 * velocity_rate
    else:
        vel_base = 4.0

    velocity_score = round(min(100.0, vel_base * (1.0 + (source_count - 1) * 0.4)), 1)

    # Bonus đặc biệt cho chủ đề AI & Công nghệ nổi bật (+12đ)
    ai_bonus = 12.0 if is_ai_tech else 0.0

    # Tổng điểm cơ sở (Base Score)
    base_score = source_score + tier_score + engagement_score + (velocity_score * 0.25) + ai_bonus

    # Hệ số suy giảm theo hàm mũ thời gian (Exponential Decay)
    decay_factor = math.exp(-LAMBDA_DECAY * delta_hours)
    hot_score = round(base_score * decay_factor, 1)

    # Gán huy hiệu thông minh
    badge = "normal"
    if hot_score >= 65.0 or source_count >= 3:
        badge = "hot"          # 🔥 HOT
    elif velocity_score >= 50.0 and delta_hours <= 6.0:
        badge = "trending"     # ⚡ ĐANG TĂNG
    elif delta_hours <= 2.5:
        badge = "new"          # 📰 MỚI

    return hot_score, velocity_score, badge

def recalculate_all_scores(storage_instance: Optional[JSONStorage] = None):
    """
    Cập nhật lại điểm nóng và huy hiệu cho tất cả các bài viết trong 48 giờ gần đây.
    Được gọi tự động sau mỗi chu kỳ quét 30 phút.
    """
    storage = storage_instance or default_storage
    now = datetime.utcnow()
    since_time = now - timedelta(hours=48)

    with storage.lock:
        for art in storage.articles:
            if art.get("is_spam", False):
                continue
            pub_dt = parse_dt(art.get("published_at"))
            if pub_dt < since_time:
                continue

            cid = art.get("cluster_id")
            cluster = storage.get_cluster_by_id(cid) if cid else None
            src_count = cluster.get("source_count", 1) if cluster else 1

            tags_str = str(art.get("tags", "")).lower()
            category = art.get("category", "")
            is_ai = ("trí tuệ nhân tạo" in tags_str or "ai" in tags_str or category in ("tech_vn", "tech_world"))

            h_score, v_score, badge = calculate_hot_score(
                source_count=src_count,
                source_tier=art.get("source_tier", 1.0),
                published_at=pub_dt,
                click_count=art.get("click_count", 0),
                view_count=art.get("view_count", 0),
                is_ai_tech=is_ai,
                now=now
            )
            art["hot_score"] = h_score
            art["velocity_score"] = v_score
            art["badge"] = badge

            if cluster and art.get("is_primary", True):
                cluster["hot_score"] = h_score
                cluster["velocity_score"] = v_score
                cluster["badge"] = badge

        storage.save()
