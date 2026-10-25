"""
OTTv2 Database Setup
SQLAlchemy với SQLite cho development.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

def normalize_db_url(url: str) -> str:
    """
    Chuẩn hóa URL CSDL:
    - Chuyển đổi SQLite đường dẫn tương đối thành tuyệt đối.
    - Hỗ trợ postgres:// và postgresql:// với driver tự động fallback (psycopg2 hoặc psycopg v3).
    """
    if not url:
        return url

    if url.startswith("sqlite:///.") or url == "sqlite:///./ottv2.db":
        from app.config import BASE_DIR
        rel_path = url.replace("sqlite:///./", "").replace("sqlite:///", "")
        abs_path = (BASE_DIR / rel_path).resolve().as_posix()
        return f"sqlite:///{abs_path}"

    if url.startswith("postgres://") or (url.startswith("postgresql://") and not url.startswith("postgresql+")):
        # Chọn driver PostgreSQL tương thích: ưu tiên psycopg2 nếu có, fallback sang psycopg (v3)
        driver = "psycopg2"
        try:
            import psycopg2  # noqa: F401
            driver = "psycopg2"
        except ImportError:
            try:
                import psycopg  # noqa: F401
                driver = "psycopg"
            except ImportError:
                driver = "psycopg2"

        prefix = f"postgresql+{driver}://"
        if url.startswith("postgres://"):
            return url.replace("postgres://", prefix, 1)
        return url.replace("postgresql://", prefix, 1)

    return url


db_url = normalize_db_url(settings.DATABASE_URL)

is_sqlite = "sqlite" in db_url
engine_kwargs = {
    "echo": False,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Cấu hình tối ưu cho Cloud PostgreSQL (Neon / Supabase / Render Postgres)
    engine_kwargs["pool_pre_ping"] = True       # Tự động phục hồi kết nối nếu bị ngắt do idle
    engine_kwargs["pool_recycle"] = 300         # Tái chế kết nối sau 5 phút chống drop kết nối
    engine_kwargs["pool_size"] = 10             # Kết nối duy trì thường trực
    engine_kwargs["max_overflow"] = 20          # Cho phép mở rộng thêm khi cao điểm giải đấu

engine = create_engine(db_url, **engine_kwargs)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency để inject DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables():
    """Tạo tất cả bảng trong DB (dùng khi khởi động)."""
    # Import models để SQLAlchemy biết các bảng cần tạo
    from app.models import user, match, submission  # noqa: F401
    Base.metadata.create_all(bind=engine)
