@echo off
cd /d "%~dp0"
title StockDesk QA Tests

if exist ".tools\node\node.exe" (
  set "NODE=.tools\node\node.exe"
) else (
  set "NODE=node"
)

echo.
echo === StockDesk QA Unit Tests (no server needed) ===
echo.
"%NODE%" scripts\test-qa.mjs
if errorlevel 1 goto :failed

echo.
echo === StockDesk Integration Tests (server required) ===
echo.

netstat -ano | findstr ":3210" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting server on port 3210...
  start "" /B "%NODE%" server.mjs
  timeout /t 3 /nobreak >nul
)

"%NODE%" scripts\test-app.mjs
if errorlevel 1 goto :failed

echo.
echo All QA tests passed.
pause
exit /b 0

:failed
echo.
echo QA tests FAILED. See errors above.
pause
exit /b 1
