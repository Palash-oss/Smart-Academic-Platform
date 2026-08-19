import socket
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


def resolve_db_host(host: str) -> str:
    """Resolves database hostname: uses 'localhost' if running outside Docker container when 'db' is specified."""
    if host == "db":
        try:
            socket.gethostbyname("db")
            return "db"
        except socket.gaierror:
            return "localhost"
    return host


class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Academic Platform API"
    VERSION: str = "0.1.0"
    
    # Database Configuration
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "smart_academic_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # LLMs (Primary: Gemini, Backup: Grok)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GROK_API_KEY: Optional[str] = None
    GROK_MODEL: str = "grok-2"

    @property
    def EFFECTIVE_POSTGRES_HOST(self) -> str:
        return resolve_db_host(self.POSTGRES_HOST)

    @property
    def DATABASE_URL(self) -> str:
        host = self.EFFECTIVE_POSTGRES_HOST
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{host}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        host = self.EFFECTIVE_POSTGRES_HOST
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{host}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Auth & Security
    JWT_SECRET: str = "academic_secret_jwt_key_change_in_production_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )



settings = Settings()
