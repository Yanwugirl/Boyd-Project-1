@echo off
cd /d "%~dp0"
where ollama >nul 2>nul
if errorlevel 1 (
  echo Install and open Ollama first:
  echo https://ollama.com/download/windows
  pause
  exit /b 1
)
echo Open the Ollama app before continuing.
echo This downloads the qwen2.5:1.5b model for the project.
call ollama pull qwen2.5:1.5b
if errorlevel 1 (
  echo Download did not complete. Open Ollama and try again.
) else (
  echo Ready. Open START_ACT1.cmd and use the setup page.
)
pause
