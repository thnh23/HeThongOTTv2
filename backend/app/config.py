"""
Cấu hình ứng dụng OTTv2 Platform — Đọc tự động từ biến môi trường (.env)
"""

import os
import secrets
from pathlib import Path
from pydantic import BaseSettings, root_validator

# Đường dẫn tuyệt đối tới file .env trong thư mục backend
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    # 1. Cơ sở dữ liệu
    DATABASE_URL: str = "sqlite:///./ottv2.db"

    # 2. Xác thực JWT (Bắt buộc nạp từ .env; không lưu secret key cố định trong file code)
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 giờ

    # 3. Lưu trữ tệp tin
    STORAGE_PATH: str = "./storage"

    # 4. CORS & Địa chỉ Web Client
    FRONTEND_URL: str = "http://localhost:5173"

    # 5. Kênh nộp bài giải đấu (Trụ cột 1)
    GOOGLE_FORM_URL: str = "https://forms.gle/uak6BpK1RExMs41M8"
    GITHUB_TEMPLATE_URL: str = "https://github.com/uet-network-programming/ottv2-bot-template"

    @root_validator(pre=True)
    def ensure_secure_secret_key(cls, values):
        """
        Bảo vệ an ninh tuyệt đối:
        - Nếu SECRET_KEY chưa được đặt trong .env hoặc còn mang giá trị placeholder cũ,
          hệ thống sẽ tự động sinh khóa ngẫu nhiên bảo mật 256-bit trong bộ nhớ,
          không bao giờ sử dụng chuỗi cố định để tránh giả mạo token JWT.
        """
        key = values.get("SECRET_KEY") or os.getenv("SECRET_KEY")
        if not key or key == "CHANGE_ME_use_openssl_rand_hex_32":
            values["SECRET_KEY"] = secrets.token_hex(32)
        return values

    class Config:
        env_file = str(ENV_FILE) if ENV_FILE.exists() else ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()


