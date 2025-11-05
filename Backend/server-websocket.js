/**
 * V2V Real-Time Communication Server
 * Node.js + Express + native ws
 *
 * Features:
 * - Vehicle registration & presence
 * - GPS location updates & nearby vehicle calculation (<= 500m)
 * - Text messaging routing
 * - Voice data routing (ArrayBuffer -> binary frames)
 * - Emergency alert high-priority broadcast
 * - Automatic cleanup on disconnect
 * - REST endpoints: /health, /vehicles, /vehicles/:id
 * - Hybrid mode abstraction (stub for radio fallback)
 * - WebRTC signaling with NO rate limiting for ICE candidates
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// ---- Configuration ----
const PORT = process.env.V2V_SERVER_PORT || 3002;
const NEARBY_RADIUS_METERS = 500;
const LOCATION_BROADCAST_INTERVAL_MS = 30_000; // 30s
const VEHICLE_STALE_TIMEOUT_MS = 60_000 * 5; // 5 minutes

// ---- In-memory stores ----
/**
 * vehicles: {
 *   [vehicleId]: {
 *     id,
 *     name,
 *     type,
 *     lastSeen: Date,
 *     location: { lat, lng, updatedAt },
 *     ws: WebSocket,
 *     isOnline: boolean,
 *     batteryLevel?,
 *     signalStrength?,
 *   }
 * }
 */
const vehicles = new Map();

// Pending binary voice streams keyed by messageId (optional future use)
const voiceStreams = new Map();

// ---- Utility Functions ----
function toRad(deg) { return deg * Math.PI / 180; }
function haversineDistanceMeters(a, b) {
  const R = 6371e3; // meters
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c; // meters
}

function getNearbyVehicles(baseVehicle) {
  if (!baseVehicle.location) return [];
  const res = [];
  vehicles.forEach(v => {
    if (v.id === baseVehicle.id) return;
    if (!v.location) return;
    const dist = haversineDistanceMeters(baseVehicle.location, v.location);
    if (dist <= NEARBY_RADIUS_METERS) {
      res.push({
        id: v.id,
        name: v.name,
        distance: Number(dist.toFixed(1)),
        signalStrength: v.signalStrength || Math.max(10, 100 - (dist / NEARBY_RADIUS_METERS) * 80),
        lastSeen: v.lastSeen,
        deviceType: v.type || 'vehicle',
        isConnectable: true
      });
    }
  });
  return res;
}

function safeSend(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }
}

function broadcastJSON(filterFn, payloadBuilder) {
  vehicles.forEach(v => {
    if (v.ws && v.ws.readyState === v.ws.OPEN && filterFn(v)) {
      safeSend(v.ws, payloadBuilder(v));
    }
  });
}

function buildVehiclePublicInfo(v) {
  return {
    id: v.id,
    name: v.name,
    type: v.type,
    lastSeen: v.lastSeen,
    location: v.location ? { lat: v.location.lat, lng: v.location.lng, updatedAt: v.location.updatedAt } : null,
    isOnline: v.isOnline,
  };
}

// ---- Hybrid Mode Stub (Radio Fallback) ----
const hybridMode = {
  isRadioFallbackActive: false,
  // In future: detect network loss & switch.
  enableRadioFallback() { this.isRadioFallbackActive = true; },
  disableRadioFallback() { this.isRadioFallbackActive = false; },
  sendRadioCompressedMessage(message) {
    // Placeholder – integrate with NRF24L01/ESP32 serial interface.
    console.log('[RADIO:FALLBACK] would send compressed message:', message.event);
  }
};

// ---- Express Setup ----
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', vehicles: vehicles.size, radioFallback: hybridMode.isRadioFallbackActive });
});

app.get('/vehicles', (req, res) => {
  const list = [];
  vehicles.forEach(v => list.push(buildVehiclePublicInfo(v)));
  res.json({ vehicles: list });
});

app.get('/vehicles/:id', (req, res) => {
  const v = vehicles.get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Not found' });
  res.json(buildVehiclePublicInfo(v));
});

// For debugging manual fallback toggle
app.post('/radio/:action', (req, res) => {
  if (req.params.action === 'enable') hybridMode.enableRadioFallback();
  if (req.params.action === 'disable') hybridMode.disableRadioFallback();
  res.json({ radioFallback: hybridMode.isRadioFallbackActive });
});

const server = http.createServer(app);

// ---- WebSocket Server ----
const wss = new WebSocketServer({ server, path: '/v2v' });

wss.on('connection', (ws, req) => {
  const connectionId = uuidv4();
  console.log('WS connection established', connectionId);

  let vehicleId = null; // will set after registration

  safeSend(ws, { event: 'connected', data: { connectionId } });

  ws.on('message', (raw, isBinary) => {
    // Voice data frames (binary) routed differently
    if (isBinary) {
      if (!vehicleId) return;
      // Assume first bytes could contain a tiny header – for now broadcast to intended recipient via JSON meta? Simplify: ignore header.
      // In real impl, include messageId/recipientId header.
      // We'll not parse; just drop if no meta previously set.
      // Extend: Could store the last declared voice target.
      return; // placeholder until front-end voice protocol is defined
    }

    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;

    const { event, data } = msg;

    switch (event) {
      case 'register_vehicle': {
        vehicleId = data.vehicleId || uuidv4();
        const vehicleEntry = {
          id: vehicleId,
          name: data.name || `Vehicle-${vehicleId.slice(0, 4)}`,
          type: data.type || 'vehicle',
          lastSeen: new Date().toISOString(),
          location: null,
          ws,
          isOnline: true,
          signalStrength: data.signalStrength || 100,
          batteryLevel: data.batteryLevel || 100
        };
        vehicles.set(vehicleId, vehicleEntry);
        safeSend(ws, { event: 'vehicle_registered', data: { vehicleId, name: vehicleEntry.name } });
        // Notify others of new presence
        broadcastJSON(v => v.id !== vehicleId, () => ({ event: 'vehicle_online', data: buildVehiclePublicInfo(vehicleEntry) }));
        break;
      }
      case 'location_update': {
        if (!vehicleId) return;
        const v = vehicles.get(vehicleId);
        if (!v) return;
        v.location = { lat: data.lat, lng: data.lng, updatedAt: new Date().toISOString() };
        v.lastSeen = new Date().toISOString();
        // Compute nearby list for this vehicle & send back
        const nearby = getNearbyVehicles(v);
        safeSend(ws, { event: 'nearby_vehicles', data: { vehicles: nearby, timestamp: new Date().toISOString() } });
        break;
      }
      case 'send_message': {
        if (!vehicleId) return;
        const recipientId = data.recipientId;
        const recipient = vehicles.get(recipientId);
        const payload = { event: 'receive_message', data: { senderId: vehicleId, content: data.content, timestamp: new Date().toISOString() } };
        if (recipient && recipient.ws && recipient.ws.readyState === recipient.ws.OPEN) {
          safeSend(recipient.ws, payload);
          safeSend(ws, { event: 'message_sent', data: { recipientId, status: 'delivered' } });
        } else {
          safeSend(ws, { event: 'message_sent', data: { recipientId, status: 'offline' } });
        }
        break;
      }
      case 'emergency_alert': {
        if (!vehicleId) return;
        const alertData = {
          id: uuidv4(),
          type: data.type || 'hazard',
          message: data.message || 'Emergency alert',
          timestamp: new Date().toISOString(),
          location: data.location || null,
          severity: data.severity || 'high',
          senderId: vehicleId
        };
        // High priority broadcast
        broadcastJSON(() => true, () => ({ event: 'emergency_alert', data: alertData }));
        break;
      }
      case 'voice_stream_meta': {
        // Placeholder for starting a voice stream handshake
        // data: { recipientId, codec, sampleRate }
        break;
      }
      case 'webrtc_offer': {
        // Forward WebRTC offer to recipient (NO rate limiting)
        if (!vehicleId) return;
        const recipientId = data.targetId || data.calleeId;
        const recipient = vehicles.get(recipientId);
        if (recipient && recipient.ws && recipient.ws.readyState === recipient.ws.OPEN) {
          safeSend(recipient.ws, { event: 'webrtc_offer', data: { ...data, callerId: vehicleId, targetId: vehicleId } });
          console.log(`WebRTC offer forwarded from ${vehicleId} to ${recipientId}`);
        }
        break;
      }
      case 'webrtc_answer': {
        // Forward WebRTC answer to caller (NO rate limiting)
        if (!vehicleId) return;
        const recipientId = data.targetId || data.callerId;
        const recipient = vehicles.get(recipientId);
        if (recipient && recipient.ws && recipient.ws.readyState === recipient.ws.OPEN) {
          safeSend(recipient.ws, { event: 'webrtc_answer', data: { ...data, calleeId: vehicleId, targetId: vehicleId } });
          console.log(`WebRTC answer forwarded from ${vehicleId} to ${recipientId}`);
        }
        break;
      }
      case 'ice_candidate': {
        // Forward ICE candidates immediately (NO rate limiting - critical for WebRTC)
        if (!vehicleId) return;
        const recipientId = data.targetId;
        const recipient = vehicles.get(recipientId);
        if (recipient && recipient.ws && recipient.ws.readyState === recipient.ws.OPEN) {
          safeSend(recipient.ws, { event: 'ice_candidate', data: { ...data, senderId: vehicleId } });
          // Only log every 5th candidate to reduce spam
          if (!ws.__iceCount) ws.__iceCount = 0;
          ws.__iceCount++;
          if (ws.__iceCount % 5 === 0) {
            console.log(`ICE candidate forwarded from ${vehicleId} to ${recipientId} (${ws.__iceCount} total)`);
          }
        }
        break;
      }
      case 'call_initiate': {
        // Forward call initiation to callee
        if (!vehicleId) return;
        const calleeId = data.calleeId || data.targetId;
        const callee = vehicles.get(calleeId);
        if (callee && callee.ws && callee.ws.readyState === callee.ws.OPEN) {
          safeSend(callee.ws, { event: 'call_initiate', data: { callerId: vehicleId, calleeId, targetId: calleeId } });
          console.log(`Call initiate forwarded from ${vehicleId} to ${calleeId}`);
        }
        break;
      }
      case 'connect_request': {
        // Forward connection request
        if (!vehicleId) return;
        const targetId = data.targetId;
        const target = vehicles.get(targetId);
        if (target && target.ws && target.ws.readyState === target.ws.OPEN) {
          safeSend(target.ws, { event: 'connect_request', data: { ...data, requesterId: vehicleId } });
          console.log(`Connect request forwarded from ${vehicleId} to ${targetId}`);
        }
        break;
      }
      case 'connect_response': {
        // Forward connection response
        if (!vehicleId) return;
        const requesterId = data.requesterId;
        const requester = vehicles.get(requesterId);
        if (requester && requester.ws && requester.ws.readyState === requester.ws.OPEN) {
          safeSend(requester.ws, { event: 'connect_response', data: { ...data, targetId: vehicleId } });
          console.log(`Connect response forwarded from ${vehicleId} to ${requesterId}`);
        }
        break;
      }
      case 'ping': {
        safeSend(ws, { event: 'pong', data: { ts: Date.now() } });
        break;
      }
      case 'heartbeat': {
        // Update last seen timestamp
        if (vehicleId) {
          const v = vehicles.get(vehicleId);
          if (v) v.lastSeen = new Date().toISOString();
        }
        break;
      }
      default: {
        // Unknown event => ignore or send error
        safeSend(ws, { event: 'error', data: { message: 'Unknown event', event } });
      }
    }
  });

  ws.on('close', () => {
    if (vehicleId) {
      const v = vehicles.get(vehicleId);
      if (v) {
        vehicles.delete(vehicleId);
        broadcastJSON(() => true, () => ({ event: 'vehicle_offline', data: { vehicleId } }));
      }
    }
  });

  ws.on('error', (err) => {
    console.error('WS error', err);
  });
});

// ---- Periodic Tasks ----
setInterval(() => {
  // Remove stale vehicles (no updates recently)
  const now = Date.now();
  vehicles.forEach((v, id) => {
    if (v.lastSeen && now - new Date(v.lastSeen).getTime() > VEHICLE_STALE_TIMEOUT_MS) {
      vehicles.delete(id);
      broadcastJSON(() => true, () => ({ event: 'vehicle_offline', data: { vehicleId: id, reason: 'stale' } }));
    }
  });
}, 60_000);

setInterval(() => {
  // Broadcast updated nearby lists to everyone (background distance recalculation)
  vehicles.forEach(v => {
    if (v.location) {
      const nearby = getNearbyVehicles(v);
      safeSend(v.ws, { event: 'nearby_vehicles', data: { vehicles: nearby, timestamp: new Date().toISOString(), periodic: true } });
    }
  });
}, LOCATION_BROADCAST_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`V2V WebSocket server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/v2v`);
});
