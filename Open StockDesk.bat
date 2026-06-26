@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

netstat -an | findstr ":3210" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:3210"
  exit /b 0
)

start "StockDesk Server" /min "%ROOT%\Run StockDesk Server.bat"
timeout /t 4 /nobreak >nul
start "" "http://localhost:3210"
exit /b 0
