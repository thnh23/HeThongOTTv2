import random
from typing import Tuple, Any


def choose_move(state: Any) -> Tuple[str, str]:
    """Random bot mẫu phục vụ đấu tập cục bộ."""
    legal_moves = state.get_legal_moves_for(state.current_player)
    if not legal_moves:
        return ('a1', 'a1')

    (fc, fr), (tc, tr) = random.choice(legal_moves)
    col_names = "abcdefghi"
    return (f"{col_names[fc]}{fr + 1}", f"{col_names[tc]}{tr + 1}")
