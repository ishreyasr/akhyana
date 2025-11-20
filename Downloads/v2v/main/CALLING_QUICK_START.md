# 🎯 V2V Voice Calling - Quick Start Guide

## ✅ What's Working Now

Your V2V Dashboard now has **FREE, reliable peer-to-peer voice calling** with:
- ✅ Local PeerJS signaling server (no cloud dependency)
- ✅ Automatic room creation and connection
- ✅ Auto-answer for seamless calling
- ✅ Mute/Unmute controls
- ✅ Clean disconnect handling
- ✅ 100% free STUN/TURN servers

## 🚀 Quick Start (3 Steps)

### 1. Start All Servers

**Option A - Use Batch File (Easiest):**
```cmd
start-all-servers.bat
```

**Option B - Use PowerShell Script:**
```powershell
.\start-all-servers.ps1
```

**Option C - Manual Start:**
```bash
# Terminal 1 - PeerJS Server
node Backend/peerjs-server.js

# Terminal 2 - WebSocket Server  
node Backend/server-websocket.js

# Terminal 3 - Frontend
pnpm dev
```

### 2. Open Two Browser Windows

- Window 1: http://localhost:3000
- Window 2: http://localhost:3000 (in new window/tab)

### 3. Test Voice Calling

1. **Register vehicles** in both windows (different names)
2. In Window 1: Select the vehicle from Window 2
3. Click **"Start Call"** in Window 1
4. Connection establishes automatically (~2-3 seconds)
5. Click **"Unmute Mic"** in both windows to talk
6. Click **"End Call"** to disconnect

## 🎤 Calling Features

### Call States
- **Idle** - No call active
- **Connecting** - Establishing connection
- **Ringing** - Incoming call (auto-answers)
- **Active** - Call connected ✅
- **Ended** - Call finished

### Controls
- **Start Call** - Initiates call to connected vehicle
- **Unmute Mic** - Enable your microphone (starts muted)
- **Mute Mic** - Disable your microphone
- **End Call** - Disconnect the call

### Audio Indicators
- 🎤 **Mic Stream** - Shows your mic is active
- 🔊 **Remote Stream** - Shows audio from other vehicle
- 🎚️ **Audio Level** - Visual level meter
- 🔇/🔊 **Mute Status** - Shows mic state

## 🏗️ Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Vehicle A     │         │   Vehicle B     │
│  (localhost)    │         │  (localhost)    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │  WebRTC Signaling        │
         └──────────┬────────────────┘
                    │
         ┌──────────▼──────────┐
         │  PeerJS Server      │
         │  localhost:9000     │
         └─────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  STUN/TURN Servers  │
         │  (Google + OpenRelay)│
         └─────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  Direct P2P Audio   │
         │  (WebRTC Stream)    │
         └─────────────────────┘
```

## 🔧 Server Details

### PeerJS Signaling Server
- **Port:** 9000
- **Path:** /peerjs
- **Purpose:** WebRTC signaling and peer discovery
- **Cost:** FREE (self-hosted)

### V2V WebSocket Server
- **Port:** 3002
- **Path:** /v2v
- **Purpose:** Vehicle location, messaging, nearby detection
- **Cost:** FREE (self-hosted)

### Frontend (Next.js)
- **Port:** 3000
- **Purpose:** User interface
- **Cost:** FREE (self-hosted)

## 🐛 Troubleshooting

### "Lost connection to server" Error
✅ **FIXED!** - Now using local server instead of cloud

### Call Not Connecting?
1. ✅ Check PeerJS server is running (should see green output)
2. ✅ Check browser console for "🔵 PeerJS connected"
3. ✅ Verify both vehicles have different IDs
4. ✅ Check microphone permissions granted

### No Audio?
1. ✅ Click "Unmute Mic" on BOTH vehicles
2. ✅ Check browser console for audio errors
3. ✅ Verify "Remote Audio Stream" appears when connected
4. ✅ Check system volume and mic settings

### PeerJS Connection Issues?
1. ✅ Restart PeerJS server: `node Backend/peerjs-server.js`
2. ✅ Refresh both browser windows
3. ✅ Check no other process is using port 9000

### WebRTC Connection Failed?
1. ✅ Check firewall isn't blocking WebRTC
2. ✅ Verify STUN servers are accessible
3. ✅ Check browser supports WebRTC (Chrome, Edge, Firefox)

## 📊 Console Logs to Look For

### Success Indicators ✅
```
🔵 PeerJS connected with ID: your-vehicle-id
📞 Starting call to: target-vehicle-id
📞 Received remote stream
📞 Remote audio playing
🎤 Microphone unmuted
```

### Connection Process 🔄
```
1. 🔵 Initializing PeerJS with ID: veh-123
2. 🔵 PeerJS connected with ID: veh-123
3. 📞 Starting PeerJS call to: veh-456
4. 📞 Calling peer: veh-456
5. 📞 Incoming call from: veh-123 (on other side)
6. 📞 Answering call from: veh-123
7. 🎤 Requesting microphone access...
8. 🎤 Microphone access granted, starting muted
9. 📞 Received remote stream
10. ✅ Call Connected!
```

## 🎯 Testing Checklist

- [ ] PeerJS server running (port 9000)
- [ ] WebSocket server running (port 3002)
- [ ] Frontend running (port 3000)
- [ ] Two browser windows open
- [ ] Both vehicles registered with different IDs
- [ ] Vehicles can see each other in nearby list
- [ ] Can connect to vehicle
- [ ] "Start Call" button works
- [ ] Call connects (sees "Call Connected" toast)
- [ ] Can see "Remote Audio Stream" element
- [ ] Can toggle mute/unmute
- [ ] Can hear audio after unmuting both
- [ ] "End Call" cleanly disconnects

## 🔐 Security Notes

- Local development: No encryption needed
- Production: Use HTTPS and secure WebSockets (wss://)
- PeerJS: Can enable SSL in production
- TURN servers: Free tier has no auth issues

## 📚 Technical Details

### PeerJS Configuration
```typescript
{
  host: 'localhost',
  port: 9000,
  path: '/peerjs',
  secure: false,
  debug: 2
}
```

### STUN/TURN Servers
```typescript
{
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // ... more STUN servers
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
}
```

### Audio Configuration
```typescript
{
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
}
```

## 🆘 Support

### Check Logs
1. **Browser Console** - WebRTC and PeerJS logs
2. **PeerJS Server Terminal** - Connection logs
3. **WebSocket Server Terminal** - Message logs

### Common Issues

| Issue | Solution |
|-------|----------|
| "Lost connection to server" | ✅ Now using local server - restart it |
| Call stuck in "Connecting" | Refresh both browsers, restart PeerJS |
| No audio | Unmute both mics, check permissions |
| Can't find vehicle | Both must be registered and nearby |

## 🎉 Success!

When everything works, you'll see:
- ✅ "Call Connected" toast notification
- ✅ Green indicator showing call active
- ✅ Remote Audio Stream controls visible
- ✅ Can toggle mute/unmute
- ✅ Audio playing after unmuting

**Your 100% free, reliable V2V voice calling is ready!** 🚗🔊🚗
