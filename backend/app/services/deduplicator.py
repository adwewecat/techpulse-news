import re
import unicodedata
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime, timedelta

def remove_accents(input_str: str) -> str:
    """Loại bỏ dấu tiếng Việt để so sánh chuỗi tương đương"""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).lower()

def get_word_tokens(text: str) -> set:
    normalized = remove_accents(text)
    words = re.findall(r'\b[a-z0-9]{2,}\b', normalized)
    stopwords = {
        "va", "cua", "cho", "la", "trong", "voi", "cac", "nhung", "da", "dang",
        "se", "duoc", "co", "nay", "do", "theo", "tai", "tu", "ve", "nhu",
        "khi", "nguoi", "den", "mot", "hai", "ba", "bon", "nam", "the", "and", "is"
    }
    return set(w for w in words if w not in stopwords)

def calculate_jaccard_similarity(set1: set, set2: set) -> float:
    if not set1 or not set2:
        return 0.0
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union if union > 0 else 0.0

def find_duplicate_cluster(
    storage: Any = None,
    title: str = "",
    summary: str = "",
    region: str = "vietnam",
    time_window_hours: int = 36,
    db: Any = None
) -> Optional[Any]:
    """
    Tìm xem bài viết mới có thuộc về một cụm sự kiện (StoryCluster) đã có trong 36 giờ qua không.
    Hỗ trợ cả JSONStorage (mặc định) và SQLAlchemy Session.
    """
    since_time = datetime.utcnow() - timedelta(hours=time_window_hours)
    new_tokens = get_word_tokens(title)
    if len(new_tokens) < 3:
        return None

    # 1. Chế độ JSONStorage (Mặc định chính của hệ thống)
    if storage is not None:
        clusters = storage.get_recent_clusters(region=region, since_time=since_time, limit=100)
        best_cluster = None
        max_sim = 0.0

        for cluster in clusters:
            headline = cluster.get("headline", "")
            cluster_tokens = get_word_tokens(headline)
            sim = calculate_jaccard_similarity(new_tokens, cluster_tokens)
            if sim > max_sim:
                max_sim = sim
                best_cluster = cluster

        if max_sim >= 0.50 and best_cluster:
            return best_cluster

        # Kiểm tra so sánh với các bài viết đơn lẻ gần đây trong Storage
        recent_articles = storage.get_recent_articles_for_dedup(region=region, since_time=since_time, limit=150)
        for art in recent_articles:
            art_tokens = get_word_tokens(art.get("title", ""))
            sim = calculate_jaccard_similarity(new_tokens, art_tokens)
            if sim >= 0.52:
                cid = art.get("cluster_id")
                if cid:
                    found_c = storage.get_cluster_by_id(cid)
                    if found_c:
                        return found_c
                # Tạo cluster mới gom cả bài cũ và bài mới
                new_cluster = storage.add_cluster({
                    "headline": art.get("title", title),
                    "region": region,
                    "category": art.get("category", "hot_vn"),
                    "source_count": 1,
                    "hot_score": 0.0,
                    "velocity_score": 0.0,
                    "badge": "new",
                    "first_seen_at": art.get("published_at", datetime.utcnow().isoformat()),
                    "last_seen_at": datetime.utcnow().isoformat()
                })
                art["cluster_id"] = new_cluster["id"]
                storage.update_article(art["id"], {"cluster_id": new_cluster["id"]})
                return new_cluster

        return None

    # 2. Chế độ SQLAlchemy Session (Fallback)
    if db is not None:
        try:
            from app.models.article import Article, StoryCluster
            clusters = (
                db.query(StoryCluster)
                .filter(
                    StoryCluster.region == region,
                    StoryCluster.last_seen_at >= since_time
                )
                .order_by(StoryCluster.last_seen_at.desc())
                .limit(100)
                .all()
            )
            best_cluster = None
            max_sim = 0.0
            for cluster in clusters:
                cluster_tokens = get_word_tokens(cluster.headline)
                sim = calculate_jaccard_similarity(new_tokens, cluster_tokens)
                if sim > max_sim:
                    max_sim = sim
                    best_cluster = cluster

            if max_sim >= 0.50 and best_cluster:
                return best_cluster

            recent_articles = (
                db.query(Article)
                .filter(
                    Article.region == region,
                    Article.published_at >= since_time,
                    Article.is_spam == False
                )
                .order_by(Article.published_at.desc())
                .limit(150)
                .all()
            )
            for art in recent_articles:
                art_tokens = get_word_tokens(art.title)
                sim = calculate_jaccard_similarity(new_tokens, art_tokens)
                if sim >= 0.52:
                    if getattr(art, "cluster", None):
                        return art.cluster
                    new_cluster = StoryCluster(
                        headline=art.title,
                        region=region,
                        category=art.category,
                        source_count=1,
                        first_seen_at=art.published_at,
                        last_seen_at=datetime.utcnow()
                    )
                    db.add(new_cluster)
                    db.flush()
                    art.cluster_id = new_cluster.id
                    db.commit()
                    return new_cluster
        except Exception:
            return None

    return None
