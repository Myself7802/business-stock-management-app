@echo off
setlocal
set "ROOT=%~dp0"
set "PATH=%ROOT%.tools\node;C:\Program Files\Git\bin;%PATH%"
cd /d "%ROOT%"

echo Pushing to GitHub (myself7802/business-stock-management-app)...
echo.
echo If repo does not exist yet, create it here first:
echo https://github.com/new?name=business-stock-management-app
echo   Public, empty (no README)
echo.

git branch -M main
git remote set-url origin https://github.com/myself7802/business-stock-management-app.git
git push -u origin main

if errorlevel 1 (
  echo.
  echo Push failed. Create the repo at the link above, sign in to GitHub, then run this again.
  pause
) else (
  echo.
  echo Done! https://github.com/myself7802/business-stock-management-app
  pause
)
