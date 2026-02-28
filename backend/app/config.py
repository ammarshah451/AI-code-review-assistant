"""Configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    environment: str = "development"
    debug: bool = False

    # CORS
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Database (Supabase)
    supabase_url: str = ""
    supabase_key: str = ""
    database_url: str = ""

    # Redis (Upstash)
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    # Google AI (Gemini)
    google_api_key: str = ""
    llm_model: str = "gemini-2.5-flash-preview-05-20"

    # GitHub
    github_app_id: str = ""
    github_private_key: str = ""
    github_webhook_secret: str = ""
    github_token: str = ""  # Personal access token for API calls

    # LangSmith
    langchain_api_key: str = ""
    langchain_project: str = "codeguard-ai"
    langchain_tracing_v2: bool = True


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
