@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title OTTv2 Tournament Launcher

echo ================================================================
echo   ⚔️  KHỞI ĐỘNG HỆ THỐNG OTTV2 TOURNAMENT PLATFORM
echo   Khoa Công nghệ Thông tin — Trường Đại học Công nghệ (VNU-UET)
echo ================================================================
echo.

set "ROOT_DIR=%~dp0"

:: 1. Xác định đường dẫn Python trong môi trường ảo .venv
set "PYTHON_EXE=%ROOT_DIR%backend\.venv\Scripts\python.exe"
if not exist "!PYTHON_EXE!" (
    set "PYTHON_EXE=python"
)

:: 2. Khởi động Backend FastAPI (Port 8000) trong cửa sổ riêng
echo [*] Đang khởi động Backend FastAPI (Port 8000)...
start "OTTv2 Backend (FastAPI :8000)" cmd /k "title OTTv2 Backend (Port 8000) && cd /d "%ROOT_DIR%backend" && "!PYTHON_EXE!" -m uvicorn app.main:app --reload --port 8000"

:: 3. Khởi động Frontend Vite (Port 5173) trong cửa sổ riêng
echo [*] Đang khởi động Frontend Vite (Port 5173)...
start "OTTv2 Frontend (Vite :5173)" cmd /k "title OTTv2 Frontend (Port 5173) && cd /d "%ROOT_DIR%frontend" && npm run dev"

:: 4. Chờ 3 giây cho server sẵn sàng rồi mở trình duyệt
echo [*] Đang chờ dịch vụ sẵn sàng...
powershell -NoProfile -Command "Start-Sleep -Seconds 3" >nul 2>&1

echo [✓] Đã khởi động thành công cả Backend và Frontend!
echo [*] Đang mở trình duyệt tới http://localhost:5173 ...
start http://localhost:5173

echo.
echo ================================================================
echo   🌐 Trang chủ & Giao diện Web: http://localhost:5173
echo   📋 Cổng Nộp Bài & Tra Cứu:     http://localhost:5173/submit
echo   🏆 Bảng Xếp Hạng:              http://localhost:5173/leaderboard
echo   ⚔️  Kênh Trực Tiếp Ván Đấu:    http://localhost:5173/matches/live
echo   🛡️  Trang Quản Trị Viên (BTC):  http://localhost:5173/admin
echo   📖 Tài liệu API (Swagger):     http://localhost:8000/docs
echo ================================================================
echo.
echo [i] Backend và Frontend đang chạy độc lập trên 2 cửa sổ riêng biệt.
echo     (Để dừng toàn bộ dịch vụ: chạy file stop_dev.bat)
echo.
