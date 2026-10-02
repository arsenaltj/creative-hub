@echo off
cd /d "%~dp0"
set "VIBEDOCK_NODE=%~dp0runtime\node.exe"
if not exist "%VIBEDOCK_NODE%" set "VIBEDOCK_NODE=node"
"%VIBEDOCK_NODE%" src\server.mjs --open --mini
if errorlevel 1 pause
