@echo off
setlocal
set "ROOT=%~dp0"
set "PATH=%ROOT%.tools\node;C:\Program Files\Git\bin;%PATH%"
cd /d "%ROOT%"

echo Pushing StockDesk to GitHub (myself7802/stockdesk)...
echo.
echo If this fails, first create the repo at:
echo https://github.com/new
echo   Name: stockdesk
echo   Public, empty (no README)
echo.

git branch -M main
git remote set-url origin https://github.com/myself7802/stockdesk.git
git push -u origin main

if errorlevel 1 (
  echo.
  echo Push failed. Create the repo on GitHub first, then run this again.
  echo You may be asked to sign in to GitHub in the browser.
  pause
) else (
  echo.
  echo Done! Repo: https://github.com/myself7802/stockdesk
  pause
)
