# 🚀 Akhyana V2V Dashboard - Deployment Guide

## Quick Terminal Deployment

### Prerequisites
```powershell
# 1. Login to Vercel
vercel login

# 2. Create GitHub repository first
# Go to https://github.com/new and create "akhyana" repo

# 3. Push code to GitHub
git push -u origin main
```

---

## 🎯 One-Command Deployment

### Deploy Frontend Only (Vercel)
```powershell
.\deploy-frontend.ps1
```

OR manually:
```powershell
vercel --prod
```

---

## 🔧 Backend Deployment Options

**⚠️ IMPORTANT:** Vercel Serverless **cannot** host WebSocket servers. You must use:

### Option 1: Railway (Recommended - Free Tier)

#### Step 1: Install Railway CLI
```powershell
npm i -g @railway/cli
```

#### Step 2: Login
```powershell
railway login
```

#### Step 3: Deploy PeerJS Server
```powershell
cd Backend
railway init
railway up
# When prompted, select "peerjs-server.js"
railway domain  # Get your deployment URL
cd ..
```

#### Step 4: Deploy WebSocket Server
```powershell
cd Backend
railway init --name akhyana-websocket
railway up
# When prompted, select "server.js"
railway domain  # Get your deployment URL
cd ..
```

#### Step 5: Update Frontend Environment Variables
```powershell
# Add environment variables to Vercel
vercel env add NEXT_PUBLIC_PEERJS_HOST production
# Enter: your-peerjs.railway.app

vercel env add NEXT_PUBLIC_PEERJS_PORT production
# Enter: 443

vercel env add NEXT_PUBLIC_WS_URL production
# Enter: wss://your-websocket.railway.app

# Redeploy frontend with new env vars
vercel --prod
```

---

### Option 2: Render (Alternative Free Option)

1. Go to https://render.com/dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Create TWO services:

**Service 1: PeerJS**
- Name: `akhyana-peerjs`
- Build Command: `npm install`
- Start Command: `node Backend/peerjs-server.js`
- Port: `9000`
- Copy the deployment URL

**Service 2: WebSocket**
- Name: `akhyana-websocket`
- Build Command: `npm install`
- Start Command: `node Backend/server.js`
- Port: `3002`
- Copy the deployment URL

Then update Vercel env vars as shown above.

---

### Option 3: Manual VPS Deployment

If you have a VPS (DigitalOcean, AWS, etc.):

```bash
# SSH into your server
ssh user@your-server.com

# Install PM2
npm i -g pm2

# Clone your repo
git clone https://github.com/ishreyasr/akhyana.git
cd akhyana

# Install dependencies
npm install

# Start servers with PM2
pm2 start Backend/peerjs-server.js --name peerjs
pm2 start Backend/server.js --name websocket

# Save PM2 config
pm2 save
pm2 startup
```

---

## 📋 Complete Deployment Checklist

- [ ] 1. Create GitHub repository `akhyana`
- [ ] 2. Push code: `git push -u origin main`
- [ ] 3. Deploy frontend: `vercel --prod`
- [ ] 4. Deploy PeerJS server (Railway/Render)
- [ ] 5. Deploy WebSocket server (Railway/Render)
- [ ] 6. Get backend URLs
- [ ] 7. Add env vars to Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_PEERJS_HOST`
  - `NEXT_PUBLIC_PEERJS_PORT`
  - `NEXT_PUBLIC_WS_URL`
- [ ] 8. Redeploy frontend: `vercel --prod`
- [ ] 9. Test your deployment!

---

## 🧪 Testing Your Deployment

```powershell
# View deployment details
vercel inspect

# View logs
vercel logs

# Check environment variables
vercel env ls
```

Open your Vercel URL in TWO browser tabs to test vehicle-to-vehicle calling!

---

## 🔄 Update Deployment

After making changes:

```powershell
# Push to GitHub
git add .
git commit -m "Update: description"
git push

# Redeploy frontend
vercel --prod

# Redeploy backend (if changed)
cd Backend
railway up  # or redeploy on Render dashboard
```

---

## 🆘 Troubleshooting

### Frontend deploys but backend doesn't work
- Check backend URLs are correct in Vercel env vars
- Ensure backends are using HTTPS/WSS (not HTTP/WS)
- Verify CORS is enabled in backend servers

### "Cannot connect to WebSocket"
- WebSocket URL must start with `wss://` (not `ws://`)
- Check Railway/Render service is running
- Verify PORT environment variable is set correctly

### "PeerJS connection failed"
- Ensure PeerJS host doesn't include `http://` or `https://`
- Port should be `443` for production (HTTPS)
- Path should be `/peerjs`

---

## 📚 Useful Commands

```powershell
# Vercel
vercel --prod                    # Deploy to production
vercel --prod --force            # Force redeploy
vercel env ls                    # List environment variables
vercel env add [NAME]            # Add environment variable
vercel logs                      # View logs
vercel inspect                   # View deployment details
vercel domains                   # Manage custom domains

# Railway
railway login                    # Login
railway up                       # Deploy
railway logs                     # View logs
railway domain                   # Get deployment URL
railway status                   # Check service status

# Git
git add .                        # Stage changes
git commit -m "message"          # Commit
git push                         # Push to GitHub
```

---

## 🎉 Success!

Your V2V Dashboard should now be live at:
- Frontend: `https://your-project.vercel.app`
- PeerJS: `https://your-peerjs.railway.app`
- WebSocket: `wss://your-websocket.railway.app`

Share your Vercel URL with friends to test vehicle-to-vehicle calling! 🚗💨
