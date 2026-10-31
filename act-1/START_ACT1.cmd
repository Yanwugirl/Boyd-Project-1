@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 LTS, then open this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\socket.io\package.json" (
  echo Installing project dependencies for the first start...
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
set ACT1_OPEN_BROWSER=1
node --env-file-if-exists=.env tools/start.cjs
pause
