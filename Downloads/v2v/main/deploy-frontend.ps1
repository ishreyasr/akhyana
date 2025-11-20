#!/usr/bin/env pwsh
# Deploy only Frontend to Vercel

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Deploying Frontend to Vercel" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if logged in
$vercelAuth = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Please login first: vercel login" -ForegroundColor Red
    exit 1
}

Write-Host "Logged in as: $vercelAuth" -ForegroundColor Green
Write-Host ""

# Deploy
Write-Host "Deploying to production..." -ForegroundColor Yellow
vercel --prod --yes

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Frontend deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "View deployment: vercel inspect" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed" -ForegroundColor Red
}
