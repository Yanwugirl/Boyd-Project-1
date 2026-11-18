@echo off
chcp 65001 >nul
cd /d "%~dp0"
where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Install it from https://git-scm.com/ and open this file again.
  pause
  exit /b 1
)
if not exist ".git" (
  git init -q
  git remote add origin https://github.com/Yanwugirl/Boyd-Project-1.git
)
echo Getting the current main branch from GitHub...
git fetch -q origin main
if errorlevel 1 (
  echo Could not reach GitHub. Check the internet connection and that you are signed in to GitHub.
  pause
  exit /b 1
)
git symbolic-ref HEAD refs/heads/main
git reset -q --mixed origin/main
git add -A
git -c user.name="Jiaming" -c user.email="Jiaming@users.noreply.github.com" commit -q -m "Jiaming's tested version: hand input, new Act 2 Filter Room, HTTPS, Act 3 fixes, same-language rewrite; tidy folder" || echo Nothing new to upload.
git push origin main
if errorlevel 1 (
  echo.
  echo The upload did not finish. If a GitHub sign-in window appeared, sign in and run this file again.
  pause
  exit /b 1
)
git branch -q --set-upstream-to=origin/main main
echo.
echo Done. Your version is now on the main branch of Yanwugirl/Boyd-Project-1.
pause
