@echo off
setlocal
set "ROOT=%~dp0"
set "PATH=%ROOT%.tools\node;%PATH%"
cd /d "%ROOT%"

if not exist "%ROOT%node_modules\" (
  echo Installing dependencies...
  call npm install
)

echo Starting StockDesk at http://localhost:5173
echo Press Ctrl+C to stop.
call npm run dev
