"""
Admin Sub-router — Vòng Chung Kết Top 32, Cấu Hình Ô Chướng Ngại Vật & Đấu Trường Knockout Bracket.
Controller endpoints chuyển giao xử lý nghiệp vụ cho tầng Service.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from .schemas import RunRoundRequest, Top32ConfigRequest
from .service import (
    get_top32_config_service,
    save_top32_config_service,
    finalize_top32_seeds_service,
    get_top32_bracket_service,
    run_top32_round_service,
    reset_top32_bracket_service,
)

router = APIRouter(tags=["admin-top32"])


@router.get("/top32/config")
def get_top32_config(db: Session = Depends(get_db)):
    """Lấy danh sách hạt giống Top 32 và cấu hình các ô chướng ngại vật."""
    return get_top32_config_service(db)


@router.post("/top32/config")
def save_top32_config(req: Top32ConfigRequest):
    """Cập nhật cấu hình các ô chướng ngại vật cho Vòng Chung Kết Top 32 và đồng bộ ra public."""
    return save_top32_config_service(req)


@router.post("/top32/finalize-seeds")
def finalize_top32_seeds(db: Session = Depends(get_db)):
    """
    Chốt danh sách 32 hạt giống chính thức từ Bảng Xếp Hạng Thụy Sĩ (loại trừ Admin 100%),
    tạo 16 cặp trận đấu thật 'pending' trong CSDL SQLite và khởi tạo cây phân nhánh Knockout.
    """
    return finalize_top32_seeds_service(db)


@router.get("/top32/bracket")
def get_top32_bracket(db: Session = Depends(get_db)):
    """Lấy dữ liệu toàn bộ cây nhánh đấu Vòng Chung Kết Top 32."""
    return get_top32_bracket_service(db)


@router.post("/top32/run-round")
async def run_top32_round(req: RunRoundRequest, db: Session = Depends(get_db)):
    """
    Thực thi thi đấu tự động cho vòng đấu chỉ định ('r32', 'r16', 'qf', 'sf', 'final')
    với thể thức BO2 trên bàn cờ có ô chướng ngại vật, tạo trận đấu thật trong CSDL và phát sóng live WebSocket.
    """
    return await run_top32_round_service(req, db)


@router.post("/top32/reset-bracket")
def reset_top32_bracket(db: Session = Depends(get_db)):
    """Đặt lại toàn bộ trạng thái nhánh đấu Vòng Chung Kết và reset các trận trong CSDL."""
    return reset_top32_bracket_service(db)
