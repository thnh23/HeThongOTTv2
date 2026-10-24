@echo off
setlocal

echo ================================================================
echo   DUNG TOAN BO DICH VU OTTV2 (BACKEND :8000 VA FRONTEND :5173)
echo ================================================================
echo.

echo [*] Dang tim va dung tien trinh tren cong 8000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo [+] Dang dung Backend PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Dang tim va dung tien trinh tren cong 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo [+] Dang dung Frontend PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [OK] Da giai phong hoan tat cong 8000 va 5173!
echo.
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1
