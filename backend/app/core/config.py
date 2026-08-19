from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Academic Platform API"
    VERSION: str = "0.1.0"
    
    # Database Configuration
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "smart_academic_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@db:5432/smart_academic_db"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://postgres:postgres@db:5432/smart_academic_db"

    # Auth & Security
    JWT_SECRET: str = "academic_secret_jwt_key_change_in_production_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # LLMs (Primary: Gemini, Backup: Grok)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GROK_API_KEY: Optional[str] = None
    GROK_MODEL: str = "grok-2"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
