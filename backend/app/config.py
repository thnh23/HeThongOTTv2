"""
Cấu hình ứng dụng OTTv2 Platform — Đọc tự động từ biến môi trường (.env)
"""

from pydantic import BaseSettings


class Settings(BaseSettings):
    # 1. Cơ sở dữ liệu
    DATABASE_URL: str = "sqlite:///./ottv2.db"

    # 2. Xác thực JWT
    SECRET_KEY: str = "CHANGE_ME_use_openssl_rand_hex_32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 giờ

    # 3. Lưu trữ tệp tin
    STORAGE_PATH: str = "./storage"

    # 4. CORS & Địa chỉ Web Client
    FRONTEND_URL: str = "http://localhost:5173"

    # 5. Kênh nộp bài giải đấu (Trụ cột 1)
    GOOGLE_FORM_URL: str = "https://forms.gle/uak6BpK1RExMs41M8"
    GITHUB_TEMPLATE_URL: str = "https://github.com/uet-network-programming/ottv2-bot-template"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

