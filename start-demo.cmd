@echo off
REM Starts all three services for the demo. Ctrl+C stops the Node/Next one.
setlocal
set PATH=%PATH%;C:\Users\omkar\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin

cd /d "%~dp0"

echo [1/3] resume screening service on :8002
start "ml-screening" cmd /k "cd /d "%~dp0" && .venv\Scripts\python.exe -m uvicorn resume_screening.service:app --port 8002"

echo [2/3] verification service on :8001
start "ml-verification" cmd /k "cd /d "%~dp0" && set BACKEND_BASE_URL=http://localhost:3000 && .venv\Scripts\python.exe -m uvicorn ml.verification.service:app --port 8001"

echo [3/3] next.js on :3000
start "web" cmd /k "cd /d "%~dp0web" && npm run dev"

echo.
echo All three starting. Open http://localhost:3000 in ~20 seconds.
