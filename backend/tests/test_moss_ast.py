"""
Unit Tests for AST Plagiarism Detector (moss_ast_check.py)
===========================================================
"""

import os
import tempfile
import pytest

from scripts.tournament.moss_ast_check import (
    extract_ast_tokens,
    compute_similarity,
    run_plagiarism_check,
)


class TestASTPlagiarismDetector:
    """Kiểm tra độ chính xác của bộ phát hiện đạo văn AST."""

    def test_variable_renaming_detected(self, tmp_path):
        """Đổi tên biến không qua mặt được AST normalizer (đạt độ tương đồng ~ 100%)."""
        code_orig = (
            "def choose_move(state):\n"
            "    my_color = state.current_player\n"
            "    valid_moves = []\n"
            "    for piece in state.board.values():\n"
            "        if piece.player == my_color:\n"
            "            valid_moves.append(piece)\n"
            "    return ('e2', 'e3')\n"
        )
        code_renamed = (
            "# Bot tác giả khác viết comment lừa\n"
            "def choose_move(s):\n"
            "    c = s.current_player\n"
            "    res = []\n"
            "    for p in s.board.values():\n"
            "        if p.player == c:\n"
            "            res.append(p)\n"
            "    return ('e2', 'e3')\n"
        )

        file_a = tmp_path / "bot_a.py"
        file_b = tmp_path / "bot_b.py"
        file_a.write_text(code_orig, encoding="utf-8")
        file_b.write_text(code_renamed, encoding="utf-8")

        tokens_a = extract_ast_tokens(str(file_a))
        tokens_b = extract_ast_tokens(str(file_b))

        assert len(tokens_a) > 0
        assert tokens_a == tokens_b, "AST tokens phải giống nhau 100% khi chỉ đổi tên biến"

        jaccard, contain = compute_similarity(tokens_a, tokens_b)
        assert jaccard == 1.0
        assert contain == 1.0

    def test_different_logic_has_low_similarity(self, tmp_path):
        """Hai giải thuật khác nhau (Random vs Heuristic A*) có độ tương đồng thấp."""
        code_simple = (
            "import random\n"
            "def choose_move(state):\n"
            "    return ('a1', 'a2')\n"
        )
        code_complex = (
            "def choose_move(state):\n"
            "    dist = {}\n"
            "    for i in range(9):\n"
            "        for j in range(9):\n"
            "            dist[(i, j)] = abs(i - 8) + abs(j - 8)\n"
            "    best = None\n"
            "    for m in state.board:\n"
            "        if best is None or dist[m] < dist[best]:\n"
            "            best = m\n"
            "    return ('e2', 'e3')\n"
        )

        file_a = tmp_path / "bot_simple.py"
        file_b = tmp_path / "bot_complex.py"
        file_a.write_text(code_simple, encoding="utf-8")
        file_b.write_text(code_complex, encoding="utf-8")

        tokens_a = extract_ast_tokens(str(file_a))
        tokens_b = extract_ast_tokens(str(file_b))

        jaccard, contain = compute_similarity(tokens_a, tokens_b)
        assert jaccard < 0.40, f"Hai logic khác hẳn nhau không được vượt quá 40% (thực tế {jaccard})"

    def test_run_plagiarism_check_flags_copied_bots(self, tmp_path):
        """Kiểm tra hàm quét thư mục gắn cờ đúng cặp sao chép."""
        dir_student_1 = tmp_path / "22020001"
        dir_student_2 = tmp_path / "22020002"
        dir_student_3 = tmp_path / "22020003"

        dir_student_1.mkdir()
        dir_student_2.mkdir()
        dir_student_3.mkdir()

        code_base = (
            "def choose_move(state):\n"
            "    c = state.current_player\n"
            "    x = [p for p in state.board.values() if p.player == c]\n"
            "    return ('b1', 'b2')\n"
        )
        code_copy = (
            "# Copy tu sinh vien 1 va sua bien\n"
            "def choose_move(st):\n"
            "    color = st.current_player\n"
            "    items = [item for item in st.board.values() if item.player == color]\n"
            "    return ('b1', 'b2')\n"
        )
        code_diff = (
            "def choose_move(state):\n"
            "    print('Totally different')\n"
            "    while True:\n"
            "        break\n"
            "    return ('h8', 'h9')\n"
        )

        (dir_student_1 / "bot.py").write_text(code_base, encoding="utf-8")
        (dir_student_2 / "bot.py").write_text(code_copy, encoding="utf-8")
        (dir_student_3 / "bot.py").write_text(code_diff, encoding="utf-8")

        report = run_plagiarism_check(str(tmp_path), threshold=0.50)
        assert report["total_bots"] == 3
        assert report["flagged_count"] >= 1

        flagged = report["flagged_pairs"][0]
        assert {flagged["student_a"], flagged["student_b"]} == {"22020001", "22020002"}
        assert flagged["jaccard_similarity"] >= 0.90
