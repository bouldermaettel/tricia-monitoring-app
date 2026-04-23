from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Load from .env file if it exists; try both relative paths (local dev) and absolute (container)
    env_file: str = str(Path(__file__).parent.parent.parent / ".env")
    model_config = SettingsConfigDict(env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    database_url: str = "sqlite:///./data/tricia-monitoring.db"
    cors_origins: str = "http://localhost:5173"
    secret_key: str = "change-me-in-production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
