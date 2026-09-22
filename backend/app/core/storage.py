import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from app.core.config import settings

def parse_dt(val: Any) -> datetime:
    """Chuyển đổi chuỗi ISO hoặc datetime về datetime UTC naive"""
    if isinstance(val, datetime):
        if val.tzinfo is not None:
            return val.astimezone(timezone.utc).replace(tzinfo=None)
        return val
    if not val:
        return datetime.min
    if isinstance(val, str):
        val_clean = val.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(val_clean)
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            return datetime.min
    return datetime.min

def is_tech_article(a: Dict[str, Any]) -> bool:
    """Xác định bài viết có thuộc mảng Công nghệ hay không"""
    cat = a.get("category", "")
    if cat in ("tech_vn", "tech_world"):
        return True
    tags = str(a.get("tags", "")).lower()
    if any(k in tags for k in ["ai", "bán dẫn", "chip", "công nghệ", "apple", "google", "smartphone", "khoa học", "thiết bị", "an ninh mạng"]):
        return True
    return False

class JSONStorage:
    def __init__(self, file_path: Optional[Path] = None):
        self.file_path = file_path or settings.DATA_FILE
        self.lock = threading.RLock()
        self.articles: List[Dict[str, Any]] = []
        self.clusters: List[Dict[str, Any]] = []
        self.crawl_logs: List[Dict[str, Any]] = []
        self._url_index: Dict[str, int] = {}
        self._article_id_map: Dict[int, Dict[str, Any]] = {}
        self._cluster_id_map: Dict[int, Dict[str, Any]] = {}
        self._log_id_map: Dict[int, Dict[str, Any]] = {}
        self._next_article_id = 1
        self._next_cluster_id = 1
        self._next_log_id = 1

        self.load()

    def load(self):
        with self.lock:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            if self.file_path.exists():
                try:
                    with open(self.file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.articles = data.get("articles", [])
                    self.clusters = data.get("clusters", [])
                    self.crawl_logs = data.get("crawl_logs", [])
                except Exception as e:
                    print(f"[JSONStorage] Lỗi khi đọc file {self.file_path}: {e}")
                    self.articles = []
                    self.clusters = []
                    self.crawl_logs = []
            else:
                self.articles = []
                self.clusters = []
                self.crawl_logs = []
                self._save_unlocked()

            self._rebuild_indices()

    def _rebuild_indices(self):
        self._url_index = {a["url"]: a["id"] for a in self.articles if "url" in a and "id" in a}
        self._article_id_map = {a["id"]: a for a in self.articles if "id" in a}
        self._cluster_id_map = {c["id"]: c for c in self.clusters if "id" in c}
        self._log_id_map = {l["id"]: l for l in self.crawl_logs if "id" in l}

        max_art_id = max([a.get("id", 0) for a in self.articles], default=0)
        self._next_article_id = max_art_id + 1

        max_clust_id = max([c.get("id", 0) for c in self.clusters], default=0)
        self._next_cluster_id = max_clust_id + 1

        max_log_id = max([l.get("id", 0) for l in self.crawl_logs], default=0)
        self._next_log_id = max_log_id + 1

    def _save_unlocked(self):
        """Ghi dữ liệu an toàn ra tệp tạm rồi đổi tên nguyên tử (atomic rename)"""
        tmp_path = self.file_path.with_suffix(".tmp")
        data = {
            "articles": self.articles,
            "clusters": self.clusters,
            "crawl_logs": self.crawl_logs
        }
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, self.file_path)

    def save(self):
        with self.lock:
            self._save_unlocked()

    # --- ARTICLE METHODS ---

    def exists_url(self, url: str) -> bool:
        with self.lock:
            return url in self._url_index

    def get_article_by_id(self, article_id: int) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self._article_id_map.get(article_id)

    def add_article(self, article: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            if "id" not in article or not article["id"]:
                article["id"] = self._next_article_id
                self._next_article_id += 1

            now_iso = datetime.utcnow().isoformat()
            if "created_at" not in article or not article["created_at"]:
                article["created_at"] = now_iso
            elif isinstance(article["created_at"], datetime):
                article["created_at"] = article["created_at"].isoformat()

            if isinstance(article.get("published_at"), datetime):
                article["published_at"] = article["published_at"].isoformat()

            self.articles.append(article)
            self._article_id_map[article["id"]] = article
            if "url" in article:
                self._url_index[article["url"]] = article["id"]

            self._save_unlocked()
            return article

    def update_article(self, article_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self.lock:
            art = self._article_id_map.get(article_id)
            if not art:
                return None
            for k, v in updates.items():
                if isinstance(v, datetime):
                    art[k] = v.isoformat()
                else:
                    art[k] = v
            self._save_unlocked()
            return art

    def get_articles(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        badge: Optional[str] = None,
        tag: Optional[str] = None,
        search: Optional[str] = None,
        only_primary: bool = True,
        page: int = 1,
        limit: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self.lock:
            filtered = []
            search_lower = search.lower().strip() if search else None
            tag_lower = tag.lower().strip() if tag else None

            for a in self.articles:
                if a.get("is_spam", False):
                    continue
                if only_primary and not a.get("is_primary", True):
                    continue
                if region and a.get("region") != region:
                    continue
                if category and a.get("category") != category:
                    continue
                if badge and a.get("badge") != badge:
                    continue
                if tag_lower:
                    tags_str = str(a.get("tags", "")).lower()
                    if tag_lower not in tags_str:
                        continue
                if search_lower:
                    title_match = search_lower in a.get("title", "").lower()
                    summary_match = search_lower in (a.get("summary_short", "") or "").lower()
                    if not (title_match or summary_match):
                        continue

                filtered.append(a)

            # Sắp xếp: hot_score giảm dần, published_at giảm dần
            filtered.sort(
                key=lambda x: (x.get("hot_score", 0.0), parse_dt(x.get("published_at"))),
                reverse=True
            )

            total = len(filtered)
            offset = (page - 1) * limit
            items = filtered[offset:offset + limit]
            return items, total

    def get_top_6h_articles(self, region: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
        with self.lock:
            # Nếu người dùng chọn riêng Thế Giới (world), 100% là tin công nghệ quốc tế
            if region == "world":
                candidates = [
                    a for a in self.articles 
                    if not a.get("is_spam", False) and a.get("is_primary", True) and a.get("region") == "world"
                ]
                candidates.sort(key=lambda x: (x.get("hot_score", 0.0), parse_dt(x.get("published_at"))), reverse=True)
                seen_clusters = set()
                deduped = []
                for art in candidates:
                    cid = art.get("cluster_id") or f"art_{art['id']}"
                    if cid not in seen_clusters:
                        seen_clusters.add(cid)
                        deduped.append(art)
                    if len(deduped) >= limit:
                        break
                return deduped

            # Khi xem "Tất cả" hoặc "Việt Nam": Ưu tiên đúng 50% tin Công nghệ và 50% tin Thời sự nóng
            target_tech = limit // 2
            target_other = limit - target_tech

            tech_candidates = []
            other_candidates = []

            for a in self.articles:
                if a.get("is_spam", False) or not a.get("is_primary", True):
                    continue
                if region and a.get("region") != region:
                    continue
                
                if is_tech_article(a):
                    tech_candidates.append(a)
                else:
                    other_candidates.append(a)

            # Sắp xếp theo hot_score và thời gian mới nhất
            tech_candidates.sort(key=lambda x: (x.get("hot_score", 0.0), parse_dt(x.get("published_at"))), reverse=True)
            other_candidates.sort(key=lambda x: (x.get("hot_score", 0.0), parse_dt(x.get("published_at"))), reverse=True)

            # Lọc trùng lặp sự kiện (cluster) cho mỗi nhóm
            seen_tech_clusters = set()
            deduped_tech = []
            for art in tech_candidates:
                cid = art.get("cluster_id") or f"art_{art['id']}"
                if cid not in seen_tech_clusters:
                    seen_tech_clusters.add(cid)
                    deduped_tech.append(art)
                if len(deduped_tech) >= target_tech:
                    break

            seen_other_clusters = set()
            deduped_other = []
            for art in other_candidates:
                cid = art.get("cluster_id") or f"art_{art['id']}"
                if cid not in seen_other_clusters:
                    seen_other_clusters.add(cid)
                    deduped_other.append(art)
                if len(deduped_other) >= target_other:
                    break

            # Nếu một bên thiếu tin do giới hạn bộ lọc, lấy thêm từ bên còn lại để luôn đủ số lượng
            if len(deduped_tech) < target_tech:
                extra_needed = target_tech - len(deduped_tech)
                for art in other_candidates:
                    cid = art.get("cluster_id") or f"art_{art['id']}"
                    if cid not in seen_other_clusters:
                        seen_other_clusters.add(cid)
                        deduped_other.append(art)
                    if len(deduped_other) >= (target_other + extra_needed):
                        break
            elif len(deduped_other) < target_other:
                extra_needed = target_other - len(deduped_other)
                for art in tech_candidates:
                    cid = art.get("cluster_id") or f"art_{art['id']}"
                    if cid not in seen_tech_clusters:
                        seen_tech_clusters.add(cid)
                        deduped_tech.append(art)
                    if len(deduped_tech) >= (target_tech + extra_needed):
                        break

            # Trộn xen kẽ nhịp nhàng 1:1 [Tech 1, Other 1, Tech 2, Other 2, ...]
            mixed = []
            max_len = max(len(deduped_tech), len(deduped_other))
            for i in range(max_len):
                if i < len(deduped_tech):
                    mixed.append(deduped_tech[i])
                if i < len(deduped_other):
                    mixed.append(deduped_other[i])
                if len(mixed) >= limit:
                    break

            # Ghim tin đặc biệt (thời tiết, giá vàng) lên đầu danh sách
            special_articles = [
                a for a in self.articles
                if a.get("category") == "special" and not a.get("is_spam", False)
            ]
            # Sắp xếp: thời tiết (hot_score 9999) trước, giá vàng (9998) sau
            special_articles.sort(key=lambda x: x.get("hot_score", 0), reverse=True)
            # Loại bỏ tin đặc biệt khỏi mixed nếu đã lọt vào
            special_ids = {a["id"] for a in special_articles}
            mixed = [a for a in mixed if a.get("id") not in special_ids]
            # Ghim đầu, đảm bảo tổng không vượt limit
            combined = special_articles + mixed
            return combined[:limit]


    def get_trending_articles(self, region: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        with self.lock:
            now = datetime.utcnow()
            since_12h = now - timedelta(hours=12)

            filtered = []
            for a in self.articles:
                if a.get("is_spam", False) or not a.get("is_primary", True):
                    continue
                if region and a.get("region") != region:
                    continue
                pub = parse_dt(a.get("published_at"))
                if pub >= since_12h:
                    filtered.append(a)

            filtered.sort(
                key=lambda x: (x.get("velocity_score", 0.0), x.get("hot_score", 0.0)),
                reverse=True
            )
            return filtered[:limit]

    def get_starred_articles(self) -> List[Dict[str, Any]]:
        with self.lock:
            filtered = [
                a for a in self.articles 
                if a.get("is_starred", False) and not a.get("is_spam", False)
            ]
            filtered.sort(
                key=lambda x: parse_dt(x.get("published_at")),
                reverse=True
            )
            return filtered

    def get_recent_articles_for_dedup(self, region: str, since_time: datetime, limit: int = 150) -> List[Dict[str, Any]]:
        with self.lock:
            res = []
            for a in self.articles:
                if a.get("is_spam", False):
                    continue
                if a.get("region") != region:
                    continue
                pub = parse_dt(a.get("published_at"))
                if pub >= since_time:
                    res.append(a)
            res.sort(key=lambda x: parse_dt(x.get("published_at")), reverse=True)
            return res[:limit]

    # --- CLUSTER METHODS ---

    def get_cluster_by_id(self, cluster_id: int) -> Optional[Dict[str, Any]]:
        with self.lock:
            return self._cluster_id_map.get(cluster_id)

    def get_recent_clusters(self, region: str, since_time: datetime, limit: int = 100) -> List[Dict[str, Any]]:
        with self.lock:
            res = []
            for c in self.clusters:
                if c.get("region") != region:
                    continue
                last_seen = parse_dt(c.get("last_seen_at"))
                if last_seen >= since_time:
                    res.append(c)
            res.sort(key=lambda x: parse_dt(x.get("last_seen_at")), reverse=True)
            return res[:limit]

    def add_cluster(self, cluster: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            if "id" not in cluster or not cluster["id"]:
                cluster["id"] = self._next_cluster_id
                self._next_cluster_id += 1

            if isinstance(cluster.get("first_seen_at"), datetime):
                cluster["first_seen_at"] = cluster["first_seen_at"].isoformat()
            if isinstance(cluster.get("last_seen_at"), datetime):
                cluster["last_seen_at"] = cluster["last_seen_at"].isoformat()

            self.clusters.append(cluster)
            self._cluster_id_map[cluster["id"]] = cluster
            self._save_unlocked()
            return cluster

    def update_cluster(self, cluster_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self.lock:
            clust = self._cluster_id_map.get(cluster_id)
            if not clust:
                return None
            for k, v in updates.items():
                if isinstance(v, datetime):
                    clust[k] = v.isoformat()
                else:
                    clust[k] = v
            self._save_unlocked()
            return clust

    def get_cluster_articles(self, cluster_id: int, exclude_article_id: Optional[int] = None) -> List[Dict[str, Any]]:
        with self.lock:
            res = []
            for a in self.articles:
                if a.get("cluster_id") == cluster_id:
                    if exclude_article_id and a.get("id") == exclude_article_id:
                        continue
                    res.append(a)
            return res

    # --- CRAWL LOG METHODS ---

    def add_crawl_log(self, log_dict: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            if "id" not in log_dict or not log_dict["id"]:
                log_dict["id"] = self._next_log_id
                self._next_log_id += 1

            if isinstance(log_dict.get("started_at"), datetime):
                log_dict["started_at"] = log_dict["started_at"].isoformat()
            if isinstance(log_dict.get("finished_at"), datetime):
                log_dict["finished_at"] = log_dict["finished_at"].isoformat()

            self.crawl_logs.append(log_dict)
            self._log_id_map[log_dict["id"]] = log_dict
            self._save_unlocked()
            return log_dict

    def update_crawl_log(self, log_id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self.lock:
            l = self._log_id_map.get(log_id)
            if not l:
                return None
            for k, v in updates.items():
                if isinstance(v, datetime):
                    l[k] = v.isoformat()
                else:
                    l[k] = v
            self._save_unlocked()
            return l

    def get_latest_crawl_log(self) -> Optional[Dict[str, Any]]:
        with self.lock:
            if not self.crawl_logs:
                return None
            return self.crawl_logs[-1]

    # --- STATS & CLEANUP ---

    def get_stats_overview(self) -> Dict[str, Any]:
        with self.lock:
            total = 0
            vn_hot = 0
            vn_tech = 0
            world_tech = 0
            hot_count = 0
            trending_count = 0
            source_counter: Dict[str, int] = {}

            for a in self.articles:
                if a.get("is_spam", False):
                    continue
                total += 1
                cat = a.get("category")
                if cat == "hot_vn":
                    vn_hot += 1
                elif cat == "tech_vn":
                    vn_tech += 1
                elif cat == "tech_world":
                    world_tech += 1

                badge = a.get("badge")
                if badge == "hot":
                    hot_count += 1
                elif badge == "trending":
                    trending_count += 1

                src = a.get("source_name", "Không rõ")
                source_counter[src] = source_counter.get(src, 0) + 1

            sorted_sources = sorted(source_counter.items(), key=lambda x: x[1], reverse=True)[:10]
            top_sources = [{"source": s[0], "count": s[1]} for s in sorted_sources]

            return {
                "total_articles": total,
                "vietnam_hot": vn_hot,
                "vietnam_tech": vn_tech,
                "world_tech": world_tech,
                "hot_now_count": hot_count,
                "trending_count": trending_count,
                "top_sources": top_sources
            }

    def cleanup_old_articles(self, days: int = 30) -> Tuple[int, int]:
        with self.lock:
            cutoff = datetime.utcnow() - timedelta(days=days)
            initial_art_count = len(self.articles)
            initial_log_count = len(self.crawl_logs)

            # Chỉ xóa tin cũ chưa đánh dấu sao
            self.articles = [
                a for a in self.articles
                if parse_dt(a.get("published_at")) >= cutoff or a.get("is_starred", False)
            ]

            # Xóa crawl log cũ
            self.crawl_logs = [
                l for l in self.crawl_logs
                if parse_dt(l.get("started_at")) >= cutoff
            ]

            deleted_articles = initial_art_count - len(self.articles)
            deleted_logs = initial_log_count - len(self.crawl_logs)

            self._rebuild_indices()
            self._save_unlocked()
            return deleted_articles, deleted_logs

# Singleton instance
storage = JSONStorage()

def get_storage() -> JSONStorage:
    return storage
