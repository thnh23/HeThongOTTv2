"""
Feature Submission — Pydantic V2 Schemas for Bot Submissions & Lookup
"""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class ValidationDetailSchema(BaseModel):
    bot_py: bool = False
    choose_move_fn: bool = False
    report_md: bool = False
    git_log: bool = False

    model_config = ConfigDict(extra="ignore")


class SubmissionResponse(BaseModel):
    id: str
    user_id: str
    status: str
    is_valid: bool
    is_active: bool
    validation: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    commit_count: int = 0
    test_run_result: dict[str, Any] | None = None
    submitted_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class TestRunResponse(BaseModel):
    submission_id: str
    status: str  # 'win', 'loss', 'draw', 'error'
    winner: str | None = None
    end_code: str
    total_moves: int
    duration_ms: int
    reason: str


class SubmissionLookupResponse(BaseModel):
    found: bool
    has_submission: bool
    student_id: str | None = None
    name: str | None = None
    masked_email: str | None = None
    class_name: str | None = None
    bot_name: str | None = None
    github_repo_url: str | None = None
    status: str
    is_valid: bool = False
    commit_hash: str | None = None
    commit_date: str | None = None
    commit_count: int | None = None
    validation_details: dict[str, bool] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    submitted_at: datetime | None = None
    message: str | None = None
