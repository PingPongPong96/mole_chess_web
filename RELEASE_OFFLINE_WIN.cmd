@echo off
setlocal
cd /d "%~dp0"
if not exist "offline_release\release_logs" mkdir "offline_release\release_logs"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
set LOG=offline_release\release_logs\release_%TS%.log

echo [release] Running release:expo ...
echo [release] Log: %LOG%
call npm run release:expo > "%LOG%" 2>&1
if errorlevel 1 (
  echo [release] FAILED. See log: %LOG%
  pause
  exit /b 1
)

echo [release] SUCCESS.
echo [release] Please send folder under offline_release\outgoing_release_*
pause
