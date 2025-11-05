#!/usr/bin/env node
/**
 * End-to-end HTTP & minimal WS smoke test.
 * Prereq: server running on localhost:3002 and Supabase env configured.
 */
const fetch = global.fetch || require('node-fetch');
const WebSocket = require('ws');

async function main() {
  const base = 'http://localhost:3002';
  const ts = Date.now();
  const email = `test_${ts}@example.com`;
  const password = 'testpass1';
  console.log('--- Create User');
  let r = await fetch(base + '/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, fullName: 'Tester ' + ts, password }) });
  console.log('status', r.status, await r.text());

  console.log('--- Login');
  r = await fetch(base + '/auth/login-local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const login = await r.json();
  console.log('login', r.status, login.status);

  console.log('--- Upsert Vehicle in user record');
  r = await fetch(base + '/user/vehicle', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, vehicle: { vehicleId: 'veh-' + ts, model: 'DemoCar', color: 'red' } }) });
  console.log('vehicle upsert', r.status, await r.text());

  console.log('--- Get User');
  r = await fetch(base + `/user?email=${encodeURIComponent(email)}`);
  console.log('get user', r.status, await r.text());

  console.log('--- User Settings Upsert');
  r = await fetch(base + '/user-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, key: 'theme', value: { theme: 'dark' } }) });
  console.log('settings upsert', r.status, await r.text());

  console.log('--- WebSocket register + location + message');
  await new Promise(resolve => {
    const ws = new WebSocket('ws://localhost:3002/v2v');
    ws.on('open', () => {
      ws.send(JSON.stringify({ event: 'register', data: { vehicleId: 'veh-' + ts, driverName: 'Driver ' + ts, vehicleInfo: { model: 'DemoCar', color: 'red' } } }));
      setTimeout(() => ws.send(JSON.stringify({ event: 'location_update', data: { vehicleId: 'veh-' + ts, lat: 37.7749, lon: -122.4194 } })), 300);
      setTimeout(() => ws.send(JSON.stringify({ event: 'send_message', data: { senderId: 'veh-' + ts, recipientId: 'veh-' + ts, content: 'Self test' } })), 600);
      setTimeout(() => ws.close(), 1200);
    });
    ws.on('message', m => { try { const msg = JSON.parse(m.toString()); console.log('WS<-', msg.event); } catch (_) { } });
    ws.on('close', () => resolve());
  });

  console.log('DONE');
}

main().catch(e => { console.error(e); process.exit(1); });