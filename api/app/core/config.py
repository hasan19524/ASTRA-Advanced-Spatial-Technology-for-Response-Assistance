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
    groq_model: str = "openai/gpt-oss-20b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # OpenRouter (free models: :free suffix)
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemma-4-31b-it:free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # NVIDIA NIM (free credits)
    nvidia_api_key: str = ""
    nvidia_model: str = "google/gemma-4-31b-it"
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"

    # --- Weather (OpenWeatherMap, free tier) ---
    weather_api_key: str = ""
    weather_base_url: str = "https://api.openweathermap.org/data/2.5"

    # --- Gnani voice (T3, Phase 2) ---
    gnani_api_key: str = ""
    gnani_base_url: str = "https://api.vachana.ai"

    # --- Demo affordance (Day 4, audit S1) — NEVER enable outside the demo ---
    demo_mode: bool = False  # DEMO_MODE=true enables POST /auth/demo-login
    demo_password: str = "astra-demo-2026"  # server-side only; never sent to clients

    # --- Poll (Day 4) ---
    poll_rate_limit: int = 5  # votes per window, per user
    poll_rate_window_seconds: int = 60

    # --- Auth rate limiting (brute-force protection) ---
    # Per IP *and* per auth endpoint, so a registration burst never locks
    # citizens out of logging in behind the same NAT address.
    auth_rate_limit: int = 10
    auth_rate_window_seconds: int = 60

    # --- Routing graph (AD-4) ---
    # The OSM graph (~406k nodes / ~475k edges) is loaded into memory at
    # startup. On a free tier that costs ~7 s and ~190 MB, so it is loaded in
    # the BACKGROUND: the API starts serving immediately and the first /route
    # request waits for the build to finish instead of the container refusing
    # connections. Set to false to skip the pre-warm entirely (the graph is
    # then built lazily on the first route request).
    routing_prewarm: bool = True

    # --- Evidence media storage (AD-8) ---
    # "local" writes to api/uploads/ — fine for development, but Render's free
    # tier has an EPHEMERAL filesystem: every redeploy and every spin-down
    # deletes the photos. "s3" puts them in an S3-compatible bucket (Cloudflare
    # R2, AWS S3, MinIO…) so they survive. The API always serves them through
    # the same signed-URL route, so the access rule never changes.
    media_storage: str = "local"  # local | s3
    media_url_ttl_seconds: int = 3600  # signed-URL lifetime
    s3_endpoint_url: str = ""  # R2: https://<account>.r2.cloudflarestorage.com
    s3_region: str = "auto"
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_key_prefix: str = "evidence"

    @model_validator(mode="after")
    def _reject_known_secrets(self) -> "Settings":
        if not self.jwt_secret or self.jwt_secret in FORBIDDEN_JWT_SECRETS:
            raise ValueError(
                "JWT_SECRET is missing or a known default — set a random value "
                "(api/.env.example shows how); booting is refused"
            )
        return self


settings = Settings()
