"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "ASTRA API"
    environment: str = "development"
    debug: bool = True

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/astra"
    redis_url: str = "redis://localhost:6379/0"

    cors_origins: list[str] = ["http://localhost:3000"]

    # --- Auth (AD-2: short-lived access + long-lived refresh) ---
    jwt_secret: str = (
        "dev-only-change-me"  # override via JWT_SECRET env in real deploys
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7


settings = Settings()
