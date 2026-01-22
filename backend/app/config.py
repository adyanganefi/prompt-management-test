import os
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/prompt_management"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5433/prompt_management"
    
    # JWT
    secret_key: str = "your-super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    
    # Encryption
    encryption_key: str = "dGhpcy1pcy1hLXNlY3JldC1rZXktMzItYnl0ZXM="
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = True
    
    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    
    class Config:
        env_file = ".env"
        extra = "allow"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
