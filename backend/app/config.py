"""
Application configuration — đọc từ .env (pydantic v1)
"""

from pydantic import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./ottv2.db"

    # JWT
    SECRET_KEY: str = "CHANGE_ME_use_openssl_rand_hex_32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440   # 24h

    # Sandbox
    SANDBOX_TIMEOUT_SEC: float = 5.0
    SANDBOX_MEMORY_MB: int = 128

    # Storage
    STORAGE_PATH: str = "./storage"

    # Admin
    ADMIN_EMAIL: str = "admin@example.com"

    # Tournament Submission (Trụ cột 1: GitHub Template + Google Form)
    GOOGLE_FORM_URL: str = "https://forms.gle/uak6BpK1RExMs41M8"
    GITHUB_TEMPLATE_URL: str = "https://github.com/uet-network-programming/ottv2-bot-template"

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"


    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
