#!/usr/bin/env python3
"""
run_batch.py — Distributed Chunk Runner for Match Evaluation
============================================================
Chạy độc lập trên mỗi laptop trong cụm 10 laptop chấm thi.
Chức năng:
  1. Đọc file chunk_XX.json chứa khoảng 100 trận đấu.
  2. Phân phối song song qua multiprocessing tận dụng tối đa CPU core.
  3. Chạy từng ván cờ qua Referee & Sandbox an toàn (timeout 2.0s / nước).
  4. Xuất file kết quả result_XX.json sẵn sàng gửi về cho Ban Tổ Chức.
"""

import os
import sys
import json
import time
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, Any

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Thêm đường dẫn backend vào sys.path để import các module engine
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.engine.referee import play_match, MatchResult
from app.services.starter_bots.random_bot import choose_move as random_choose_move
from app.services.starter_bots.greedy_bot import choose_move as greedy_choose_move


def resolve_bot_callable(bot_info: Dict[str, Any]):
    """Ánh xạ thông tin bot sang hàm callable tương ứng."""
    bot_type = bot_info.get("bot_type", "random")
    if bot_type == "greedy":
        return greedy_choose_move
    return random_choose_move


def execute_single_match(match_item: Dict[str, Any], timeout_sec: float = 2.0) -> Dict[str, Any]:
    """Chạy 1 ván đấu giữa 2 bot và trả về kết quả."""
    match_id = match_item["match_id"]
    white_info = match_item["white"]
    black_info = match_item["black"]

    white_fn = resolve_bot_callable(white_info)
    black_fn = resolve_bot_callable(black_info)

    try:
        start_time = time.perf_counter()
        res: MatchResult = play_match(
            bot_white_fn=white_fn,
            bot_black_fn=black_fn,
            bot_white_name=white_info.get("name", "White"),
            bot_black_name=black_info.get("name", "Black"),
            timeout_sec=timeout_sec,
            max_moves=200,
            match_id=match_id,
        )
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return {
            "match_id": match_id,
            "round": match_item.get("round", 1),
            "white_id": white_info["id"],
            "black_id": black_info["id"],
            "white_name": white_info.get("name"),
            "black_name": black_info.get("name"),
            "winner": res.winner,              # 'W', 'B', hoặc None (hòa)
            "end_code": res.end_code,          # 'W1', 'W2', 'B1', 'B2', 'D2', v.v.
            "total_moves": res.total_moves,
            "duration_ms": elapsed_ms,
            "reason": res.reason,
            "status": "success",
        }
    except Exception as exc:
        return {
            "match_id": match_id,
            "round": match_item.get("round", 1),
            "white_id": white_info["id"],
            "black_id": black_info["id"],
            "winner": None,
            "end_code": "D2",
            "total_moves": 0,
            "duration_ms": 0,
            "reason": f"Execution error: {str(exc)}",
            "status": "error",
        }


def main():
    parser = argparse.ArgumentParser(description="Distributed Batch Runner for OTTv2 Chunk")
    parser.add_argument("--chunk-file", type=str, required=True, help="Đường dẫn tới file chunk_XX.json")
    parser.add_argument("--output-file", type=str, default=None, help="Đường dẫn file kết quả result_XX.json")
    parser.add_argument("--workers", type=int, default=4, help="Số tiến trình song song (mặc định 4)")
    parser.add_argument("--timeout", type=float, default=2.0, help="Thời gian tối đa cho 1 nước đi (giây)")
    args = parser.parse_args()

    if not os.path.exists(args.chunk_file):
        print(f"[!] Không tìm thấy file chunk: {args.chunk_file}")
        sys.exit(1)

    with open(args.chunk_file, "r", encoding="utf-8") as f:
        chunk_data = json.load(f)

    matches = chunk_data.get("matches", [])
    chunk_id = chunk_data.get("chunk_id", 1)
    round_num = chunk_data.get("round", 1)

    print(f"============================================================")
    print(f"[*] MÁY CHẤM PHÂN TÁN — CHUNK #{chunk_id} (VÒNG {round_num})")
    print(f"[*] Tổng số trận đấu: {len(matches)} | Số workers: {args.workers}")
    print(f"============================================================")

    results = []
    start_all = time.perf_counter()

    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(execute_single_match, m, args.timeout): m for m in matches}

        completed_count = 0
        total_count = len(matches)

        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            completed_count += 1

            winner_str = "Hòa" if res["winner"] is None else ("Trắng thắng" if res["winner"] == "W" else "Đen thắng")
            print(f"[{completed_count}/{total_count}] {res['match_id']}: {winner_str} ({res['end_code']}, {res['total_moves']} nước, {res['duration_ms']}ms)")

    total_time = round(time.perf_counter() - start_all, 2)
    print(f"\n[✓] Hoàn tất chấm thi {len(results)} trận trong {total_time}s!")

    output_path = args.output_file
    if not output_path:
        base_dir = os.path.dirname(args.chunk_file)
        output_path = os.path.join(base_dir, f"result_{str(chunk_id).zfill(2)}.json")

    payload = {
        "chunk_id": chunk_id,
        "round": round_num,
        "total_matches": len(results),
        "execution_time_sec": total_time,
        "results": results,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"[✓] Đã xuất file kết quả: {output_path}")


if __name__ == "__main__":
    main()
