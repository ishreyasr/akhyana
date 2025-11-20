/**
 * Frontend WebSocket Debug Script
 * Run this in browser console to debug WebSocket connection
 */

console.log('🔍 Starting Frontend WebSocket Debug...');

// Connect to V2V backend like the dashboard does
const ws = new WebSocket('ws://localhost:3002/v2v');
const vehicleId = 'frontend-debug-' + Date.now();

ws.onopen = () => {
  console.log('✅ Frontend debug connected to V2V server');

  // Register like the auto-registration hook does
  ws.send(JSON.stringify({
    event: 'register',
    data: {
      vehicleId: vehicleId,
      driverName: 'Frontend Debug User',
      vehicleInfo: {
        licensePlate: 'DEBUG-01',
        model: 'Debug Vehicle',
        color: 'blue'
      }
    }
  }));

  console.log(`📝 Registered debug vehicle: ${vehicleId}`);
};

ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    console.log(`📥 [${msg.event}]`, msg.data);

    if (msg.event === 'registered') {
      console.log('✅ Debug vehicle registered successfully');

      // Send location like auto-location does
      ws.send(JSON.stringify({
        event: 'location_update',
        data: {
          vehicleId: vehicleId,
          lat: 37.7749,
          lon: -122.4194
        }
      }));

      console.log('📍 Sent debug location update');
    }

    if (msg.event === 'nearby_vehicles') {
      console.log(`🎯 NEARBY VEHICLES RECEIVED!`);
      console.log(`   Count: ${msg.data.vehicles ? msg.data.vehicles.length : 0}`);
      console.log(`   Radius: ${msg.data.radius}`);
      if (msg.data.debug) {
        console.log(`   Debug: ${msg.data.debug}`);
      }

      if (msg.data.vehicles && msg.data.vehicles.length > 0) {
        console.log('   Vehicles:');
        msg.data.vehicles.forEach((v, i) => {
          console.log(`     ${i + 1}. ${v.driverName} (${v.vehicleId})`);
          console.log(`        Distance: ${v.distance}m`);
          console.log(`        Vehicle: ${v.color} ${v.model}`);
          if (v.location) {
            console.log(`        Location: ${v.location}`);
          }
        });
      } else {
        console.log('   ⚠️  No vehicles in list - this is the problem!');
      }
    }

  } catch (e) {
    console.log('❌ Error parsing WebSocket message:', e.message);
  }
};

ws.onerror = (error) => {
  console.log('❌ WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log(`🔌 WebSocket closed: ${event.code} ${event.reason}`);
};

console.log('💡 This script simulates what the dashboard should be doing.');
console.log('💡 If you see "NEARBY VEHICLES RECEIVED!" with vehicles listed,');
console.log('💡 then the backend is working and the issue is in the React components.');
console.log('💡 Copy and paste this entire script into your browser console while on the dashboard.');

// Store reference globally so you can close it later
window.debugWS = ws;
