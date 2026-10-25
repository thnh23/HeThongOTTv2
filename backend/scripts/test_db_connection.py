"""
Script Kiểm Tra Kết Nối Cơ Sở Dữ Liệu Neon PostgreSQL
=====================================================
Sử dụng:
    python scripts/test_db_connection.py
hoặc:
    python scripts/test_db_connection.py "postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"
"""

import sys
import os
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import create_engine, text, inspect
from app.config import settings


def test_connection(url: str = None):
    target_url = url or settings.DATABASE_URL
    if not target_url:
        print("[LỖI] Không tìm thấy URL kết nối. Vui lòng truyền URL hoặc điền vào .env")
        return False

    # Chuẩn hóa postgresql prefix nếu dùng postgres://
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif target_url.startswith("postgresql://") and not target_url.startswith("postgresql+"):
        target_url = target_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Ẩn password khi in ra console
    masked_url = target_url
    if "@" in target_url and "://" in target_url:
        scheme, rest = target_url.split("://", 1)
        cred, host_part = rest.split("@", 1)
        if ":" in cred:
            user, _ = cred.split(":", 1)
            masked_url = f"{scheme}://{user}:***@{host_part}"

    print(f"[*] Đang thử kết nối tới: {masked_url} ...")

    try:
        engine = create_engine(
            target_url,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False} if "sqlite" in target_url else {},
        )
        with engine.connect() as conn:
            # 1. Kiểm tra phiên bản DB
            res = conn.execute(text("SELECT version();")).scalar()
            print("[+] KẾT NỐI THÀNH CÔNG!")
            print(f"    - Database Version: {res}")

            # 2. Kiểm tra danh sách bảng
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            print(f"    - Các bảng hiện có: {tables if tables else 'Chưa có bảng nào (Sẽ tự tạo khi backend chạy)'}")

            # 3. Đếm số lượng User nếu bảng users đã tồn tại
            if "users" in tables:
                count = conn.execute(text("SELECT COUNT(*) FROM users;")).scalar()
                print(f"    - Số lượng thí sinh/tài khoản trong bảng users: {count}")

        return True

    except Exception as e:
        print(f"[-] KẾT NỐI THẤT BÀI!")
        print(f"    Chi tiết lỗi: {e}")
        return False


if __name__ == "__main__":
    url_arg = sys.argv[1] if len(sys.argv) > 1 else None
    success = test_connection(url_arg)
    sys.exit(0 if success else 1)
