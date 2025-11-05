#!/usr/bin/env pwsh
# Deploy to Render.com using Blueprint

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        Deploy Backend Servers to Render.com          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Manual Deployment Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to: https://render.com/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "2. Click 'New +' → 'Blueprint'" -ForegroundColor White
Write-Host ""
Write-Host "3. Connect your GitHub repository:" -ForegroundColor White
Write-Host "   Repository: ishreyasr/akhyana" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Render will automatically detect render.yaml and create:" -ForegroundColor White
Write-Host "   ✓ akhyana-peerjs (PeerJS Server)" -ForegroundColor Green
Write-Host "   ✓ akhyana-websocket (WebSocket Server)" -ForegroundColor Green
Write-Host ""
Write-Host "5. After deployment completes, copy both URLs" -ForegroundColor White
Write-Host ""
Write-Host "6. Add environment variables to Vercel:" -ForegroundColor Yellow
Write-Host "   vercel env add NEXT_PUBLIC_PEERJS_HOST production" -ForegroundColor Cyan
Write-Host "   vercel env add NEXT_PUBLIC_PEERJS_PORT production" -ForegroundColor Cyan
Write-Host "   vercel env add NEXT_PUBLIC_WS_URL production" -ForegroundColor Cyan
Write-Host ""
Write-Host "7. Redeploy frontend:" -ForegroundColor Yellow
Write-Host "   vercel --prod" -ForegroundColor Cyan
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "🔗 Quick Links:" -ForegroundColor Yellow
Write-Host "   Render Dashboard: https://render.com/dashboard" -ForegroundColor Cyan
Write-Host "   GitHub Repo: https://github.com/ishreyasr/akhyana" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to open Render dashboard in browser..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Start-Process "https://render.com/dashboard"
