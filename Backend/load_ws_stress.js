#!/usr/bin/env node
/**
 * Simple WebSocket load script (autocannon-lite) using native ws clients.
 * Generates N vehicles each sending location updates at a rate (with coalescing).
 * Metrics: total messages sent, duration, approximate updates/sec processed.
 */
const WebSocket = require('ws');
const { CONFIG } = require('./server');

const VEHICLES = parseInt(process.env.LT_VEHICLES || '50', 10);
const DURATION_MS = parseInt(process.env.LT_DURATION_MS || '10000', 10);
const UPDATE_INTERVAL_MS = parseInt(process.env.LT_UPDATE_INTERVAL_MS || '120', 10);

const url = `ws://127.0.0.1:${CONFIG.PORT}${CONFIG.WS_PATH}`;
let sent = 0;
let connected = 0;
const sockets = [];

function jitter(base) { return base + (Math.random() * 20 - 10); }

for (let i = 0; i < VEHICLES; i++) {
    const id = `load-${i}`;
    const ws = new WebSocket(url);
    ws.on('open', () => {
        ws.send(JSON.stringify({ event: 'register', data: { vehicleId: id } }));
    });
    ws.on('message', m => {
        try { const msg = JSON.parse(m.toString()); if (msg.event === 'registered') { connected++; schedule(id, ws); } } catch { }
    });
    sockets.push(ws);
}

function schedule(id, ws) {
    let lat = 37.77 + Math.random() * 0.01;
    let lon = -122.41 + Math.random() * 0.01;
    const timer = setInterval(() => {
        if (ws.readyState !== ws.OPEN) { clearInterval(timer); return; }
        lat += (Math.random() - 0.5) * 0.0003;
        lon += (Math.random() - 0.5) * 0.0003;
        ws.send(JSON.stringify({ event: 'location_update', data: { vehicleId: id, lat, lon } }));
        sent++;
    }, jitter(UPDATE_INTERVAL_MS));
}

setTimeout(() => {
    console.log(JSON.stringify({ phase: 'ramp_complete', connected }));
}, 1500);

setTimeout(() => {
    sockets.forEach(s => { try { s.close(); } catch (_) { } });
    console.log(JSON.stringify({ phase: 'done', vehicles: VEHICLES, durationMs: DURATION_MS, sent }));
    const ups = (sent / (DURATION_MS / 1000)).toFixed(1);
    console.log(JSON.stringify({ metric: 'updates_per_sec', value: ups }));
    process.exit(0);
}, DURATION_MS);
