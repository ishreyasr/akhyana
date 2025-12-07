# Final Configuration Steps

## ✅ Frontend (Vercel) - DONE
The frontend has been updated with the new environment variables and redeployed.
- URL: https://v2v-bmsit.vercel.app/

## ⚠️ Backend (Render) - ACTION REQUIRED

You need to manually update the **akhyana-websocket** service on Render to allow connections from your new frontend URL.

### Steps to Update Render:

1. Go to your **akhyana-websocket** service on https://dashboard.render.com
2. Click **"Environment"** tab
3. Find `ALLOWED_ORIGINS` variable (or add it if missing)
4. Set value to: `https://v2v-bmsit.vercel.app`
5. Click **"Save Changes"**

This will trigger a redeploy of the backend. Once finished, your application will be fully connected!

### Verification
1. Open https://v2v-bmsit.vercel.app/
2. Open browser console (F12)
3. Check if WebSocket connects successfully (no red errors)
