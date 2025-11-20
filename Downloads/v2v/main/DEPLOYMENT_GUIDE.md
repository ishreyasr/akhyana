# 🚀 V2V Dashboard - Step-by-Step Deployment Guide (Vercel + Render)

This guide will walk you through deploying your V2V Dashboard using **Vercel** (frontend) and **Render** (backend servers).

## ⚠️ Important Notes About Render Free Tier

> **WebSocket Limitation:** Render's free tier disconnects WebSocket connections after 5 minutes of activity. This is a known limitation. For testing and demos, this may be acceptable, but for production use, you might need to upgrade to a paid plan or use Railway instead.

---

## Part 1: Deploy Frontend to Vercel

### Step 1: Login to Vercel

```powershell
vercel login
```

- Select your preferred login method (GitHub, Google, Email, etc.)
- Follow the authentication flow in your browser
- Return to terminal once logged in

### Step 2: Deploy to Vercel

```powershell
vercel --prod
```

**Answer the prompts:**
1. **Set up and deploy?** → `Y`
2. **Which scope?** → Select your account (press Enter)
3. **Link to existing project?** → `N`
4. **Project name?** → `v2v-dashboard` (or any name you prefer)
5. **Directory?** → `./` (press Enter)
6. **Override settings?** → `N` (press Enter)

**Wait for deployment to complete.** You'll get a URL like:
```
✅ Production: https://v2v-dashboard-xxx.vercel.app
```

**Save this URL!** You'll need it later.

---

## Part 2: Deploy Backend Servers to Render

### Step 1: Create Render Account

1. Go to https://render.com
2. Click **"Get Started"** or **"Sign Up"**
3. Sign up with GitHub, GitLab, or Email
4. Verify your email if required

### Step 2: Prepare Code for Render

Render needs to access your code. You have two options:

#### Option A: Push to GitHub (Recommended)

```powershell
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit for deployment"

# Create a GitHub repository at https://github.com/new
# Name it: v2v-dashboard

# Add remote and push
git remote add origin https://github.com/YOUR-USERNAME/v2v-dashboard.git
git branch -M main
git push -u origin main
```

#### Option B: Upload Manually (Faster for testing)

We'll deploy directly as "Blueprint" instances without GitHub.

---

### Step 3: Deploy PeerJS Server on Render

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Click:** "New +" → "Web Service"

**Configuration:**

| Field | Value |
|-------|-------|
| **Name** | `v2v-peerjs` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node Backend/peerjs-server.js` |
| **Plan** | Free |

**Environment Variables:**
Click "Environment" → "Add Environment Variable"
- Key: `PEERJS_PORT`
- Value: `9000`

**Click:** "Create Web Service"

**Wait for deployment** (2-5 minutes)

**Save the URL!** It will look like: `https://v2v-peerjs.onrender.com`

---

### Step 4: Deploy WebSocket Server on Render

1. **Go back to Dashboard:** https://dashboard.render.com
2. **Click:** "New +" → "Web Service"

**Configuration:**

| Field | Value |
|-------|-------|
| **Name** | `v2v-websocket` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node Backend/launch-server.js` |
| **Plan** | Free |

**Environment Variables:**
Click "Environment" → "Add Environment Variable"

Add these variables:

| Key | Value |
|-----|-------|
| `V2V_SERVER_PORT` | `3002` |
| `SUPABASE_URL` | Your Supabase project URL (from `.env.local`) |
| `SUPABASE_SERVICE_KEY` | Your Supabase service role key |
| `ALLOWED_ORIGINS` | `https://v2v-dashboard-xxx.vercel.app` (your Vercel URL) |

**Click:** "Create Web Service"

**Wait for deployment** (2-5 minutes)

**Save the URL!** It will look like: `https://v2v-websocket.onrender.com`

---

## Part 3: Connect Frontend to Backend

Now we need to tell Vercel where your backend servers are.

### Step 1: Add Environment Variables to Vercel

You can do this via CLI or Dashboard. Let's use CLI:

```powershell
# Set PeerJS host (WITHOUT https://, just the domain)
vercel env add NEXT_PUBLIC_PEERJS_HOST production
# When prompted, enter: v2v-peerjs.onrender.com

# Set PeerJS port
vercel env add NEXT_PUBLIC_PEERJS_PORT production
# When prompted, enter: 443

# Set PeerJS path
vercel env add NEXT_PUBLIC_PEERJS_PATH production
# When prompted, enter: /peerjs

# Set WebSocket URL (WITH wss://)
vercel env add NEXT_PUBLIC_WS_URL production
# When prompted, enter: wss://v2v-websocket.onrender.com

# Add Supabase URL
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# When prompted, enter your Supabase URL from .env.local

# Add Supabase Anon Key
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# When prompted, enter your Supabase anon key from .env.local
```

### Alternative: Add via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click on your `v2v-dashboard` project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_PEERJS_HOST` | `v2v-peerjs.onrender.com` |
| `NEXT_PUBLIC_PEERJS_PORT` | `443` |
| `NEXT_PUBLIC_PEERJS_PATH` | `/peerjs` |
| `NEXT_PUBLIC_WS_URL` | `wss://v2v-websocket.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

### Step 2: Redeploy Frontend

```powershell
vercel --prod
```

This will rebuild your frontend with the new environment variables.

---

## Part 4: Testing Your Deployment

### Test 1: Frontend Loads

1. Open your Vercel URL: `https://v2v-dashboard-xxx.vercel.app`
2. ✅ Dashboard should load without errors
3. ✅ Check browser console (F12) for any errors

### Test 2: WebSocket Connection

1. Open browser DevTools (F12) → **Network** tab → **WS** filter
2. ✅ You should see a WebSocket connection to `wss://v2v-websocket.onrender.com`
3. ✅ Status should be "101 Switching Protocols" (successful)

### Test 3: Voice Calling (Most Important!)

1. **Open your Vercel URL in TWO different browser windows** (or use Incognito)
2. In Window 1: Register as Vehicle A
3. In Window 2: Register as Vehicle B
4. Try calling from Vehicle A → Vehicle B
5. ✅ Call should connect
6. ✅ You should hear audio in both windows

### Test 4: Emergency Alerts

1. In one window, trigger an emergency alert
2. ✅ Other vehicles should receive a notification
3. ✅ Click "Connect" to auto-initiate call
4. ✅ Emergency badge should appear and clear after 5 minutes

---

## 🎉 Deployment Complete!

Your V2V Dashboard is now live at:
- **Frontend:** `https://v2v-dashboard-xxx.vercel.app`
- **PeerJS:** `https://v2v-peerjs.onrender.com`
- **WebSocket:** `https://v2v-websocket.onrender.com`

---

## 🔧 Troubleshooting

### Frontend shows "Disconnected"

**Check:** WebSocket URL is correct in Vercel environment variables
```powershell
vercel env ls
```

**Solution:** Ensure URL starts with `wss://` (not `ws://`)

### Voice calling doesn't work

**Check:** PeerJS configuration
1. `NEXT_PUBLIC_PEERJS_HOST` should NOT have `https://`
2. `NEXT_PUBLIC_PEERJS_PORT` should be `443`
3. `NEXT_PUBLIC_PEERJS_PATH` should be `/peerjs`

**Test PeerJS server directly:**
Open: `https://v2v-peerjs.onrender.com/peerjs`
Should return: `{"name":"PeerJS Server"}`

### "WebSocket disconnects after 5 minutes"

**This is expected on Render's free tier.** Solutions:
1. Upgrade to Render paid plan ($7/month per service)
2. Switch to Railway (see implementation_plan.md)
3. Accept limitation for demo/testing purposes

### Backend servers show "Service Unavailable"

**Reason:** Render free tier spins down after 15 minutes of inactivity

**Solution:** First request after spin-down takes 30-60 seconds to wake up

### CORS errors

**Check:** `ALLOWED_ORIGINS` in WebSocket server environment variables

**Solution:** Ensure it matches your Vercel URL exactly (with `https://`)

---

## 📊 Monitoring Your Deployment

### Vercel Logs

```powershell
vercel logs
```

Or visit: https://vercel.com/dashboard → Your Project → Deployments → Latest → View Logs

### Render Logs

- Go to https://dashboard.render.com
- Click on your service (v2v-peerjs or v2v-websocket)
- Click **"Logs"** tab
- View real-time logs

---

## 🔄 Updating Your Deployment

### Frontend Changes

```powershell
# Make changes to code
git add .
git commit -m "Description"
git push

# Vercel auto-deploys if GitHub integration is enabled
# Or manually:
vercel --prod
```

### Backend Changes

**If using GitHub:**
1. Push changes: `git push`
2. Render auto-deploys

**If not using GitHub:**
1. Go to Render dashboard
2. Click service → **"Manual Deploy"** → **"Deploy latest commit"**

---

## 💰 Cost Summary

| Service | Component | Cost |
|---------|-----------|------|
| Vercel | Frontend | **FREE** (Hobby plan) |
| Render | PeerJS Server | **FREE** (with limitations) |
| Render | WebSocket Server | **FREE** (with limitations) |
| **Total** | | **$0/month** |

**Limitations to be aware of:**
- WebSocket connections disconnect after 5 minutes on Render free tier
- Services spin down after 15 min inactivity (30-60s cold start)
- Suitable for testing/demos, consider paid plan for production

---

## 🆘 Need Help?

**Check these resources:**
1. [Vercel Documentation](https://vercel.com/docs)
2. [Render Documentation](https://render.com/docs)
3. [PeerJS Documentation](https://peerjs.com/docs/)

**Common Commands:**
```powershell
# Vercel
vercel --help
vercel env ls       # List environment variables
vercel logs         # View logs
vercel inspect      # View deployment details

# Git
git status          # Check status
git add .           # Stage all changes
git commit -m "msg" # Commit
git push            # Push to GitHub
```

---

Good luck with your deployment! 🚀
