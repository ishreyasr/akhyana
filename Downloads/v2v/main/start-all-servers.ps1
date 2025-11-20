# V2V Dashboard Startup Script
# Runs all required servers for the V2V system

Write-Host "🚀 Starting V2V Dashboard System..." -ForegroundColor Green
Write-Host ""

# Start PeerJS signaling server
Write-Host "📡 Starting PeerJS signaling server (port 9000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; node Backend/peerjs-server.js"
Start-Sleep -Seconds 2

# Start WebSocket backend server
Write-Host "🌐 Starting V2V WebSocket server (port 3002)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; node Backend/server-websocket.js"
Start-Sleep -Seconds 2

# Start Next.js frontend
Write-Host "💻 Starting Next.js frontend (port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; pnpm dev"
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ All servers started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Server Status:" -ForegroundColor Yellow
Write-Host "   • PeerJS Server:    http://localhost:9000/peerjs" -ForegroundColor White
Write-Host "   • WebSocket Server: ws://localhost:3002/v2v" -ForegroundColor White
Write-Host "   • Frontend:         http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "🎯 To test calling:" -ForegroundColor Yellow
Write-Host "   1. Open http://localhost:3000 in two browser windows" -ForegroundColor White
Write-Host "   2. Connect different vehicles in each window" -ForegroundColor White
Write-Host "   3. Click 'Start Call' on one vehicle" -ForegroundColor White
Write-Host "   4. Call should connect automatically" -ForegroundColor White
Write-Host "   5. Unmute both mics to talk" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to close all servers..." -ForegroundColor Red
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Cleanup - close all spawned processes
Get-Process | Where-Object {$_.MainWindowTitle -like "*peerjs-server*" -or $_.MainWindowTitle -like "*server-websocket*" -or $_.MainWindowTitle -like "*pnpm dev*"} | Stop-Process
