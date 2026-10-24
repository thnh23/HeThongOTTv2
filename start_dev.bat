@echo off
setlocal

set "ROOT_DIR=%~dp0"

echo ================================================================
echo   KHOI DONG HE THONG OTTV2 TOURNAMENT PLATFORM (1-CLICK)
echo   Khoa CNTT - Truong Dai hoc Cong nghe (VNU-UET)
echo ================================================================
echo.

:: 1. Kiem tra Python
set "PYTHON_EXE=%ROOT_DIR%backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)

:: 2. Khoi dong Backend FastAPI (Port 8000)
echo [*] Dang khoi dong Backend FastAPI (Port 8000)...
start "OTTv2 Backend (FastAPI :8000)" /D "%ROOT_DIR%backend" cmd /k ""%PYTHON_EXE%" -m uvicorn app.main:app --reload --port 8000"

:: 3. Khoi dong Frontend Vite (Port 5173)
echo [*] Dang khoi dong Frontend Vite (Port 5173)...
start "OTTv2 Frontend (Vite :5173)" /D "%ROOT_DIR%frontend" cmd /k "npm run dev"

:: 4. Cho 3 giay roi mo trinh duyet
echo [*] Dang cho he thong san sang...
powershell -NoProfile -Command "Start-Sleep -Seconds 3" >nul 2>&1

echo [OK] Da khoi dong thanh cong! Dang mo trinh duyet...
start http://localhost:5173

echo.
echo ================================================================
echo   Trang chu va Web Client: http://localhost:5173
echo   Cong Nop Bai va Tra Cuu: http://localhost:5173/submit
echo   Bang Xep Hang:           http://localhost:5173/leaderboard
echo   Kenh Truc Tiep:          http://localhost:5173/matches/live
echo   Trang Quan Tri (Admin):  http://localhost:5173/admin
echo   Tai lieu API (Swagger):  http://localhost:8000/docs
echo ================================================================
echo.
echo [i] Backend va Frontend dang chay tren 2 cua so rieng biet.
echo     (De dung toan bo he thong: chay file stop_dev.bat)
echo.
