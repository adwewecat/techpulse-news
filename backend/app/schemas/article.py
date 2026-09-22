from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import json

class RelatedArticle(BaseModel):
    id: int
    title: str
    url: str
    source_name: str
    source_domain: str
    published_at: datetime

    class Config:
        from_attributes = True

class ArticleOut(BaseModel):
    id: int
    cluster_id: Optional[int] = None
    title: str
    slug: Optional[str] = None
    url: str
    source_name: str
    source_domain: str
    source_tier: float
    region: str
    category: str
    summary_short: Optional[str] = None
    summary_bullets: List[str] = []
    image_url: Optional[str] = None
    tags: List[str] = []
    published_at: datetime
    created_at: datetime
    view_count: int = 0
    click_count: int = 0
    hot_score: float = 0.0
    velocity_score: float = 0.0
    badge: str = "new"
    is_spam: bool = False
    is_primary: bool = True
    is_starred: bool = False
    deep_analysis: Optional[str] = None
    related_sources_count: int = 1
    related_articles: List[RelatedArticle] = []

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_custom(cls, article, related_articles=None, source_count=1):
        def g(k, default=None):
            if isinstance(article, dict):
                return article.get(k, default)
            return getattr(article, k, default)

        def parse_dt_field(val):
            if isinstance(val, datetime):
                return val
            if isinstance(val, str):
                try:
                    return datetime.fromisoformat(val.replace("Z", "+00:00"))
                except Exception:
                    pass
            return datetime.utcnow()

        summary_bullets_val = g("summary_bullets")
        bullets = []
        if summary_bullets_val:
            if isinstance(summary_bullets_val, list):
                bullets = summary_bullets_val
            else:
                try:
                    bullets = json.loads(summary_bullets_val)
                except Exception:
                    bullets = [b.strip() for b in str(summary_bullets_val).split("\n") if b.strip()]

        tags_val = g("tags")
        tags_list = []
        if tags_val:
            if isinstance(tags_val, list):
                tags_list = tags_val
            else:
                try:
                    tags_list = json.loads(tags_val)
                except Exception:
                    tags_list = [t.strip() for t in str(tags_val).split(",") if t.strip()]

        rel_list = []
        art_id = g("id")
        if related_articles:
            for rel in related_articles:
                rel_g = (lambda k, d=None: rel.get(k, d)) if isinstance(rel, dict) else (lambda k, d=None: getattr(rel, k, d))
                r_id = rel_g("id")
                if r_id != art_id:
                    rel_list.append(RelatedArticle(
                        id=r_id,
                        title=rel_g("title", ""),
                        url=rel_g("url", ""),
                        source_name=rel_g("source_name", ""),
                        source_domain=rel_g("source_domain", ""),
                        published_at=parse_dt_field(rel_g("published_at"))
                    ))

        return cls(
            id=art_id,
            cluster_id=g("cluster_id"),
            title=g("title", ""),
            slug=g("slug"),
            url=g("url", ""),
            source_name=g("source_name", ""),
            source_domain=g("source_domain", ""),
            source_tier=g("source_tier", 1.0),
            region=g("region", "vietnam"),
            category=g("category", "hot_vn"),
            summary_short=g("summary_short"),
            summary_bullets=bullets,
            image_url=g("image_url"),
            tags=tags_list,
            published_at=parse_dt_field(g("published_at")),
            created_at=parse_dt_field(g("created_at")),
            view_count=g("view_count", 0),
            click_count=g("click_count", 0),
            hot_score=g("hot_score", 0.0),
            velocity_score=g("velocity_score", 0.0),
            badge=g("badge", "new"),
            is_spam=bool(g("is_spam", False)),
            is_primary=bool(g("is_primary", True)),
            is_starred=bool(g("is_starred", False)),
            deep_analysis=g("deep_analysis"),
            related_sources_count=max(source_count, len(rel_list) + 1),
            related_articles=rel_list
        )

class DeepAnalysisPerspective(BaseModel):
    source: str
    perspective: str

class DeepAnalysisImpacts(BaseModel):
    short_term: str
    long_term: str

class DeepAnalysisResponse(BaseModel):
    article_id: int
    title: str
    source_name: str
    url: str
    overview: str
    key_facts: List[str]
    multi_source_perspectives: List[DeepAnalysisPerspective] = []
    deep_analysis: str
    impacts: DeepAnalysisImpacts
    unanswered_questions: List[str] = []
    actionable_takeaway: str
    related_articles: List[RelatedArticle] = []
    generated_at: datetime

class NewsListResponse(BaseModel):
    items: List[ArticleOut]
    total: int
    page: int
    limit: int
    has_more: bool

class CrawlStatusResponse(BaseModel):
    is_running: bool
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    sources_count: int
    total_articles: int
    last_log: Optional[dict] = None

class StatsOverview(BaseModel):
    total_articles: int
    vietnam_hot: int
    vietnam_tech: int
    world_tech: int
    hot_now_count: int
    trending_count: int
    top_sources: List[dict]
