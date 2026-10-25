"""
Feature Sandbox — Domain Logic for Benchmarking Bots, Obstacles & Latency
"""

import json
import os
import uuid
from typing import Any
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.submission import Submission

SWISS_STORAGE_DIR = os.path.join(settings.STORAGE_PATH, "tournament")
from app.services.sandbox import load_bot_from_file
from app.services.validator import check_choose_move_in_code
from app.services.starter_bots.greedy_bot import choose_move as greedy_choose_move
from app.services.starter_bots.random_bot import choose_move as random_choose_move
from app.services.starter_bots.obstacle_bot import choose_move as obstacle_choose_move
from app.services.engine.referee import play_match
from app.features.sandbox.schemas import (
    BenchmarkObstacleRequest,
    BenchmarkObstacleResponse,
    BenchmarkSandboxRequest,
    BenchmarkSandboxResponse,
)


def get_default_top32_obstacles() -> list[str]:
    """Lấy danh sách các ô chướng ngại vật mặc định từ top32_config.json."""
    config_file = os.path.join(SWISS_STORAGE_DIR, "top32_config.json")
    default_obstacles = ["d4", "d6", "f4", "f6", "e5"]
    if os.path.exists(config_file):
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                return saved.get("obstacles", default_obstacles)
        except Exception:
            pass
    return default_obstacles


def execute_obstacle_benchmark(
    req: BenchmarkObstacleRequest,
    target_user: User | None,
    db: Session,
) -> BenchmarkObstacleResponse:
    """
    Thực thi Sandbox Benchmark kiểm tra bot đối đầu ObstacleBot trên bàn cờ có ô cản:
    - Thẩm định trần độ trễ tính toán: <= 300ms/nước
    - Kiểm tra tính tuân thủ ô cấm
    - Trả về replay trực quan
    """
    temp_bot_file = None
    candidate_fn = None
    bot_name = "Thí sinh"

    try:
        if req.bot_code and req.bot_code.strip():
            temp_dir = os.path.join(settings.STORAGE_PATH, "submissions", "temp")
            os.makedirs(temp_dir, exist_ok=True)
            temp_bot_file = os.path.join(temp_dir, f"bot_bench_{uuid.uuid4().hex[:8]}.py")
            with open(temp_bot_file, "w", encoding="utf-8") as f:
                f.write(req.bot_code)

            if not check_choose_move_in_code(temp_bot_file):
                raise HTTPException(
                    status_code=400,
                    detail="Mã nguồn thiếu định nghĩa hàm 'def choose_move(state)'.",
                )
            candidate_fn = load_bot_from_file(temp_bot_file)
            bot_name = target_user.name if target_user else "Bot v2 Snippet"
        elif req.submission_id:
            sub = db.query(Submission).filter(Submission.id == req.submission_id).first()
            if not sub or not sub.extracted_path:
                raise HTTPException(status_code=404, detail="Không tìm thấy bản nộp.")
            bot_path = os.path.join(sub.extracted_path, "bot.py")
            if not os.path.exists(bot_path):
                raise HTTPException(status_code=400, detail="Không tìm thấy bot.py trong bản nộp.")
            candidate_fn = load_bot_from_file(bot_path)
            bot_name = f"Bản nộp #{sub.id[:8]}"
        elif target_user:
            repo_bot = os.path.join(
                settings.STORAGE_PATH, "submissions", "repos", str(target_user.student_id or ""), "bot.py"
            )
            if os.path.exists(repo_bot):
                candidate_fn = load_bot_from_file(repo_bot)
                bot_name = target_user.bot_name or f"Bot của {target_user.name}"
            else:
                sub = (
                    db.query(Submission)
                    .filter(Submission.user_id == target_user.id)
                    .order_by(Submission.submitted_at.desc())
                    .first()
                )
                if sub and sub.extracted_path:
                    bot_path = os.path.join(sub.extracted_path, "bot.py")
                    if os.path.exists(bot_path):
                        candidate_fn = load_bot_from_file(bot_path)
                        bot_name = target_user.bot_name or f"Bot của {target_user.name}"

        if candidate_fn is None:
            candidate_fn = greedy_choose_move
            bot_name = "GreedyBot (Chế độ Demo Mẫu)"

        if req.obstacles and len(req.obstacles) > 0:
            obstacles_list = [str(o).strip().lower() for o in req.obstacles if str(o).strip()]
        else:
            obstacles_list = get_default_top32_obstacles()

        match_res = play_match(
            bot_white_fn=candidate_fn,
            bot_black_fn=obstacle_choose_move,
            bot_white_name=bot_name,
            bot_black_name="ObstacleBot (Mẫu Top 32)",
            timeout_sec=0.3,
            max_moves=200,
            obstacles=obstacles_list,
        )

        white_moves = [m for m in match_res.moves if m.get("player") == "W"]
        if white_moves:
            durations = [int(m.get("duration_ms", 0)) for m in white_moves]
            avg_ms = round(sum(durations) / len(durations), 2)
            max_ms = max(durations)
        else:
            avg_ms = 0.0
            max_ms = 0

        is_obstacle_compliant = True
        for m in match_res.moves:
            if m.get("player") == "W" and "chướng ngại vật" in str(m.get("error", "")).lower():
                is_obstacle_compliant = False
                break
        if "chướng ngại vật" in match_res.reason.lower() and match_res.winner == "B":
            is_obstacle_compliant = False

        is_latency_compliant = (max_ms <= 300 and match_res.end_code != "T1")

        return BenchmarkObstacleResponse(
            status="finished",
            winner=match_res.winner,
            end_code=match_res.end_code,
            total_moves=len(match_res.moves),
            duration_ms=match_res.duration_ms,
            average_move_time_ms=avg_ms,
            max_move_time_ms=max_ms,
            is_latency_compliant=is_latency_compliant,
            is_obstacle_compliant=is_obstacle_compliant,
            obstacles=obstacles_list,
            reason=match_res.reason,
            bot_name=bot_name,
            opponent_name="ObstacleBot (Mẫu Top 32)",
            replay=match_res.to_replay_dict(),
        )

    finally:
        if temp_bot_file and os.path.exists(temp_bot_file):
            try:
                os.remove(temp_bot_file)
            except Exception:
                pass


def execute_sandbox_benchmark(
    req: BenchmarkSandboxRequest,
    current_user: User | None,
) -> BenchmarkSandboxResponse:
    """
    Sân đấu thử nghiệm Sandbox Lab dành cho thí sinh thử bot trực tiếp:
    - Chế độ standard (9x9 không cản) hoặc obstacle (9x9 có ô cản)
    - Đối đầu GreedyBot, RandomBot, hoặc ObstacleBot
    - Thẩm định độ trễ và tính hợp lệ nước đi
    """
    if not req.bot_code or not req.bot_code.strip():
        raise HTTPException(
            status_code=400,
            detail="Vui lòng dán mã nguồn bot.py có định nghĩa hàm 'def choose_move(state)'.",
        )

    temp_bot_file = None
    try:
        temp_dir = os.path.join(settings.STORAGE_PATH, "submissions", "temp")
        os.makedirs(temp_dir, exist_ok=True)
        temp_bot_file = os.path.join(temp_dir, f"bot_sandbox_{uuid.uuid4().hex[:8]}.py")
        with open(temp_bot_file, "w", encoding="utf-8") as f:
            f.write(req.bot_code)

        if not check_choose_move_in_code(temp_bot_file):
            raise HTTPException(
                status_code=400,
                detail="Mã nguồn thiếu định nghĩa hàm 'def choose_move(state)'. Vui lòng kiểm tra lại cấu trúc bot.",
            )

        candidate_fn = load_bot_from_file(temp_bot_file)
        bot_name = current_user.name if current_user else "Thí sinh (Dán Code)"

        mode = req.mode.lower() if req.mode else "standard"
        if mode == "obstacle":
            if req.obstacles and len(req.obstacles) > 0:
                obstacles_list = [str(o).strip().lower() for o in req.obstacles if str(o).strip()]
            else:
                obstacles_list = get_default_top32_obstacles()
            opponent_fn = obstacle_choose_move
            opponent_name = "ObstacleBot (Mẫu Top 32)"
        else:
            mode = "standard"
            obstacles_list = []
            opp = (req.opponent or "greedy").lower()
            if opp == "random":
                opponent_fn = random_choose_move
                opponent_name = "RandomBot (Ngẫu Nhiên)"
            else:
                opponent_fn = greedy_choose_move
                opponent_name = "GreedyBot (Ăn Quân Chuẩn)"

        match_res = play_match(
            bot_white_fn=candidate_fn,
            bot_black_fn=opponent_fn,
            bot_white_name=bot_name,
            bot_black_name=opponent_name,
            timeout_sec=0.3,
            max_moves=200,
            obstacles=obstacles_list,
        )

        white_moves = [m for m in match_res.moves if m.get("player") == "W"]
        if white_moves:
            durations = [int(m.get("duration_ms", 0)) for m in white_moves]
            avg_ms = round(sum(durations) / len(durations), 2)
            max_ms = max(durations)
        else:
            avg_ms = 0.0
            max_ms = 0

        is_obstacle_compliant = True
        if mode == "obstacle":
            for m in match_res.moves:
                if m.get("player") == "W" and "chướng ngại vật" in str(m.get("error", "")).lower():
                    is_obstacle_compliant = False
                    break
            if "chướng ngại vật" in match_res.reason.lower() and match_res.winner == "B":
                is_obstacle_compliant = False

        is_latency_compliant = (max_ms <= 300 and match_res.end_code != "T1")

        return BenchmarkSandboxResponse(
            status="finished",
            mode=mode,
            winner=match_res.winner,
            end_code=match_res.end_code,
            total_moves=len(match_res.moves),
            duration_ms=match_res.duration_ms,
            average_move_time_ms=avg_ms,
            max_move_time_ms=max_ms,
            is_latency_compliant=is_latency_compliant,
            is_obstacle_compliant=is_obstacle_compliant,
            obstacles=obstacles_list,
            reason=match_res.reason,
            bot_name=bot_name,
            opponent_name=opponent_name,
            replay=match_res.to_replay_dict(),
        )

    finally:
        if temp_bot_file and os.path.exists(temp_bot_file):
            try:
                os.remove(temp_bot_file)
            except Exception:
                pass
