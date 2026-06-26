@echo off
setlocal
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

if exist "%ROOT%\.tools\node\node.exe" (
  "%ROOT%\.tools\node\node.exe" "%ROOT%\scripts\seed-dummy-data.mjs"
) else (
  node "%ROOT%\scripts\seed-dummy-data.mjs"
)

pause
