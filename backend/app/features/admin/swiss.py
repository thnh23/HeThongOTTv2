"""
Admin Sub-router — Vận Hành Giải Đấu Thụy Sĩ (Swiss 13 Vòng & Chấm Phân Tán)
"""

import os
import io
import json
import glob
import re
import zipfile
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.match import Match, Replay
from app.features.admin.common import (
    SwissPairRequest,
    SwissPublishRequest,
    SWISS_STORAGE_DIR,
)

router = APIRouter(tags=["admin-swiss"])


@router.get("/swiss/status")
def get_swiss_tournament_status(round_num: Optional[int] = 1, db: Session = Depends(get_db)):
    """Lấy trạng thái điều hành giải đấu Thụy Sĩ (Swiss 13 Vòng) dựa trên dữ liệu thật."""
    os.makedirs(SWISS_STORAGE_DIR, exist_ok=True)

    current_round = round_num or 1
    chunks_ready = 0
    results_ready = 0
    is_published = False

    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{current_round}")
    chunks_dir = os.path.join(round_dir, "chunks")
    results_dir = os.path.join(round_dir, "results")
    publish_dir = os.path.join(round_dir, "published")

    num_chunks = 4
    if os.path.exists(chunks_dir):
        chunk_files = [f for f in os.listdir(chunks_dir) if f.startswith("chunk_") and f.endswith(".json")]
        if len(chunk_files) > 0:
            num_chunks = len(chunk_files)
        chunks_ready = len(chunk_files)
    if os.path.exists(results_dir):
        results_ready = len([f for f in os.listdir(results_dir) if f.startswith("result_") and f.endswith(".json")])
    if os.path.exists(os.path.join(publish_dir, "standings.json")):
        is_published = True

    total_real_players = db.query(User).filter(User.is_admin == False).count()
    total_matches_expected = total_real_players // 2

    return {
        "current_round": current_round,
        "total_rounds": 13,
        "total_players": total_real_players,
        "total_matches_expected": total_matches_expected,
        "num_chunks": num_chunks,
        "chunks_ready": chunks_ready,
        "results_ready": results_ready,
        "is_published": is_published,
        "chunks_progress_percent": int((results_ready / num_chunks) * 100) if num_chunks > 0 else 0,
        "system_status": "ready",
    }


@router.post("/swiss/pair")
def trigger_swiss_pair(req: SwissPairRequest):
    """
    Bốc thăm ghép cặp Vòng R theo thể thức Thụy Sĩ và chia nhỏ 10 chunks.
    """
    try:
        import importlib
        import scripts.tournament.pair_swiss
        importlib.reload(scripts.tournament.pair_swiss)
        from scripts.tournament.pair_swiss import load_or_generate_players, swiss_pair_round, split_into_chunks

        round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{req.round_num}")
        chunks_dir = os.path.join(round_dir, "chunks")
        results_dir = os.path.join(round_dir, "results")
        publish_dir = os.path.join(round_dir, "published")
        os.makedirs(chunks_dir, exist_ok=True)
        os.makedirs(results_dir, exist_ok=True)
        os.makedirs(publish_dir, exist_ok=True)

        # Tự động dọn sạch các file kết quả cũ của vòng này khi bốc thăm mới
        if os.path.exists(results_dir):
            for old_res in glob.glob(os.path.join(results_dir, "result_*.json")):
                try:
                    os.remove(old_res)
                except Exception:
                    pass
        if os.path.exists(publish_dir):
            for old_pub in glob.glob(os.path.join(publish_dir, "*.json")):
                try:
                    os.remove(old_pub)
                except Exception:
                    pass

        prev_players_file = os.path.join(
            SWISS_STORAGE_DIR, f"round_{req.round_num - 1}", "published", f"players_after_r{req.round_num - 1}.json"
        )
        players = load_or_generate_players(
            prev_players_file if os.path.exists(prev_players_file) else None, count=req.player_count
        )

        pairings = swiss_pair_round(players, req.round_num)
        chunks = split_into_chunks(pairings, num_chunks=req.num_chunks)

        for idx, chunk in enumerate(chunks, 1):
            chunk_file = os.path.join(chunks_dir, f"chunk_{str(idx).zfill(2)}.json")
            payload = {
                "round": req.round_num,
                "chunk_id": idx,
                "total_chunks": req.num_chunks,
                "matches_count": len(chunk),
                "matches": chunk,
            }
            with open(chunk_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)

        # Lưu trạng thái thí sinh trước vòng đấu
        with open(os.path.join(chunks_dir, f"players_before_r{req.round_num}.json"), "w", encoding="utf-8") as f:
            json.dump(players, f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "round": req.round_num,
            "total_matches": len(pairings),
            "num_chunks": len(chunks),
            "message": f"Đã ghép cặp thành công Vòng {req.round_num} ({len(pairings)} trận) và chia thành {len(chunks)} file chunk!",
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi ghép cặp Swiss: {str(e)}")


@router.post("/swiss/publish")
def trigger_swiss_publish(req: SwissPublishRequest, db: Session = Depends(get_db)):
    """
    Hợp nhất các file kết quả, tính toán Buchholz & Sonneborn-Berger,
    xuất bản JSON tĩnh và đồng bộ vào CSDL (bảng matches và users).
    """
    try:
        from scripts.tournament.merge_and_publish import merge_and_calculate_standings

        round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{req.round_num}")
        chunks_dir = os.path.join(round_dir, "chunks")
        results_dir = os.path.join(round_dir, "results")
        publish_dir = os.path.join(round_dir, "published")
        os.makedirs(publish_dir, exist_ok=True)

        pattern = os.path.join(results_dir, "result_*.json")
        result_files = sorted(glob.glob(pattern))

        # Xác định số lượng chunk cần đủ từ thư mục chunks/ (mặc định 4)
        expected_chunks = 4
        if os.path.exists(chunks_dir):
            c_files = [f for f in os.listdir(chunks_dir) if f.startswith("chunk_") and f.endswith(".json")]
            if len(c_files) > 0:
                expected_chunks = len(c_files)

        if len(result_files) < expected_chunks:
            raise HTTPException(
                status_code=400,
                detail=f"Chưa đủ {expected_chunks} file kết quả (hiện có {len(result_files)}/{expected_chunks} file)! Vui lòng tiếp nhận đủ kết quả từ {expected_chunks} máy chấm.",
            )

        all_matches = []
        for rf in result_files:
            with open(rf, "r", encoding="utf-8") as f:
                d = json.load(f)
                all_matches.extend(d.get("results", []))

        chunks_dir = os.path.join(round_dir, "chunks")
        players_file = os.path.join(chunks_dir, f"players_before_r{req.round_num}.json")
        players = None
        if os.path.exists(players_file):
            try:
                with open(players_file, "r", encoding="utf-8") as f:
                    players = json.load(f)
            except Exception:
                players = None

        if not players:
            # Fallback thông minh: nếu chưa có file snapshot, lấy trực tiếp danh sách thí sinh từ DB
            db_users = db.query(User).filter(User.is_admin == False).all()
            players = [
                {
                    "id": u.id,
                    "student_id": u.student_id or u.email.split("@")[0],
                    "name": u.name,
                    "bot_name": getattr(u, "bot_name", None) or f"Bot_{u.student_id or u.name}",
                    "points": 0,
                    "history": [],
                    "opponents_history": [],
                }
                for u in db_users
            ]

        updated_players = merge_and_calculate_standings(players, all_matches, req.round_num)

        # Lưu standings tại round published
        standings_file = os.path.join(publish_dir, "standings.json")
        with open(standings_file, "w", encoding="utf-8") as f:
            json.dump({
                "round": req.round_num,
                "total_matches": len(all_matches),
                "published_at": datetime.utcnow().isoformat(),
                "players": updated_players,
            }, f, indent=2, ensure_ascii=False)

        # Đồng bộ xuất bản ra backend/published và frontend/public/data để Jamstack tải được ngay
        base_backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        pub_dirs = [
            os.path.join(base_backend_dir, "published"),
            os.path.join(os.path.dirname(base_backend_dir), "frontend", "public", "data"),
        ]
        for pdir in pub_dirs:
            try:
                os.makedirs(pdir, exist_ok=True)
                with open(os.path.join(pdir, "standings.json"), "w", encoding="utf-8") as pf:
                    json.dump(updated_players, pf, indent=2, ensure_ascii=False)
                with open(os.path.join(pdir, "top32.json"), "w", encoding="utf-8") as tf:
                    json.dump(updated_players[:32], tf, indent=2, ensure_ascii=False)
            except Exception:
                pass

        # Đồng bộ các trận đấu đã hoàn thành vào CSDL Match để tra cứu lịch sử và realtime API
        try:
            for m in all_matches:
                m_id = m.get("match_id")
                if not m_id:
                    continue
                existing = db.query(Match).filter(Match.id == m_id).first()
                end_code = m.get("end_code")
                if end_code not in ("W1", "W2", "D1", "D2", "T1"):
                    end_code = "D2"
                if not existing:
                    match_obj = Match(
                        id=m_id,
                        tier="A",
                        bot_a_id=m.get("white_id"),
                        bot_b_id=m.get("black_id"),
                        status="done",
                        winner=m.get("winner"),
                        end_code=end_code,
                        total_moves=m.get("total_moves", 0),
                        duration_ms=m.get("duration_ms", 0),
                        played_at=datetime.utcnow(),
                    )
                    db.add(match_obj)
                else:
                    existing.bot_a_id = m.get("white_id") or existing.bot_a_id
                    existing.bot_b_id = m.get("black_id") or existing.bot_b_id
                    existing.status = "done"
                    existing.winner = m.get("winner")
                    existing.end_code = end_code
                    existing.total_moves = m.get("total_moves", 0)
                    existing.duration_ms = m.get("duration_ms", 0)

                # Đồng bộ Replay cho ván đấu nếu file kết quả có dữ liệu nước đi / replay
                moves_data = m.get("moves")
                states_data = m.get("states")
                if moves_data is not None:
                    rep_obj = db.query(Replay).filter(Replay.match_id == m_id).first()
                    if not rep_obj:
                        rep_obj = Replay(
                            match_id=m_id,
                            moves_json=json.dumps(moves_data, ensure_ascii=False),
                            states_json=json.dumps(states_data or [], ensure_ascii=False),
                        )
                        db.add(rep_obj)
                    else:
                        rep_obj.moves_json = json.dumps(moves_data, ensure_ascii=False)
                        rep_obj.states_json = json.dumps(states_data or [], ensure_ascii=False)

            # Cập nhật điểm và hệ số cho User trong CSDL
            for p in updated_players:
                uid = p.get("id") or p.get("user_id")
                u = db.query(User).filter(User.id == uid).first() if uid else None
                if not u and p.get("student_id"):
                    u = db.query(User).filter(User.student_id == p["student_id"]).first()
                if u:
                    if hasattr(u, "swiss_points"):
                        u.swiss_points = p.get("points", 0)
                    if hasattr(u, "swiss_wins"):
                        u.swiss_wins = p.get("wins", 0)
                    if hasattr(u, "buchholz"):
                        u.buchholz = p.get("buchholz", 0.0)
                    if hasattr(u, "sonneborn_berger"):
                        u.sonneborn_berger = p.get("sonneborn_berger", 0.0)

            db.commit()
        except Exception:
            db.rollback()

        # Lưu snapshot cho vòng sau
        next_snapshot = os.path.join(publish_dir, f"players_after_r{req.round_num}.json")
        with open(next_snapshot, "w", encoding="utf-8") as f:
            json.dump(updated_players, f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "round": req.round_num,
            "total_matches_processed": len(all_matches),
            "total_players": len(updated_players),
            "message": f"Đã xuất bản thành công Bảng Xếp Hạng Vòng {req.round_num}! Buchholz & Sonneborn-Berger đã được cập nhật.",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi hợp nhất và xuất bản Swiss: {str(e)}")


@router.get("/swiss/chunks/{round_num}")
def get_round_chunks_list(round_num: int):
    """Lấy danh sách chi tiết các chunk đã cắt cho Vòng round_num."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    chunks_dir = os.path.join(round_dir, "chunks")

    if not os.path.exists(chunks_dir):
        return {"round": round_num, "total_chunks": 0, "chunks": []}

    pattern = os.path.join(chunks_dir, "chunk_*.json")
    chunk_files = sorted(glob.glob(pattern))
    results_dir = os.path.join(round_dir, "results")

    chunks_data = []
    for cf in chunk_files:
        base_name = os.path.basename(cf)
        chunk_idx = int(base_name.replace("chunk_", "").replace(".json", ""))

        matches_count = 100
        try:
            with open(cf, "r", encoding="utf-8") as f:
                c_json = json.load(f)
                matches_count = len(c_json.get("matches", []))
        except Exception:
            pass

        result_file = os.path.join(results_dir, f"result_{str(chunk_idx).zfill(2)}.json")
        is_completed = os.path.exists(result_file)

        chunks_data.append({
            "chunk_id": chunk_idx,
            "file_name": base_name,
            "matches_count": matches_count,
            "file_size_kb": round(os.path.getsize(cf) / 1024, 1),
            "is_completed": is_completed,
            "download_url": f"/api/admin/swiss/chunks/{round_num}/{chunk_idx}/download",
        })

    return {
        "round": round_num,
        "total_chunks": len(chunks_data),
        "chunks": chunks_data,
    }


@router.get("/swiss/chunks/{round_num}/{chunk_id}/download")
def download_single_chunk(round_num: int, chunk_id: int):
    """Tải xuống file chunk_XX.json cho máy chấm cụ thể."""
    chunk_file = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}", "chunks", f"chunk_{str(chunk_id).zfill(2)}.json")
    if not os.path.exists(chunk_file):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file chunk_{chunk_id} cho Vòng {round_num}!")

    return FileResponse(
        path=chunk_file,
        filename=f"chunk_{str(chunk_id).zfill(2)}.json",
        media_type="application/json",
    )


@router.get("/swiss/chunks/{round_num}/download-zip")
def download_all_chunks_zip(round_num: int):
    """Đóng gói tất cả file chunk của Vòng round_num kèm script run_batch.py thành file ZIP."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    chunks_dir = os.path.join(round_dir, "chunks")

    if not os.path.exists(chunks_dir):
        raise HTTPException(status_code=404, detail=f"Chưa có file chunk cho Vòng {round_num}. Vui lòng bấm Bốc Thăm trước!")

    zip_filename = f"swiss_round_{round_num}_chunks.zip"
    zip_path = os.path.join(round_dir, zip_filename)

    base_project_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for cf in glob.glob(os.path.join(chunks_dir, "chunk_*.json")):
            zf.write(cf, arcname=os.path.join("chunks", os.path.basename(cf)))

        run_batch_script = os.path.join(base_project_dir, "scripts", "tournament", "run_batch.py")
        if os.path.exists(run_batch_script):
            zf.write(run_batch_script, arcname="run_batch.py")

        instructions = f"""HƯỚNG DẪN CHẠY CHẤM THI CỤM MÁY LAPTOP SINH VIÊN (VÒNG {round_num})
======================================================================
1. Máy số X (ví dụ Máy #01) copy file 'chunks/chunk_01.json' vào thư mục làm việc.
2. Chạy lệnh:
   python run_batch.py --chunk chunks/chunk_01.json --out result_01.json
3. Sau khi chạy xong (~2-3 phút cho 100 trận), gửi file 'result_01.json' về cho BTC
   hoặc tải trực tiếp lên mục 'Tiếp Nhận Kết Quả' trên Admin Dashboard!
"""
        zf.writestr("HUONG_DAN_CHAM_THI.txt", instructions)

    return FileResponse(
        path=zip_path,
        filename=zip_filename,
        media_type="application/zip",
    )


@router.post("/swiss/upload-result")
async def upload_machine_result(
    file: UploadFile = File(...),
    round_num: Optional[int] = Form(None),
    chunk_id: Optional[int] = Form(None),
):
    """
    Tiếp nhận file result_XX.json từ máy chấm phân tán hoặc file ZIP chứa nhiều result,
    hoặc 1 file kết quả chung (unified results) chứa toàn bộ các trận đấu của vòng.
    """
    file_bytes = await file.read()
    filename = file.filename or ""

    if filename.endswith(".json"):
        try:
            data = json.loads(file_bytes.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=400, detail="File nộp không phải định dạng JSON hợp lệ!")

        r_num = round_num or (data.get("round") if isinstance(data, dict) else 1) or 1
        results_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{r_num}", "results")
        chunks_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{r_num}", "chunks")
        os.makedirs(results_dir, exist_ok=True)

        target_chunk_id = chunk_id or (data.get("chunk_id") if isinstance(data, dict) else None)
        if not target_chunk_id:
            clean_name = os.path.splitext(filename)[0]
            if "result_" in clean_name:
                try:
                    target_chunk_id = int(clean_name.replace("result_", ""))
                except Exception:
                    pass

        results_list = (
            data.get("results")
            if isinstance(data, dict)
            else (data if isinstance(data, list) else [])
        )

        # 1. Xác định target_chunk_id nếu nộp cho 1 máy cụ thể (qua Form param, JSON chunk_id, hoặc tên file)
        target_chunk_id = chunk_id
        if not target_chunk_id and isinstance(data, dict) and data.get("chunk_id") is not None:
            try:
                target_chunk_id = int(data.get("chunk_id"))
            except (ValueError, TypeError):
                pass

        if not target_chunk_id:
            m = re.search(r'(?:result|chunk)[_\-](\d+)', filename, re.IGNORECASE)
            if m:
                try:
                    target_chunk_id = int(m.group(1))
                except (ValueError, TypeError):
                    pass

        # 2. XỬ LÝ NỘP LẺ CHO 1 MÁY CHẤM DUY NHẤT:
        # Nếu đã xác định được target_chunk_id (do bấm nút nộp tại máy đó hoặc file ghi rõ chunk_id):
        # TUYỆT ĐỐI CHỈ LƯU VÀO MÁY ĐÓ, KHÔNG BAO GIỜ PHÂN TÁCH SANG CÁC MÁY KHÁC!
        if target_chunk_id:
            chunk_file = os.path.join(chunks_dir, f"chunk_{str(target_chunk_id).zfill(2)}.json")
            saved_results = results_list

            # Nếu file chứa nhiều trận (vd nộp nhầm file gộp vào nút nộp máy lẻ), lọc đúng các trận của máy này
            if os.path.exists(chunk_file) and results_list:
                try:
                    with open(chunk_file, "r", encoding="utf-8") as f:
                        cf_data = json.load(f)
                    c_matches = cf_data.get("matches", [])
                    c_match_ids = {m["match_id"] for m in c_matches if isinstance(m, dict) and "match_id" in m}
                    filtered = [
                        r for r in results_list
                        if isinstance(r, dict) and r.get("match_id") in c_match_ids
                    ]
                    if len(filtered) > 0:
                        saved_results = filtered
                except Exception:
                    pass

            target_file = os.path.join(results_dir, f"result_{str(target_chunk_id).zfill(2)}.json")
            payload = {
                "chunk_id": target_chunk_id,
                "round": r_num,
                "total_matches": len(saved_results),
                "execution_time_sec": data.get("execution_time_sec", 0) if isinstance(data, dict) else 0,
                "results": saved_results,
            }
            with open(target_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)

            return {
                "success": True,
                "round": r_num,
                "chunk_id": target_chunk_id,
                "matches_count": len(saved_results),
                "is_unified": False,
                "message": f"Đã tiếp nhận thành công kết quả Máy #{str(target_chunk_id).zfill(2)} ({len(saved_results)} trận đấu)!",
            }

        # 3. NẾU KHÔNG CÓ target_chunk_id (nộp ở nút Gói chung Step 3.2):
        # Kiểm tra nội dung trận đấu xem có khớp với các chunk trong thư mục chunks/ không
        if os.path.exists(chunks_dir) and len(results_list) > 0:
            chunk_files = sorted(glob.glob(os.path.join(chunks_dir, "chunk_*.json")))
            results_by_match = {
                r["match_id"]: r
                for r in results_list
                if isinstance(r, dict) and "match_id" in r
            }

            chunks_matched = []
            for cf in chunk_files:
                b_name = os.path.basename(cf)
                c_id = int(b_name.replace("chunk_", "").replace(".json", ""))
                try:
                    with open(cf, "r", encoding="utf-8") as f:
                        c_data = json.load(f)
                    c_matches = c_data.get("matches", [])
                    matched_res = [
                        results_by_match[m["match_id"]]
                        for m in c_matches
                        if m.get("match_id") in results_by_match
                    ]
                    if len(matched_res) > 0 and len(matched_res) == len(c_matches):
                        chunks_matched.append((c_id, matched_res, len(c_matches)))
                except Exception:
                    pass

            # Trường hợp 3a: File chỉ chứa toàn bộ trận của đúng 1 chunk -> Lưu duy nhất máy đó!
            if len(chunks_matched) == 1:
                c_id, matched_res, count_m = chunks_matched[0]
                target_file = os.path.join(results_dir, f"result_{str(c_id).zfill(2)}.json")
                payload = {
                    "chunk_id": c_id,
                    "round": r_num,
                    "total_matches": count_m,
                    "execution_time_sec": data.get("execution_time_sec", 0) if isinstance(data, dict) else 0,
                    "results": matched_res,
                }
                with open(target_file, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2, ensure_ascii=False)
                return {
                    "success": True,
                    "round": r_num,
                    "chunk_id": c_id,
                    "matches_count": count_m,
                    "is_unified": False,
                    "message": f"Tự động nhận diện kết quả Máy #{str(c_id).zfill(2)} ({count_m} trận đấu)!",
                }

            # Trường hợp 3b: File chứa kết quả của từ 2 chunk trở lên (file gộp đa chunk)
            elif len(chunks_matched) > 1:
                saved_chunks = []
                total_m = 0
                for c_id, matched_res, count_m in chunks_matched:
                    target_file = os.path.join(results_dir, f"result_{str(c_id).zfill(2)}.json")
                    payload = {
                        "chunk_id": c_id,
                        "round": r_num,
                        "total_matches": count_m,
                        "execution_time_sec": data.get("execution_time_sec", 0) if isinstance(data, dict) else 0,
                        "results": matched_res,
                    }
                    with open(target_file, "w", encoding="utf-8") as f:
                        json.dump(payload, f, indent=2, ensure_ascii=False)
                    saved_chunks.append(c_id)
                    total_m += count_m

                return {
                    "success": True,
                    "round": r_num,
                    "chunk_id": saved_chunks,
                    "matches_count": total_m,
                    "is_unified": True,
                    "message": f"Đã phân tách và hoàn tất kết quả cho cả {len(saved_chunks)} máy chấm ({total_m} trận đấu)!",
                }

        raise HTTPException(
            status_code=400,
            detail="Không xác định được máy chấm (chunk_id)! Vui lòng đặt tên file dạng 'result_01.json' hoặc nộp tại nút 'Nộp KQ' của từng máy.",
        )

    elif filename.endswith(".zip"):
        try:
            zf = zipfile.ZipFile(io.BytesIO(file_bytes))
            count_saved = 0
            for name in zf.namelist():
                if name.endswith(".json") and "result_" in os.path.basename(name):
                    b_name = os.path.basename(name)
                    c_id = int(b_name.replace("result_", "").replace(".json", ""))

                    r_num = round_num or 1
                    results_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{r_num}", "results")
                    os.makedirs(results_dir, exist_ok=True)

                    with open(os.path.join(results_dir, b_name), "wb") as out_f:
                        out_f.write(zf.read(name))
                    count_saved += 1

            return {
                "success": True,
                "count_saved": count_saved,
                "message": f"Đã giải nén và lưu thành công {count_saved} file kết quả từ gói ZIP!",
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Lỗi khi đọc file ZIP kết quả: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Định dạng không được hỗ trợ! Vui lòng nộp file .json hoặc .zip!")


@router.get("/swiss/results-status/{round_num}")
def get_round_results_status(round_num: int):
    """Kiểm tra chi tiết tình trạng nộp bài của từng máy chấm (mặc định 4 máy)."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    chunks_dir = os.path.join(round_dir, "chunks")
    results_dir = os.path.join(round_dir, "results")

    # Xác định tổng số chunk thực tế đã chia trong vòng đấu này
    total_chunks = 4
    if os.path.exists(chunks_dir):
        c_files = [f for f in os.listdir(chunks_dir) if f.startswith("chunk_") and f.endswith(".json")]
        if len(c_files) > 0:
            total_chunks = len(c_files)

    status_list = []
    ready_count = 0
    total_matches_done = 0

    for chunk_id in range(1, total_chunks + 1):
        res_file = os.path.join(results_dir, f"result_{str(chunk_id).zfill(2)}.json")
        chunk_file = os.path.join(chunks_dir, f"chunk_{str(chunk_id).zfill(2)}.json")
        is_ready = os.path.exists(res_file)

        matches_count = 0
        file_size_kb = 0.0
        last_updated = None

        if is_ready:
            ready_count += 1
            file_size_kb = round(os.path.getsize(res_file) / 1024, 1)
            last_updated = datetime.fromtimestamp(os.path.getmtime(res_file)).strftime("%H:%M:%S %d/%m")
            try:
                with open(res_file, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    matches_count = len(d.get("results", []))
                    total_matches_done += matches_count
            except Exception:
                matches_count = 0
        else:
            # Nếu chưa nộp kết quả, đọc số trận được giao từ file chunk
            if os.path.exists(chunk_file):
                try:
                    with open(chunk_file, "r", encoding="utf-8") as f:
                        cf_data = json.load(f)
                        matches_count = len(cf_data.get("matches", []))
                except Exception:
                    matches_count = 0

        status_list.append({
            "chunk_id": chunk_id,
            "machine_label": f"Máy #{str(chunk_id).zfill(2)}",
            "is_ready": is_ready,
            "matches_count": matches_count,
            "file_size_kb": file_size_kb,
            "last_updated": last_updated,
        })

    return {
        "round": round_num,
        "ready_count": ready_count,
        "total_chunks": total_chunks,
        "total_matches_done": total_matches_done,
        "is_all_ready": ready_count >= total_chunks,
        "progress_percent": int((ready_count / total_chunks) * 100) if total_chunks > 0 else 0,
        "machines": status_list,
    }


@router.delete("/swiss/results/{round_num}")
def reset_round_results(round_num: int):
    """Xóa toàn bộ các file kết quả đã nộp của vòng đấu để đặt lại trạng thái chờ nộp."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    results_dir = os.path.join(round_dir, "results")
    publish_dir = os.path.join(round_dir, "published")
    deleted_count = 0

    if os.path.exists(results_dir):
        for f in glob.glob(os.path.join(results_dir, "result_*.json")):
            try:
                os.remove(f)
                deleted_count += 1
            except Exception:
                pass

    if os.path.exists(publish_dir):
        for f in glob.glob(os.path.join(publish_dir, "*.json")):
            try:
                os.remove(f)
            except Exception:
                pass

    return {
        "success": True,
        "round": round_num,
        "deleted_count": deleted_count,
        "message": f"Đã đặt lại trạng thái! Đã dọn sạch {deleted_count} file kết quả của Vòng {round_num}.",
    }


@router.delete("/swiss/results/{round_num}/{chunk_id}")
def delete_single_chunk_result(round_num: int, chunk_id: int):
    """Hủy/xóa file kết quả của riêng một máy chấm để nộp lại."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    results_dir = os.path.join(round_dir, "results")
    target_file = os.path.join(results_dir, f"result_{str(chunk_id).zfill(2)}.json")

    if os.path.exists(target_file):
        try:
            os.remove(target_file)
            return {
                "success": True,
                "round": round_num,
                "chunk_id": chunk_id,
                "message": f"Đã hủy kết quả Máy #{str(chunk_id).zfill(2)}!",
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Không thể xóa kết quả máy #{chunk_id}: {str(e)}")

    return {
        "success": True,
        "round": round_num,
        "chunk_id": chunk_id,
        "message": f"Máy #{str(chunk_id).zfill(2)} chưa có file kết quả.",
    }
