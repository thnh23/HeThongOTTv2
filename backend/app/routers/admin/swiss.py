"""
Admin Sub-router — Vận Hành Giải Đấu Thụy Sĩ (Swiss 13 Vòng & Chấm Phân Tán)
"""

import os
import io
import json
import glob
import zipfile
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from app.routers.admin.common import (
    SwissPairRequest,
    SwissPublishRequest,
    SWISS_STORAGE_DIR,
)

router = APIRouter(tags=["admin-swiss"])


@router.get("/swiss/status")
def get_swiss_tournament_status():
    """Lấy trạng thái điều hành giải đấu Thụy Sĩ (Swiss 13 Vòng)."""
    os.makedirs(SWISS_STORAGE_DIR, exist_ok=True)

    current_round = 1
    chunks_ready = 0
    results_ready = 0
    is_published = False

    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{current_round}")
    chunks_dir = os.path.join(round_dir, "chunks")
    results_dir = os.path.join(round_dir, "results")
    publish_dir = os.path.join(round_dir, "published")

    if os.path.exists(chunks_dir):
        chunks_ready = len([f for f in os.listdir(chunks_dir) if f.startswith("chunk_") and f.endswith(".json")])
    if os.path.exists(results_dir):
        results_ready = len([f for f in os.listdir(results_dir) if f.startswith("result_") and f.endswith(".json")])
    if os.path.exists(os.path.join(publish_dir, "standings.json")):
        is_published = True

    return {
        "current_round": current_round,
        "total_rounds": 13,
        "total_players": 2000,
        "num_chunks": 10,
        "chunks_ready": chunks_ready,
        "results_ready": results_ready,
        "is_published": is_published,
        "chunks_progress_percent": int((results_ready / 10) * 100) if chunks_ready > 0 else 0,
        "system_status": "ready",
    }


@router.post("/swiss/pair")
def trigger_swiss_pair(req: SwissPairRequest):
    """
    Bốc thăm ghép cặp Vòng R theo thể thức Thụy Sĩ và chia nhỏ 10 chunks.
    """
    try:
        from scripts.tournament.pair_swiss import load_or_generate_players, swiss_pair_round, split_into_chunks

        round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{req.round_num}")
        chunks_dir = os.path.join(round_dir, "chunks")
        os.makedirs(chunks_dir, exist_ok=True)

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi ghép cặp Swiss: {str(e)}")


@router.post("/swiss/publish")
def trigger_swiss_publish(req: SwissPublishRequest):
    """
    Hợp nhất 10 file kết quả, tính toán Buchholz & Sonneborn-Berger và xuất bản JSON tĩnh.
    """
    try:
        from scripts.tournament.merge_and_publish import calculate_tiebreakers

        round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{req.round_num}")
        results_dir = os.path.join(round_dir, "results")
        publish_dir = os.path.join(round_dir, "published")
        os.makedirs(publish_dir, exist_ok=True)

        pattern = os.path.join(results_dir, "result_*.json")
        result_files = sorted(glob.glob(pattern))

        if len(result_files) < 10:
            raise HTTPException(
                status_code=400,
                detail=f"Chưa đủ 10 file kết quả (hiện có {len(result_files)}/10 file)! Vui lòng tiếp nhận đủ kết quả từ 10 máy chấm.",
            )

        all_matches = []
        for rf in result_files:
            with open(rf, "r", encoding="utf-8") as f:
                d = json.load(f)
                all_matches.extend(d.get("results", []))

        chunks_dir = os.path.join(round_dir, "chunks")
        players_file = os.path.join(chunks_dir, f"players_before_r{req.round_num}.json")
        if not os.path.exists(players_file):
            raise HTTPException(status_code=500, detail="Không tìm thấy file trạng thái người chơi trước vòng đấu!")

        with open(players_file, "r", encoding="utf-8") as f:
            players = json.load(f)

        updated_players = calculate_tiebreakers(players, all_matches, req.round_num)

        # Lưu standings
        standings_file = os.path.join(publish_dir, "standings.json")
        with open(standings_file, "w", encoding="utf-8") as f:
            json.dump({
                "round": req.round_num,
                "total_matches": len(all_matches),
                "published_at": datetime.utcnow().isoformat(),
                "players": updated_players,
            }, f, indent=2, ensure_ascii=False)

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
):
    """
    Tiếp nhận file result_XX.json từ máy chấm phân tán hoặc file ZIP chứa nhiều result.
    Lưu trực tiếp vào thư mục results/ của vòng đấu.
    """
    file_bytes = await file.read()
    filename = file.filename or ""

    if filename.endswith(".json"):
        try:
            data = json.loads(file_bytes.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=400, detail="File nộp không phải định dạng JSON hợp lệ!")

        r_num = round_num or data.get("round", 1)
        chunk_id = data.get("chunk_id")
        if not chunk_id:
            clean_name = os.path.splitext(filename)[0]
            if "result_" in clean_name:
                try:
                    chunk_id = int(clean_name.replace("result_", ""))
                except Exception:
                    pass

        if not chunk_id:
            raise HTTPException(status_code=400, detail="Không xác định được chunk_id từ file kết quả!")

        results_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{r_num}", "results")
        os.makedirs(results_dir, exist_ok=True)

        target_file = os.path.join(results_dir, f"result_{str(chunk_id).zfill(2)}.json")
        with open(target_file, "wb") as f:
            f.write(file_bytes)

        matches_count = len(data.get("results", []))
        return {
            "success": True,
            "round": r_num,
            "chunk_id": chunk_id,
            "matches_count": matches_count,
            "message": f"Đã tiếp nhận thành công kết quả Máy #{chunk_id} ({matches_count} trận đấu)!",
        }

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
    """Kiểm tra chi tiết tình trạng nộp bài của từng máy chấm trong 10 máy."""
    round_dir = os.path.join(SWISS_STORAGE_DIR, f"round_{round_num}")
    results_dir = os.path.join(round_dir, "results")

    status_list = []
    ready_count = 0
    total_matches_done = 0

    for chunk_id in range(1, 11):
        res_file = os.path.join(results_dir, f"result_{str(chunk_id).zfill(2)}.json")
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
                matches_count = 100
                total_matches_done += 100

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
        "total_chunks": 10,
        "total_matches_done": total_matches_done,
        "is_all_ready": ready_count >= 10,
        "progress_percent": int((ready_count / 10) * 100),
        "machines": status_list,
    }
