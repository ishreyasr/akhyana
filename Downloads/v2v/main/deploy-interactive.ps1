#!/usr/bin/env pwsh
# STEP-BY-STEP TERMINAL DEPLOYMENT GUIDE

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Akhyana V2V Dashboard - Terminal Deployment      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 You have 3 services to deploy:" -ForegroundColor Yellow
Write-Host "   1. Frontend (Next.js) → Vercel" -ForegroundColor White
Write-Host "   2. PeerJS Server → Railway/Render" -ForegroundColor White
Write-Host "   3. WebSocket Server → Railway/Render" -ForegroundColor White
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "STEP 1: Push to GitHub (Required First!)" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "1. Create repository on GitHub:" -ForegroundColor Yellow
Write-Host "   https://github.com/new" -ForegroundColor Cyan
Write-Host "   Name: akhyana" -ForegroundColor Cyan
Write-Host "   (Make it PUBLIC for free deployments)" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Push code:" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter when GitHub repo is created and code is pushed"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "STEP 2: Deploy Frontend to Vercel" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "Run these commands:" -ForegroundColor Yellow
Write-Host "   vercel login" -ForegroundColor Cyan
Write-Host "   vercel --prod" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 During setup, press Enter to accept defaults" -ForegroundColor Gray
Write-Host ""
$deployFrontend = Read-Host "Deploy frontend now? (y/n)"

if ($deployFrontend -eq "y") {
    Write-Host ""
    Write-Host "Checking Vercel login..." -ForegroundColor Yellow
    $auth = vercel whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Logging in to Vercel..." -ForegroundColor Yellow
        vercel login
    } else {
        Write-Host "✅ Already logged in as: $auth" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Deploying to Vercel..." -ForegroundColor Yellow
    vercel --prod
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Frontend deployed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  IMPORTANT: Add environment variables!" -ForegroundColor Yellow
        Write-Host "After deploying backends, run:" -ForegroundColor Yellow
        Write-Host "   vercel env add NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Cyan
        Write-Host "   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Cyan
        Write-Host "   vercel env add NEXT_PUBLIC_PEERJS_HOST" -ForegroundColor Cyan
        Write-Host "   vercel env add NEXT_PUBLIC_PEERJS_PORT" -ForegroundColor Cyan
        Write-Host "   vercel env add NEXT_PUBLIC_WS_URL" -ForegroundColor Cyan
        Write-Host "   vercel --prod  # Redeploy with env vars" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "STEP 3: Deploy Backend Servers (PeerJS + WebSocket)" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Vercel can't host WebSocket servers!" -ForegroundColor Red
Write-Host ""
Write-Host "Choose your backend deployment platform:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Railway (Recommended - Easiest)" -ForegroundColor Cyan
Write-Host "   • Free tier: 500 hours/month" -ForegroundColor Gray
Write-Host "   • No credit card required" -ForegroundColor Gray
Write-Host "   • CLI deployment support" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Render (Alternative)" -ForegroundColor Cyan
Write-Host "   • Free tier available" -ForegroundColor Gray
Web-Host "   • Web dashboard deployment" -ForegroundColor Gray
Write-Host "   • Good documentation" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Self-hosted VPS" -ForegroundColor Cyan
Write-Host "   • Full control" -ForegroundColor Gray
Write-Host "   • Requires server management" -ForegroundColor Gray
Write-Host ""

$backendChoice = Read-Host "Choose platform (1/2/3)"

if ($backendChoice -eq "1") {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "Railway Deployment" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Install Railway CLI:" -ForegroundColor Yellow
    Write-Host "   npm i -g @railway/cli" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Deploy steps:" -ForegroundColor Yellow
    Write-Host "   1. railway login" -ForegroundColor Cyan
    Write-Host "   2. railway init" -ForegroundColor Cyan
    Write-Host "   3. Select: Backend/peerjs-server.js" -ForegroundColor Cyan
    Write-Host "   4. railway up" -ForegroundColor Cyan
    Write-Host "   5. railway domain  # Get URL" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Repeat for Backend/server.js (WebSocket)" -ForegroundColor Cyan
    Write-Host ""
    
} elseif ($backendChoice -eq "2") {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "Render Deployment" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Manual steps:" -ForegroundColor Yellow
    Write-Host "   1. Go to https://render.com/dashboard" -ForegroundColor Cyan
    Write-Host "   2. New + → Web Service" -ForegroundColor Cyan
    Write-Host "   3. Connect GitHub repo 'akhyana'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Service 1 (PeerJS):" -ForegroundColor Yellow
    Write-Host "   - Name: akhyana-peerjs" -ForegroundColor Cyan
    Write-Host "   - Start: node Backend/peerjs-server.js" -ForegroundColor Cyan
    Write-Host "   - Port: 9000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Service 2 (WebSocket):" -ForegroundColor Yellow
    Write-Host "   - Name: akhyana-websocket" -ForegroundColor Cyan
    Write-Host "   - Start: node Backend/server.js" -ForegroundColor Cyan
    Write-Host "   - Port: 3002" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "STEP 4: Update Frontend Environment Variables" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "After backends are deployed, add these to Vercel:" -ForegroundColor Yellow
Write-Host ""
Write-Host "vercel env add NEXT_PUBLIC_SUPABASE_URL production" -ForegroundColor Cyan
Write-Host "vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production" -ForegroundColor Cyan
Write-Host "vercel env add NEXT_PUBLIC_PEERJS_HOST production" -ForegroundColor Cyan
Write-Host "vercel env add NEXT_PUBLIC_PEERJS_PORT production" -ForegroundColor Cyan
Write-Host "vercel env add NEXT_PUBLIC_WS_URL production" -ForegroundColor Cyan
Write-Host ""
Write-Host "Then redeploy:" -ForegroundColor Yellow
Write-Host "vercel --prod" -ForegroundColor Cyan
Write-Host ""

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Deployment Guide Complete!              ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📚 See DEPLOYMENT.md for detailed instructions" -ForegroundColor Cyan
Write-Host ""
