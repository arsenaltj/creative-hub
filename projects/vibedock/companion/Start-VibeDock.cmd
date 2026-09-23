@echo off
cd /d "%~dp0"
set "VIBEDOCK_NODE=%~dp0runtime\node.exe"
if not exist "%VIBEDOCK_NODE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js 22.13 or newer is required. Download the Windows portable package or install Node.js.
    pause
    exit /b 1
  )
  set "VIBEDOCK_NODE=node"
)
if not defined VIBEDOCK_PORT set VIBEDOCK_PORT=47831
"%VIBEDOCK_NODE%" src\server.mjs --open
if errorlevel 1 pause
