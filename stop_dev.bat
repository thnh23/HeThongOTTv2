@echo off
chcp 65001 >nul
title OTTv2 Shutdown Tool
echo ================================================================
echo   DỪNG TOÀN BỘ DỊCH VỤ OTTV2 (BACKEND :8000 & FRONTEND :5173)
echo ================================================================
echo.

echo [*] Đang tìm và dừng tiến trình trên cổng 8000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo [+] Đang dừng PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Đang tìm và dừng tiến trình trên cổng 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo [+] Đang dừng PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [✓] Đã giải phóng hoàn tất cổng 8000 và 5173!
echo.
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1
