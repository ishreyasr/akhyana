@echo off
echo ========================================
echo    V2V Dashboard Quick Start
echo ========================================
echo.

echo [1/3] Starting PeerJS Server (port 9000)...
start "PeerJS Server" cmd /k "node Backend\peerjs-server.js"
timeout /t 2 /nobreak >nul

echo [2/3] Starting V2V Backend Server (port 3002)...
start "V2V Backend" cmd /k "node Backend\launch-server.js"
timeout /t 2 /nobreak >nul

echo [3/3] Starting Next.js Frontend (port 3000)...
start "V2V Frontend" cmd /k "pnpm dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo    All Servers Started!
echo ========================================
echo.
echo PeerJS:    http://localhost:9000/peerjs
echo WebSocket: ws://localhost:3002/v2v
echo Frontend:  http://localhost:3000
echo.
echo Open http://localhost:3000 in TWO browser windows
echo to test voice calling between vehicles!
echo.
pause
