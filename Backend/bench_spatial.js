#!/usr/bin/env node
// Quick synthetic benchmark for spatial index vs naive scan
const geolib = require('geolib');
const { performance } = require('perf_hooks');

const RADIUS = 500; // meters
const VEHICLE_COUNTS = [1000, 5000];

function randomLatLon() {
    // Rough bounding box around (0,0) small area ~1 deg
    return { lat: (Math.random() - 0.5) * 0.5, lon: (Math.random() - 0.5) * 0.5 };
}

function buildVehicles(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
        const { lat, lon } = randomLatLon();
        arr.push({ vehicleId: 'v' + i, location: { lat, lon } });
    }
    return arr;
}

function naive(vehicles, idx) {
    const src = vehicles[idx];
    const { lat, lon } = src.location;
    const res = [];
    for (const v of vehicles) {
        if (v === src || !v.location) continue;
        const d = geolib.getDistance({ latitude: lat, longitude: lon }, { latitude: v.location.lat, longitude: v.location.lon });
        if (d <= RADIUS) res.push(v.vehicleId);
    }
    return res;
}

// Geohash spatial index replicate (precision 6)
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function encodeGeohash(lat, lon, precision = 6) {
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
function buildNeighborTables() {
    const NEIGHBORS = { even: { right: 'bc01fg45238967deuvhjyznpkmstqrwx', left: '238967debc01fg45kmstqrwxuvhjyznp', top: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy', bottom: '14365h7k9dcfesgujnmqp0r2twvyx8zb' } };
    NEIGHBORS.odd = { right: NEIGHBORS.even.top, left: NEIGHBORS.even.bottom, top: NEIGHBORS.even.right, bottom: NEIGHBORS.even.left };
    const BORDERS = { even: { right: 'bcfguvyz', left: '0145hjnp', top: 'prxz', bottom: '028b' } };
    BORDERS.odd = { right: BORDERS.even.top, left: BORDERS.even.bottom, top: BORDERS.even.right, bottom: BORDERS.even.left };
    return { NEIGHBORS, BORDERS };
}
const { NEIGHBORS, BORDERS } = buildNeighborTables();
function adjacent(hash, dir) {
    const last = hash[hash.length - 1];
    const type = (hash.length % 2) ? 'odd' : 'even';
    const base = hash.slice(0, -1);
    const border = BORDERS[type][dir];
    const table = NEIGHBORS[type][dir];
    let newBase = base;
    if (border.includes(last) && base) newBase = adjacent(base, dir);
    const pos = BASE32.indexOf(last);
    if (pos === -1) return hash;
    return newBase + table[pos];
}
function neighbors(hash) {
    const n = adjacent(hash, 'top');
    const s = adjacent(hash, 'bottom');
    const e = adjacent(hash, 'right');
    const w = adjacent(hash, 'left');
    const ne = adjacent(n, 'right');
    const nw = adjacent(n, 'left');
    const se = adjacent(s, 'right');
    const sw = adjacent(s, 'left');
    return [hash, n, s, e, w, ne, nw, se, sw];
}
function GeoHashIndex() { this.map = new Map(); }
GeoHashIndex.prototype.add = function (v) { const h = encodeGeohash(v.location.lat, v.location.lon); v._h = h; let set = this.map.get(h); if (!set) { set = new Set(); this.map.set(h, set); } set.add(v); };
GeoHashIndex.prototype.query = function (src) { const h = encodeGeohash(src.location.lat, src.location.lon); const cands = new Set(); neighbors(h).forEach(k => { const set = this.map.get(k); if (set) set.forEach(v => cands.add(v)); }); const out = []; cands.forEach(v => { if (v === src) return; const d = geolib.getDistance({ latitude: src.location.lat, longitude: src.location.lon }, { latitude: v.location.lat, longitude: v.location.lon }); if (d <= RADIUS) out.push(v.vehicleId); }); return out; };

function run() {
    VEHICLE_COUNTS.forEach(n => {
        const vehicles = buildVehicles(n);
        const index = new GeoHashIndex(); vehicles.forEach(v => index.add(v));
        const sampleIndices = Array.from({ length: 30 }, () => Math.floor(Math.random() * n));

        const t0 = performance.now();
        sampleIndices.forEach(i => naive(vehicles, i));
        const t1 = performance.now();

        const t2 = performance.now();
        sampleIndices.forEach(i => index.query(vehicles[i]));
        const t3 = performance.now();

        console.log(JSON.stringify({ vehicles: n, naiveMs: (t1 - t0).toFixed(2), indexedMs: (t3 - t2).toFixed(2), speedup: ((t1 - t0) / (t3 - t2)).toFixed(2) }));
    });
}

run();
