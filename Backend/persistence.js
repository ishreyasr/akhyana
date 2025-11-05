/**
 * Lightweight Supabase persistence via REST endpoints (no ESM import needed).
 * Falls back gracefully if env vars not set or requests fail.
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim() || null;
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim() || null;
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim() || null;
const AUTH_KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

const ENABLED = !!(SUPABASE_URL && AUTH_KEY);
if (!ENABLED) {
  console.warn('[persistence] supabase disabled (missing URL or anon key)');
} else {
  console.log('[persistence] supabase enabled', { base: SUPABASE_URL });
}

async function restInsert(table, rows, { upsert = false } = {}) {
  if (!ENABLED) return { skipped: true };
  try {
    const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
    if (upsert) url.searchParams.set('on_conflict', 'id');
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'apikey': AUTH_KEY,
        'Authorization': `Bearer ${AUTH_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': upsert ? 'resolution=merge-duplicates' : 'return=minimal'
      },
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
    });
    if (!res.ok) {
      const txt = await res.text();
      const preview = JSON.stringify(rows).slice(0, 120);
      console.warn('supabase_insert_fail', { table, status: res.status, preview, details: txt.slice(0, 200) });
      return { error: true, status: res.status };
    }
    if (process.env.DEBUG_PERSIST === '1') {
      const preview = JSON.stringify(rows).slice(0, 120);
      console.log('supabase_insert_ok', { table, upsert, preview });
    }
    return { ok: true };
  } catch (e) {
    const preview = JSON.stringify(rows).slice(0, 120);
    console.warn('supabase_insert_error', { table, err: e.message, preview });
    return { error: true };
  }
}

async function upsertVehicle(v) {
  return restInsert('vehicles', {
    id: v.vehicleId,
    name: v.vehicleInfo?.model || v.vehicleId,
    driver_name: v.driverName,
    license_plate: v.vehicleInfo?.licensePlate,
    model: v.vehicleInfo?.model,
    color: v.vehicleInfo?.color,
    last_lat: v.location?.lat,
    last_lon: v.location?.lon,
    last_heading: null,
    last_speed: null,
    online: true,
    updated_at: new Date().toISOString()
  }, { upsert: true });
}

async function insertLocation(vehicleId, lat, lon, extra = {}) {
  return restInsert('location_history', {
    vehicle_id: vehicleId,
    lat, lon,
    heading: extra.heading ?? null,
    speed: extra.speed ?? null,
    accuracy: extra.accuracy ?? null
  });
}

async function insertMessage(msg) {
  return restInsert('messages', {
    id: msg.id,
    sender_id: msg.senderId,
    recipient_id: msg.recipientId,
    content: msg.content,
    message_type: msg.messageType || 'text',
    created_at: new Date(msg.ts || Date.now()).toISOString()
  });
}

async function insertEmergency(alert) {
  return restInsert('emergency_alerts', {
    id: alert.id,
    vehicle_id: alert.senderId,
    alert_type: 'generic',
    severity: 1,
    details: alert.vehicleInfo ? JSON.stringify(alert.vehicleInfo) : null,
    created_at: new Date(alert.ts || Date.now()).toISOString()
  });
}

async function insertCallSession(session) {
  return restInsert('call_sessions', {
    id: session.id,
    caller_id: session.callerId,
    callee_id: session.calleeId,
    state: session.state,
    started_at: new Date(session.startedAt).toISOString(),
    answered_at: session.answeredAt ? new Date(session.answeredAt).toISOString() : null,
    ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : null,
    last_signal_at: new Date().toISOString(),
    end_reason: session.endReason || null
  });
}

async function updateCallSession(session) { return insertCallSession(session); }

async function insertProximityEvent(ev) {
  return restInsert('proximity_events', {
    id: ev.id,
    vehicle_id: ev.vehicleId,
    peer_vehicle_id: ev.peerVehicleId,
    event_type: ev.eventType,
    distance_m: ev.distanceM,
    occurred_at: new Date(ev.ts || Date.now()).toISOString()
  });
}

async function markOffline(vehicleId) {
  if (!ENABLED) return;
  try {
    // Minimal patch update using RPC not defined; fallback to upsert with online=false
    await restInsert('vehicles', [{ id: vehicleId, online: false, updated_at: new Date().toISOString() }], { upsert: true });
  } catch (_) { }
}

module.exports = {
  ENABLED,
  upsertVehicle,
  insertLocation,
  insertMessage,
  insertEmergency,
  insertCallSession,
  updateCallSession,
  insertProximityEvent,
  markOffline
};
