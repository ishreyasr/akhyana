# Fix for Failed Render Deployments

## Problem Identified
Both services (`akhyana-websocket` and `akhyana-peerjs`) are failing with this error:
```
npm ERR! Could not resolve dependency:
npm ERR! peer @types/node@"^18.11.18" from serialport@12.0.0
```

This is the same `serialport` peer dependency issue that occurred on Vercel.

## Solution

### Option 1: Add Environment Variable (Quick Fix)

For **both services** (akhyana-websocket and akhyana-peerjs):

1. **Go to Service Settings**:
   - Click on the service (akhyana-websocket or akhyana-peerjs)
   - Click "Environment" tab on the left

2. **Add New Environment Variable**:
   - Click "Add Environment Variable"
   - Key: `NPM_CONFIG_LEGACY_PEER_DEPS`
   - Value: `true`
   - Click "Save Changes"

3. **Trigger Manual Deploy**:
   - Go to "Manual Deploy" section
   - Click "Deploy latest commit"

4. **Repeat for the other service**

### Option 2: Update Repository (Permanent Fix)

Since we already pushed the fixed `package.json` to GitHub (with `serialport` in `optionalDependencies`), you can:

1. **For both services**:
   - Go to service page
   - Click "Manual Deploy" → "Deploy latest commit"
   
2. This will pull the latest code from GitHub which has the fix

### Option 3: Remove serialport completely (if not needed)

If `serialport` is not actually used in your backend code:

1. Remove it from `package.json` completely
2. Commit and push to GitHub
3. Redeploy both services

## Which Services to Fix

✅ **akhyana-websocket** (srv-d45kfd49c44c73c5plmg)
- Status: Failed 4min ago
- Add `NPM_CONFIG_LEGACY_PEER_DEPS=true`
- Or deploy latest commit (has the fix)

✅ **akhyana-peerjs** (srv-d45kfd49c44c73c5pllg)  
- Status: Failed 14d ago
- Add `NPM_CONFIG_LEGACY_PEER_DEPS=true`
- Or deploy latest commit (has the fix)

## After Fixing

Once both services are deployed successfully, you'll need to:

1. **Get the Service URLs** from Render dashboard
2. **Update Vercel Environment Variables**:
```powershell
vercel env add NEXT_PUBLIC_PEERJS_HOST production
# Enter: akhyana-peerjs.onrender.com

vercel env add NEXT_PUBLIC_WS_URL production
# Enter: wss://akhyana-websocket.onrender.com

vercel env add NEXT_PUBLIC_PEERJS_PORT production
# Enter: 443

vercel env add NEXT_PUBLIC_PEERJS_PATH production
# Enter: /peerjs
```

3. **Redeploy Vercel**:
```powershell
vercel --prod
```

## Expected Result

After the fix, both services should build successfully and you'll see "Live" status on the dashboard.
