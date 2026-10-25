"""
Feature Sandbox — Pydantic V2 Schemas for Bot Playground & Benchmark
"""

from typing import Any
from pydantic import BaseModel, Field


class BenchmarkObstacleRequest(BaseModel):
    student_id: str | None = None
    submission_id: str | None = None
    bot_code: str | None = None
    obstacles: list[str] | None = None


class BenchmarkObstacleResponse(BaseModel):
    status: str
    winner: str | None = None
    end_code: str
    total_moves: int
    duration_ms: int
    average_move_time_ms: float
    max_move_time_ms: int
    is_latency_compliant: bool
    is_obstacle_compliant: bool
    obstacles: list[str] = Field(default_factory=list)
    reason: str
    bot_name: str
    opponent_name: str
    replay: dict[str, Any]


class BenchmarkSandboxRequest(BaseModel):
    mode: str = "standard"  # "standard" | "obstacle"
    opponent: str = "greedy"  # "greedy" | "random" | "obstacle"
    bot_code: str
    obstacles: list[str] | None = None


class BenchmarkSandboxResponse(BaseModel):
    status: str
    mode: str
    winner: str | None = None
    end_code: str
    total_moves: int
    duration_ms: int
    average_move_time_ms: float
    max_move_time_ms: int
    is_latency_compliant: bool
    is_obstacle_compliant: bool
    obstacles: list[str] = Field(default_factory=list)
    reason: str
    bot_name: str
    opponent_name: str
    replay: dict[str, Any]
