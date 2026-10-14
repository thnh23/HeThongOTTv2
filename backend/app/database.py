"""
OTTv2 Database Setup
SQLAlchemy với SQLite cho development.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(

    db_url,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
    echo=False,
)


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
