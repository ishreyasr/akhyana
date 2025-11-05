# WebRTC Connection Debugging Guide

## Issue: WebRTC Connection Failed

The error you're seeing indicates that the WebRTC peer connection is failing to establish. Here's a comprehensive debugging guide to help identify and fix the issue.

## 🔍 **Debugging Steps**

### 1. **Check Browser Console Logs**
Open your browser's developer console (F12) and look for these specific log messages:

**Expected Flow:**
```
📞 Starting call from [vehicle1] to [vehicle2]
📞 Getting local audio stream...
📞 Local audio stream obtained, tracks: 1
📞 Creating WebRTC offer...
📞 Setting local description...
📞 Sending offer to: [vehicle2]
📞 Handling incoming offer from: [vehicle1]
📞 Setting remote description...
📞 Creating answer...
📞 Setting local description (answer)...
📞 Sending answer to: [vehicle1]
📞 Handling incoming answer from: [vehicle2]
📞 Setting remote description (answer)...
📞 WebRTC connection state changed: connecting
📞 WebRTC connection state changed: connected
```

**Error Indicators:**
- `📞 WebRTC connection failed` - Connection establishment failed
- `📞 Failed to handle offer:` - Offer processing failed
- `📞 Failed to handle answer:` - Answer processing failed
- `📞 ICE candidate handling failed:` - ICE candidate issues

### 2. **Check Microphone Permissions**
Ensure microphone access is granted:
1. Click the microphone icon in your browser's address bar
2. Make sure "Allow" is selected for microphone access
3. Try refreshing the page and granting permission again

### 3. **Verify WebSocket Connection**
Check if the WebSocket signaling is working:
1. Look for WebSocket connection logs in console
2. Verify that `call_initiate`, `webrtc_offer`, `webrtc_answer` messages are being sent/received
3. Check network tab for WebSocket message flow

### 4. **Test with Different Browsers**
Try the voice call in different browsers:
- **Chrome**: Usually has the best WebRTC support
- **Firefox**: Good WebRTC support
- **Safari**: May have different behavior
- **Edge**: Modern versions have good support

### 5. **Check Network Environment**
WebRTC requires specific network conditions:
- **HTTPS Required**: WebRTC only works over HTTPS in production
- **Firewall**: Some corporate firewalls block WebRTC traffic
- **NAT**: Complex NAT configurations can cause issues

## 🛠️ **Common Fixes**

### Fix 1: Reset WebRTC State
If you're getting stuck in a bad state, try this:

1. **Clear Browser Data:**
   - Go to browser settings
   - Clear cookies and site data for your domain
   - Refresh the page

2. **Hard Refresh:**
   - Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - This clears cached JavaScript and forces reload

### Fix 2: Check STUN Server Connectivity
The implementation uses Google's STUN servers. Test if they're accessible:

```javascript
// Run this in browser console to test STUN servers
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

pc.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('STUN server working:', event.candidate);
  }
};

pc.createOffer().then(offer => pc.setLocalDescription(offer));
```

### Fix 3: Verify Audio Stream
Test if microphone access is working:

```javascript
// Run this in browser console
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('Microphone working:', stream.getAudioTracks().length, 'tracks');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(error => console.error('Microphone error:', error));
```

### Fix 4: Check Signaling Server
Verify that the WebSocket signaling is working properly:

1. **Check WebSocket Connection:**
   ```javascript
   // In browser console
   console.log('WebSocket state:', webSocketService.getConnectionStatus());
   ```

2. **Monitor WebSocket Messages:**
   - Open Network tab in DevTools
   - Look for WebSocket connection
   - Check if messages are being sent/received

## 🧪 **Testing Methods**

### Method 1: Use the Test File
1. Open `test-webrtc-voice.html` in your browser
2. Click "Start Call" to test WebRTC functionality
3. Monitor the debug log for any errors

### Method 2: Two Browser Windows
1. Open the V2V dashboard in two separate browser windows
2. Register different vehicles in each window
3. Connect the vehicles
4. Try starting a call

### Method 3: Different Devices
1. Use two different devices (phone + computer)
2. Ensure both have microphone access
3. Test the voice call functionality

## 📊 **Debug Information to Collect**

When reporting issues, please provide:

1. **Browser Information:**
   - Browser name and version
   - Operating system
   - Whether HTTPS is enabled

2. **Console Logs:**
   - Copy all console logs from the call attempt
   - Include any error messages

3. **Network Information:**
   - Are you on a corporate network?
   - Any firewall or proxy settings?
   - Mobile data vs WiFi?

4. **Steps to Reproduce:**
   - Exact steps you took
   - What you expected to happen
   - What actually happened

## 🔧 **Advanced Debugging**

### Enable Detailed Logging
Add this to your browser console for more detailed WebRTC logs:

```javascript
// Enable WebRTC logging
localStorage.setItem('webrtc-debug', 'true');

// Check peer connection states
const checkPeerState = () => {
  console.log('Peer Connection State:', peerRef.current?.connectionState);
  console.log('ICE Connection State:', peerRef.current?.iceConnectionState);
  console.log('Signaling State:', peerRef.current?.signalingState);
};

// Run this periodically during a call attempt
setInterval(checkPeerState, 2000);
```

### Monitor ICE Candidates
```javascript
// Monitor ICE candidate gathering
peerRef.current.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('ICE Candidate:', event.candidate.candidate);
  } else {
    console.log('ICE gathering complete');
  }
};
```

## 🚨 **Emergency Fallback**

If WebRTC continues to fail, you can implement a fallback:

1. **Text-based Communication**: Use the existing messaging system
2. **External Voice Service**: Integrate with services like Twilio
3. **Simplified Audio**: Use basic audio recording/playback

## 📞 **Getting Help**

If the issue persists after trying these steps:

1. **Check the Console Logs**: Look for specific error messages
2. **Try Different Browsers**: Test in Chrome, Firefox, Safari
3. **Test Network**: Try from different network (mobile data vs WiFi)
4. **Simplify Test**: Use the `test-webrtc-voice.html` file first

The enhanced logging I've added should provide much more detailed information about where exactly the WebRTC connection is failing. Check the console logs and let me know what specific error messages you're seeing!

