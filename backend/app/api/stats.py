from fastapi import APIRouter, Depends
from app.core.storage import get_storage, JSONStorage
from app.schemas.article import StatsOverview

router = APIRouter(prefix="/api/stats", tags=["Stats"])

@router.get("", response_model=StatsOverview)
def get_stats_overview(storage: JSONStorage = Depends(get_storage)):
    data = storage.get_stats_overview()
    return StatsOverview(
        total_articles=data["total_articles"],
        vietnam_hot=data["vietnam_hot"],
        vietnam_tech=data["vietnam_tech"],
        world_tech=data["world_tech"],
        hot_now_count=data["hot_now_count"],
        trending_count=data["trending_count"],
        top_sources=data["top_sources"]
    )
