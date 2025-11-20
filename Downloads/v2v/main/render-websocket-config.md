# Render Deployment Configuration for WebSocket Server

## Service Name
v2v-websocket

## Runtime
Node

## Build Command
```
npm install
```

## Start Command
```
node Backend/launch-server.js
```

## Environment Variables

| Key | Value | Notes |
|-----|-------|-------|
| V2V_SERVER_PORT | 3002 | WebSocket server port |
| SUPABASE_URL | `<your-supabase-url>` | Get from .env.local |
| SUPABASE_SERVICE_KEY | `<your-service-key>` | Get from Supabase dashboard |
| ALLOWED_ORIGINS | `https://your-vercel-url.vercel.app` | Update after Vercel deployment |

## Important Notes

1. **SUPABASE_URL**: Copy from your `.env.local` file or Supabase project settings
2. **SUPABASE_SERVICE_KEY**: Found in Supabase Dashboard → Settings → API → service_role key (NOT anon key)
3. **ALLOWED_ORIGINS**: Must match your Vercel deployment URL exactly (with https://)

## Auto-Deploy
No (deploy manually or via GitHub integration)

## Health Check Path
/ (returns JSON status)

## Instance Type
Free

## ⚠️ Known Limitations (Render Free Tier)
- WebSocket connections disconnect after 5 minutes
- Service spins down after 15 minutes of inactivity
- Cold start time: 30-60 seconds
