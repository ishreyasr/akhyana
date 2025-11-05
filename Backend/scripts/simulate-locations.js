#!/usr/bin/env node
/**
 * Quick simulation: register two vehicles and stream a couple of location updates
 * Requires server running locally on port 3002.
 * Usage: node simulate-locations.js
 */
const WebSocket = require('ws');

function connect(id, coords) {
  const ws = new WebSocket('ws://localhost:3002/v2v');
  ws.on('open', () => {
    ws.send(JSON.stringify({ event: 'register', data: { vehicleId: id, driverName: id, vehicleInfo: { model: 'Sim', color: 'blue' } } }));
    setTimeout(() => {
      coords.forEach((c, idx) => setTimeout(() => {
        ws.send(JSON.stringify({ event: 'location_update', data: { vehicleId: id, lat: c[0], lon: c[1] } }));
      }, 400 * (idx + 1)));
    }, 300);
  });
  ws.on('message', m => {
    try { const msg = JSON.parse(m.toString()); if (msg.event === 'nearby_vehicles') console.log(id, 'nearby:', msg.data); } catch (_) { }
  });
}

// Two vehicles ~50m apart in SF
connect('sim-A', [[37.7749, -122.4194], [37.7750, -122.4195]]);
connect('sim-B', [[37.7752, -122.4196], [37.7753, -122.4197]]);
