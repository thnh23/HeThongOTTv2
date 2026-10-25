"""
Script Dọn Sạch Cơ Sở Dữ Liệu & Storage (Reset Clean Database & Storage)
======================================================================
1. Xóa sạch toàn bộ dữ liệu bảng trong cơ sở dữ liệu (Users, Submissions, Matches).
2. Tạo mới toàn bộ bảng theo schema chuẩn.
3. Khởi tạo tài khoản Quản Trị Viên (Admin BTC):
     Email:    admin@uet.vnu.edu.vn
     Mật khẩu: admin123
4. Dọn sạch các tệp xuất bản tĩnh (.json) tại published/ và frontend/public/data/.
5. Dọn sạch toàn bộ tệp tin rác trong backend/storage/:
     - storage/tournament/ (kết quả vòng Thụy Sĩ, config Top 32, bracket)
     - storage/replays/ (các tệp replay trận đấu cũ)
     - storage/submissions/repos/ (các repository bot sinh viên đã clone)
     - storage/submissions/temp/ & moss_report.md
"""

import os
import sys
import stat
import shutil
import argparse
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Thêm thư mục backend vào sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.features.auth.service import hash_password


def handle_remove_readonly(func, path, exc_info):
    """Xử lý lỗi PermissionError/Access Denied khi xóa thư mục git có file readonly trên Windows."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def clean_published_files():
    """Xóa các tệp JSON tĩnh đã xuất bản để tránh hiển thị bảng xếp hạng giả."""
    published_dirs = [
        BASE_DIR / "published",
        BASE_DIR.parent / "frontend" / "public" / "data",
    ]
    for pdir in published_dirs:
        if pdir.exists():
            deleted_count = 0
            for jf in pdir.glob("*.json"):
                try:
                    jf.unlink(missing_ok=True)
                    deleted_count += 1
                except Exception:
                    pass
            print(f"[✓] Đã dọn sạch {deleted_count} tệp JSON tĩnh tại: {pdir}")


def clean_storage_files(keep_repos: bool = False, keep_template_cache: bool = True):
    """
    Dọn sạch các tệp dữ liệu giải đấu trong backend/storage/:
    - storage/tournament: Xóa các round Thụy Sĩ, Top 32 bracket và config.
    - storage/replays: Xóa các tệp replay trận đấu cũ.
    - storage/submissions: Xóa mã nguồn bot clone cũ, thư mục temp và báo cáo MOSS.
    """
    storage_dir = BASE_DIR / "storage"
    if not storage_dir.exists():
        storage_dir.mkdir(parents=True, exist_ok=True)
        return

    print("[*] Đang dọn sạch tệp tin trong backend/storage/...")

    # 1. Dọn dẹp storage/tournament
    tournament_dir = storage_dir / "tournament"
    if tournament_dir.exists():
        for item in tournament_dir.iterdir():
            if item.name == ".gitkeep":
                continue
            try:
                if item.is_dir():
                    shutil.rmtree(item, onerror=handle_remove_readonly)
                else:
                    item.unlink(missing_ok=True)
            except Exception as e:
                print(f"    [!] Lỗi khi xóa tệp tournament {item.name}: {e}")
        (tournament_dir / ".gitkeep").touch(exist_ok=True)
        print("    [✓] Đã dọn sạch storage/tournament/ (bracket, config, các vòng Thụy Sĩ)")

    # 2. Dọn dẹp storage/replays
    replays_dir = storage_dir / "replays"
    if replays_dir.exists():
        replays_count = 0
        for item in replays_dir.iterdir():
            if item.name == ".gitkeep":
                continue
            try:
                if item.is_dir():
                    shutil.rmtree(item, onerror=handle_remove_readonly)
                else:
                    item.unlink(missing_ok=True)
                    replays_count += 1
            except Exception as e:
                print(f"    [!] Lỗi khi xóa replay {item.name}: {e}")
        (replays_dir / ".gitkeep").touch(exist_ok=True)
        print(f"    [✓] Đã dọn sạch storage/replays/ ({replays_count} tệp replay)")

    # 3. Dọn dẹp storage/submissions
    submissions_dir = storage_dir / "submissions"
    if submissions_dir.exists():
        # Xóa các tệp lẻ như moss_report.md
        for f in submissions_dir.glob("*.md"):
            f.unlink(missing_ok=True)
        for f in submissions_dir.glob("*.json"):
            f.unlink(missing_ok=True)

        # Xóa temp
        temp_dir = submissions_dir / "temp"
        if temp_dir.exists():
            for item in temp_dir.iterdir():
                if item.name == ".gitkeep":
                    continue
                try:
                    if item.is_dir():
                        shutil.rmtree(item, onerror=handle_remove_readonly)
                    else:
                        item.unlink(missing_ok=True)
                except Exception:
                    pass
            (temp_dir / ".gitkeep").touch(exist_ok=True)

        # Xóa repos
        repos_dir = submissions_dir / "repos"
        if repos_dir.exists():
            if keep_repos:
                print("    [i] Giữ lại các repository sinh viên đã clone (--keep-repos được bật)")
            else:
                deleted_repos_count = 0
                for item in repos_dir.iterdir():
                    if item.name == ".gitkeep":
                        continue
                    if keep_template_cache and item.name == ".template_cache":
                        continue
                    try:
                        if item.is_dir():
                            shutil.rmtree(item, onerror=handle_remove_readonly)
                            deleted_repos_count += 1
                        else:
                            item.unlink(missing_ok=True)
                    except Exception as e:
                        print(f"    [!] Lỗi khi xóa repo {item.name}: {e}")
                (repos_dir / ".gitkeep").touch(exist_ok=True)
                print(f"    [✓] Đã dọn sạch storage/submissions/repos/ ({deleted_repos_count} thư mục bot)")

        print("    [✓] Đã làm sạch storage/submissions/ (temp, repos, reports)")


def reset_database(keep_repos: bool = False, keep_template_cache: bool = True, custom_db_url: str = None):
    target_engine = engine
    target_session_factory = SessionLocal

    if custom_db_url:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        normalized_url = custom_db_url
        if normalized_url.startswith("postgres://"):
            normalized_url = normalized_url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif normalized_url.startswith("postgresql://") and not normalized_url.startswith("postgresql+"):
            normalized_url = normalized_url.replace("postgresql://", "postgresql+psycopg2://", 1)

        masked = normalized_url
        if "@" in normalized_url and "://" in normalized_url:
            s, r = normalized_url.split("://", 1)
            c, h = r.split("@", 1)
            u = c.split(":", 1)[0] if ":" in c else c
            masked = f"{s}://{u}:***@{h}"
        print(f"[*] Đang kết nối tới Cơ sở dữ liệu: {masked}")

        target_engine = create_engine(
            normalized_url,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False} if "sqlite" in normalized_url else {},
        )
        target_session_factory = sessionmaker(autocommit=False, autoflush=False, bind=target_engine)

    print("[*] Đang xóa sạch toàn bộ các bảng trong cơ sở dữ liệu...")
    Base.metadata.drop_all(bind=target_engine)
    print("[*] Đang tái tạo cấu trúc bảng mới...")
    Base.metadata.create_all(bind=target_engine)

    with target_session_factory() as db:
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

        user_count = db.query(User).count()
        admin_count = db.query(User).filter(User.is_admin == True).count()
        student_count = db.query(User).filter(User.is_admin == False).count()

        print("[✓] Đã khởi tạo tài khoản quản trị mặc định:")
        print("    - Admin:    admin@uet.vnu.edu.vn / admin123")
        print(f"[✓] Cơ sở dữ liệu sạch: {user_count} Users ({admin_count} Admin, {student_count} Thí sinh).")
        print("    [!] Không tự nạp dữ liệu mẫu: Thí sinh sẽ được nhập tự động qua Pipeline từ Google Form (CSV).")

    # Xóa xuất bản tĩnh cục bộ
    clean_published_files()

    # Xóa storage cục bộ
    clean_storage_files(keep_repos=keep_repos, keep_template_cache=keep_template_cache)

    print("\n[✓] HOÀN TẤT: Hệ thống đã được đưa về trạng thái sạch (Clean State) hoàn toàn!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Script dọn sạch CSDL và Storage giải đấu (Trạng thái sạch hoàn toàn)")
    parser.add_argument(
        "--db-url",
        type=str,
        default=None,
        help="Chuỗi kết nối DB tùy chọn (vd: link Neon Postgres trên Production)",
    )
    parser.add_argument(
        "--keep-repos",
        action="store_true",
        help="Giữ lại các repository sinh viên đã clone trong storage/submissions/repos",
    )
    parser.add_argument(
        "--wipe-template-cache",
        action="store_true",
        help="Xóa luôn cả bộ nhớ đệm template repository (.template_cache)",
    )
    args = parser.parse_args()

    reset_database(
        keep_repos=args.keep_repos,
        keep_template_cache=not args.wipe_template_cache,
        custom_db_url=args.db_url,
    )


