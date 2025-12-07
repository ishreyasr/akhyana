# Fix for "Backend: No such file or directory" Error

## The Issue
The repository structure on GitHub ended up being nested. Instead of the code being at the top level, it is inside:
`Downloads/v2v/main/`

So Render is looking for `Backend` at the top, but it's actually at `Downloads/v2v/main/Backend`.

## The Fix

You need to update the **Root Directory** setting for **BOTH** services (`akhyana-websocket` and `akhyana-peerjs`).

### Step 1: Fix akhyana-websocket

1. Go to the service on Render dashboard
2. Click **"Settings"** tab
3. Scroll down to **"Root Directory"** section
4. Click **"Edit"**
5. Enter: `Downloads/v2v/main`
6. Click **"Save Changes"**

This will automatically trigger a new deploy.

### Step 2: Fix akhyana-peerjs

1. Go to the service on Render dashboard
2. Click **"Settings"** tab
3. Scroll down to **"Root Directory"** section
4. Click **"Edit"**
5. Enter: `Downloads/v2v/main`
6. Click **"Save Changes"**

## Why this happened
When the code was pushed to GitHub, it included the full folder path `Downloads/v2v/main` instead of just the contents. Setting the Root Directory tells Render to "start" inside that folder, so all the commands (like `cd Backend`) will work correctly.

## Verification
After saving, the new deployment should start. Watch the logs - it should now successfully find the directory and install dependencies.
