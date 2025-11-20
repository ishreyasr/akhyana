# Vercel Environment Variables

Copy these values from your `.env.local` file when setting up Vercel deployment.

## Required Environment Variables for Production

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Backend Servers (Update after Render deployment)
```
NEXT_PUBLIC_PEERJS_HOST=<your-peerjs-service>.onrender.com
NEXT_PUBLIC_PEERJS_PORT=443
NEXT_PUBLIC_PEERJS_PATH=/peerjs
NEXT_PUBLIC_WS_URL=wss://<your-websocket-service>.onrender.com
```

## How to Add via Vercel CLI

```powershell
# Supabase URL
vercel env add NEXT_PUBLIC_SUPABASE_URL production

# Supabase Anon Key
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# PeerJS Host (without https://)
vercel env add NEXT_PUBLIC_PEERJS_HOST production

# PeerJS Port
vercel env add NEXT_PUBLIC_PEERJS_PORT production

# PeerJS Path
vercel env add NEXT_PUBLIC_PEERJS_PATH production

# WebSocket URL (with wss://)
vercel env add NEXT_PUBLIC_WS_URL production
```

## How to Add via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **"Add"** for each variable
5. Enter **Name** and **Value**
6. Select **"Production"** environment
7. Click **"Save"**

## Verification

After adding variables, verify they're set correctly:

```powershell
vercel env ls
```

## Common Mistakes to Avoid

❌ **Wrong:** `NEXT_PUBLIC_PEERJS_HOST=https://v2v-peerjs.onrender.com`  
✅ **Correct:** `NEXT_PUBLIC_PEERJS_HOST=v2v-peerjs.onrender.com`

❌ **Wrong:** `NEXT_PUBLIC_WS_URL=ws://v2v-websocket.onrender.com`  
✅ **Correct:** `NEXT_PUBLIC_WS_URL=wss://v2v-websocket.onrender.com`

❌ **Wrong:** `NEXT_PUBLIC_PEERJS_PORT=9000`  
✅ **Correct:** `NEXT_PUBLIC_PEERJS_PORT=443` (for production HTTPS)
