#!/usr/bin/env python3
"""
merge_and_publish.py — Swiss Results Merger & Jamstack Static Publisher
========================================================================
Chạy bởi Ban Tổ Chức sau khi thu thập 10 file result_XX.json từ 10 laptop.
Chức năng:
  1. Hợp nhất kết quả toàn bộ 1.000 trận đấu của Vòng R.
  2. Cập nhật điểm Match Points (Thắng +3, Hòa +1, Thua 0).
  3. Tính toán hệ số phụ quốc tế:
     - Buchholz Cut-1 (BH-1)
     - Sonneborn-Berger (SB)
  4. Xác định Top 32 cờ thủ xuất sắc nhất.
  5. Xuất bản các file JSON tĩnh:
     - published/standings.json
     - published/round_{R}.json
     - published/top32.json
     - published/players_state.json (sẵn sàng cho vòng R+1)
"""

import os
import sys
import glob
import json
import argparse
from typing import List, Dict, Any

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def calculate_tiebreakers(players_map: Dict[str, Dict[str, Any]]):
    """Tính toán hệ số phụ Buchholz Cut-1 và Sonneborn-Berger."""
    for p_id, p in players_map.items():
        opponents = p.get("opponents_history", [])  # list of (opp_id, result_for_p)
        opp_points = [players_map[opp_id]["points"] for opp_id, _ in opponents if opp_id in players_map]

        # 1. Buchholz Cut-1 (nếu có từ 2 đối thủ trở lên, bỏ đối thủ điểm thấp nhất)
        if len(opp_points) >= 2:
            p["buchholz"] = round(float(sum(opp_points) - min(opp_points)), 1)
        else:
            p["buchholz"] = round(float(sum(opp_points)), 1)

        # 2. Sonneborn-Berger (100% điểm đối thủ thắng + 50% điểm đối thủ hòa)
        sb = 0.0
        for opp_id, res in opponents:
            if opp_id in players_map:
                opp_score = players_map[opp_id]["points"]
                if res == "win":
                    sb += opp_score
                elif res == "draw":
                    sb += opp_score * 0.5
        p["sonneborn_berger"] = round(sb, 1)


def merge_and_calculate_standings(
    players_input: Any,
    all_matches: List[Dict[str, Any]],
    round_num: int = 1,
) -> List[Dict[str, Any]]:
    """
    Hợp nhất kết quả thi đấu của vòng đấu, cập nhật điểm, tính Tiebreakers và sắp xếp xếp hạng.
    """
    players_map = {}
    if isinstance(players_input, list):
        for p in players_input:
            players_map[p["id"]] = dict(p)
    elif isinstance(players_input, dict):
        players_map = {k: dict(v) for k, v in players_input.items()}

    # Tự động trích xuất người chơi từ các trận đấu nếu chưa có trong map
    for m in all_matches:
        w_id = m.get("white_id") or m.get("player_1_id")
        b_id = m.get("black_id") or m.get("player_2_id")
        w_name = m.get("white_name") or m.get("player_1_name") or f"Thí Sinh {w_id}"
        b_name = m.get("black_name") or m.get("player_2_name") or f"Thí Sinh {b_id}"
        for pid, pname in ((w_id, w_name), (b_id, b_name)):
            if pid and pid not in players_map:
                players_map[pid] = {
                    "id": pid,
                    "name": pname,
                    "student_id": str(pid).replace("player_", "2102"),
                    "bot_name": f"Bot_{pid}",
                    "points": 0,
                    "matches_played": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                    "white_count": 0,
                    "black_count": 0,
                    "history": [],
                    "opponents_history": [],
                }

    # Đảm bảo các thuộc tính cần thiết luôn tồn tại
    for p in players_map.values():
        p.setdefault("opponents_history", [])
        p.setdefault("matches_played", 0)
        p.setdefault("wins", 0)
        p.setdefault("draws", 0)
        p.setdefault("losses", 0)
        p.setdefault("white_count", 0)
        p.setdefault("black_count", 0)
        p.setdefault("points", 0)
        p.setdefault("history", [])

    # Cập nhật kết quả từng trận đấu vào stats
    for m in all_matches:
        w_id = m.get("white_id") or m.get("player_1_id")
        b_id = m.get("black_id") or m.get("player_2_id")
        winner = m.get("winner")

        if not w_id or not b_id:
            continue

        if w_id in players_map:
            p_w = players_map[w_id]
            p_w["matches_played"] += 1
            p_w["white_count"] += 1
            p_w["history"].append(b_id)

        if b_id in players_map:
            p_b = players_map[b_id]
            p_b["matches_played"] += 1
            p_b["black_count"] += 1
            p_b["history"].append(w_id)

        if winner == "W":
            if w_id in players_map:
                players_map[w_id]["wins"] += 1
                players_map[w_id]["points"] += 3
                players_map[w_id]["opponents_history"].append((b_id, "win"))
            if b_id in players_map:
                players_map[b_id]["losses"] += 1
                players_map[b_id]["opponents_history"].append((w_id, "loss"))
        elif winner == "B":
            if b_id in players_map:
                players_map[b_id]["wins"] += 1
                players_map[b_id]["points"] += 3
                players_map[b_id]["opponents_history"].append((w_id, "win"))
            if w_id in players_map:
                players_map[w_id]["losses"] += 1
                players_map[w_id]["opponents_history"].append((b_id, "loss"))
        else:
            # Hòa
            if w_id in players_map:
                players_map[w_id]["draws"] += 1
                players_map[w_id]["points"] += 1
                players_map[w_id]["opponents_history"].append((b_id, "draw"))
            if b_id in players_map:
                players_map[b_id]["draws"] += 1
                players_map[b_id]["points"] += 1
                players_map[b_id]["opponents_history"].append((w_id, "draw"))

    # Tính toán Tiebreakers
    calculate_tiebreakers(players_map)

    # Sắp xếp thứ hạng toàn giải
    sorted_standings = sorted(
        players_map.values(),
        key=lambda p: (
            p["points"],
            p.get("buchholz", 0),
            p.get("sonneborn_berger", 0),
            p["wins"],
            -p["losses"],
        ),
        reverse=True,
    )

    # Thêm thứ hạng và dự phóng điểm học phần
    standings_export = []
    for rank_idx, p in enumerate(sorted_standings, 1):
        mp = p["matches_played"]
        win_rate = round((p["wins"] / mp) * 100, 1) if mp > 0 else 0.0

        grade = "6.5 – 7.0"
        if rank_idx <= 32:
            grade = "10.0 (A+)"
        elif p["wins"] >= 10:
            grade = "9.5"
        elif p["wins"] >= 8:
            grade = "9.0"
        elif p["wins"] >= 6:
            grade = "8.5"
        elif p["wins"] >= 4:
            grade = "7.5"

        item = {
            **p,
            "rank": rank_idx,
            "user_id": p["id"],
            "name": p["name"],
            "student_id": p.get("student_id"),
            "bot_name": p.get("bot_name"),
            "matches_played": mp,
            "wins": p["wins"],
            "draws": p["draws"],
            "losses": p["losses"],
            "points": p["points"],
            "buchholz": p.get("buchholz", 0.0),
            "sonneborn_berger": p.get("sonneborn_berger", 0.0),
            "win_rate": win_rate,
            "grade_projection": grade,
            "is_top32": rank_idx <= 32,
        }
        standings_export.append(item)

    return standings_export


def main():
    parser = argparse.ArgumentParser(description="Merge Results and Publish Jamstack Static JSON")
    parser.add_argument("--round", type=int, required=True, help="Vòng đấu vừa hoàn thành")
    parser.add_argument("--results-dir", type=str, default="results", help="Thư mục chứa các file result_XX.json")
    parser.add_argument("--players-file", type=str, default=None, help="File players trước vòng đấu này")
    parser.add_argument("--publish-dir", type=str, default="published", help="Thư mục xuất file JSON tĩnh")
    args = parser.parse_args()

    os.makedirs(args.publish_dir, exist_ok=True)

    # 1. Thu thập tất cả các file result
    pattern = os.path.join(args.results_dir, "result_*.json")
    result_files = sorted(glob.glob(pattern))

    if not result_files:
        print(f"[!] Không tìm thấy file kết quả nào theo mẫu: {pattern}")
        sys.exit(1)

    print(f"[*] Đang đọc {len(result_files)} file kết quả từ {args.results_dir}...")
    all_matches = []
    for r_file in result_files:
        with open(r_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            all_matches.extend(data.get("results", []))

    print(f"[+] Tổng số trận đấu đã hợp nhất: {len(all_matches)}")

    # 2. Tải danh sách người chơi
    players_map = {}
    if args.players_file and os.path.exists(args.players_file):
        with open(args.players_file, "r", encoding="utf-8") as f:
            for p in json.load(f):
                players_map[p["id"]] = p
    else:
        # Tự động trích xuất người chơi từ các trận đấu nếu không có file gốc
        for m in all_matches:
            for side in ("white", "black"):
                pid = m[f"{side}_id"]
                if pid not in players_map:
                    players_map[pid] = {
                        "id": pid,
                        "name": m[f"{side}_name"],
                        "student_id": pid.replace("player_", "2102"),
                        "bot_name": f"Bot_{pid}",
                        "points": 0,
                        "matches_played": 0,
                        "wins": 0,
                        "draws": 0,
                        "losses": 0,
                        "white_count": 0,
                        "black_count": 0,
                        "history": [],
                        "opponents_history": [],
                    }

    # Đảm bảo các thuộc tính cần thiết luôn tồn tại
    for p in players_map.values():
        p.setdefault("history", [])
        p.setdefault("opponents_history", [])
        p.setdefault("matches_played", 0)
        p.setdefault("points", 0)
        p.setdefault("wins", 0)
        p.setdefault("draws", 0)
        p.setdefault("losses", 0)
        p.setdefault("white_count", 0)
        p.setdefault("black_count", 0)

    # 3. Cập nhật kết quả từng trận đấu vào stats
    for m in all_matches:
        w_id = m["white_id"]
        b_id = m["black_id"]
        winner = m["winner"]

        if w_id in players_map:
            p_w = players_map[w_id]
            p_w["matches_played"] += 1
            p_w["white_count"] += 1
            p_w["history"].append(b_id)

        if b_id in players_map:
            p_b = players_map[b_id]
            p_b["matches_played"] += 1
            p_b["black_count"] += 1
            p_b["history"].append(w_id)

        if winner == "W":
            if w_id in players_map:
                players_map[w_id]["wins"] += 1
                players_map[w_id]["points"] += 3
                players_map[w_id]["opponents_history"].append((b_id, "win"))
            if b_id in players_map:
                players_map[b_id]["losses"] += 1
                players_map[b_id]["opponents_history"].append((w_id, "loss"))
        elif winner == "B":
            if b_id in players_map:
                players_map[b_id]["wins"] += 1
                players_map[b_id]["points"] += 3
                players_map[b_id]["opponents_history"].append((w_id, "win"))
            if w_id in players_map:
                players_map[w_id]["losses"] += 1
                players_map[w_id]["opponents_history"].append((b_id, "loss"))
        else:
            # Hòa
            if w_id in players_map:
                players_map[w_id]["draws"] += 1
                players_map[w_id]["points"] += 1
                players_map[w_id]["opponents_history"].append((b_id, "draw"))
            if b_id in players_map:
                players_map[b_id]["draws"] += 1
                players_map[b_id]["points"] += 1
                players_map[b_id]["opponents_history"].append((w_id, "draw"))

    # 4. Tính toán Tiebreakers
    calculate_tiebreakers(players_map)

    # 5. Sắp xếp thứ hạng toàn giải
    sorted_standings = sorted(
        players_map.values(),
        key=lambda p: (
            p["points"],
            p.get("buchholz", 0),
            p.get("sonneborn_berger", 0),
            p["wins"],
            -p["losses"]
        ),
        reverse=True
    )

    # Thêm thứ hạng và dự phóng điểm học phần
    standings_export = []
    for rank_idx, p in enumerate(sorted_standings, 1):
        mp = p["matches_played"]
        win_rate = round((p["wins"] / mp) * 100, 1) if mp > 0 else 0.0

        grade = "6.5 – 7.0"
        if rank_idx <= 32:
            grade = "10.0 (A+)"
        elif p["wins"] >= 10:
            grade = "9.5"
        elif p["wins"] >= 8:
            grade = "9.0"
        elif p["wins"] >= 6:
            grade = "8.5"
        elif p["wins"] >= 4:
            grade = "7.5"

        item = {
            "rank": rank_idx,
            "user_id": p["id"],
            "name": p["name"],
            "student_id": p.get("student_id"),
            "bot_name": p.get("bot_name"),
            "matches_played": mp,
            "wins": p["wins"],
            "draws": p["draws"],
            "losses": p["losses"],
            "points": p["points"],
            "buchholz": p.get("buchholz", 0.0),
            "sonneborn_berger": p.get("sonneborn_berger", 0.0),
            "win_rate": win_rate,
            "grade_projection": grade,
            "is_top32": rank_idx <= 32,
        }
        standings_export.append(item)

    # 6. Xuất các file JSON
    standings_path = os.path.join(args.publish_dir, "standings.json")
    with open(standings_path, "w", encoding="utf-8") as f:
        json.dump(standings_export, f, indent=2, ensure_ascii=False)
    print(f"[✓] Đã xuất bản bảng xếp hạng: {standings_path}")

    round_path = os.path.join(args.publish_dir, f"round_{args.round}.json")
    with open(round_path, "w", encoding="utf-8") as f:
        json.dump({"round": args.round, "total_matches": len(all_matches), "matches": all_matches}, f, indent=2, ensure_ascii=False)
    print(f"[✓] Đã xuất bản kết quả vòng đấu: {round_path}")

    top32_path = os.path.join(args.publish_dir, "top32.json")
    with open(top32_path, "w", encoding="utf-8") as f:
        json.dump(standings_export[:32], f, indent=2, ensure_ascii=False)
    print(f"[✓] Đã xuất bản danh sách Top 32: {top32_path}")

    next_players_path = os.path.join(args.publish_dir, f"players_after_r{args.round}.json")
    with open(next_players_path, "w", encoding="utf-8") as f:
        json.dump(list(players_map.values()), f, indent=2, ensure_ascii=False)
    print(f"[✓] Đã lưu trạng thái thí sinh cho vòng {args.round + 1}: {next_players_path}")

    print(f"\n============================================================")
    print(f"TOP 5 THÍ SINH DẪN ĐẦU SAU VÒNG {args.round}:")
    for top in standings_export[:5]:
        print(f"  #{top['rank']} {top['name']} ({top['student_id']}) — {top['points']}đ (BH: {top['buchholz']}, SB: {top['sonneborn_berger']})")
    print(f"============================================================")


if __name__ == "__main__":
    main()
