"""
Script Dọn Sạch Cơ Sở Dữ Liệu (Reset Clean Database)
===================================================
1. Xóa sạch toàn bộ dữ liệu thí sinh, bài nộp, trận đấu và replay.
2. Tạo mới toàn bộ bảng theo schema chuẩn.
3. Khởi tạo tài khoản Quản Trị Viên (Admin BTC):
     Email:    admin@uet.vnu.edu.vn
     Mật khẩu: admin123
"""

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Thêm thư mục backend vào sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.submission import Submission
from app.models.match import Match, Replay
from app.routers.auth import hash_password


def reset_database():
    print("[*] Đang xóa sạch toàn bộ các bảng trong cơ sở dữ liệu...")
    Base.metadata.drop_all(bind=engine)
    print("[*] Đang tái tạo cấu trúc bảng mới...")
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        admin_user = User(
            id="admin-master",
            name="Ban Tổ Chức Giải Đấu (Admin)",
            email="admin@uet.vnu.edu.vn",
            hashed_password=hash_password("admin123"),
            student_id="ADMIN001",
            class_name="BTC-INT3304",
            is_admin=True,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        print("[✓] Đã khởi tạo tài khoản Admin mặc định:")
        print("    - Email:    admin@uet.vnu.edu.vn")
        print("    - Mật khẩu: admin123")
        print(f"[✓] Cơ sở dữ liệu sạch: 1 User (Admin), 0 Bài nộp, 0 Trận đấu.")


if __name__ == "__main__":
    reset_database()
