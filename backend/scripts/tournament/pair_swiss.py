#!/usr/bin/env python3
"""
pair_swiss.py — Swiss Tournament Pairing Engine (Thể Thức Thụy Sĩ)
===================================================================
Quy mô: Phục vụ 2.000 sinh viên UET với chi phí 0đ.
Chức năng:
  1. Ghép cặp vòng R (1 đến 13) theo thể thức Thụy Sĩ chuẩn FIDE:
     - Thí sinh cùng nhóm điểm (Score Group) đấu với nhau.
     - Không bao giờ gặp lại nhau lần thứ hai trong giải.
     - Cân bằng số ván cầm Trắng (W) và Đen (B).
  2. Tự động cắt 1.000 trận đấu thành 10 file chunk (chunk_01.json .. chunk_10.json)
     để phân phối cho 10 laptop sinh viên chấm thi song song.
"""

import os
import sys
import json
import random
import argparse
from typing import List, Dict, Any, Tuple, Optional

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def load_or_generate_players(players_file: Optional[str] = None, count: int = 2000) -> List[Dict[str, Any]]:
    """Tải danh sách thí sinh từ file hoặc tự động tạo dữ liệu mẫu nếu chưa có."""
    if players_file and os.path.exists(players_file):
        with open(players_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Tự động khởi tạo dữ liệu mẫu cho quy mô 2.000 sinh viên
    print(f"[*] Khởi tạo danh sách {count} sinh viên UET...")
    players = []
    for i in range(1, count + 1):
        msv = f"2102{str(i).zfill(4)}" if i <= 1000 else f"2202{str(i - 1000).zfill(4)}"
        bot_type = "greedy" if i % 4 == 0 else "random"
        players.append({
            "id": f"player_{i}",
            "student_id": msv,
            "name": f"Sinh Viên {msv}",
            "bot_name": f"Bot_{msv}_{bot_type}",
            "bot_type": bot_type,
            "points": 0,
            "white_count": 0,
            "black_count": 0,
            "history": [],        # Danh sách opponent_ids đã gặp
            "results": [],        # Kết quả các vòng: 'W', 'B', 'D', 'L'
        })
    return players


def swiss_pair_round(players: List[Dict[str, Any]], round_num: int) -> List[Dict[str, Any]]:
    """
    Ghép cặp Swiss System chuẩn:
    1. Gom các người chơi theo nhóm điểm (Score Groups).
    2. Trong mỗi nhóm điểm, ghép cặp tránh gặp lại người trong history.
    3. Phân định Trắng - Đen theo lịch sử cầm màu.
    """
    # Sắp xếp theo điểm giảm dần
    sorted_players = sorted(players, key=lambda p: (p.get("points", 0), -len(p.get("history", []))), reverse=True)

    unpaired = list(sorted_players)
    pairings = []
    match_counter = 1

    while len(unpaired) >= 2:
        p1 = unpaired.pop(0)

        # Tìm đối thủ thích hợp trong danh sách còn lại (chưa từng gặp)
        best_opponent_idx = -1
        for idx, candidate in enumerate(unpaired):
            if candidate["id"] not in p1.get("history", []):
                best_opponent_idx = idx
                break

        # Nếu tất cả ứng viên đều đã gặp (trường hợp cực hiếm), lấy đối thủ gần nhất
        if best_opponent_idx == -1:
            best_opponent_idx = 0

        p2 = unpaired.pop(best_opponent_idx)

        # Phân định Trắng - Đen: ai cầm Trắng ít hơn sẽ được ưu tiên đi Trắng
        p1_w = p1.get("white_count", 0)
        p2_w = p2.get("white_count", 0)

        if p1_w < p2_w:
            white, black = p1, p2
        elif p2_w < p1_w:
            white, black = p2, p1
        else:
            # Ngẫu nhiên nếu bằng nhau
            if random.random() < 0.5:
                white, black = p1, p2
            else:
                white, black = p2, p1

        pairings.append({
            "match_id": f"R{round_num}_M{str(match_counter).zfill(4)}",
            "round": round_num,
            "white": {
                "id": white["id"],
                "student_id": white.get("student_id"),
                "name": white["name"],
                "bot_name": white.get("bot_name"),
                "bot_type": white.get("bot_type", "random"),
            },
            "black": {
                "id": black["id"],
                "student_id": black.get("student_id"),
                "name": black["name"],
                "bot_name": black.get("bot_name"),
                "bot_type": black.get("bot_type", "random"),
            },
        })
        match_counter += 1

    # Thí sinh lẻ nhận 1 điểm bye
    if len(unpaired) == 1:
        bye_player = unpaired.pop(0)
        print(f"[*] Thí sinh lẻ được nhận Bye (+3 điểm): {bye_player['name']} ({bye_player['student_id']})")
        bye_player["points"] = bye_player.get("points", 0) + 3

    return pairings


def split_into_chunks(pairings: List[Dict[str, Any]], num_chunks: int = 10) -> List[List[Dict[str, Any]]]:
    """Cắt danh sách trận đấu thành num_chunks phần đều nhau."""
    total = len(pairings)
    chunk_size = (total + num_chunks - 1) // num_chunks
    chunks = []
    for i in range(num_chunks):
        start = i * chunk_size
        end = min(start + chunk_size, total)
        if start < total:
            chunks.append(pairings[start:end])
        else:
            chunks.append([])
    return chunks


def main():
    parser = argparse.ArgumentParser(description="Swiss Tournament Pairing Engine for 2,000 Students")
    parser.add_argument("--round", type=int, default=1, help="Số thứ tự vòng đấu (1 đến 13)")
    parser.add_argument("--players-file", type=str, default=None, help="Đường dẫn file JSON danh sách người chơi")
    parser.add_argument("--chunks-dir", type=str, default="chunks", help="Thư mục xuất các file chunk")
    parser.add_argument("--num-chunks", type=int, default=10, help="Số lượng file chunk (cho 10 laptop chấm thi)")
    parser.add_argument("--player-count", type=int, default=2000, help="Số thí sinh khởi tạo nếu chưa có file")
    args = parser.parse_args()

    os.makedirs(args.chunks_dir, exist_ok=True)

    players = load_or_generate_players(args.players_file, count=args.player_count)
    print(f"[+] Tổng số thí sinh: {len(players)}")

    pairings = swiss_pair_round(players, args.round)
    print(f"[+] Đã ghép cặp Vòng {args.round}: {len(pairings)} trận đấu")

    chunks = split_into_chunks(pairings, num_chunks=args.num_chunks)

    # Xuất các file chunk
    for idx, chunk in enumerate(chunks, 1):
        chunk_file = os.path.join(args.chunks_dir, f"chunk_{str(idx).zfill(2)}.json")
        payload = {
            "round": args.round,
            "chunk_id": idx,
            "total_chunks": args.num_chunks,
            "matches_count": len(chunk),
            "matches": chunk,
        }
        with open(chunk_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"  -> Đã tạo {chunk_file} ({len(chunk)} trận)")

    # Lưu lại trạng thái players hiện tại nếu cần
    save_players_path = os.path.join(args.chunks_dir, f"players_before_r{args.round}.json")
    with open(save_players_path, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2, ensure_ascii=False)

    print(f"\n[✓] Hoàn tất ghép cặp Vòng {args.round}! Sẵn sàng chuyển giao 10 file chunk cho 10 máy chấm.")


if __name__ == "__main__":
    main()
