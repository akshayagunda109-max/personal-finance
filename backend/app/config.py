"""Application configuration, loaded from environment / .env file.

In production every secret below must come from a real environment variable
(or a secrets manager) - the defaults here exist only so local development
works out of the box, and `validate_production_settings` refuses to start the
app if a placeholder default leaks into a production deploy.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-insecure-secret-change-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # "development" or "production". Production enables stricter startup checks.
    environment: str = "development"

    # PostgreSQL connection string, e.g.
    # postgresql+psycopg://user:password@localhost:5432/finance
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/finance"

    # Comma-separated list of browser origins allowed to call this API.
    cors_origins: str = "http://localhost:5173"

    app_name: str = "Personal Finance API"

    # Signing key for auth tokens. MUST be overridden in production - anyone
    # who knows it can mint tokens for any user.
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-lite-latest"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


settings = Settings()


def validate_production_settings() -> None:
    """Fail fast rather than serve a production deploy with dev placeholders."""
    if not settings.is_production:
        return

    problems = []
    if settings.jwt_secret == DEV_JWT_SECRET:
        problems.append("JWT_SECRET is still the insecure development default")
    if "localhost" in settings.cors_origins:
        problems.append("CORS_ORIGINS still points at localhost")
    if "postgres:postgres@localhost" in settings.database_url:
        problems.append("DATABASE_URL still points at the local dev database")
    if not settings.gemini_api_key:
        problems.append("GEMINI_API_KEY is not set")

    if problems:
        raise RuntimeError(
            "Refusing to start in production with unsafe configuration:\n  - "
            + "\n  - ".join(problems)
        )
