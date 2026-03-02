@echo off
setlocal
cd /d "%~dp0"
if exist "prebuilt_runtime\win-x64\node\node.exe" (
  "prebuilt_runtime\win-x64\node\node.exe" "expo_dual_window_launcher.mjs" --open=2 --query=expo=1^&api=local
) else (
  node "expo_dual_window_launcher.mjs" --open=2 --query=expo=1^&api=local
)
if errorlevel 1 (
  echo Launch failed.
  pause
  exit /b 1
)
