/**
 * V2V Hybrid Communication Server (Core Implementation)
 * Responsibilities:
 *  - WebSocket real-time control plane
 *  - Vehicle presence & heartbeats
 *  - Proximity detection (<=500m) using geolib
 *  - Text & emergency message routing
 *  - WebRTC signaling relay (call setup)
 *  - Hybrid offline radio bridge (serialport stub + binary protocol)
 *  - Structured logging (winston)
 */

// ---------------------- Imports & Setup ----------------------
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const geolib = require('geolib');
const winston = require('winston');
const persistence = require('./persistence');
const { z } = require('zod');
const Redis = require('ioredis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
let SerialPort; // lazy require (optional in dev)
let firebaseAdmin = null;
try { SerialPort = require('serialport').SerialPort; } catch (_) { /* optional */ }
// Only initialize Firebase if not disabled and credentials available
if (process.env.DISABLE_FIREBASE_AUTH !== '1') {
  try { firebaseAdmin = require('firebase-admin'); if (!firebaseAdmin.apps.length) { firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.applicationDefault?.() || undefined }); } } catch (_) { /* optional auth */ }
}

// ---------------------- Config ----------------------
const CONFIG = {
  PORT: parseInt(process.env.V2V_SERVER_PORT || '3002', 10),
  WS_PATH: '/v2v',
  NEARBY_RADIUS_METERS: parseInt(process.env.NEARBY_RADIUS_METERS || '500', 10),
  HEARTBEAT_TIMEOUT_MS: 60_000,
  PROXIMITY_RECALC_INTERVAL_MS: 30_000,
  STALE_SWEEP_INTERVAL_MS: 60_000,
  RADIO_ENABLED: process.env.RADIO_ENABLED === 'true',
  RADIO_PORT: process.env.RADIO_PORT || 'COM5', // adjust per environment
  RADIO_BAUD: parseInt(process.env.RADIO_BAUD || '115200', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  REDIS_PRESENCE_KEY: 'v2v:presence',
  REDIS_MESSAGES_KEY: 'v2v:messages'
};

// ---------------------- Logger ----------------------
const baseLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      return JSON.stringify({ ts: timestamp, level, message, ...meta });
    })
  ),
  transports: [new winston.transports.Console()]
});

function withContext(category, extra = {}) {
  const add = (level, msg, meta = {}) => {
    // If a requestId/sessionId already present keep it; else allow pass-through
    baseLogger.log(level, msg, { category, ...extra, ...meta });
  };
  return {
    info: (msg, meta = {}) => add('info', msg, meta),
    warn: (msg, meta = {}) => add('warn', msg, meta),
    error: (msg, meta = {}) => add('error', msg, meta)
  };
}

const logger = withContext('core');
const logAuth = withContext('auth');
const logSignaling = withContext('signaling');
const logProximity = withContext('proximity');

// We'll declare app after; create an array for deferred middlewares
const deferredHttpMiddleware = [];
function addDeferred(mw) { deferredHttpMiddleware.push(mw); }
// RequestId middleware (added after app instantiation)
addDeferred((req, res, next) => {
  req.requestId = uuidv4();
  const start = Date.now();
  res.setHeader('X-Request-Id', req.requestId);
  res.on('finish', () => {
    logger.info('http_access', { requestId: req.requestId, method: req.method, url: req.originalUrl || req.url, status: res.statusCode, durationMs: Date.now() - start });
  });
  next();
});

// ---------------------- Data Stores ----------------------
/** vehicles Map structure:
 *  vehicleId -> {
 *    vehicleId,
 *    driverName,
 *    vehicleInfo: { licensePlate, model, color },
 *    ws, lastHeartbeat: number,
 *    location: { lat, lon, updatedAt } | null,
 *    connectedAt: number
 *  }
 */
const vehicles = new Map();
// Radio short ID <-> vehicleId registry (shortID -> vehicleId)
const radioIdRegistry = new Map();
// Track last nearby peers per vehicle for enter/exit detection
const lastNearbyMap = new Map(); // vehicleId -> Set(peerVehicleId)

// Track last known call sessions (optional extension)
const callSessions = new Map(); // key: sessionId -> { callerId, calleeId, state }
// Pending consent requests: key `${requesterId}->${targetId}` => { requestedAt, purpose }
const pendingConsents = new Map();

// ---------------------- Metrics (P1 Observability) ----------------------
// Simple in-memory counters (reset on process restart). For production, export
// to a persistent TSDB via Prometheus scraping.
const metrics = {
  messagesTotal: 0,
  emergenciesTotal: 0,
  callSessionsTotal: 0,
  startedAt: Date.now(),
  messageLatencyBuckets: [0, 10, 50, 100, 250, 500, 1000, 2000, 5000],
  messageLatencyCounts: {}, // bucket label -> count
  messageLatencySum: 0,
  messageLatencyCount: 0,
  spatialCandidatesExamined: 0,
  spatialCandidatesWithinRadius: 0,
  locationUpdatesReceived: 0,
  locationUpdatesProcessed: 0,
  locationUpdatesCoalesced: 0
};
metrics.messageLatencyBuckets.forEach(b => { metrics.messageLatencyCounts[b] = 0; });
metrics.messageLatencyCounts['+Inf'] = 0;

// ---------------------- Redis Client ----------------------
let redis = null;
let redisPub = null; // dedicated publisher (optional)
let redisSub = null; // subscription connection for horizontal broadcast
let redisDisabled = true; // Start disabled by default
let redisErrorCount = 0;

// Only enable Redis if explicitly configured
if (process.env.ENABLE_REDIS === 'true' && process.env.REDIS_URL) {
  try {
    redis = new Redis(CONFIG.REDIS_URL, {
      retryStrategy: (times) => {
        if (times > 3) {
          redisDisabled = true;
          logger.warn('redis_disabled_after_retries', { attempts: times });
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true
    });

    redisPub = redis;
    redisSub = new Redis(CONFIG.REDIS_URL, {
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true
    });

    const onErr = (tag) => (err) => {
      redisErrorCount++;
      logger.error('redis_error', { ctx: tag, err: err.message, count: redisErrorCount });
      if (redisErrorCount > 5 && !redisDisabled) {
        redisDisabled = true;
        logger.warn('redis_disabled_after_errors');
        try { redis.disconnect(false); } catch (_) { }
        try { redisSub.disconnect(false); } catch (_) { }
      }
    };

    redis.on('error', onErr('main'));
    redisSub.on('error', onErr('sub'));
    redis.on('connect', () => {
      redisDisabled = false;
      logger.info('redis_connected_main');
    });
    redisSub.on('connect', () => logger.info('redis_connected_sub'));

    // Try to connect
    Promise.all([redis.connect(), redisSub.connect()])
      .then(() => {
        // Subscribe to horizontal broadcast channel
        const CHANNEL = 'v2v:broadcast';
        redisSub.subscribe(CHANNEL, (err, count) => {
          if (err) {
            logger.error('redis_subscribe_fail', { err: err.message });
            redisDisabled = true;
          } else {
            logger.info('redis_subscribed', { count });
          }
        });
        redisSub.on('message', (channel, message) => {
          if (channel !== CHANNEL) return;
          try {
            const payload = JSON.parse(message);
            if (payload.origin === process.pid) return; // skip echoes from self
            // fan-out locally
            vehicles.forEach(v => safeSend(v.ws, payload.obj));
          } catch (e) {
            logger.warn('redis_broadcast_parse_fail', { e: e.message });
          }
        });
      })
      .catch((err) => {
        logger.error('redis_connection_failed', { err: err.message });
        redisDisabled = true;
        redis = null;
        redisSub = null;
        redisPub = null;
      });
  } catch (err) {
    logger.error('redis_init_failed', { err: err.message });
    redisDisabled = true;
    redis = null;
    redisSub = null;
    redisPub = null;
  }
} else {
  logger.info('redis_disabled', { reason: 'not_configured' });
}

async function persistPresence(vehicleId, data) {
  if (!redis || redisDisabled) return;
  try { await redis.hset(CONFIG.REDIS_PRESENCE_KEY, vehicleId, JSON.stringify(data)); } catch (e) { logger.warn('redis_presence_set_fail', { e: e.message }); }
}
async function removePresence(vehicleId) { if (!redis || redisDisabled) return; try { await redis.hdel(CONFIG.REDIS_PRESENCE_KEY, vehicleId); } catch (e) { logger.warn('redis_presence_del_fail', { e: e.message }); } }
async function persistMessage(record) { if (!redis || redisDisabled) return; try { await redis.rpush(CONFIG.REDIS_MESSAGES_KEY, JSON.stringify(record)); } catch (e) { logger.warn('redis_message_push_fail', { e: e.message }); } }

// ---------------------- Zod Schemas ----------------------
const RegisterSchema = z.object({ vehicleId: z.string().regex(/^[A-Za-z0-9._-]{3,40}$/), driverName: z.string().min(1).max(64).optional(), vehicleInfo: z.object({ licensePlate: z.string().optional(), model: z.string().optional(), color: z.string().optional() }).optional(), authToken: z.string().optional() });
const LocationSchema = z.object({ vehicleId: z.string(), lat: z.number().gte(-90).lte(90), lon: z.number().gte(-180).lte(180) });
const MessageSchema = z.object({ senderId: z.string(), recipientId: z.string(), content: z.string().min(1).max(512), messageType: z.enum(['text']).default('text'), sentTs: z.number().optional() });
const EmergencySchema = z.object({ senderId: z.string(), vehicleInfo: z.any().optional() });
const RelaySchema = z.object({ targetId: z.string(), sdp: z.any().optional(), callerId: z.string().optional(), calleeId: z.string().optional(), candidate: z.any().optional() });
// Consent connection schemas
const ConnectRequestSchema = z.object({ requesterId: z.string(), targetId: z.string(), purpose: z.string().max(128).optional() });
const ConnectResponseSchema = z.object({ requesterId: z.string(), targetId: z.string(), approved: z.boolean(), reason: z.string().max(128).optional() });
// Sync event schemas
const SyncDisconnectSchema = z.object({ fromVehicleId: z.string(), toVehicleId: z.string(), reason: z.string().optional(), timestamp: z.number().optional() });
const SyncEndCallSchema = z.object({ fromVehicleId: z.string(), toVehicleId: z.string(), reason: z.string().optional(), timestamp: z.number().optional() });

// ---------------------- Helper Functions ----------------------
function safeSend(ws, obj) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(obj)); } catch (err) { logger.warn('ws_send_error', { err: err.message }); }
}

function sendError(ws, code, message, details) {
  safeSend(ws, { event: 'error', data: { code, message, ts: Date.now(), details } });
}

function sanitize(str, max = 512) {
  if (typeof str !== 'string') return '';
  let cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (cleaned.length > max) cleaned = cleaned.slice(0, max);
  return cleaned;
}

// ---------------------- Rate Limiting (simple token bucket) ----------------------
const rateLimits = {
  location_update: { capacity: 5, intervalMs: 1000 },
  send_message: { capacity: 3, intervalMs: 1000 },
  signaling: { capacity: 2, intervalMs: 1000 },
  emergency_alert: { capacity: 1, intervalMs: 10000 }
};
const buckets = new Map(); // key vehicleId:event -> { tokens, lastRefill }
function allowEvent(vehicleId, type) {
  const cfg = rateLimits[type]; if (!cfg) return true;
  const key = vehicleId + ':' + type;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) { b = { tokens: cfg.capacity, lastRefill: now }; buckets.set(key, b); }
  const elapsed = now - b.lastRefill;
  if (elapsed > cfg.intervalMs) {
    const refillCount = Math.floor(elapsed / cfg.intervalMs);
    b.tokens = Math.min(cfg.capacity, b.tokens + refillCount * cfg.capacity);
    b.lastRefill = now;
  }
  if (b.tokens > 0) { b.tokens--; return true; }
  return false;
}

// Horizontal-scale aware broadcast: local fan-out + Redis pub (skeleton)
function broadcast(obj) {
  vehicles.forEach(v => safeSend(v.ws, obj));
  // Publish to other nodes (fire-and-forget)
  if (redisPub && !redisDisabled) {
    try { redisPub.publish('v2v:broadcast', JSON.stringify({ origin: process.pid, obj })); } catch (_) { }
  }
}

// --- Spatial Index (Geohash Buckets) ---
// Use geohash precision 6 (~0.6km height ~1.2km width near equator) suitable for 500m search radius.
// Each vehicle stored under its geohash; candidate set = hash + 8 neighbors.
const GEOHASH_PRECISION = 6;
const geoIndex = new Map(); // geohash -> Set(vehicleId)
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat, lon, precision = GEOHASH_PRECISION) {
  let idx = 0, bit = 0, evenBit = true, hash = '';
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  while (hash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon >= lonMid) { idx = idx * 2 + 1; lonMin = lonMid; } else { idx = idx * 2; lonMax = lonMid; }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) { idx = idx * 2 + 1; latMin = latMid; } else { idx = idx * 2; latMax = latMid; }
    }
    evenBit = !evenBit;
    bit++;
    if (bit === 5) { hash += BASE32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

// Neighbor calculation based on geohash adjacency tables
const NEIGHBORS = {
  even: {
    right: 'bc01fg45238967deuvhjyznpkmstqrwx',
    left: '238967debc01fg45kmstqrwxuvhjyznp',
    top: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy',
    bottom: '14365h7k9dcfesgujnmqp0r2twvyx8zb'
  },
  odd: {}
};
NEIGHBORS.odd = { // swap lat/lon orientation
  right: NEIGHBORS.even.top,
  left: NEIGHBORS.even.bottom,
  top: NEIGHBORS.even.right,
  bottom: NEIGHBORS.even.left
};
const BORDERS = {
  even: {
    right: 'bcfguvyz',
    left: '0145hjnp',
    top: 'prxz',
    bottom: '028b'
  },
  odd: {}
};
BORDERS.odd = {
  right: BORDERS.even.top,
  left: BORDERS.even.bottom,
  top: BORDERS.even.right,
  bottom: BORDERS.even.left
};

function adjacentGeohash(hash, dir) {
  if (!hash) return '';
  const last = hash[hash.length - 1];
  const type = (hash.length % 2) ? 'odd' : 'even';
  const base = hash.slice(0, -1);
  const border = BORDERS[type][dir];
  const neighborTable = NEIGHBORS[type][dir];
  let newBase = base;
  if (border.includes(last) && base) newBase = adjacentGeohash(base, dir);
  const pos = BASE32.indexOf(last);
  if (pos === -1) return hash; // unknown char
  const newChar = neighborTable[pos];
  return newBase + newChar;
}

function geohashNeighbors(hash) {
  const n = adjacentGeohash(hash, 'top');
  const s = adjacentGeohash(hash, 'bottom');
  const e = adjacentGeohash(hash, 'right');
  const w = adjacentGeohash(hash, 'left');
  const ne = adjacentGeohash(n, 'right');
  const nw = adjacentGeohash(n, 'left');
  const se = adjacentGeohash(s, 'right');
  const sw = adjacentGeohash(s, 'left');
  return [hash, n, s, e, w, ne, nw, se, sw].filter(Boolean);
}

function addToGeoIndex(v) {
  if (!v.location) return;
  const h = encodeGeohash(v.location.lat, v.location.lon);
  v._geohash = h;
  let set = geoIndex.get(h); if (!set) { set = new Set(); geoIndex.set(h, set); }
  set.add(v.vehicleId);
}

function moveInGeoIndex(v) {
  if (!v.location) return;
  const newHash = encodeGeohash(v.location.lat, v.location.lon);
  if (v._geohash === newHash) return; // same bucket
  if (v._geohash) {
    const oldSet = geoIndex.get(v._geohash);
    if (oldSet) { oldSet.delete(v.vehicleId); if (!oldSet.size) geoIndex.delete(v._geohash); }
  }
  v._geohash = newHash;
  let set = geoIndex.get(newHash); if (!set) { set = new Set(); geoIndex.set(newHash, set); }
  set.add(v.vehicleId);
}

function removeFromGeoIndex(v) {
  if (!v || !v._geohash) return;
  const set = geoIndex.get(v._geohash);
  if (set) { set.delete(v.vehicleId); if (!set.size) geoIndex.delete(v._geohash); }
  v._geohash = null;
}

function computeNearbyList(sourceVehicle) {
  if (!sourceVehicle.location) return [];
  const vehicleCount = vehicles.size;
  if (vehicleCount < 50) { // small set: linear scan
    const { lat, lon } = sourceVehicle.location;
    const arr = [];
    vehicles.forEach(v => {
      if (v.vehicleId === sourceVehicle.vehicleId || !v.location) return;
      const d = geolib.getDistance({ latitude: lat, longitude: lon }, { latitude: v.location.lat, longitude: v.location.lon });
      if (d <= CONFIG.NEARBY_RADIUS_METERS) arr.push({ vehicleId: v.vehicleId, driverName: v.driverName, distance: d, model: v.vehicleInfo?.model, color: v.vehicleInfo?.color });
    });
    return arr.sort((a, b) => a.distance - b.distance);
  }
  const selfHash = encodeGeohash(sourceVehicle.location.lat, sourceVehicle.location.lon);
  const hashes = geohashNeighbors(selfHash);
  const candidates = new Set();
  hashes.forEach(h => { const set = geoIndex.get(h); if (set) set.forEach(id => candidates.add(id)); });
  const { lat, lon } = sourceVehicle.location;
  const nearby = [];
  let examined = 0;
  candidates.forEach(id => {
    if (id === sourceVehicle.vehicleId) return;
    const v = vehicles.get(id);
    if (!v || !v.location) return;
    examined++;
    const d = geolib.getDistance({ latitude: lat, longitude: lon }, { latitude: v.location.lat, longitude: v.location.lon });
    if (d <= CONFIG.NEARBY_RADIUS_METERS) nearby.push({ vehicleId: id, driverName: v.driverName, distance: d, model: v.vehicleInfo?.model, color: v.vehicleInfo?.color });
  });
  metrics.spatialCandidatesExamined += examined;
  metrics.spatialCandidatesWithinRadius += nearby.length;
  return nearby.sort((a, b) => a.distance - b.distance);
}

// Temporary function to show ALL registered vehicles (for debugging)
function computeAllVehiclesList(sourceVehicle) {
  const arr = [];
  vehicles.forEach(v => {
    if (v.vehicleId === sourceVehicle.vehicleId) return; // Don't include self

    let distance = 'unknown';
    if (sourceVehicle.location && v.location) {
      distance = geolib.getDistance(
        { latitude: sourceVehicle.location.lat, longitude: sourceVehicle.location.lon },
        { latitude: v.location.lat, longitude: v.location.lon }
      );
    }

    arr.push({
      vehicleId: v.vehicleId,
      driverName: v.driverName,
      distance: distance,
      model: v.vehicleInfo?.model || 'Unknown Model',
      color: v.vehicleInfo?.color || 'Unknown Color',
      licensePlate: v.vehicleInfo?.licensePlate || null, // Include license plate
      hasLocation: !!v.location,
      location: v.location ? `${v.location.lat.toFixed(4)}, ${v.location.lon.toFixed(4)}` : 'No location',
      vehicleInfo: v.vehicleInfo || {} // Include full vehicle info for compatibility
    });
  });

  // Sort by distance if available, otherwise by name
  return arr.sort((a, b) => {
    if (typeof a.distance === 'number' && typeof b.distance === 'number') {
      return a.distance - b.distance;
    }
    return a.driverName.localeCompare(b.driverName);
  });
}

function publicVehicleInfo(v) {
  return {
    vehicleId: v.vehicleId,
    driverName: v.driverName,
    vehicleInfo: v.vehicleInfo,
    location: v.location,
    connectedAt: v.connectedAt
  };
}

// Compute checksum (uint16) of buffer bytes
function computeChecksum(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum = (sum + buf[i]) & 0xFFFF;
  return sum;
}

// ---------------------- Radio Bridge (Stub Implementation) ----------------------
/** Binary Protocol (enhanced framing):
 * Frame: [2B magic 0x56 0x32][1B version][1B type][1B senderShortId][1B recipientShortId or 0xFF broadcast][2B length][N payload][2B checksum]
 * - checksum = sum(all bytes after magic up to payload end) % 65535
 * - senderShortId maps to full vehicleId via radioIdRegistry
 * Types: 0x01 text, 0x02 emergency, 0x10 control
 */
const RADIO_MAGIC = Buffer.from([0x56, 0x32]);
const RADIO_VERSION = 0x01;
let nextRadioShortId = 1; // 1..254 (0 reserved, 255 broadcast)

function allocateRadioShortId(vehicleId) {
  for (let [shortId, vid] of radioIdRegistry.entries()) if (vid === vehicleId) return shortId;
  while (radioIdRegistry.has(nextRadioShortId)) nextRadioShortId = (nextRadioShortId % 254) + 1;
  radioIdRegistry.set(nextRadioShortId, vehicleId);
  return nextRadioShortId++;
}

function getVehicleIdFromShort(shortId) { return radioIdRegistry.get(shortId) || null; }
const RadioBridge = {
  enabled: CONFIG.RADIO_ENABLED,
  port: null,
  buffer: Buffer.alloc(0),
  init() {
    if (!this.enabled || !SerialPort) { logger.info('radio_init_skipped', { reason: 'disabled_or_missing_serialport' }); return; }
    try {
      this.port = new SerialPort({ path: CONFIG.RADIO_PORT, baudRate: CONFIG.RADIO_BAUD });
      this.port.on('open', () => logger.info('radio_port_open', { port: CONFIG.RADIO_PORT }));
      this.port.on('data', data => this.onData(data));
      this.port.on('error', err => logger.error('radio_port_error', { err: err.message }));
    } catch (err) { logger.error('radio_init_fail', { err: err.message }); this.enabled = false; }
  },
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      if (!this.buffer.slice(0, 2).equals(RADIO_MAGIC)) { // resync
        this.buffer = this.buffer.slice(1); continue;
      }
      if (this.buffer.length < 2 + 1 + 1 + 1 + 1 + 2) return; // wait header
      const version = this.buffer.readUInt8(2);
      const type = this.buffer.readUInt8(3);
      const senderShort = this.buffer.readUInt8(4);
      const recipientShort = this.buffer.readUInt8(5);
      const len = this.buffer.readUInt16BE(6);
      const total = 2 + 1 + 1 + 1 + 1 + 2 + len + 2;
      if (this.buffer.length < total) return; // wait full
      const payload = this.buffer.slice(10, 10 + len);
      const checksum = this.buffer.readUInt16BE(10 + len);
      const calc = computeChecksum(this.buffer.slice(2, 10 + len));
      const frame = this.buffer.slice(0, total);
      this.buffer = this.buffer.slice(total);
      if (checksum !== calc) { logger.warn('radio_checksum_mismatch'); continue; }
      this.handleFrame({ version, type, senderShort, recipientShort, payload });
    }
  },
  handleFrame({ type, senderShort, recipientShort, payload }) {
    const senderId = getVehicleIdFromShort(senderShort) || `radio-${senderShort}`;
    const recipientId = recipientShort === 0xFF ? null : getVehicleIdFromShort(recipientShort);
    const content = payload.toString('utf8');
    logger.info('radio_frame', { type, senderShort, recipientShort });
    if (type === 0x01) {
      if (recipientId && vehicles.has(recipientId)) {
        const rec = vehicles.get(recipientId);
        safeSend(rec.ws, { event: 'receive_message', data: { senderId, content, ts: Date.now(), via: 'radio' } });
      } else {
        broadcast({ event: 'radio_text', data: { from: senderId, content } });
      }
    } else if (type === 0x02) {
      broadcast({ event: 'emergency_alert', data: { senderId, message: content, via: 'radio' } });
    }
  },
  sendFrame({ type, senderId, recipientId, content }) {
    if (!this.enabled || !this.port) return false;
    const senderShort = allocateRadioShortId(senderId);
    const recipientShort = recipientId ? allocateRadioShortId(recipientId) : 0xFF;
    const payload = Buffer.from(content, 'utf8');
    const header = Buffer.alloc(2 + 1 + 1 + 1 + 1 + 2);
    RADIO_MAGIC.copy(header, 0);
    header.writeUInt8(RADIO_VERSION, 2);
    header.writeUInt8(type, 3);
    header.writeUInt8(senderShort, 4);
    header.writeUInt8(recipientShort, 5);
    header.writeUInt16BE(payload.length, 6);
    const checksum = computeChecksum(Buffer.concat([header.slice(2), payload]));
    const csumBuf = Buffer.alloc(2); csumBuf.writeUInt16BE(checksum, 0);
    const frame = Buffer.concat([header, payload, csumBuf]);
    try { this.port.write(frame); return true; } catch (err) { logger.error('radio_send_fail', { err: err.message }); return false; }
  }
};
RadioBridge.init();

// ---------------------- Express HTTP Layer ----------------------
const app = express();
// Apply deferred middleware first (requestId etc.)
if (deferredHttpMiddleware.length) {
  deferredHttpMiddleware.forEach(mw => app.use(mw));
}
app.use(express.json());
// Basic CORS enforcement using ALLOWED_ORIGINS env (comma-separated)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { return res.status(204).end(); }
  next();
});

let lastSupabaseCheck = { ts: 0, status: 'unknown' };
async function probeSupabase() {
  if (!persistence.ENABLED) return 'disabled';
  const now = Date.now();
  if (now - lastSupabaseCheck.ts < 5000) return lastSupabaseCheck.status; // cache 5s
  try {
    const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !key) { lastSupabaseCheck = { ts: now, status: 'disabled' }; return 'disabled'; }
    const url = new URL('/rest/v1/vehicles?select=id&limit=1', base);
    const r = await fetch(url.toString(), { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    lastSupabaseCheck = { ts: now, status: r.ok ? 'up' : 'down' };
  } catch { lastSupabaseCheck = { ts: now, status: 'down' }; }
  return lastSupabaseCheck.status;
}

app.get('/health', async (req, res) => {
  const supa = await probeSupabase();
  res.json({
    status: 'ok',
    vehicles: vehicles.size,
    radioEnabled: RadioBridge.enabled,
    redis: redis && !redisDisabled ? 'up' : 'down',
    supabase: supa,
    version: process.env.BUILD_VERSION || 'dev',
    buildTimestamp: process.env.BUILD_TIMESTAMP || null,
    timestamp: Date.now()
  });
});

// Prometheus style metrics exposition
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  const lines = [];
  lines.push('# HELP v2v_messages_total Total chat/text messages routed');
  lines.push('# TYPE v2v_messages_total counter');
  lines.push(`v2v_messages_total ${metrics.messagesTotal}`);
  lines.push('# HELP v2v_emergencies_total Total emergency alerts broadcast');
  lines.push('# TYPE v2v_emergencies_total counter');
  lines.push(`v2v_emergencies_total ${metrics.emergenciesTotal}`);
  lines.push('# HELP v2v_call_sessions_total Total call initiation events (not necessarily completed)');
  lines.push('# TYPE v2v_call_sessions_total counter');
  lines.push(`v2v_call_sessions_total ${metrics.callSessionsTotal}`);
  lines.push('# HELP v2v_active_vehicles Current number of connected vehicles');
  lines.push('# TYPE v2v_active_vehicles gauge');
  lines.push(`v2v_active_vehicles ${vehicles.size}`);
  lines.push('# HELP v2v_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE v2v_uptime_seconds gauge');
  lines.push(`v2v_uptime_seconds ${Math.floor((Date.now() - metrics.startedAt) / 1000)}`);
  lines.push('# HELP v2v_spatial_candidates_examined Total candidate vehicles examined in spatial index queries');
  lines.push('# TYPE v2v_spatial_candidates_examined counter');
  lines.push(`v2v_spatial_candidates_examined ${metrics.spatialCandidatesExamined}`);
  lines.push('# HELP v2v_spatial_candidates_within_radius Total candidates that were within nearby radius after filtering');
  lines.push('# TYPE v2v_spatial_candidates_within_radius counter');
  lines.push(`v2v_spatial_candidates_within_radius ${metrics.spatialCandidatesWithinRadius}`);
  lines.push('# HELP v2v_location_updates_received Raw location update events received (valid)');
  lines.push('# TYPE v2v_location_updates_received counter');
  lines.push(`v2v_location_updates_received ${metrics.locationUpdatesReceived}`);
  lines.push('# HELP v2v_location_updates_processed Location updates actually processed after coalescing');
  lines.push('# TYPE v2v_location_updates_processed counter');
  lines.push(`v2v_location_updates_processed ${metrics.locationUpdatesProcessed}`);
  lines.push('# HELP v2v_location_updates_coalesced Location update events collapsed/dropped by server coalescing');
  lines.push('# TYPE v2v_location_updates_coalesced counter');
  lines.push(`v2v_location_updates_coalesced ${metrics.locationUpdatesCoalesced}`);
  // Histogram exposition
  lines.push('# HELP v2v_message_delivery_latency_ms Message delivery latency (placeholder)');
  lines.push('# TYPE v2v_message_delivery_latency_ms histogram');
  let cumulative = 0;
  for (const b of metrics.messageLatencyBuckets) {
    cumulative += metrics.messageLatencyCounts[b];
    lines.push(`v2v_message_delivery_latency_ms_bucket{le="${b}"} ${cumulative}`);
  }
  cumulative += metrics.messageLatencyCounts['+Inf'];
  lines.push(`v2v_message_delivery_latency_ms_bucket{le="+Inf"} ${cumulative}`);
  lines.push(`v2v_message_delivery_latency_ms_sum ${metrics.messageLatencySum}`);
  lines.push(`v2v_message_delivery_latency_ms_count ${metrics.messageLatencyCount}`);
  res.send(lines.join('\n') + '\n');
});

app.get('/vehicles', (req, res) => {
  res.json({ vehicles: Array.from(vehicles.values()).map(publicVehicleInfo) });
});

app.get('/vehicles/:id', (req, res) => {
  const v = vehicles.get(req.params.id);
  if (!v) return res.status(404).json({ error: 'not_found' });
  res.json(publicVehicleInfo(v));
});

// --- Settings Proxy (skeleton) ---
// POST /user-settings { userId, key, value }
// In production: authenticate + authorize userId; use service key (server-side) & Row Level Security.
app.post('/user-settings', async (req, res) => {
  try {
    const { email, key, value } = req.body || {};
    if (!email || !key) return res.status(400).json({ error: 'invalid_payload' });
    const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;
    if (!base || !serviceKey) {
      logger.warn('settings_upsert_no_service_key');
      return res.status(503).json({ error: 'not_configured' });
    }
    const payload = [{ email, key, value, updated_at: new Date().toISOString() }];
    const resp = await fetch(`${base}/rest/v1/v2v_user_settings`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const text = await resp.text();
      logger.warn('settings_upsert_fail', { status: resp.status, text });
      return res.status(500).json({ error: 'upsert_failed', details: text });
    }
    logger.info('settings_upsert_ok', { email, key });
    return res.json({ status: 'ok' });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.get('/presence', (req, res) => {
  const now = Date.now();
  const list = Array.from(vehicles.values()).map(v => ({ vehicleId: v.vehicleId, lastHeartbeat: v.lastHeartbeat, lastSeenMsAgo: now - v.lastHeartbeat, geohash: v._geohash || null }));
  res.json({ count: list.length, vehicles: list });
});

// ---- Debug helpers (non-production) ----
if (process.env.ENABLE_DEBUG_ENDPOINTS === '1') {
  app.get('/debug/vehicles', (req, res) => {
    const data = Array.from(vehicles.values()).map(v => ({
      vehicleId: v.vehicleId,
      driverName: v.driverName,
      location: v.location,
      vehicleInfo: v.vehicleInfo,
      lastHeartbeat: v.lastHeartbeat,
      connectedAt: v.connectedAt
    }));
    res.json({ count: data.length, radiusMeters: CONFIG.NEARBY_RADIUS_METERS, vehicles: data });
  });
  app.post('/debug/location', (req, res) => {
    try {
      const { vehicleId, lat, lon } = req.body || {};
      if (!vehicleId || typeof lat !== 'number' || typeof lon !== 'number') return res.status(400).json({ error: 'invalid_payload' });
      const rec = vehicles.get(vehicleId);
      if (!rec) return res.status(404).json({ error: 'vehicle_not_found' });
      rec.location = { lat, lon, updatedAt: Date.now() };
      moveInGeoIndex(rec);
      // Recompute its nearby list and send immediate payload
      const nearby = computeNearbyList(rec);
      safeSend(rec.ws, { event: 'nearby_vehicles', data: { vehicles: nearby, radius: CONFIG.NEARBY_RADIUS_METERS, debug: true } });
      return res.json({ status: 'ok', vehicleId, lat, lon, nearbyCount: nearby.length });
    } catch (e) { return res.status(500).json({ error: 'server_error', message: e.message }); }
  });
  // List recent users (debug) GET /debug/users?limit=20
  app.get('/debug/users', async (req, res) => {
    if (!process.env.ENABLE_DEBUG_ENDPOINTS) return res.status(403).json({ error: 'disabled' });
    const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 100);
    const { base, serviceKey } = resolveSupabaseCreds();
    if (!base || !serviceKey) return res.status(500).json({ error: 'supabase_not_configured' });
    try {
      const url = `${base}/rest/v1/v2v_users?select=email,full_name,vehicle,created_at,updated_at&order=created_at.desc&limit=${limit}`;
      const resp = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!resp.ok) { const txt = await resp.text(); return res.status(500).json({ error: 'fetch_failed', details: txt }); }
      const data = await resp.json();
      return res.json({ count: data.length, users: data });
    } catch (e) { return res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // Debug locations endpoint
  app.get('/debug/locations', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
    const { base, serviceKey } = resolveSupabaseCreds();
    if (!base || !serviceKey) return res.status(500).json({ error: 'supabase_not_configured' });
    try {
      const url = `${base}/rest/v1/location_history?select=vehicle_id,lat,lon,created_at&order=created_at.desc&limit=${limit}`;
      const resp = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!resp.ok) { const txt = await resp.text(); return res.status(500).json({ error: 'fetch_failed', details: txt }); }
      const data = await resp.json();
      return res.json({ count: data.length, locations: data });
    } catch (e) { return res.status(500).json({ error: 'server_error', message: e.message }); }
  });

  // Debug config endpoint
  app.get('/debug/config', (req, res) => {
    res.json({
      nearbyRadius: CONFIG.NEARBY_RADIUS_METERS,
      supabaseEnabled: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      debugPersist: process.env.DEBUG_PERSIST === '1',
      radioEnabled: CONFIG.RADIO_ENABLED,
      redisEnabled: !redisDisabled,
      currentVehicles: vehicles.size,
      firebaseDisabled: process.env.DISABLE_FIREBASE_AUTH === '1'
    });
  });
}

function resolveSupabaseCreds() {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  // Prefer explicit server-side service key. Fallback to anon only in dev if service key absent.
  const rawService = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
  const serviceKey = rawService ? rawService.trim() : null;
  return { base, serviceKey };
}

// Basic Supabase-backed user registry upsert (email unique)
app.post('/user', async (req, res) => {
  try {
    const { email, fullName, vehicle, password } = req.body || {};
    if (!email) return res.status(400).json({ error: 'missing_email' });
    const { base, serviceKey } = resolveSupabaseCreds();
    if (!serviceKey || !base) {
      logger.warn('supabase_not_configured_upsert', { haveBase: !!base, haveKey: !!serviceKey });
      return res.status(500).json({ error: 'supabase_not_configured' });
    }
    const row = { email, updated_at: new Date().toISOString() };
    if (fullName !== undefined) row.full_name = fullName || null;
    if (vehicle !== undefined) row.vehicle = vehicle || null; // vehicle object with vehicleId, licensePlate, etc.
    if (password) {
      if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'weak_password' });
      try { row.password_hash = await bcrypt.hash(password, 10); } catch (e) { return res.status(500).json({ error: 'hash_failed' }); }
    }
    const payload = [row];
    logger.info('supabase_user_upsert_attempt', { email, hasVehicle: !!vehicle, base, hasServiceKey: !!serviceKey });
    console.log('DEBUG: About to fetch to:', `${base}/rest/v1/v2v_users`);
    console.log('DEBUG: Payload:', JSON.stringify(payload));
    console.log('DEBUG: Headers serviceKey length:', serviceKey ? serviceKey.length : 'null');

    const resp = await fetch(`${base}/rest/v1/v2v_users`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const txt = await resp.text();
      logger.warn('supabase_user_upsert_failed', { status: resp.status, txt });
      return res.status(500).json({ error: 'upsert_failed', details: txt });
    }
    logger.info('supabase_user_upsert_ok', { email });
    return res.json({ status: 'ok' });
  } catch (e) {
    console.error('DEBUG: Detailed error in /user endpoint:', e);
    logger.error('user_upsert_error', { error: e.message, stack: e.stack });
    return res.status(500).json({ error: 'server_error', message: e.message, details: e.toString() });
  }
});

// Update only vehicle details (PUT /user/vehicle { email, vehicle })
app.put('/user/vehicle', async (req, res) => {
  try {
    const { email, vehicle } = req.body || {};
    if (!email || !vehicle) return res.status(400).json({ error: 'missing_fields' });
    const { base, serviceKey } = resolveSupabaseCreds();
    if (!serviceKey || !base) return res.status(500).json({ error: 'supabase_not_configured' });
    const payload = [{ email, vehicle, updated_at: new Date().toISOString() }];
    const resp = await fetch(`${base}/rest/v1/v2v_users`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) { const txt = await resp.text(); return res.status(500).json({ error: 'update_failed', details: txt }); }
    return res.json({ status: 'ok' });
  } catch (e) { return res.status(500).json({ error: 'server_error', message: e.message }); }
});

// Fetch only vehicle details GET /user/vehicle?email=...
app.get('/user/vehicle', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'missing_email' });
    const { base, serviceKey } = resolveSupabaseCreds();
    if (!serviceKey || !base) return res.status(500).json({ error: 'supabase_not_configured' });
    const url = `${base}/rest/v1/v2v_users?email=eq.${encodeURIComponent(email)}&select=vehicle`;
    const resp = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!resp.ok) { const txt = await resp.text(); return res.status(500).json({ error: 'fetch_failed', details: txt }); }
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return res.status(404).json({ error: 'not_found' });
    return res.json({ vehicle: data[0].vehicle || null });
  } catch (e) { return res.status(500).json({ error: 'server_error', message: e.message }); }
});

// Fetch vehicle details by vehicleId from Supabase
app.get('/vehicle/:vehicleId', async (req, res) => {
  try {
    const vehicleId = req.params.vehicleId;
    if (!vehicleId) return res.status(400).json({ error: 'missing_vehicle_id' });

    const { base, serviceKey } = resolveSupabaseCreds();
    if (!serviceKey || !base) return res.status(500).json({ error: 'supabase_not_configured' });

    // Search for user with this vehicleId in their vehicle object
    const url = `${base}/rest/v1/v2v_users?select=vehicle&vehicle->>vehicleId=eq.${encodeURIComponent(vehicleId)}`;
    const resp = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(500).json({ error: 'fetch_failed', details: txt });
    }

    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'vehicle_not_found' });
    }

    return res.json({ vehicle: data[0].vehicle || null });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// Local email/password login using stored hash
app.post('/auth/login-local', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'missing_credentials' });
    const { base, serviceKey } = resolveSupabaseCreds();
    if (!serviceKey || !base) return res.status(500).json({ error: 'supabase_not_configured' });
    const url = `${base}/rest/v1/v2v_users?email=eq.${encodeURIComponent(email)}&select=email,full_name,vehicle,password_hash`;
    const resp = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!resp.ok) { const txt = await resp.text(); return res.status(500).json({ error: 'fetch_failed', details: txt }); }
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return res.status(401).json({ error: 'invalid_credentials' });
    const user = data[0];
    if (!user.password_hash) return res.status(401).json({ error: 'password_login_not_enabled' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'invalid_credentials' });
    const secret = process.env.JWT_SECRET || process.env.V2V_JWT_SECRET || 'dev-insecure-secret-change-me';
    if (secret.startsWith('dev-insecure-secret')) {
      logger.warn('using_default_jwt_secret');
    }
    const expiresInSeconds = 7 * 24 * 60 * 60; // 7 days
    const token = jwt.sign({ sub: email, email }, secret, { algorithm: 'HS256', expiresIn: expiresInSeconds });
    const isProd = process.env.NODE_ENV === 'production';
    try {
      res.cookie('v2v_session', token, { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: expiresInSeconds * 1000, path: '/' });
    } catch (_) { /* cookie setting failed (unlikely) */ }
    return res.json({ status: 'ok', user: { email: user.email, fullName: user.full_name, vehicle: user.vehicle }, token, expiresIn: expiresInSeconds });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// (Optional) session introspection route
app.get('/auth/session', (req, res) => {
  try {
    const token = (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) ? req.headers.authorization.slice(7) : (req.cookies && req.cookies.v2v_session);
    if (!token) return res.status(401).json({ error: 'no_token' });
    const secret = process.env.JWT_SECRET || process.env.V2V_JWT_SECRET || 'dev-insecure-secret-change-me';
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return res.json({ status: 'ok', session: decoded });
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token', message: e.message });
  }
});

// GET /user?email=... -> fetch user record
app.get('/user', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'missing_email' });
    const { base, serviceKey } = resolveSupabaseCreds();
    if (!base || !serviceKey) return res.status(500).json({ error: 'supabase_not_configured' });
    const url = `${base}/rest/v1/v2v_users?email=eq.${encodeURIComponent(email)}&select=email,full_name,vehicle,created_at,updated_at`;
    const resp = await fetch(url, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!resp.ok) { const txt = await resp.text(); return res.status(500).json({ error: 'fetch_failed', details: txt }); }
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return res.status(404).json({ error: 'not_found' });
    return res.json({ user: data[0] });
  } catch (e) { return res.status(500).json({ error: 'server_error', message: e.message }); }
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---------------------- WebSocket Layer ----------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: CONFIG.WS_PATH });
wss.on('headers', (headers, req) => {
  // Enforce Origin header for WS upgrade if provided
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    req.destroy();
  }
});

async function handleRegister(ws, data, authHeader) {
  const parsed = RegisterSchema.safeParse(data || {});
  if (!parsed.success) { sendError(ws, 'invalid_register', 'Invalid register payload', parsed.error.issues); return; }
  const { vehicleId, driverName, vehicleInfo, authToken } = parsed.data;
  const forceAuth = process.env.REQUIRE_AUTH === '1';
  if (firebaseAdmin || forceAuth) {
    const token = (authHeader || authToken || '').replace(/^[Bb]earer\s+/, '');
    if (!token) { sendError(ws, 'auth_failed', 'Missing auth token'); try { ws.close(); } catch (_) { } return; }
    if (firebaseAdmin) {
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        if (decoded.vehicleId && decoded.vehicleId !== vehicleId) { sendError(ws, 'auth_failed', 'Vehicle ID mismatch'); try { ws.close(); } catch (_) { } return; }
      } catch (e) { sendError(ws, 'auth_failed', 'Invalid auth token', { error: e.message }); try { ws.close(); } catch (_) { } return; }
    } else {
      // Test mode fallback: accept any non-empty token
    }
  }
  const record = {
    vehicleId,
    driverName: sanitize(driverName || 'Unknown', 64),
    vehicleInfo: vehicleInfo || {},
    ws,
    lastHeartbeat: Date.now(),
    location: null,
    connectedAt: Date.now()
  };
  vehicles.set(vehicleId, record);
  persistPresence(vehicleId, { driverName, vehicleInfo, connectedAt: record.connectedAt });
  // Add to spatial geohash index (added when first location arrives)
  // Fire and forget persistence
  persistence.upsertVehicle(record);
  logger.info('vehicle_registered', { vehicleId });
  safeSend(ws, { event: 'registered', data: { vehicleId } });
  broadcast({ event: 'presence_update', data: { vehicleId, status: 'online' } });
  broadcast({ event: 'presence_update', data: { vehicleId, status: 'online', lastSeen: Date.now() } });
}

function handleHeartbeat(ws, vehicleId) {
  const rec = vehicles.get(vehicleId);
  if (rec) {
    rec.lastHeartbeat = Date.now();
    safeSend(ws, { event: 'heartbeat_ack', data: { ts: Date.now() } });
  } else {
    safeSend(ws, { event: 'error', data: { message: 'unknown_vehicle' } });
  }
}

const locationCoalesce = new Map(); // vehicleId -> { lastProcessedTs, pending, timer }
function handleLocationUpdate(ws, data) {
  const parsed = LocationSchema.safeParse(data || {});
  if (!parsed.success) { sendError(ws, 'invalid_location', 'Invalid location payload', parsed.error.issues); return; }
  const { vehicleId, lat, lon } = parsed.data;
  const rec = vehicles.get(vehicleId);
  if (!rec) { sendError(ws, 'invalid_location', 'Vehicle not registered'); return; }
  metrics.locationUpdatesReceived++;
  let st = locationCoalesce.get(vehicleId);
  if (!st) { st = { lastProcessedTs: 0, pending: null, timer: null }; locationCoalesce.set(vehicleId, st); }
  // If there was already a pending update that hasn't flushed yet, this one will overwrite -> coalesced
  if (st.pending) metrics.locationUpdatesCoalesced++;
  st.pending = { lat, lon };
  const MIN_INTERVAL = 150; // ms ~6-7/sec server-side
  const now = Date.now();
  const elapsed = now - st.lastProcessedTs;
  const processLocation = () => {
    if (!st.pending) return;
    const { lat: plat, lon: plon } = st.pending;
    st.pending = null;
    rec.location = { lat: plat, lon: plon, updatedAt: Date.now() };
    if (process.env.DEBUG_NEARBY === '1' || process.env.DEBUG_LOCATIONS === '1') {
      logger.info('location_update_processed', { vehicleId: rec.vehicleId, lat: plat, lon: plon });
    }
    metrics.locationUpdatesProcessed++;
    rec.lastHeartbeat = Date.now();
    moveInGeoIndex(rec);
    persistence.insertLocation(rec.vehicleId, plat, plon);
    persistence.upsertVehicle(rec);
    const nearby = computeAllVehiclesList(rec); // TEMP: Show all vehicles instead of just nearby
    safeSend(ws, { event: 'nearby_vehicles', data: { vehicles: nearby, radius: 'ALL_VEHICLES', coalesced: true, debug: 'showing_all_registered_vehicles' } });
    try {
      const prevSet = lastNearbyMap.get(rec.vehicleId) || new Set();
      const currentSet = new Set(nearby.map(n => n.vehicleId));
      nearby.forEach(n => { if (!prevSet.has(n.vehicleId)) { const ev = { id: uuidv4(), vehicleId: rec.vehicleId, peerVehicleId: n.vehicleId, eventType: 'enter', distanceM: n.distance, ts: Date.now() }; safeSend(ws, { event: 'proximity_event', data: ev }); persistence.insertProximityEvent(ev); } });
      prevSet.forEach(peerId => { if (!currentSet.has(peerId)) { const ev = { id: uuidv4(), vehicleId: rec.vehicleId, peerVehicleId: peerId, eventType: 'exit', distanceM: null, ts: Date.now() }; safeSend(ws, { event: 'proximity_event', data: ev }); persistence.insertProximityEvent(ev); } });
      lastNearbyMap.set(rec.vehicleId, currentSet);
    } catch (e) { logger.warn('proximity_event_calc_fail', { e: e.message }); }
    vehicles.forEach(v => {
      if (v.vehicleId === rec.vehicleId || !v.location) return;
      try {
        const distance = geolib.getDistance(
          { latitude: rec.location.lat, longitude: rec.location.lon },
          { latitude: v.location.lat, longitude: v.location.lon }
        );
        if (distance <= CONFIG.NEARBY_RADIUS_METERS) {
          safeSend(v.ws, { event: 'peer_location', data: { vehicleId: rec.vehicleId, lat: rec.location.lat, lon: rec.location.lon, ts: Date.now(), coalesced: true } });
        }
      } catch (_) { }
    });
    st.lastProcessedTs = Date.now();
  };
  if (elapsed >= MIN_INTERVAL) {
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    processLocation();
  } else if (!st.timer) {
    st.timer = setTimeout(() => { st.timer = null; processLocation(); }, MIN_INTERVAL - elapsed);
  }
}

function routeMessage(ws, data) {
  const parsed = MessageSchema.safeParse(data || {});
  if (!parsed.success) { sendError(ws, 'validation_error', 'Invalid message payload', parsed.error.issues); return; }
  const { senderId, recipientId } = parsed.data;
  const content = sanitize(parsed.data.content, 512);
  const sentTs = parsed.data.sentTs && Number.isFinite(parsed.data.sentTs) ? parsed.data.sentTs : null;
  const nowTs = Date.now();
  const record = { id: uuidv4(), senderId, recipientId, content, ts: nowTs };
  persistMessage(record);
  persistence.insertMessage(record);
  metrics.messagesTotal++;
  const recipient = vehicles.get(recipientId);
  if (recipient) {
    safeSend(recipient.ws, { event: 'receive_message', data: record });
    const latency = sentTs ? Math.max(0, nowTs - sentTs) : 0;
    metrics.messageLatencySum += latency;
    metrics.messageLatencyCount++;
    let bucketRecorded = false;
    for (const b of metrics.messageLatencyBuckets) {
      if (latency <= b) { metrics.messageLatencyCounts[b]++; bucketRecorded = true; break; }
    }
    if (!bucketRecorded) metrics.messageLatencyCounts['+Inf']++;
  } else {
    // Attempt radio fallback
    RadioBridge.sendFrame({ type: 0x01, senderId: senderId, recipientId, content });
  }
}

function broadcastEmergency(ws, data) {
  const parsed = EmergencySchema.safeParse(data || {});
  if (!parsed.success) { sendError(ws, 'validation_error', 'Invalid emergency payload', parsed.error.issues); return; }
  const { senderId, vehicleInfo } = parsed.data;
  const alert = { id: uuidv4(), senderId, vehicleInfo, ts: Date.now() };
  broadcast({ event: 'emergency_alert', data: alert });
  persistence.insertEmergency(alert);
  metrics.emergenciesTotal++;
  RadioBridge.sendFrame({ type: 0x02, senderId: senderId || '00000000-0000-0000-0000-000000000000', recipientId: null, content: 'EMERGENCY' });
}

function relay(ws, data, type) {
  const parsed = RelaySchema.safeParse(data || {});
  if (!parsed.success) return safeSend(ws, { event: 'error', data: { message: 'invalid_relay', type } });
  const { targetId } = parsed.data;
  const target = vehicles.get(targetId);
  if (!target) return safeSend(ws, { event: 'error', data: { message: 'target_offline', type } });
  safeSend(target.ws, { event: type, data: parsed.data });
}

wss.on('connection', ws => {
  const sessionId = uuidv4();
  const wsLogger = withContext('core', { sessionId });
  const wsAuth = withContext('auth', { sessionId });
  const wsSig = withContext('signaling', { sessionId });
  const wsProx = withContext('proximity', { sessionId });
  wsLogger.info('ws_connection');
  safeSend(ws, { event: 'connected', data: { ts: Date.now(), sessionId } });
  let boundVehicleId = null;
  const authHeader = ws._socket?.parser?.incoming?.headers?.authorization || null;

  ws.on('message', (raw, isBinary) => {
    if (isBinary) return; // binary handling reserved for future voice bytes if ever routed here
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const { event, data } = msg || {};

    switch (event) {
      case 'register':
        handleRegister(ws, data, authHeader).then(() => { boundVehicleId = data?.vehicleId || boundVehicleId; wsAuth.info('register_event', { vehicleId: boundVehicleId }); });
        break;
      case 'heartbeat':
        if (boundVehicleId) handleHeartbeat(ws, boundVehicleId); break;
      case 'location_update':
        if (boundVehicleId && !allowEvent(boundVehicleId, 'location_update')) { sendError(ws, 'rate_limited', 'Too many location updates', { retryAfterMs: 1000 }); break; }
        handleLocationUpdate(ws, data); break;
      case 'send_message':
        if (boundVehicleId && !allowEvent(boundVehicleId, 'send_message')) { sendError(ws, 'rate_limited', 'Message rate exceeded'); break; }
        routeMessage(ws, data); wsSig.info('message_sent'); break;
      case 'emergency_alert':
        if (boundVehicleId && !allowEvent(boundVehicleId, 'emergency_alert')) { sendError(ws, 'rate_limited', 'Emergency alert rate exceeded'); break; }
        broadcastEmergency(ws, data); wsSig.info('emergency_alert'); break;
      case 'connect_request': {
        const parsed = ConnectRequestSchema.safeParse(data || {});
        if (!parsed.success) { sendError(ws, 'invalid_connect_request', 'Invalid connect request'); break; }
        const { requesterId, targetId, purpose } = parsed.data;
        const target = vehicles.get(targetId);
        if (!target) { sendError(ws, 'target_offline', 'Target offline'); break; }
        const key = `${requesterId}->${targetId}`;
        pendingConsents.set(key, { requestedAt: Date.now(), purpose: purpose || null });
        safeSend(target.ws, { event: 'connect_request', data: { requesterId, targetId, purpose, ts: Date.now() } });
        wsSig.info('connect_request', { requesterId, targetId });
        break;
      }
      case 'connect_response': {
        const parsed = ConnectResponseSchema.safeParse(data || {});
        if (!parsed.success) { sendError(ws, 'invalid_connect_response', 'Invalid connect response'); break; }
        const { requesterId, targetId, approved, reason } = parsed.data;
        const key = `${requesterId}->${targetId}`;
        const pending = pendingConsents.get(key);
        const requester = vehicles.get(requesterId);
        if (!pending || !requester) { sendError(ws, 'no_pending_request', 'No pending request'); break; }
        pendingConsents.delete(key);
        safeSend(requester.ws, { event: 'connect_response', data: { requesterId, targetId, approved, reason, ts: Date.now() } });
        wsSig.info('connect_response', { requesterId, targetId, approved });
        break;
      }
      // WebRTC signaling
      case 'call_initiate':
        if (boundVehicleId && !allowEvent(boundVehicleId, 'signaling')) { sendError(ws, 'rate_limited', 'Signaling rate exceeded'); break; }
        metrics.callSessionsTotal++;
        // Handle call_initiate specially - don't use relay function
        if (data?.callerId && data?.calleeId) {
          const target = vehicles.get(data.calleeId);
          if (target) {
            safeSend(target.ws, { event: 'call_initiate', data });
            console.log(`📞 Relayed call_initiate from ${data.callerId} to ${data.calleeId}`);
          } else {
            safeSend(ws, { event: 'error', data: { message: 'target_offline', type: 'call_initiate' } });
          }
        } else {
          safeSend(ws, { event: 'error', data: { message: 'invalid_call_initiate', type: 'call_initiate' } });
        }
        try {
          if (data?.callerId && data?.calleeId) {
            const cs = { id: uuidv4(), callerId: data.callerId, calleeId: data.calleeId, state: 'ringing', startedAt: Date.now() };
            callSessions.set(cs.id, cs);
            persistence.insertCallSession(cs);
          }
        } catch (_) { }
        wsSig.info('call_initiate'); break;
      case 'webrtc_offer':
        if (boundVehicleId && !allowEvent(boundVehicleId, 'signaling')) { sendError(ws, 'rate_limited', 'Signaling rate exceeded'); break; }
        relay(ws, data, 'webrtc_offer'); wsSig.info('webrtc_offer'); break;
      case 'webrtc_answer':
        if (boundVehicleId && !allowEvent(boundVehicleId, 'signaling')) { sendError(ws, 'rate_limited', 'Signaling rate exceeded'); break; }
        relay(ws, data, 'webrtc_answer');
        try {
          // Find ringing session for this pair
          for (let cs of callSessions.values()) {
            if (cs.callerId === data?.callerId && cs.calleeId === data?.calleeId && cs.state === 'ringing') {
              cs.state = 'active'; cs.answeredAt = Date.now();
              persistence.updateCallSession(cs); break;
            }
          }
        } catch (_) { }
        wsSig.info('webrtc_answer'); break;
      case 'ice_candidate':
        if (boundVehicleId && !allowEvent(boundVehicleId, 'signaling')) { sendError(ws, 'rate_limited', 'Signaling rate exceeded'); break; }
        // Coalesce burst of ICE candidates: small delay queue per connection would be ideal.
        relay(ws, data, 'ice_candidate'); wsSig.info('ice_candidate'); break;
      case 'sync_disconnect': {
        const parsed = SyncDisconnectSchema.safeParse(data || {});
        if (!parsed.success) { sendError(ws, 'invalid_sync_disconnect', 'Invalid sync disconnect data'); break; }
        const { fromVehicleId, toVehicleId, reason, timestamp } = parsed.data;
        const targetVehicle = vehicles.get(toVehicleId);
        if (!targetVehicle) { sendError(ws, 'target_offline', 'Target vehicle not found'); break; }
        if (targetVehicle.ws && targetVehicle.ws.readyState === WebSocket.OPEN) {
          safeSend(targetVehicle.ws, {
            event: 'sync_disconnect',
            data: { fromVehicleId, toVehicleId, reason: reason || 'peer_disconnect', timestamp: timestamp || Date.now() }
          });
          logger.info('sync_disconnect_relayed', { from: fromVehicleId, to: toVehicleId, reason });
        }
        break;
      }
      case 'sync_end_call': {
        const parsed = SyncEndCallSchema.safeParse(data || {});
        if (!parsed.success) { sendError(ws, 'invalid_sync_end_call', 'Invalid sync end call data'); break; }
        const { fromVehicleId, toVehicleId, reason, timestamp } = parsed.data;
        const targetVehicle = vehicles.get(toVehicleId);
        if (!targetVehicle) { sendError(ws, 'target_offline', 'Target vehicle not found'); break; }
        if (targetVehicle.ws && targetVehicle.ws.readyState === WebSocket.OPEN) {
          safeSend(targetVehicle.ws, {
            event: 'sync_end_call',
            data: { fromVehicleId, toVehicleId, reason: reason || 'peer_ended', timestamp: timestamp || Date.now() }
          });
          logger.info('sync_end_call_relayed', { from: fromVehicleId, to: toVehicleId, reason });
        }
        break;
      }
      default:
        // Provide better context back to client for debugging
        sendError(ws, 'unknown_event', 'Unsupported event', { event, known: ['register', 'heartbeat', 'location_update', 'send_message', 'emergency_alert', 'connect_request', 'connect_response', 'call_initiate', 'webrtc_offer', 'webrtc_answer', 'ice_candidate', 'sync_disconnect', 'sync_end_call'] });
    }
  });

  ws.on('close', () => {
    if (boundVehicleId && vehicles.has(boundVehicleId)) {
      vehicles.delete(boundVehicleId);
      removePresence(boundVehicleId);
      // Remove from geohash index
      try { const rec = vehicles.get(boundVehicleId); if (rec) removeFromGeoIndex(rec); } catch (_) { }
      persistence.markOffline(boundVehicleId);
      broadcast({ event: 'presence_update', data: { vehicleId: boundVehicleId, status: 'offline', lastSeen: Date.now() } });
      logger.info('vehicle_disconnected', { vehicleId: boundVehicleId });
      // End any active/ringing call sessions involving this vehicle
      for (let cs of callSessions.values()) {
        if ((cs.callerId === boundVehicleId || cs.calleeId === boundVehicleId) && !cs.endedAt) {
          cs.state = 'ended'; cs.endedAt = Date.now(); cs.endReason = 'disconnect';
          persistence.updateCallSession(cs);
        }
      }
    }
  });

  ws.on('error', err => wsLogger.error('ws_error', { err: err.message }));
});

// ---------------------- Maintenance Tasks ----------------------
setInterval(() => {
  const now = Date.now();
  const timeout = CONFIG.HEARTBEAT_TIMEOUT_MS;
  vehicles.forEach((v, id) => {
    if (now - v.lastHeartbeat > timeout) {
      logger.warn('vehicle_heartbeat_timeout', { vehicleId: id });
      try { v.ws.close(); } catch (_) { }
      vehicles.delete(id);
      broadcast({ event: 'presence_update', data: { vehicleId: id, status: 'timeout' } });
    }
  });
}, CONFIG.STALE_SWEEP_INTERVAL_MS);

setInterval(() => {
  vehicles.forEach(v => {
    if (v.location) {
      const nearby = computeAllVehiclesList(v); // TEMP: Show all vehicles instead of just nearby
      safeSend(v.ws, { event: 'nearby_vehicles', data: { vehicles: nearby, periodic: true, debug: 'showing_all_registered_vehicles' } });
      // Periodic diff for robustness (in case of missed updates)
      try {
        const prevSet = lastNearbyMap.get(v.vehicleId) || new Set();
        const currentSet = new Set(nearby.map(n => n.vehicleId));
        nearby.forEach(n => { if (!prevSet.has(n.vehicleId)) { const ev = { id: uuidv4(), vehicleId: v.vehicleId, peerVehicleId: n.vehicleId, eventType: 'enter', distanceM: n.distance, ts: Date.now() }; safeSend(v.ws, { event: 'proximity_event', data: ev }); persistence.insertProximityEvent(ev); } });
        prevSet.forEach(peerId => { if (!currentSet.has(peerId)) { const ev = { id: uuidv4(), vehicleId: v.vehicleId, peerVehicleId: peerId, eventType: 'exit', distanceM: null, ts: Date.now() }; safeSend(v.ws, { event: 'proximity_event', data: ev }); persistence.insertProximityEvent(ev); } });
        lastNearbyMap.set(v.vehicleId, currentSet);
      } catch (_) { }
    }
  });
}, CONFIG.PROXIMITY_RECALC_INTERVAL_MS);

// ---------------------- Start Server ----------------------
if (!process.env.V2V_EMBEDDED) {
  server.listen(CONFIG.PORT, () => {
    logger.info('server_started', { port: CONFIG.PORT, wsPath: CONFIG.WS_PATH });
  });
}

module.exports = { server, wss, vehicles, callSessions, metrics, CONFIG };
