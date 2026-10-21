"""
Rate Limiting Middleware for FastAPI
Sliding window rate limiter per client IP address.
"""

import time
import threading
from typing import Dict, List, Tuple
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        default_limit: int = 180,       # 180 requests per window
        window_seconds: int = 60,        # 60s window
        sensitive_limits: Dict[str, int] = None,
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.window_seconds = window_seconds
        # Sensitive routes get stricter limits (e.g. login, submit)
        self.sensitive_limits = sensitive_limits or {
            "/api/auth/login": 30,
            "/api/auth/register": 20,
            "/api/submit": 25,
        }
        # In-memory store: { ip: [(timestamp, path), ...] }
        self._requests: Dict[str, List[Tuple[float, str]]] = {}
        self._lock = threading.Lock()
        self._last_cleanup = time.time()

    def _get_client_ip(self, request: Request) -> str:
        # Check forwarded headers first if behind reverse proxy
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _cleanup_old_entries(self, current_time: float):
        """Dọn dẹp các mốc thời gian đã hết hạn sau mỗi 2 phút."""
        if current_time - self._last_cleanup < 120:
            return
        self._last_cleanup = current_time
        cutoff = current_time - self.window_seconds
        keys_to_delete = []
        for ip, logs in self._requests.items():
            valid_logs = [entry for entry in logs if entry[0] > cutoff]
            if valid_logs:
                self._requests[ip] = valid_logs
            else:
                keys_to_delete.append(ip)
        for ip in keys_to_delete:
            del self._requests[ip]

    async def dispatch(self, request: Request, call_next):
        # Không giới hạn WebSocket, health check, docs, static file
        path = request.url.path
        if (
            path.startswith("/ws")
            or path.startswith("/docs")
            or path.startswith("/redoc")
            or path.startswith("/openapi.json")
            or path in ("/health", "/api/health", "/rules.json", "/api/rules")
            or request.method == "OPTIONS"
        ):
            return await call_next(request)

        # Allow test bypass header
        if request.headers.get("X-Test-Bypass") == "1":
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        current_time = time.time()
        cutoff = current_time - self.window_seconds

        # Determine limit for this path
        limit = self.default_limit
        for prefix, sensitive_limit in self.sensitive_limits.items():
            if path.startswith(prefix):
                limit = sensitive_limit
                break

        with self._lock:
            self._cleanup_old_entries(current_time)
            user_logs = self._requests.setdefault(client_ip, [])
            # Filter logs within current window
            user_logs = [entry for entry in user_logs if entry[0] > cutoff]
            self._requests[client_ip] = user_logs

            # Check if exceeded
            if len(user_logs) >= limit:
                retry_after = int(self.window_seconds - (current_time - user_logs[0][0]))
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Quá giới hạn yêu cầu (Rate limit exceeded). Vui lòng thử lại sau.",
                        "error": "RATE_LIMIT_EXCEEDED",
                        "retry_after_seconds": max(1, retry_after),
                    },
                    headers={"Retry-After": str(max(1, retry_after))},
                )

            # Record this request
            user_logs.append((current_time, path))

        response = await call_next(request)
        return response
