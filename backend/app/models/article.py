from datetime import datetime
from typing import Optional, List, Dict, Any

class StoryCluster:
    def __init__(
        self,
        id: Optional[int] = None,
        headline: str = "",
        region: str = "vietnam",
        category: str = "hot_vn",
        source_count: int = 1,
        hot_score: float = 0.0,
        velocity_score: float = 0.0,
        badge: str = "new",
        summary_ai: Optional[str] = None,
        first_seen_at: Optional[Any] = None,
        last_seen_at: Optional[Any] = None,
        **kwargs
    ):
        self.id = id
        self.headline = headline
        self.region = region
        self.category = category
        self.source_count = source_count
        self.hot_score = hot_score
        self.velocity_score = velocity_score
        self.badge = badge
        self.summary_ai = summary_ai
        self.first_seen_at = first_seen_at or datetime.utcnow().isoformat()
        self.last_seen_at = last_seen_at or datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "headline": self.headline,
            "region": self.region,
            "category": self.category,
            "source_count": self.source_count,
            "hot_score": self.hot_score,
            "velocity_score": self.velocity_score,
            "badge": self.badge,
            "summary_ai": self.summary_ai,
            "first_seen_at": self.first_seen_at if isinstance(self.first_seen_at, str) else self.first_seen_at.isoformat(),
            "last_seen_at": self.last_seen_at if isinstance(self.last_seen_at, str) else self.last_seen_at.isoformat()
        }

class Article:
    def __init__(
        self,
        id: Optional[int] = None,
        cluster_id: Optional[int] = None,
        title: str = "",
        slug: Optional[str] = None,
        url: str = "",
        source_name: str = "",
        source_domain: str = "",
        source_tier: float = 1.0,
        region: str = "vietnam",
        category: str = "hot_vn",
        summary_short: Optional[str] = None,
        summary_bullets: Optional[str] = None,
        content_raw: Optional[str] = None,
        image_url: Optional[str] = None,
        tags: Optional[str] = None,
        published_at: Optional[Any] = None,
        created_at: Optional[Any] = None,
        view_count: int = 0,
        click_count: int = 0,
        hot_score: float = 0.0,
        velocity_score: float = 0.0,
        badge: str = "new",
        is_spam: bool = False,
        is_primary: bool = True,
        is_starred: bool = False,
        deep_analysis: Optional[str] = None,
        deep_analysis_updated_at: Optional[Any] = None,
        **kwargs
    ):
        self.id = id
        self.cluster_id = cluster_id
        self.title = title
        self.slug = slug
        self.url = url
        self.source_name = source_name
        self.source_domain = source_domain
        self.source_tier = source_tier
        self.region = region
        self.category = category
        self.summary_short = summary_short
        self.summary_bullets = summary_bullets
        self.content_raw = content_raw
        self.image_url = image_url
        self.tags = tags
        self.published_at = published_at or datetime.utcnow().isoformat()
        self.created_at = created_at or datetime.utcnow().isoformat()
        self.view_count = view_count
        self.click_count = click_count
        self.hot_score = hot_score
        self.velocity_score = velocity_score
        self.badge = badge
        self.is_spam = is_spam
        self.is_primary = is_primary
        self.is_starred = is_starred
        self.deep_analysis = deep_analysis
        self.deep_analysis_updated_at = deep_analysis_updated_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "cluster_id": self.cluster_id,
            "title": self.title,
            "slug": self.slug,
            "url": self.url,
            "source_name": self.source_name,
            "source_domain": self.source_domain,
            "source_tier": self.source_tier,
            "region": self.region,
            "category": self.category,
            "summary_short": self.summary_short,
            "summary_bullets": self.summary_bullets,
            "content_raw": self.content_raw,
            "image_url": self.image_url,
            "tags": self.tags,
            "published_at": self.published_at if isinstance(self.published_at, str) else self.published_at.isoformat(),
            "created_at": self.created_at if isinstance(self.created_at, str) else self.created_at.isoformat(),
            "view_count": self.view_count,
            "click_count": self.click_count,
            "hot_score": self.hot_score,
            "velocity_score": self.velocity_score,
            "badge": self.badge,
            "is_spam": self.is_spam,
            "is_primary": self.is_primary,
            "is_starred": self.is_starred,
            "deep_analysis": self.deep_analysis,
            "deep_analysis_updated_at": self.deep_analysis_updated_at if (isinstance(self.deep_analysis_updated_at, str) or not self.deep_analysis_updated_at) else self.deep_analysis_updated_at.isoformat()
        }

class CrawlLog:
    def __init__(
        self,
        id: Optional[int] = None,
        started_at: Optional[Any] = None,
        finished_at: Optional[Any] = None,
        sources_crawled: int = 0,
        articles_found: int = 0,
        articles_new: int = 0,
        status: str = "running",
        error_message: Optional[str] = None,
        **kwargs
    ):
        self.id = id
        self.started_at = started_at or datetime.utcnow().isoformat()
        self.finished_at = finished_at
        self.sources_crawled = sources_crawled
        self.articles_found = articles_found
        self.articles_new = articles_new
        self.status = status
        self.error_message = error_message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "started_at": self.started_at if isinstance(self.started_at, str) else self.started_at.isoformat(),
            "finished_at": self.finished_at if (isinstance(self.finished_at, str) or not self.finished_at) else self.finished_at.isoformat(),
            "sources_crawled": self.sources_crawled,
            "articles_found": self.articles_found,
            "articles_new": self.articles_new,
            "status": self.status,
            "error_message": self.error_message
        }
