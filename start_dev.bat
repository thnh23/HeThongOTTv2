@echo off
chcp 65001 >nul
title OTTv2 Tournament Launcher
echo ================================================================
echo   ⚔️  KHỞI ĐỘNG HỆ THỐNG OTTV2 TOURNAMENT PLATFORM (1-CLICK)
echo   Khoa Công nghệ Thông tin — Trường Đại học Công nghệ (VNU-UET)
echo ================================================================
echo.

set "ROOT_DIR=%~dp0"

:: 1. Kiểm tra môi trường Backend
if not exist "%ROOT_DIR%backend\.venv\Scripts\uvicorn.exe" (
    if not exist "%ROOT_DIR%backend\.venv\Scripts\python.exe" (
        echo [!] Cảnh báo: Chưa tìm thấy môi trường ảo .venv trong backend.
        echo [*] Đang thử sử dụng Python toàn cục...
    )
)

:: 2. Khởi động Backend FastAPI (Port 8000) trong cửa sổ riêng
echo [*] Đang khởi động Backend FastAPI (Port 8000)...
start "OTTv2 Backend (FastAPI :8000)" cmd /k "title OTTv2 Backend (Port 8000) && cd /d "%ROOT_DIR%backend" && if exist .venv\Scripts\activate.bat (call .venv\Scripts\activate.bat) && uvicorn app.main:app --reload --port 8000"

:: 3. Khởi động Frontend Vite (Port 5173) trong cửa sổ riêng
echo [*] Đang khởi động Frontend Vite (Port 5173)...
start "OTTv2 Frontend (Vite :5173)" cmd /k "title OTTv2 Frontend (Port 5173) && cd /d "%ROOT_DIR%frontend" && npm run dev"

:: 4. Đợi 3 giây để máy chủ khởi tạo rồi mở trình duyệt
echo [*] Đang chờ dịch vụ sẵn sàng...
timeout /t 3 /nobreak >nul

echo.
echo [✓] Đã khởi động thành công cả Backend và Frontend!
echo [*] Đang mở trình duyệt tới http://localhost:5173 ...
start http://localhost:5173

echo.
echo ================================================================
echo   🌐 Trang chủ & Giao diện Web: http://localhost:5173
echo   📋 Cổng Nộp Bài & Tra Cứu:     http://localhost:5173/submit
echo   🏆 Bảng Xếp Hạng 13 Vòng:      http://localhost:5173/leaderboard
echo   ⚔️  Kênh Trực Tiếp Ván Đấu:    http://localhost:5173/matches/live
echo   🛡️  Trang Quản Trị Viên (BTC):  http://localhost:5173/admin
echo   📖 Tài liệu API (Swagger):     http://localhost:8000/docs
echo ================================================================
echo.
echo (Để dừng hệ thống: Chỉ cần đóng 2 cửa sổ Backend và Frontend vừa mở)
echo.
pause
