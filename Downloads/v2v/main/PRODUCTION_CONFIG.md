# Production Environment Variables

## Frontend (Vercel)
Update these in your Vercel project settings:

```env
# PeerJS Configuration
NEXT_PUBLIC_PEERJS_HOST=akhyana-peerjs.onrender.com
NEXT_PUBLIC_PEERJS_PORT=443
NEXT_PUBLIC_PEERJS_PATH=/peerjs

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=wss://akhyana-websocket.onrender.com

# Supabase (Keep existing)
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

## Backend (Render)

### akhyana-websocket
Update these in Render service settings:

```env
# Allowed Origins (CORS)
ALLOWED_ORIGINS=https://v2v-bmsit.vercel.app

# Port (Keep existing)
V2V_SERVER_PORT=3002
```

### akhyana-peerjs
No changes needed if `PEERJS_PORT` is set to `9000`.
