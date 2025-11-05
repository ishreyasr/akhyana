#!/usr/bin/env pwsh
# Complete Deployment Script for Akhyana V2V Dashboard
# Deploys: Frontend, PeerJS Server, WebSocket Server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Akhyana V2V Dashboard Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if logged in to Vercel
Write-Host "[0/4] Checking Vercel authentication..." -ForegroundColor Yellow
$vercelAuth = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to Vercel. Please run: vercel login" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Logged in as: $vercelAuth" -ForegroundColor Green
Write-Host ""

# Push to GitHub first
Write-Host "[1/4] Pushing to GitHub..." -ForegroundColor Yellow
git add -A
git commit -m "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ErrorAction SilentlyContinue
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green
} else {
    Write-Host "⚠️  GitHub push skipped (no changes or already pushed)" -ForegroundColor Yellow
}
Write-Host ""

# Deploy Frontend
Write-Host "[2/4] Deploying Frontend to Vercel..." -ForegroundColor Yellow
Write-Host "Building and deploying Next.js application..." -ForegroundColor Gray
vercel --prod --yes
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend deployment failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Note about backend servers
Write-Host "[3/4] Backend Servers Deployment" -ForegroundColor Yellow
Write-Host "⚠️  IMPORTANT: Vercel Serverless doesn't support WebSockets!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Your Backend servers (PeerJS & WebSocket) need persistent connections." -ForegroundColor Cyan
Write-Host "You have 3 options:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Railway (Recommended - Free)" -ForegroundColor Green
Write-Host "  1. Go to https://railway.app" -ForegroundColor Gray
Write-Host "  2. Create project from GitHub repo" -ForegroundColor Gray
Write-Host "  3. Deploy Backend/peerjs-server.js (port 9000)" -ForegroundColor Gray
Write-Host "  4. Deploy Backend/server.js (port 3002)" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Render (Alternative - Free)" -ForegroundColor Green
Write-Host "  1. Go to https://render.com" -ForegroundColor Gray
Write-Host "  2. Create two Web Services" -ForegroundColor Gray
Write-Host "  3. Deploy both backend files" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 3: Heroku" -ForegroundColor Green
Write-Host "  Run: .\deploy-backend-heroku.ps1" -ForegroundColor Gray
Write-Host ""

# Instructions for next steps
Write-Host "[4/4] Next Steps" -ForegroundColor Yellow
Write-Host "1. Deploy backend servers (choose option above)" -ForegroundColor White
Write-Host "2. Get your backend URLs from Railway/Render/Heroku" -ForegroundColor White
Write-Host "3. Update Vercel environment variables:" -ForegroundColor White
Write-Host "   vercel env add NEXT_PUBLIC_PEERJS_HOST" -ForegroundColor Gray
Write-Host "   vercel env add NEXT_PUBLIC_WS_URL" -ForegroundColor Gray
Write-Host "4. Redeploy frontend: vercel --prod" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Deployment Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Frontend: Deployed to Vercel" -ForegroundColor Green
Write-Host "⏳ PeerJS: Needs Railway/Render deployment" -ForegroundColor Yellow
Write-Host "⏳ WebSocket: Needs Railway/Render deployment" -ForegroundColor Yellow
Write-Host ""
Write-Host "View your deployment: vercel inspect" -ForegroundColor Cyan
Write-Host ""
