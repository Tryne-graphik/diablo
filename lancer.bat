@echo off
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    start "" "http://127.0.0.1:8000"
) else (
    cd /d "%~dp0"
    start "Diablo IV Assistant" ".venv\Scripts\python.exe" -m app.main
)
