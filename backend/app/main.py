"""
OTTv2 Tournament — FastAPI Main Application
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_all_tables
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import auth, submit, matches, leaderboard, admin
from app.websocket import websocket_router

logger = logging.getLogger("ottv2.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Tạo bảng DB khi khởi động nếu chưa có, và tự động nạp dữ liệu mẫu nếu DB mới tạo."""
    create_all_tables()
    try:
        from app.database import SessionLocal
        from app.models.user import User
        from seed_demo_data import seed_data
        with SessionLocal() as db:
            if db.query(User).count() == 0:
                logger.info("Database rỗng — Tự động tạo tài khoản Admin và dữ liệu thi đấu mẫu...")
                seed_data()
    except Exception as e:
        logger.warning("Không thể tự động nạp dữ liệu mẫu: %s", e)
    yield



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

# ── CORS ────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────
app.include_router(auth.router)
app.include_router(submit.router)
app.include_router(matches.router)
app.include_router(leaderboard.router)
app.include_router(admin.router)
app.include_router(websocket_router)


# ── Health check ────────────────────────────────
@app.get("/health", tags=["system"])
@app.get("/api/health", tags=["system"])
def health_check():
    return {"status": "ok", "version": "1.0.0", "game": "OTTv2"}


@app.get("/rules.json", tags=["system"])
@app.get("/api/rules", tags=["system"])
def get_rules():
    """Trả về luật chơi OTTv2 dưới dạng JSON công bố công khai."""
    import json, os
    rules_path = os.path.join(os.path.dirname(__file__), "..", "..", "rules.json")
    rules_path = os.path.abspath(rules_path)
    if os.path.exists(rules_path):
        with open(rules_path, encoding="utf-8") as f:
            return json.load(f)
    return {"error": "rules.json not found"}

