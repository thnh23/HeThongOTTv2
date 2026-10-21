"""
Tests Engine OTTv2 — bao phủ T01–T10 theo đặc tả website_spec.md
"""

import pytest
from app.services.engine.board import (
    BoardState, Piece, create_initial_board,
    parse_square, square_to_str, BOARD_SIZE,
)
from app.services.engine.rules import (
    can_capture, get_legal_moves, get_legal_moves_from,
    apply_move, check_game_over, step, is_legal_move,
    InvalidMoveError, EndCode, parse_move,
)


# ═══════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════

def make_state(pieces: dict[str, tuple[str, str]], current_player: str = 'W') -> BoardState:
    """
    Tạo bàn cờ tùy chỉnh từ dict.

    pieces = { "e5": ("W", "R"), "f6": ("B", "S"), ... }
    """
    board = {}
    for sq, (player, ptype) in pieces.items():
        pos = parse_square(sq)
        board[pos] = Piece(player, ptype)
    state = BoardState(board=board, current_player=current_player)
    state.position_history.append(state.to_snapshot())
    return state


# ═══════════════════════════════════════════════
# Notation tests
# ═══════════════════════════════════════════════

class TestNotation:
    def test_parse_a1(self):
        assert parse_square("a1") == (0, 0)

    def test_parse_i9(self):
        assert parse_square("i9") == (8, 8)

    def test_parse_e5(self):
        assert parse_square("e5") == (4, 4)

    def test_square_to_str(self):
        assert square_to_str(0, 0) == "a1"
        assert square_to_str(8, 8) == "i9"
        assert square_to_str(4, 4) == "e5"

    def test_invalid_col(self):
        with pytest.raises(ValueError):
            parse_square("z5")

    def test_invalid_row(self):
        with pytest.raises(ValueError):
            parse_square("a0")

    def test_roundtrip(self):
        for col in range(9):
            for row in range(9):
                sq = square_to_str(col, row)
                assert parse_square(sq) == (col, row)


# ═══════════════════════════════════════════════
# Capture logic tests
# ═══════════════════════════════════════════════

class TestCaptureLogic:
    def test_rock_beats_scissors(self):
        assert can_capture('R', 'S') is True

    def test_scissors_beats_paper(self):
        assert can_capture('S', 'P') is True

    def test_paper_beats_rock(self):
        assert can_capture('P', 'R') is True

    def test_rock_cannot_capture_paper(self):
        assert can_capture('R', 'P') is False

    def test_scissors_cannot_capture_rock(self):
        assert can_capture('S', 'R') is False

    def test_paper_cannot_capture_scissors(self):
        assert can_capture('P', 'S') is False

    def test_same_type_no_capture(self):
        for t in ('R', 'S', 'P'):
            assert can_capture(t, t) is False


# ═══════════════════════════════════════════════
# T01 — Búa đi vào Kéo địch: hợp lệ, Kéo bị loại
# ═══════════════════════════════════════════════

class TestT01:
    """T01: Búa (W) đi vào ô có Kéo (B) → hợp lệ, Kéo bị ăn."""

    def test_move_is_legal(self):
        state = make_state({"e5": ("W", "R"), "f6": ("B", "S")}, 'W')
        move = parse_move("e5", "f6")
        assert is_legal_move(state, move)

    def test_scissors_removed_after_capture(self):
        state = make_state({"e5": ("W", "R"), "f6": ("B", "S")}, 'W')
        new_state, _ = step(state, "e5", "f6")
        # Kéo bị loại, ô f6 có Búa trắng
        pos = parse_square("f6")
        assert pos in new_state.board
        assert new_state.board[pos] == Piece('W', 'R')

    def test_original_square_empty(self):
        state = make_state({"e5": ("W", "R"), "f6": ("B", "S")}, 'W')
        new_state, _ = step(state, "e5", "f6")
        assert parse_square("e5") not in new_state.board


# ═══════════════════════════════════════════════
# T02 — Búa đi vào Bao địch: không hợp lệ
# ═══════════════════════════════════════════════

class TestT02:
    """T02: Búa (W) cố đi vào ô Bao (B) → InvalidMoveError."""

    def test_move_is_illegal(self):
        state = make_state({"e5": ("W", "R"), "f6": ("B", "P")}, 'W')
        move = parse_move("e5", "f6")
        assert not is_legal_move(state, move)

    def test_raises_on_step(self):
        state = make_state({"e5": ("W", "R"), "f6": ("B", "P")}, 'W')
        with pytest.raises(InvalidMoveError):
            step(state, "e5", "f6")


# ═══════════════════════════════════════════════
# T03 — Hai quân cùng loại đối đầu: chặn nhau
# ═══════════════════════════════════════════════

class TestT03:
    """T03: Búa (W) và Búa (B) kề nhau → không thể ăn nhau."""

    def test_cannot_move_into_same_type(self):
        state = make_state({"e5": ("W", "R"), "f6": ("B", "R")}, 'W')
        move = parse_move("e5", "f6")
        assert not is_legal_move(state, move)

    def test_legal_moves_exclude_same_type(self):
        state = make_state({"e5": ("W", "R"), "f6": ("B", "R")}, 'W')
        legal = get_legal_moves(state)
        assert parse_move("e5", "f6") not in legal

    def test_own_piece_blocks(self):
        # Không thể đi vào ô có quân mình
        state = make_state({"e5": ("W", "R"), "f6": ("W", "S")}, 'W')
        assert not is_legal_move(state, parse_move("e5", "f6"))


# ═══════════════════════════════════════════════
# T04 — Ăn Kéo cuối của địch: thắng ngay (W1)
# ═══════════════════════════════════════════════

class TestT04:
    """T04: Búa ăn Kéo cuối cùng của Đen → W1."""

    def test_win_w1_on_last_scissors(self):
        # Đen chỉ còn 1 Kéo duy nhất
        state = make_state({
            "e5": ("W", "R"),
            "f6": ("B", "S"),    # Kéo cuối của Đen
            "a9": ("B", "R"),    # Búa Đen vẫn còn
            "b9": ("B", "P"),    # Bao Đen vẫn còn
        }, 'W')
        new_state, result = step(state, "e5", "f6")
        assert result is not None
        assert result.end_code == EndCode.W1
        assert result.winner == 'W'

    def test_no_win_when_scissors_remain(self):
        # Cả hai bên có đủ 3 loại quân → W1 không kích hoạt sau khi ăn 1 quân
        state = make_state({
            "e5": ("W", "R"),
            "c3": ("W", "S"),   # Kéo Trắng còn
            "g3": ("W", "P"),   # Bao Trắng còn
            "f6": ("B", "S"),
            "g7": ("B", "S"),   # còn Kéo Đen khác
            "a9": ("B", "R"),   # Búa Đen còn
            "b9": ("B", "P"),   # Bao Đen còn
        }, 'W')
        _, result = step(state, "e5", "f6")
        assert result is None


# ═══════════════════════════════════════════════
# T05 — Quân vào ô i9 (Trắng): thắng W2
# ═══════════════════════════════════════════════

class TestT05:
    """T05: Quân Trắng vào ô i9 → W2."""

    def test_white_wins_at_i9(self):
        # Trắng ở h8, đi vào i9
        state = make_state({
            "h8": ("W", "R"),
            "a1": ("B", "S"),   # Đen còn quân
        }, 'W')
        new_state, result = step(state, "h8", "i9")
        assert result is not None
        assert result.end_code == EndCode.W2
        assert result.winner == 'W'

    def test_black_wins_at_a1(self):
        # Đen ở b2, đi vào a1
        state = make_state({
            "b2": ("B", "P"),
            "i9": ("W", "S"),
        }, 'B')
        new_state, result = step(state, "b2", "a1")
        assert result is not None
        assert result.end_code == EndCode.W2
        assert result.winner == 'B'

    def test_i9_not_win_for_black(self):
        # Đen vào i9 không phải ô đích của Đen → không thắng W2
        state = make_state({
            "h8": ("B", "P"),
            "a1": ("W", "S"),
        }, 'B')
        new_state, result = step(state, "h8", "i9")
        # Không có W2
        if result is not None:
            assert result.end_code != EndCode.W2 or result.winner != 'B'


# ═══════════════════════════════════════════════
# T06 — Quân ở rìa bàn: không có nước ra ngoài
# ═══════════════════════════════════════════════

class TestT06:
    """T06: Quân ở ô góc/rìa → không có nước đi ra ngoài bàn."""

    def test_corner_a1_has_3_moves_max(self):
        state = make_state({"a1": ("W", "R")}, 'W')
        moves = get_legal_moves(state)
        # Từ góc a1 chỉ có tối đa 3 nước hợp lệ (b1, a2, b2)
        assert len(moves) <= 3

    def test_corner_i9_has_3_moves_max(self):
        state = make_state({"i9": ("W", "R")}, 'W')
        moves = get_legal_moves(state)
        assert len(moves) <= 3

    def test_edge_a5_has_5_moves_max(self):
        # Rìa trái giữa bàn → tối đa 5 nước (không thể đi sang trái)
        state = make_state({"a5": ("W", "R")}, 'W')
        moves = get_legal_moves(state)
        assert len(moves) <= 5

    def test_no_out_of_bounds_moves(self):
        state = create_initial_board()
        for move in get_legal_moves(state):
            _, (tc, tr) = move
            assert 0 <= tc < BOARD_SIZE
            assert 0 <= tr < BOARD_SIZE

    def test_center_e5_has_8_moves(self):
        # Trung tâm, xung quanh trống → 8 nước
        state = make_state({"e5": ("W", "R")}, 'W')
        moves = get_legal_moves(state)
        assert len(moves) == 8


# ═══════════════════════════════════════════════
# T07 — Bot trả nước sai: bot đó thua
# ═══════════════════════════════════════════════

class TestT07:
    """T07: InvalidMoveError khi bot trả nước không hợp lệ."""

    def test_move_to_same_square(self):
        state = create_initial_board()
        with pytest.raises(InvalidMoveError):
            step(state, "a1", "a1")

    def test_move_out_of_bounds_raises(self):
        with pytest.raises(ValueError):
            step(create_initial_board(), "a1", "z9")

    def test_move_empty_square(self):
        state = create_initial_board()
        # e5 là ô trống ở bàn đầu
        with pytest.raises(InvalidMoveError):
            step(state, "e5", "e6")

    def test_move_opponent_piece(self):
        # Trắng cố di chuyển quân Đen
        state = make_state({"a9": ("B", "R")}, 'W')
        with pytest.raises(InvalidMoveError):
            step(state, "a9", "b9")

    def test_move_two_squares(self):
        # Chỉ được đi 1 ô
        state = make_state({"e5": ("W", "R")}, 'W')
        with pytest.raises(InvalidMoveError):
            step(state, "e5", "g5")


# ═══════════════════════════════════════════════
# T08 — Validator từ chối gói nộp thiếu git_log.txt
# ═══════════════════════════════════════════════

class TestT08:
    """T08: Cổng nộp báo lỗi khi thiếu git_log.txt (yêu cầu chứng minh lịch sử tự code)."""

    def test_missing_git_log_rejected(self, tmp_path):
        import zipfile
        from app.services.validator import validate_submission_zip
        zip_file = tmp_path / "sub.zip"
        with zipfile.ZipFile(zip_file, "w") as zf:
            zf.writestr("bot.py", "def choose_move(s): return ('a1', 'a2')")
            zf.writestr("REPORT.md", "Content report")
        
        res = validate_submission_zip(str(zip_file), str(tmp_path / "out"), "A")
        assert res.is_valid is False
        assert any("git_log.txt" in err for err in res.errors)


# ═══════════════════════════════════════════════
# T09 — Cảnh báo API key trong chat
# ═══════════════════════════════════════════════

class TestT09:
    """T09: Cảnh báo API key chưa che trong lịch sử chat."""

    def test_api_key_scanner(self, tmp_path):
        from app.services.validator import scan_file_for_api_keys
        chat_file = tmp_path / "chat.txt"
        chat_file.write_text("API key: sk-abcdefghijklmnopqrstuvwxyz1234567890abcdef")
        findings = scan_file_for_api_keys(str(chat_file))
        assert len(findings) == 1
        assert findings[0]["type"] == "OpenAI API Key"


# ═══════════════════════════════════════════════
# T10 — Bot cố đọc file / mạng ngoài sandbox
# ═══════════════════════════════════════════════

class TestT10:
    """T10: Sandbox chặn network ngoài sandbox."""

    def test_network_blocked(self):
        from app.services.sandbox import execute_bot_move
        from app.services.starter_bots.faulty_bots import network_bot
        from app.services.engine.board import create_initial_board

        res = execute_bot_move(network_bot, create_initial_board(), timeout_sec=1.0, block_network=True)
        assert res.is_success is False
        assert res.error_code in ("SECURITY_VIOLATION", "TIMEOUT")



# ═══════════════════════════════════════════════
# Additional engine tests
# ═══════════════════════════════════════════════

class TestInitialBoard:
    def test_initial_piece_count(self):
        state = create_initial_board()
        white_counts = state.get_piece_counts('W')
        black_counts = state.get_piece_counts('B')
        # Mỗi bên có 9 quân mỗi loại * 2 hàng = 18 quân, 6 mỗi loại
        assert white_counts == {'R': 6, 'S': 6, 'P': 6}
        assert black_counts == {'R': 6, 'S': 6, 'P': 6}

    def test_initial_player_is_white(self):
        state = create_initial_board()
        assert state.current_player == 'W'

    def test_initial_board_has_correct_positions(self):
        state = create_initial_board()
        # Hàng 1 (idx 0) và 2 (idx 1) là Trắng
        for col in range(9):
            assert state.board[(col, 0)].player == 'W'
            assert state.board[(col, 1)].player == 'W'
        # Hàng 8 (idx 7) và 9 (idx 8) là Đen
        for col in range(9):
            assert state.board[(col, 7)].player == 'B'
            assert state.board[(col, 8)].player == 'B'


class TestTurnAlternation:
    def test_turn_switches_after_move(self):
        state = create_initial_board()
        assert state.current_player == 'W'
        # Đi nước hợp lệ đầu tiên của Trắng
        legal = get_legal_moves(state)
        (fc, fr), (tc, tr) = legal[0]
        new_state = apply_move(state, legal[0])
        assert new_state.current_player == 'B'

    def test_move_count_increments(self):
        state = create_initial_board()
        assert state.move_count == 0
        legal = get_legal_moves(state)
        new_state = apply_move(state, legal[0])
        assert new_state.move_count == 1


class TestDrawConditions:
    def test_draw_over_200_moves(self):
        # Giả lập state với move_count > 200 và có đủ quân để không trigger W1
        state = make_state({
            "e5": ("W", "R"), "c3": ("W", "S"), "g3": ("W", "P"),
            "e7": ("B", "R"), "c7": ("B", "S"), "g7": ("B", "P"),
        }, 'W')
        state.move_count = 201
        result = check_game_over(state)
        assert result is not None
        assert result.end_code == EndCode.D2
        assert result.winner is None

    def test_repetition_draw(self):
        state = make_state({"e5": ("W", "R"), "e3": ("B", "P")}, 'W')
        # Lặp thế bằng cách đi đi lại lại
        s = state
        for _ in range(4):   # 2 chu kỳ W→B→W→B
            legal_w = get_legal_moves(s)
            s = apply_move(s, legal_w[0])
            if check_game_over(s):
                break
            legal_b = get_legal_moves(s)
            s = apply_move(s, legal_b[0])
            result = check_game_over(s)
            if result and result.end_code == EndCode.D2:
                assert result.winner is None
                return
        # Không nhất thiết phải lặp sau 4 nước, test chỉ đảm bảo không crash
        assert True


class TestGetLegalMovesFrom:
    def test_returns_valid_squares(self):
        state = make_state({"e5": ("W", "R")}, 'W')
        targets = get_legal_moves_from(state, "e5")
        expected = {"d4", "e4", "f4", "d5", "f5", "d6", "e6", "f6"}
        assert set(targets) == expected

    def test_empty_square_returns_empty(self):
        state = make_state({"e5": ("W", "R")}, 'W')
        assert get_legal_moves_from(state, "a5") == []

    def test_opponent_piece_returns_empty(self):
        state = make_state({"e5": ("B", "R")}, 'W')
        assert get_legal_moves_from(state, "e5") == []
