"""Application configuration, loaded from environment / .env file."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # PostgreSQL connection string, e.g.
    # postgresql+psycopg://user:password@localhost:5432/finance
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/finance"

    # Frontend origin allowed by CORS (Vite dev server).
    frontend_origin: str = "http://localhost:5173"

    app_name: str = "Personal Finance API"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-lite-latest"


settings = Settings()
