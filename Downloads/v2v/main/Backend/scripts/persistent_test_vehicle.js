/**
 * Persistent Test Vehicle for Frontend Testing
 * This vehicle stays connected and appears in nearby devices list
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3002/v2v';

console.log('🚗 Starting Persistent Test Vehicle...');

const ws = new WebSocket(WS_URL);
let vehicleId = 'persistent-test-vehicle-' + Date.now();

ws.on('open', () => {
  console.log('✅ Connected to V2V server');

  // Register vehicle
  ws.send(JSON.stringify({
    event: 'register',
    data: {
      vehicleId: vehicleId,
      driverName: 'Test Driver (Persistent)',
      vehicleInfo: {
        licensePlate: 'TEST-123',
        model: 'Test Vehicle',
        color: 'green'
      }
    }
  }));

  console.log(`📝 Registered vehicle: ${vehicleId}`);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());

    if (msg.event === 'registered') {
      console.log('✅ Vehicle registration confirmed');

      // Send initial location (San Francisco Financial District)
      const location = {
        vehicleId: vehicleId,
        lat: 37.7749,
        lon: -122.4194
      };

      ws.send(JSON.stringify({
        event: 'location_update',
        data: location
      }));

      console.log(`📍 Sent location: ${location.lat}, ${location.lon}`);

      // Send periodic location updates every 30 seconds with slight variations
      setInterval(() => {
        const newLocation = {
          vehicleId: vehicleId,
          lat: 37.7749 + (Math.random() - 0.5) * 0.001, // Small random movement
          lon: -122.4194 + (Math.random() - 0.5) * 0.001
        };

        ws.send(JSON.stringify({
          event: 'location_update',
          data: newLocation
        }));

        console.log(`📍 Updated location: ${newLocation.lat.toFixed(6)}, ${newLocation.lon.toFixed(6)}`);
      }, 30000);
    }

    if (msg.event === 'nearby_vehicles') {
      console.log(`🎯 Nearby vehicles update: ${msg.data.vehicles ? msg.data.vehicles.length : 0} vehicles`);
      if (msg.data.debug) {
        console.log(`   Debug: ${msg.data.debug}`);
      }
    }

  } catch (e) {
    console.log('❌ Error parsing message:', e.message);
  }
});

ws.on('error', (error) => {
  console.log('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Disconnected: ${code} ${reason.toString()}`);
  process.exit(0);
});

// Keep the process alive
console.log('🎮 Vehicle will stay connected. Press Ctrl+C to disconnect.');
console.log('📱 Now open the dashboard at http://localhost:3000 and check "Nearby Vehicles"');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test vehicle...');
  ws.close();
});
