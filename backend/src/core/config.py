from functools import lru_cache
from pathlib import Path

import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_repo_config() -> dict:
    config_path = Path(__file__).resolve().parents[3] / "config.yml"
    if not config_path.exists():
        return {}

    with config_path.open("r", encoding="utf-8") as config_file:
        parsed = yaml.safe_load(config_file) or {}
        return parsed if isinstance(parsed, dict) else {}


class Settings(BaseSettings):
    # Load from .env file if it exists; try both relative paths (local dev) and absolute (container)
    env_file: str = str(Path(__file__).parent.parent.parent / ".env")
    model_config = SettingsConfigDict(env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    database_url: str = "sqlite:///./data/tricia-monitoring.db"
    cors_origins: str = "http://localhost:5173"
    secret_key: str = "change-me-in-production-32-byte-minimum-key"
    bootstrap_admin_username: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_display_name: str = "System Admin"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    repo_config = _load_repo_config()
    bootstrap_admin = repo_config.get("auth", {}).get("bootstrap_admin", {})

    if not settings.bootstrap_admin_username:
        settings.bootstrap_admin_username = str(bootstrap_admin.get("username", "")).strip()
    if not settings.bootstrap_admin_password:
        settings.bootstrap_admin_password = str(bootstrap_admin.get("password", ""))
    if settings.bootstrap_admin_display_name == "System Admin":
        display_name = str(bootstrap_admin.get("display_name", "")).strip()
        if display_name:
            settings.bootstrap_admin_display_name = display_name

    return settings
