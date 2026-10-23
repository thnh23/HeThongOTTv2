"""Starter Bots package"""
from .random_bot import choose_move as random_choose_move
from .greedy_bot import choose_move as greedy_choose_move
from .obstacle_bot import choose_move as obstacle_choose_move

__all__ = ["random_choose_move", "greedy_choose_move", "obstacle_choose_move"]

