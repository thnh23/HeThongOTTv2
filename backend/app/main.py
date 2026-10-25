"""
OTTv2 Tournament — FastAPI Main Application
"""

import asyncio
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_all_tables
from app.middleware.rate_limit import RateLimitMiddleware
from app.features import (
    auth_router,
    submission_router,
    sandbox_router,
    matches_router,
    leaderboard_router,
    admin_router,
)
from app.websocket import websocket_router

logger = logging.getLogger("ottv2.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Tạo bảng DB khi khởi động và tự động khởi tạo tài khoản Quản Trị Viên (Admin BTC) nếu chưa có."""
    create_all_tables()
    try:
        from app.database import SessionLocal
        from app.models.user import User
        from app.features.auth.service import hash_password
        with SessionLocal() as db:
            admin_user = db.query(User).filter(User.is_admin == True).first()
            if not admin_user:
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
                logger.info("Đã khởi tạo tài khoản Admin mặc định: admin@uet.vnu.edu.vn / admin123")

            # Đồng bộ mật khẩu mặc định (MSSV) cho các tài khoản sinh viên được import từ Google Form
            unhashed_students = db.query(User).filter(User.hashed_password == "student_auto_hash").all()
            if unhashed_students:
                for stu in unhashed_students:
                    default_pwd = stu.student_id or (stu.email.split("@")[0] if "@" in stu.email else stu.id[:8])
                    stu.hashed_password = hash_password(default_pwd)
                db.commit()
                logger.info(f"Đã đồng bộ mật khẩu mặc định (MSSV) cho {len(unhashed_students)} tài khoản sinh viên.")
    except Exception as e:
        logger.warning("Không thể tự động nạp tài khoản admin hoặc sửa mật khẩu: %s", e)


    try:
        yield
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass
    finally:
        logger.info("Đã dọn dẹp và dừng backend an toàn.")



app = FastAPI(
    title="OTTv2 Tournament Platform",
    description="Hệ thống tổ chức giải đấu bot OTTv2 cho sinh viên",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Global Exception Handler ─────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Lỗi máy chủ nội bộ. Vui lòng liên hệ Ban tổ chức giải đấu.",
            "error": "INTERNAL_SERVER_ERROR",
        },
    )

# ── Rate Limiting Middleware ────────────────────
app.add_middleware(RateLimitMiddleware, default_limit=180, window_seconds=60)

# ── Production Security Headers Middleware ──────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
    return response

# ── CORS Hardening ──────────────────────────────
cors_origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]
if getattr(settings, "ALLOWED_ORIGINS", ""):
    for origin in settings.ALLOWED_ORIGINS.split(","):
        orig_clean = origin.strip()
        if orig_clean and orig_clean not in cors_origins:
            cors_origins.append(orig_clean)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)


# ── Feature Routers ─────────────────────────────
app.include_router(auth_router)
app.include_router(submission_router)
app.include_router(sandbox_router)
app.include_router(matches_router)
app.include_router(leaderboard_router)
app.include_router(admin_router)
app.include_router(websocket_router)


# ── Health check & Root ─────────────────────────
@app.get("/", tags=["system"])
@app.head("/", tags=["system"])
def root():
    return {"status": "ok", "message": "OTTv2 Tournament API", "game": "OTTv2", "docs": "/docs"}


@app.get("/health", tags=["system"])
@app.get("/api/health", tags=["system"])
def health_check():
    return {"status": "ok", "version": "1.0.0", "game": "OTTv2"}



@app.get("/rules.json", tags=["system"])
@app.get("/api/rules", tags=["system"])
def get_rules():
    """Trả về luật chơi OTTv2 dưới dạng JSON công bố công khai."""
    import json, os
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "rules.json"),
        os.path.join(os.path.dirname(__file__), "..", "rules.json"),
        os.path.join(os.getcwd(), "rules.json"),
        "/app/rules.json",
    ]
    for p in candidates:
        ap = os.path.abspath(p)
        if os.path.exists(ap):
            with open(ap, encoding="utf-8") as f:
                return json.load(f)
    return {"error": "rules.json not found"}


