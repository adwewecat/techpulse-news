from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    DATA_FILE: Path = BASE_DIR / "data" / "news_data.json"
    DATABASE_URL: Optional[str] = None
    CRAWL_INTERVAL_MINUTES: int = 30
    HOST: str = "0.0.0.0"
    PORT: int = 8002
    GEMINI_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

settings = Settings()
