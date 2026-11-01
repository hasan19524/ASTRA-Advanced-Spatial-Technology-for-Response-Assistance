"""Application settings loaded from environment variables."""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Day 4 (audit S2): signing keys that ever shipped as a default — refused at
# import so no deploy can boot on them. Set JWT_SECRET in .env (see .env.example).
FORBIDDEN_JWT_SECRETS = frozenset(
    {"dev-only-change-me", "ast-ra-dev-secret-change-in-prod"}
)


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
    jwt_secret: str = ""  # no default on purpose — validated below
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # --- Assessment (Day 4 — pluggable backend) ---
    # rules = the deterministic stub (default). llm = LlmBackend with automatic
    # degradation back to rules when the key is missing or the call fails.
    assessment_backend: str = "rules"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"  # OpenAI-compatible
    llm_timeout_seconds: float = 8.0

    # --- Multi-provider free LLMs (assistant + assessment, zero-cost tiers) ---
    # Groq (already the legacy default)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # OpenRouter (free models: :free suffix)
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # NVIDIA NIM (free credits)
    nvidia_api_key: str = ""
    nvidia_model: str = "meta/llama-3.1-8b-instruct"
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"

    # --- Gnani voice (T3, Phase 2) ---
    gnani_api_key: str = ""
    gnani_base_url: str = "https://api.vachana.ai"

    # --- Demo affordance (Day 4, audit S1) — NEVER enable outside the demo ---
    demo_mode: bool = False  # DEMO_MODE=true enables POST /auth/demo-login
    demo_password: str = "astra-demo-2026"  # server-side only; never sent to clients

    # --- Poll (Day 4) ---
    poll_rate_limit: int = 5  # votes per window, per user
    poll_rate_window_seconds: int = 60

    @model_validator(mode="after")
    def _reject_known_secrets(self) -> "Settings":
        if not self.jwt_secret or self.jwt_secret in FORBIDDEN_JWT_SECRETS:
            raise ValueError(
                "JWT_SECRET is missing or a known default — set a random value "
                "(api/.env.example shows how); booting is refused"
            )
        return self


settings = Settings()
