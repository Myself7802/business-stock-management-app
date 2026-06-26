@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "NODE_HOME=%ROOT%\.tools\node"
set "PATH=%NODE_HOME%;%PATH%"
cd /d "%ROOT%"

if not exist "%NODE_HOME%\node.exe" (
  echo Portable Node.js not found.
  pause
  exit /b 1
)

if not exist "%ROOT%\node_modules\" (
  echo First time only: installing dependencies...
  call "%NODE_HOME%\npm.cmd" install
  if errorlevel 1 (
    echo.
    echo Install failed.
    pause
    exit /b 1
  )
)

title StockDesk Server
call "%NODE_HOME%\node.exe" "%ROOT%\server.mjs"
