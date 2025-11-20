#!/usr/bin/env node
/**
 * Simple WebSocket test without extra complexity
 */
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3002/v2v');

ws.on('open', () => {
  console.log('Connected to WebSocket');

  // Register without auth token since we disabled Firebase
  ws.send(JSON.stringify({
    event: 'register',
    data: {
      vehicleId: 'test-simple',
      driverName: 'Test Driver',
      vehicleInfo: { model: 'TestCar', color: 'red' }
    }
  }));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('Received:', msg.event, msg.data);

    if (msg.event === 'registered') {
      console.log('Registration successful, sending location...');
      setTimeout(() => {
        console.log('Sending location update...');
        ws.send(JSON.stringify({
          event: 'location_update',
          data: {
            vehicleId: 'test-simple',
            lat: 37.7749,
            lon: -122.4194
          }
        }));
      }, 500);

      setTimeout(() => {
        console.log('Sending second location update...');
        ws.send(JSON.stringify({
          event: 'location_update',
          data: {
            vehicleId: 'test-simple',
            lat: 37.7750,
            lon: -122.4195
          }
        }));
      }, 1000);

      setTimeout(() => {
        ws.close();
      }, 3000);
    }

    if (msg.event === 'nearby_vehicles') {
      console.log('✓ Nearby vehicles received:', msg.data.vehicles?.length || 0);
    }

    if (msg.event === 'error') {
      console.log('❌ Error:', msg.data);
    }
  } catch (e) {
    console.error('Parse error:', e);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

ws.on('close', () => {
  console.log('WebSocket closed');
  process.exit(0);
});

setTimeout(() => {
  console.log('Timeout - closing');
  ws.close();
  process.exit(1);
}, 5000);
