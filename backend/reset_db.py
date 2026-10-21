"""
OTTv2 Database Reset Script
Xóa toàn bộ các bảng trong database và nạp lại dữ liệu khởi tạo mẫu chuẩn 9x9.
Chạy: python reset_db.py
"""

import sys
import os
import subprocess

# Ensure backend root is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Auto-detect and switch to virtual environment if current interpreter lacks dependencies
venv_win = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
venv_unix = os.path.join(BASE_DIR, ".venv", "bin", "python")
venv_python = venv_win if os.path.exists(venv_win) else (venv_unix if os.path.exists(venv_unix) else None)

if venv_python and os.path.normcase(sys.executable) != os.path.normcase(venv_python):
    try:
        import sqlalchemy
    except ModuleNotFoundError:
        res = subprocess.run([venv_python] + sys.argv, cwd=BASE_DIR)
        sys.exit(res.returncode)

from sqlalchemy import text
from app.database import Base, engine, create_all_tables
from seed_demo_data import seed_data


def reset_database(seed: bool = True):
    print("Đang xóa tất cả các bảng trong database...")
    is_postgres = "postgres" in str(engine.url).lower()

    if is_postgres:
        with engine.connect() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE;"))
            conn.execute(text("CREATE SCHEMA public;"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
            conn.commit()
        print("✓ Đã drop sạch schema public trên PostgreSQL thành công!")
    else:
        Base.metadata.drop_all(bind=engine)
        print("✓ Đã drop tất cả các bảng SQLite thành công!")

    print("Đang khởi tạo lại cấu trúc bảng mới...")
    create_all_tables()

    if seed:
        print("Đang nạp dữ liệu mẫu ban đầu...")
        seed_data()
        print("✅ Đã reset database và nạp dữ liệu mẫu thành công!")
    else:
        print("✅ Đã reset database về trạng thái TRẮNG (không nạp dữ liệu mẫu)!")


if __name__ == "__main__":
    should_seed = "--no-seed" not in sys.argv
    reset_database(seed=should_seed)
