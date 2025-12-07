# Deploy to Railway (No GitHub Required!)

Railway has a CLI just like Vercel that lets you deploy directly from your terminal.

## Step 1: Install Railway CLI

```powershell
npm install -g @railway/cli
```

## Step 2: Login to Railway

```powershell
railway login
```
This will open your browser for authentication.

## Step 3: Deploy PeerJS Server

```powershell
# Navigate to your project
cd C:\Users\shreyas\Downloads\v2v\main

# Create new Railway project for PeerJS
railway init

# Set start command and environment variable
railway up --service peerjs
```

When prompted:
- Start Command: `node Backend/peerjs-server.js`
- Set environment: `PEERJS_PORT=9000`

## Step 4: Deploy WebSocket Server

```powershell
# Create second service for WebSocket
railway service create

# Deploy WebSocket
railway up --service websocket
```

When prompted:
- Start Command: `node Backend/launch-server.js`
- Set environment variables:
  - `V2V_SERVER_PORT=3002`
  - `SUPABASE_URL=<from your .env.local>`
  - `SUPABASE_SERVICE_KEY=<from Supabase dashboard>`
  - `ALLOWED_ORIGINS=<your Vercel URL>`

## Step 5: Get Your URLs

```powershell
# Get PeerJS URL
railway domain

# Switch to websocket service and get URL
railway service
railway domain
```

## Step 6: Update Vercel Environment Variables

```powershell
vercel env add NEXT_PUBLIC_PEERJS_HOST production
# Enter: your-peerjs.railway.app

vercel env add NEXT_PUBLIC_PEERJS_PORT production
# Enter: 443

vercel env add NEXT_PUBLIC_PEERJS_PATH production
# Enter: /peerjs

vercel env add NEXT_PUBLIC_WS_URL production
# Enter: wss://your-websocket.railway.app

# Redeploy frontend
vercel --prod
```

## Why Railway Instead of Render?

- ✅ Has CLI (no GitHub needed)
- ✅ $5/month with $5 credits (effectively free)
- ✅ **No 5-minute WebSocket timeout** (unlike Render free tier)
- ✅ Better for production use
- ✅ Similar to Vercel CLI workflow

---

## Alternative: Manual Render Deployment

If you really want to use Render, you'll need to:
1. Create a GitHub account (just for deployment, 5 minutes)
2. Push your code once
3. Deploy via Render dashboard

**However, Railway is strongly recommended** because:
- It works from terminal like Vercel
- No WebSocket limitations
- Better for your use case
