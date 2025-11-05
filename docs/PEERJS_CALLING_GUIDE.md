# PeerJS Calling Integration Guide

## Overview

Your V2V Dashboard now uses **PeerJS** - a completely free, open-source WebRTC library that handles all the complexity of peer-to-peer calling.

## How It Works

### 1. **Automatic Room Creation**
- Each vehicle gets a unique Peer ID (using their vehicleId)
- When you click "Start Call", it automatically connects to the other vehicle's Peer ID
- No manual room creation needed!

### 2. **Free Infrastructure**
- Uses PeerJS's free cloud signaling server (`peerjs.com`)
- Multiple free STUN/TURN servers for NAT traversal
- No backend signaling server required
- No API keys or paid services

### 3. **Simple Flow**
```
Vehicle A clicks "Start Call"
    ↓
PeerJS automatically calls Vehicle B's Peer ID
    ↓
Vehicle B auto-answers (after brief moment)
    ↓
Audio streams are connected
    ↓
Both can talk and hear each other
    ↓
Click "End Call" to disconnect
```

## Features

✅ **Automatic connection** - Just click "Start Call"
✅ **Auto-answer incoming calls** - No manual accept needed
✅ **Mute/Unmute** - Toggle your microphone anytime
✅ **Automatic cleanup** - Everything is cleaned up on disconnect
✅ **No rate limiting** - PeerJS handles all signaling efficiently
✅ **Free forever** - No costs, no limits on the free tier

## Technical Details

### PeerJS Configuration

```typescript
{
  host: 'peerjs.com',
  port: 443,
  secure: true,
  config: {
    iceServers: [
      // Multiple Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Free TURN servers for NAT traversal
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  }
}
```

### State Management

The `usePeerJSCall` hook manages:
- **callState**: Current call status (idle, connecting, ringing, active, ended, error)
- **remoteStream**: Audio stream from the other vehicle
- **localStream**: Your microphone audio stream
- **isMicMuted**: Current mute state
- **isReady**: Whether PeerJS is connected and ready

### Call States

1. **idle** - No call in progress
2. **connecting** - Establishing connection
3. **ringing** - Incoming call (brief moment before auto-answer)
4. **active** - Call is connected and active
5. **ended** - Call has ended
6. **error** - Something went wrong

## Advantages Over Custom WebRTC

| Feature | Custom WebRTC | PeerJS |
|---------|---------------|--------|
| Setup Complexity | High | Low |
| Signaling Server | Required | Built-in |
| Rate Limiting | Possible | Handled |
| Connection Issues | Common | Rare |
| Code Maintenance | High | Low |
| Cost | Backend costs | Free |

## Usage

### Starting a Call

```typescript
// In your component
const { startCall, callState } = usePeerJSCall(myVehicleId);

// Call another vehicle
await startCall(otherVehicleId);
```

### Ending a Call

```typescript
const { endCall } = usePeerJSCall(myVehicleId);

// End the current call
endCall();
```

### Mute/Unmute

```typescript
const { toggleMute, isMicMuted } = usePeerJSCall(myVehicleId);

// Toggle microphone
toggleMute();

// Check mute state
console.log('Muted:', isMicMuted);
```

## Troubleshooting

### Call Not Connecting?

1. **Check Peer IDs** - Both vehicles must have unique, valid IDs
2. **Check PeerJS Status** - Look for "PeerJS connected" in console
3. **Check Microphone Permissions** - Both vehicles need mic access
4. **Check Network** - Firewall might be blocking WebRTC

### No Audio?

1. **Unmute** - Both mics start muted by default
2. **Check Browser Console** - Look for audio-related errors
3. **Check Audio Element** - Should show "Remote Audio Stream" in UI
4. **Try Different Browser** - Some browsers have stricter autoplay policies

### PeerJS Connection Failed?

- The free PeerJS server might be temporarily down
- Try refreshing the page to reconnect
- Check network connectivity

## Future Enhancements

Possible improvements:
- Manual call accept/reject UI
- Call history
- Call quality indicators
- Network statistics
- Recording capabilities (with consent)

## Support

PeerJS is actively maintained:
- GitHub: https://github.com/peers/peerjs
- Documentation: https://peerjs.com/docs/
- Free tier has no limitations for basic usage

## Migration Notes

### What Changed

**Before:**
- Manual WebRTC implementation with complex signaling
- Required backend WebSocket for offer/answer/ICE
- Rate limiting issues with ICE candidates
- Connection often stuck in "connecting" state

**After:**
- PeerJS handles all WebRTC complexity
- Built-in signaling via free PeerJS cloud
- No rate limiting - batching handled automatically
- Reliable connection establishment

### Removed Dependencies

- No longer need custom WebSocket signaling for calls
- Removed manual ICE candidate batching
- Removed consent flow (can be re-added if needed)

### Code Changes

- `useWebRTCCall` → `usePeerJSCall`
- Simplified API with fewer edge cases
- Automatic cleanup and error handling
