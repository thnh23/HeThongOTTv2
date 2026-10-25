"""
Feature Sandbox — Router & Endpoints for Interactive Benchmark & Obstacle Testing
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.features.auth.service import get_optional_current_user
from app.features.sandbox.schemas import (
    BenchmarkObstacleRequest,
    BenchmarkObstacleResponse,
    BenchmarkSandboxRequest,
    BenchmarkSandboxResponse,
)
from app.features.sandbox.service import (
    execute_obstacle_benchmark,
    execute_sandbox_benchmark,
)

router = APIRouter(prefix="/api/submit", tags=["sandbox"])


@router.get("/benchmark-obstacle/config")
def get_benchmark_obstacle_config():
    """Lấy danh sách các ô chướng ngại vật công bố công khai cho thí sinh thử nghiệm sandbox."""
    from app.features.admin.top32.service import get_current_obstacles
    return {
        "obstacles": get_current_obstacles()
    }


@router.post("/benchmark-obstacle", response_model=BenchmarkObstacleResponse)
def run_benchmark_obstacle(
    req: BenchmarkObstacleRequest,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Sandbox Benchmark API dành cho Top 32 Vòng Chung Kết:
    - Kiểm thử Bot v2 đối đầu ObstacleBot trên bàn cờ có ô chướng ngại vật cấm.
    - Đo lường độ trễ tính toán từng nước (yêu cầu <= 300ms/nước, vượt quá bị xử thua T1).
    - Thẩm định tính tuân thủ ô cản (bot có phạm luật lao vào ô cấm không).
    - Trả về toàn bộ dữ liệu replay trực quan (obstacles, moves, board states).
    """
    target_user = current_user
    if not target_user and req.student_id:
        s_clean = req.student_id.strip()
        target_user = (
            db.query(User)
            .filter((User.student_id == s_clean) | (User.email == s_clean))
            .first()
        )
    return execute_obstacle_benchmark(req, target_user, db)


@router.post("/benchmark-sandbox", response_model=BenchmarkSandboxResponse)
def run_benchmark_sandbox(
    req: BenchmarkSandboxRequest,
    current_user: User | None = Depends(get_optional_current_user),
):
    """
    Sân Đấu Thử Nghiệm Sandbox Lab Dành Cho Thí Sinh:
    - 100% Thử nghiệm trực tiếp bằng cách dán mã nguồn bot.py (hàm choose_move).
    - Hỗ trợ 2 chế độ:
        1. 'standard': Bàn cờ chuẩn 9x9 không cản, đối đầu GreedyBot hoặc RandomBot.
        2. 'obstacle': Bàn cờ ô cản 9x9 với các chướng ngại vật cấm, đối đầu ObstacleBot.
    - Thẩm định độ trễ tính toán (<= 300ms) và luật di chuyển.
    - Trả về toàn bộ replay bàn cờ để tua lại trực quan.
    """
    return execute_sandbox_benchmark(req, current_user)
