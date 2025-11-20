# Quick Setup Guide for Render Deployment

## Prerequisites
1. You have a Render account (sign up at https://render.com if you haven't)
2. Your code needs to be in a GitHub repository for easiest deployment

## Option A: Deploy via GitHub (Recommended)

### Step 1: Push to GitHub
```powershell
# Initialize git if not done
git init

# Add all files
git add .

# Commit
git commit -m "Ready for Render deployment"

# Create GitHub repo at https://github.com/new
# Name it: v2v-dashboard

# Add remote and push
git remote add origin https://github.com/YOUR-USERNAME/v2v-dashboard.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` and create both services automatically
5. Add the remaining environment variables:
   - For `akhyana-websocket`:
     - `SUPABASE_URL` → (from your `.env.local`)
     - `SUPABASE_SERVICE_KEY` → (from Supabase dashboard > Settings > API > service_role)
     - `ALLOWED_ORIGINS` → (your Vercel URL, e.g., `https://v2v-xxx.vercel.app`)

---

## Option B: Manual Deployment (No GitHub needed)

Since you don't have GitHub set up, follow these steps to deploy manually:

### Service 1: PeerJS Server

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Choose **"Build and deploy from a Git repository"** OR **"Deploy an existing image"**
   - If no GitHub: You'll need to set up GitHub first, OR
   - Use Render's "Deploy an existing image" with a Docker image
   
**For now, the easiest path forward:**

### Quick Alternative: Use GitHub Just for Deployment

Even if you don't actively use GitHub, it's the easiest way to deploy to Render:

1. **Create GitHub Account**: https://github.com/signup (if you don't have one)
2. **Create Repository**: https://github.com/new
   - Name: `v2v-dashboard`
   - Visibility: Private or Public (your choice)
   - Don't initialize with README
3. **Push Your Code**:
```powershell
cd c:\Users\shreyas\Downloads\v2v\main
git init
git add .
git commit -m "Initial commit for Render deployment"
git remote add origin https://github.com/YOUR-USERNAME/v2v-dashboard.git
git branch -M main
git push -u origin main
```

4. **Deploy on Render**:
   - Connect GitHub to Render
   - Deploy using the `render.yaml` blueprint

---

## What Happens Next

Once deployed, Render will:
- Build your services (takes 3-5 minutes first time)
- Assign URLs like:
  - `https://akhyana-peerjs.onrender.com`
  - `https://akhyana-websocket.onrender.com`
- Keep them running on the free tier (with limitations)

---

## Environment Variables Needed

### For akhyana-websocket service:
Create these in Render dashboard after the service is created:

| Variable | Where to Get It | Example |
|----------|-----------------|---------|
| `SUPABASE_URL` | Your `.env.local` file | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → service_role | `eyJhbGc...` |
| `ALLOWED_ORIGINS` | Your Vercel deployment URL | `https://v2v.vercel.app` |

---

## Next Steps After Backend Deployment

1. **Get Your Backend URLs** from Render dashboard
2. **Add to Vercel**:
```powershell
vercel env add NEXT_PUBLIC_PEERJS_HOST production
# Enter: akhyana-peerjs.onrender.com (no https://)

vercel env add NEXT_PUBLIC_PEERJS_PORT production  
# Enter: 443

vercel env add NEXT_PUBLIC_PEERJS_PATH production
# Enter: /peerjs

vercel env add NEXT_PUBLIC_WS_URL production
# Enter: wss://akhyana-websocket.onrender.com
```

3. **Redeploy Vercel**:
```powershell
vercel --prod
```

4. **Test Your Deployment!**
