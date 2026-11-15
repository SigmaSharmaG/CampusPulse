from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://campuspulse:campuspulse@localhost:5432/campuspulse"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    ws_heartbeat_seconds: int = Field(default=30, ge=5, le=300)
    simulation_interval_seconds: int = Field(default=5, ge=1, le=60)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
