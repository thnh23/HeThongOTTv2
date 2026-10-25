"""
Service Layer cho Vòng Chung Kết Top 32:
Xử lý nghiệp vụ cấu hình ô cản, chốt hạt giống từ Swiss, điều phối thi đấu các vòng và đồng bộ file tĩnh.
"""

import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.match import Match
from app.features.admin.common import SWISS_STORAGE_DIR
from .schemas import Top32ConfigRequest, RunRoundRequest
from .bracket import generate_initial_bracket, advance_bracket_winners
from .executor import execute_match_bo2_async

BRACKET_FILE = os.path.join(SWISS_STORAGE_DIR, "top32_bracket.json")
CONFIG_FILE = os.path.join(SWISS_STORAGE_DIR, "top32_config.json")


def get_current_obstacles() -> List[str]:
    """Lấy danh sách tọa độ ô chướng ngại vật từ file cấu hình, mặc định 5 ô nếu chưa có."""
    default_obstacles = ["d4", "d6", "f4", "f6", "e5"]
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                return saved.get("obstacles", default_obstacles)
        except Exception:
            pass
    return default_obstacles


def sync_config_to_public(data: Dict[str, Any]):
    """Đồng bộ cấu hình ô cản và thông báo Top 32 ra các thư mục public để người dùng tra cứu."""
    try:
        os.makedirs(SWISS_STORAGE_DIR, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        base_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
        pub_dirs = [
            os.path.join(base_backend, "published"),
            os.path.join(os.path.dirname(base_backend), "frontend", "public", "data"),
        ]
        for pdir in pub_dirs:
            os.makedirs(pdir, exist_ok=True)
            with open(os.path.join(pdir, "top32_config.json"), "w", encoding="utf-8") as pf:
                json.dump(data, pf, indent=2, ensure_ascii=False)
    except Exception:
        pass


def sync_bracket_to_public(data: Dict[str, Any]):
    """Đồng bộ trạng thái bracket ra thư mục public tĩnh để frontend tra cứu tức thì."""
    try:
        os.makedirs(SWISS_STORAGE_DIR, exist_ok=True)
        with open(BRACKET_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        base_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
        pub_dirs = [
            os.path.join(base_backend, "published"),
            os.path.join(os.path.dirname(base_backend), "frontend", "public", "data"),
        ]
        for pdir in pub_dirs:
            os.makedirs(pdir, exist_ok=True)
            with open(os.path.join(pdir, "top32_bracket.json"), "w", encoding="utf-8") as pf:
                json.dump(data, pf, indent=2, ensure_ascii=False)
    except Exception:
        pass


def get_top32_config_service(db: Session) -> Dict[str, Any]:
    """Lấy danh sách hạt giống Top 32 và cấu hình các ô chướng ngại vật."""
    default_obstacles = get_current_obstacles()
    announcement = "Vòng Chung kết Top 32 áp dụng luật bàn cờ có ô chướng ngại vật cấm đi vào tại 5 vị trí: d4, d6, f4, f6, e5."

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                announcement = saved.get("rules_announcement", announcement)
        except Exception:
            pass

    # Lấy danh sách Top 32 thí sinh từ DB (loại trừ Admin)
    top32_users = (
        db.query(User)
        .filter(User.is_admin == False, User.is_top32 == True)
        .order_by(
            User.swiss_points.desc(),
            User.swiss_wins.desc(),
            User.buchholz.desc(),
            User.sonneborn_berger.desc(),
        )
        .limit(32)
        .all()
    )

    if not top32_users:
        top32_users = (
            db.query(User)
            .filter(User.is_admin == False)
            .order_by(
                User.swiss_points.desc(),
                User.swiss_wins.desc(),
                User.buchholz.desc(),
                User.sonneborn_berger.desc(),
            )
            .limit(32)
            .all()
        )

    users_list = []
    for idx, u in enumerate(top32_users, 1):
        users_list.append({
            "seed": idx,
            "id": u.id,
            "name": u.name,
            "student_id": u.student_id,
            "class_name": u.class_name,
            "bot_name": u.bot_name,
            "swiss_wins": u.swiss_wins or 0,
            "swiss_points": u.swiss_points or 0,
            "github_repo_url": u.github_repo_url,
        })

    return {
        "obstacles": default_obstacles,
        "rules_announcement": announcement,
        "total_seeds": len(users_list),
        "seeds": users_list,
    }


def save_top32_config_service(req: Top32ConfigRequest) -> Dict[str, Any]:
    """Cập nhật cấu hình các ô chướng ngại vật cho Vòng Chung Kết Top 32 và đồng bộ ra public."""
    try:
        data = {
            "obstacles": [o.lower().strip() for o in req.obstacles if o.strip()],
            "rules_announcement": req.rules_announcement or "",
            "updated_at": datetime.now().isoformat(),
        }
        sync_config_to_public(data)

        return {
            "success": True,
            "obstacles": data["obstacles"],
            "message": f"Đã lưu thành công cấu hình {len(data['obstacles'])} ô chướng ngại vật cho Vòng Chung Kết!",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu cấu hình Top 32: {str(e)}")


def finalize_top32_seeds_service(db: Session) -> Dict[str, Any]:
    """
    Chốt danh sách 32 hạt giống chính thức từ Bảng Xếp Hạng Thụy Sĩ (loại trừ Admin 100%),
    tạo 16 cặp trận đấu thật 'pending' trong CSDL SQLite và khởi tạo cây phân nhánh Knockout.
    """
    # 1. Đồng bộ điểm số từ published/standings.json nếu có
    base_backend = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
    standings_file = os.path.join(base_backend, "published", "standings.json")
    if os.path.exists(standings_file):
        try:
            with open(standings_file, "r", encoding="utf-8") as f:
                st_data = json.load(f)
                for item in st_data:
                    u_id = item.get("user_id") or item.get("id")
                    if u_id:
                        db_u = db.query(User).filter(User.id == u_id).first()
                        if db_u:
                            db_u.swiss_points = item.get("points", 0)
                            db_u.swiss_wins = item.get("wins", 0)
                            db_u.buchholz = item.get("buchholz", 0.0)
                            db_u.sonneborn_berger = item.get("sonneborn_berger", 0.0)
                db.commit()
        except Exception:
            pass

    # 2. Lấy 32 thí sinh xuất sắc nhất từ DB (loại trừ Admin, sắp xếp theo chuẩn FIDE tie-break)
    candidates = (
        db.query(User)
        .filter(User.is_admin == False)
        .order_by(
            User.swiss_points.desc(),
            User.swiss_wins.desc(),
            User.buchholz.desc(),
            User.sonneborn_berger.desc(),
        )
        .limit(32)
        .all()
    )

    if len(candidates) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Hệ thống hiện chỉ có {len(candidates)} thí sinh hợp lệ trong CSDL. Cần tối thiểu 2 thí sinh để khởi tạo vòng Chung kết!",
        )

    # 3. Đánh dấu is_top32 = True cho 32 người, False cho người khác
    db.query(User).update({User.is_top32: False})

    seeds_payload = []
    for idx, u in enumerate(candidates, 1):
        u.is_top32 = True
        seeds_payload.append({
            "seed": idx,
            "id": u.id,
            "name": u.name,
            "student_id": u.student_id,
            "class_name": u.class_name,
            "bot_name": u.bot_name,
            "swiss_wins": u.swiss_wins or 0,
            "swiss_points": u.swiss_points or 0,
            "github_repo_url": u.github_repo_url,
        })
    db.commit()

    # 4. Tạo cây phân nhánh Knockout ban đầu
    bracket = generate_initial_bracket(seeds_payload)

    # 5. Khởi tạo 16 trận đấu thật 'pending' trong bảng matches của SQLite
    for m in bracket["rounds"]["r32"]:
        m_id = m["id"]
        p_a = m.get("player_a")
        p_b = m.get("player_b")
        if p_a and p_b:
            db_m = db.query(Match).filter(Match.id == m_id).first()
            if not db_m:
                db_m = Match(
                    id=m_id,
                    tier="A",
                    bot_a_id=p_a["id"],
                    bot_b_id=p_b["id"],
                    status="pending",
                    created_at=datetime.utcnow(),
                )
                db.add(db_m)
            else:
                db_m.bot_a_id = p_a["id"]
                db_m.bot_b_id = p_b["id"]
                db_m.status = "pending"
                db_m.winner = None
                db_m.end_code = None
                db_m.total_moves = 0
                db_m.duration_ms = 0
    db.commit()

    sync_bracket_to_public(bracket)

    return {
        "success": True,
        "total_seeds": len(seeds_payload),
        "seeds": seeds_payload,
        "bracket": bracket,
        "message": f"Đã chốt thành công danh sách {len(seeds_payload)} hạt giống và khởi tạo 16 trận đấu Vòng Chung Kết trong CSDL! Hãy nhấp nút 'Kích Hoạt Thi Đấu Vòng 1/16' để bắt đầu chạy các trận đấu.",
    }


def get_top32_bracket_service(db: Session) -> Dict[str, Any]:
    """Lấy dữ liệu toàn bộ cây nhánh đấu Vòng Chung Kết Top 32."""
    if os.path.exists(BRACKET_FILE):
        try:
            with open(BRACKET_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    cfg = get_top32_config_service(db)
    seeds = cfg.get("seeds", [])
    bracket = generate_initial_bracket(seeds)
    return bracket


async def run_top32_round_service(req: RunRoundRequest, db: Session) -> Dict[str, Any]:
    """
    Thực thi thi đấu tự động cho vòng đấu chỉ định ('r32', 'r16', 'qf', 'sf', 'final')
    với thể thức BO2 trên bàn cờ có ô chướng ngại vật, tạo trận đấu thật trong CSDL và phát sóng live WebSocket.
    """
    bracket = get_top32_bracket_service(db)
    rounds = bracket.get("rounds", {})
    round_key = req.round_type.lower().strip()

    if round_key not in rounds:
        raise HTTPException(status_code=400, detail=f"Vòng đấu không hợp lệ: '{round_key}'! Hỗ trợ: r32, r16, qf, sf, final.")

    matches_to_run = rounds[round_key]
    obstacles = get_current_obstacles()

    # 0. Nếu force_rerun: Đặt lại trạng thái pending cho toàn bộ trận trong vòng
    if req.force_rerun:
        for m in matches_to_run:
            m["status"] = "pending"
            m["score_a"] = 0.0
            m["score_b"] = 0.0
            m["winner_id"] = None
            m["winner_name"] = None
            m["winner_seed"] = None
            m["loser_id"] = None
            m["loser_name"] = None
            m["loser_seed"] = None
            m["game_results"] = []
            db_m = db.query(Match).filter(Match.id == m["id"]).first()
            if db_m:
                db_m.status = "pending"
                db_m.winner = None
                db_m.end_code = None
                db_m.total_moves = 0
                db_m.duration_ms = 0
        db.commit()
        bracket["updated_at"] = datetime.now().isoformat()
        sync_bracket_to_public(bracket)

    # Chạy từng trận đấu trong vòng (tạo trận đấu thật, phát sóng live WebSocket)
    for m in matches_to_run:
        if m.get("status") == "completed" and not req.force_rerun:
            continue

        p_a = m.get("player_a")
        p_b = m.get("player_b")

        if p_a and p_b:
            m["status"] = "running"
            bracket["updated_at"] = datetime.now().isoformat()
            sync_bracket_to_public(bracket)

            await execute_match_bo2_async(m, db, obstacles)

            bracket["updated_at"] = datetime.now().isoformat()
            sync_bracket_to_public(bracket)
        elif p_a and not p_b:
            m["status"] = "completed"
            m["winner_id"] = p_a["id"]
            m["winner_name"] = p_a["name"]
            m["winner_seed"] = p_a.get("seed")
            m["score_a"] = 2.0
            m["score_b"] = 0.0
            m["game_results"] = [{"game": 1, "winner": "W", "reason": "Thắng miễn đấu (Bye - Không có đối thủ hạt giống)."}]
            db_m = db.query(Match).filter(Match.id == m["id"]).first()
            if db_m:
                db_m.status = "done"
                db_m.winner = "W"
                db_m.end_code = "W1"
                db.commit()
            bracket["updated_at"] = datetime.now().isoformat()
            sync_bracket_to_public(bracket)
        elif p_b and not p_a:
            m["status"] = "completed"
            m["winner_id"] = p_b["id"]
            m["winner_name"] = p_b["name"]
            m["winner_seed"] = p_b.get("seed")
            m["score_a"] = 0.0
            m["score_b"] = 2.0
            m["game_results"] = [{"game": 1, "winner": "B", "reason": "Thắng miễn đấu (Bye - Không có đối thủ hạt giống)."}]
            db_m = db.query(Match).filter(Match.id == m["id"]).first()
            if db_m:
                db_m.status = "done"
                db_m.winner = "B"
                db_m.end_code = "W1"
                db.commit()
            bracket["updated_at"] = datetime.now().isoformat()
            sync_bracket_to_public(bracket)
        else:
            m["status"] = "completed"
            bracket["updated_at"] = datetime.now().isoformat()
            sync_bracket_to_public(bracket)

    # Đẩy người thắng vào vòng kế tiếp
    next_round_key = advance_bracket_winners(bracket, round_key, matches_to_run)

    # Tự động tạo Match record 'pending' trong DB cho vòng kế tiếp
    if next_round_key and next_round_key in rounds:
        for nm in rounds[next_round_key]:
            if nm.get("player_a") and nm.get("player_b"):
                nm_id = nm["id"]
                exist_nm = db.query(Match).filter(Match.id == nm_id).first()
                if not exist_nm:
                    db.add(Match(
                        id=nm_id,
                        tier="A",
                        bot_a_id=nm["player_a"]["id"],
                        bot_b_id=nm["player_b"]["id"],
                        status="pending",
                        created_at=datetime.utcnow(),
                    ))
                else:
                    exist_nm.bot_a_id = nm["player_a"]["id"]
                    exist_nm.bot_b_id = nm["player_b"]["id"]
                    exist_nm.status = "pending"
        db.commit()

    bracket["updated_at"] = datetime.now().isoformat()
    sync_bracket_to_public(bracket)

    return {
        "success": True,
        "round": round_key,
        "matches_count": len(matches_to_run),
        "bracket": bracket,
        "message": f"Đã hoàn thành thi đấu {len(matches_to_run)} trận Vòng '{round_key}' trên bàn cờ có ô cản và phát sóng WebSocket!",
    }


def reset_top32_bracket_service(db: Session) -> Dict[str, Any]:
    """Đặt lại toàn bộ trạng thái nhánh đấu Vòng Chung Kết và reset các trận trong CSDL."""
    cfg = get_top32_config_service(db)
    seeds = cfg.get("seeds", [])
    bracket = generate_initial_bracket(seeds)
    sync_bracket_to_public(bracket)

    # Đặt lại trạng thái pending cho các trận R32 trong DB
    for m in bracket["rounds"]["r32"]:
        m_id = m["id"]
        p_a = m.get("player_a")
        p_b = m.get("player_b")
        if p_a and p_b:
            db_m = db.query(Match).filter(Match.id == m_id).first()
            if db_m:
                db_m.status = "pending"
                db_m.winner = None
                db_m.end_code = None
                db_m.total_moves = 0
                db_m.duration_ms = 0
            else:
                db.add(Match(
                    id=m_id,
                    tier="A",
                    bot_a_id=p_a["id"],
                    bot_b_id=p_b["id"],
                    status="pending",
                    created_at=datetime.utcnow(),
                ))
    db.commit()

    return {
        "success": True,
        "message": "Đã thiết lập lại trạng thái nhánh đấu Vòng Chung Kết!",
        "bracket": bracket,
    }
