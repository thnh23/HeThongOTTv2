"""
Knockout Bracket Management & FIDE Seeding Tree Logic.
Pure business logic độc lập với Database & Network để tối ưu testability.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

# Sơ đồ bốc thăm hạt giống chuẩn 32 người (FIDE / Grand Slam)
# Đảm bảo Seed 1 và Seed 2 ở hai nhánh đối diện và chỉ gặp nhau ở trận Chung kết
SEED_PAIRS_32 = [
    (1, 32), (16, 17),
    (9, 24), (8, 25),
    (4, 29), (13, 20),
    (12, 21), (5, 28),
    (2, 31), (15, 18),
    (10, 23), (7, 26),
    (3, 30), (14, 19),
    (11, 22), (6, 27),
]


def generate_initial_bracket(seeds: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Khởi tạo toàn bộ cây nhánh đấu Knockout Top 32 với 16 trận R32 đã có hạt giống."""
    seed_map = {s["seed"]: s for s in seeds}

    # 1. Vòng 1/16 (Round of 32: 16 trận)
    r32_matches = []
    for m_idx, (s1, s2) in enumerate(SEED_PAIRS_32, 1):
        p_a = seed_map.get(s1)
        p_b = seed_map.get(s2)
        r32_matches.append({
            "id": f"R32_M{str(m_idx).zfill(2)}",
            "round": "r32",
            "label": f"1/16 - Trận {str(m_idx).zfill(2)}",
            "player_a": p_a,
            "player_b": p_b,
            "score_a": 0.0,
            "score_b": 0.0,
            "status": "pending",
            "winner_id": None,
            "winner_name": None,
            "winner_seed": None,
            "game_results": [],
        })

    # 2. Vòng 1/8 (Round of 16: 8 trận)
    r16_matches = []
    for m_idx in range(1, 9):
        r16_matches.append({
            "id": f"R16_M{str(m_idx).zfill(2)}",
            "round": "r16",
            "label": f"1/8 - Trận {str(m_idx).zfill(2)}",
            "player_a": None,
            "player_b": None,
            "score_a": 0.0,
            "score_b": 0.0,
            "status": "pending",
            "winner_id": None,
            "winner_name": None,
            "winner_seed": None,
            "game_results": [],
        })

    # 3. Vòng Tứ Kết (Quarter-Finals: 4 trận)
    qf_matches = []
    for m_idx in range(1, 5):
        qf_matches.append({
            "id": f"QF_M{str(m_idx).zfill(2)}",
            "round": "qf",
            "label": f"Tứ Kết - Trận {str(m_idx).zfill(2)}",
            "player_a": None,
            "player_b": None,
            "score_a": 0.0,
            "score_b": 0.0,
            "status": "pending",
            "winner_id": None,
            "winner_name": None,
            "winner_seed": None,
            "game_results": [],
        })

    # 4. Vòng Bán Kết (Semi-Finals: 2 trận)
    sf_matches = []
    for m_idx in range(1, 3):
        sf_matches.append({
            "id": f"SF_M{str(m_idx).zfill(2)}",
            "round": "sf",
            "label": f"Bán Kết - Trận {str(m_idx).zfill(2)}",
            "player_a": None,
            "player_b": None,
            "score_a": 0.0,
            "score_b": 0.0,
            "status": "pending",
            "winner_id": None,
            "winner_name": None,
            "winner_seed": None,
            "loser_id": None,
            "loser_name": None,
            "loser_seed": None,
            "game_results": [],
        })

    # 5. Vòng Chung Kết & Tranh Hạng Ba (Finals: 2 trận)
    final_matches = [
        {
            "id": "FINAL_CHAMPION",
            "round": "final",
            "label": "Trận Chung Kết Tranh Cúp Vàng",
            "player_a": None,
            "player_b": None,
            "score_a": 0.0,
            "score_b": 0.0,
            "status": "pending",
            "winner_id": None,
            "winner_name": None,
            "winner_seed": None,
            "loser_id": None,
            "loser_name": None,
            "loser_seed": None,
            "game_results": [],
        },
        {
            "id": "FINAL_THIRD_PLACE",
            "round": "final",
            "label": "Trận Tranh Hạng Ba (Huy Chương Đồng)",
            "player_a": None,
            "player_b": None,
            "score_a": 0.0,
            "score_b": 0.0,
            "status": "pending",
            "winner_id": None,
            "winner_name": None,
            "winner_seed": None,
            "loser_id": None,
            "loser_name": None,
            "loser_seed": None,
            "game_results": [],
        },
    ]

    return {
        "status": "initialized",
        "total_seeds": len(seeds),
        "rounds": {
            "r32": r32_matches,
            "r16": r16_matches,
            "qf": qf_matches,
            "sf": sf_matches,
            "final": final_matches,
        },
        "podium": {
            "champion": None,
            "runner_up": None,
            "third_place": None,
            "fourth_place": None,
        },
        "updated_at": datetime.now().isoformat(),
    }


def advance_bracket_winners(bracket: Dict[str, Any], round_key: str, matches_to_run: List[Dict[str, Any]]) -> Optional[str]:
    """
    Đẩy thí sinh chiến thắng (hoặc thua ở Bán Kết xuống Tranh Hạng 3) vào các vị trí cặp đấu vòng kế tiếp.
    Trả về tên key của vòng kế tiếp ('r16', 'qf', 'sf', 'final', None).
    """
    rounds = bracket.get("rounds", {})
    next_round_key = None

    if round_key == "r32":
        next_round_key = "r16"
        r16_matches = rounds.get("r16", [])
        for idx, r16_m in enumerate(r16_matches):
            src_a = matches_to_run[idx * 2] if idx * 2 < len(matches_to_run) else None
            src_b = matches_to_run[idx * 2 + 1] if idx * 2 + 1 < len(matches_to_run) else None

            if src_a and src_a.get("status") == "completed":
                r16_m["player_a"] = src_a["player_a"] if src_a["winner_id"] == src_a["player_a"]["id"] else src_a["player_b"]
            if src_b and src_b.get("status") == "completed":
                r16_m["player_b"] = src_b["player_a"] if src_b["winner_id"] == src_b["player_a"]["id"] else src_b["player_b"]

    elif round_key == "r16":
        next_round_key = "qf"
        qf_matches = rounds.get("qf", [])
        for idx, qf_m in enumerate(qf_matches):
            src_a = matches_to_run[idx * 2] if idx * 2 < len(matches_to_run) else None
            src_b = matches_to_run[idx * 2 + 1] if idx * 2 + 1 < len(matches_to_run) else None

            if src_a and src_a.get("status") == "completed":
                qf_m["player_a"] = src_a["player_a"] if src_a["winner_id"] == src_a["player_a"]["id"] else src_a["player_b"]
            if src_b and src_b.get("status") == "completed":
                qf_m["player_b"] = src_b["player_a"] if src_b["winner_id"] == src_b["player_a"]["id"] else src_b["player_b"]

    elif round_key == "qf":
        next_round_key = "sf"
        sf_matches = rounds.get("sf", [])
        for idx, sf_m in enumerate(sf_matches):
            src_a = matches_to_run[idx * 2] if idx * 2 < len(matches_to_run) else None
            src_b = matches_to_run[idx * 2 + 1] if idx * 2 + 1 < len(matches_to_run) else None

            if src_a and src_a.get("status") == "completed":
                sf_m["player_a"] = src_a["player_a"] if src_a["winner_id"] == src_a["player_a"]["id"] else src_a["player_b"]
            if src_b and src_b.get("status") == "completed":
                sf_m["player_b"] = src_b["player_a"] if src_b["winner_id"] == src_b["player_a"]["id"] else src_b["player_b"]

    elif round_key == "sf":
        next_round_key = "final"
        final_matches = rounds.get("final", [])
        if len(final_matches) >= 2 and len(matches_to_run) >= 2:
            sf1 = matches_to_run[0]
            sf2 = matches_to_run[1]

            if sf1.get("status") == "completed" and sf2.get("status") == "completed":
                # Trận Chung Kết (FINAL_CHAMPION): Thắng SF1 vs Thắng SF2
                final_matches[0]["player_a"] = sf1["player_a"] if sf1["winner_id"] == sf1["player_a"]["id"] else sf1["player_b"]
                final_matches[0]["player_b"] = sf2["player_a"] if sf2["winner_id"] == sf2["player_a"]["id"] else sf2["player_b"]

                # Trận Tranh Hạng Ba (FINAL_THIRD_PLACE): Thua SF1 vs Thua SF2
                final_matches[1]["player_a"] = sf1["player_b"] if sf1["winner_id"] == sf1["player_a"]["id"] else sf1["player_a"]
                final_matches[1]["player_b"] = sf2["player_b"] if sf2["winner_id"] == sf2["player_a"]["id"] else sf2["player_a"]

    elif round_key == "final":
        podium = bracket.get("podium", {})
        if len(matches_to_run) >= 2:
            gf = matches_to_run[0]  # Grand Final
            tp = matches_to_run[1]  # Third Place match

            if gf.get("status") == "completed":
                podium["champion"] = gf["player_a"] if gf["winner_id"] == gf["player_a"]["id"] else gf["player_b"]
                podium["runner_up"] = gf["player_b"] if gf["winner_id"] == gf["player_a"]["id"] else gf["player_a"]

            if tp.get("status") == "completed":
                podium["third_place"] = tp["player_a"] if tp["winner_id"] == tp["player_a"]["id"] else tp["player_b"]
                podium["fourth_place"] = tp["player_b"] if tp["winner_id"] == tp["player_a"]["id"] else tp["player_a"]

            bracket["podium"] = podium

    return next_round_key
