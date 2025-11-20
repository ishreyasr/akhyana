/**
 * Simple test for nearby devices functionality
 * Creates two vehicles and verifies they can see each other
 */

const WebSocket = require('ws');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testNearbyDevices() {
  console.log('🚀 Testing Nearby Devices Functionality');
  console.log('========================================');

  const vehicle1 = {
    id: 'test-vehicle-1',
    coords: [37.7749, -122.4194], // San Francisco
    ws: null
  };

  const vehicle2 = {
    id: 'test-vehicle-2',
    coords: [37.7752, -122.4197], // ~400m from vehicle1
    ws: null
  };

  // Connect vehicle 1
  console.log('\n📡 Connecting Vehicle 1...');
  vehicle1.ws = new WebSocket('ws://localhost:3002/v2v');

  await new Promise((resolve) => {
    vehicle1.ws.on('open', () => {
      console.log('✅ Vehicle 1 connected');

      // Register vehicle 1
      vehicle1.ws.send(JSON.stringify({
        event: 'register',
        data: {
          vehicleId: vehicle1.id,
          driverName: 'Driver One',
          vehicleInfo: { model: 'Tesla Model 3', color: 'blue' }
        }
      }));

      resolve();
    });
  });

  // Wait for registration
  await sleep(1000);

  // Send initial location for vehicle 1
  console.log('📍 Sending Vehicle 1 location...');
  vehicle1.ws.send(JSON.stringify({
    event: 'location_update',
    data: {
      vehicleId: vehicle1.id,
      lat: vehicle1.coords[0],
      lon: vehicle1.coords[1]
    }
  }));

  await sleep(1000);

  // Connect vehicle 2
  console.log('\n📡 Connecting Vehicle 2...');
  vehicle2.ws = new WebSocket('ws://localhost:3002/v2v');

  await new Promise((resolve) => {
    vehicle2.ws.on('open', () => {
      console.log('✅ Vehicle 2 connected');

      // Register vehicle 2
      vehicle2.ws.send(JSON.stringify({
        event: 'register',
        data: {
          vehicleId: vehicle2.id,
          driverName: 'Driver Two',
          vehicleInfo: { model: 'Honda Civic', color: 'red' }
        }
      }));

      resolve();
    });
  });

  // Wait for registration
  await sleep(1000);

  // Send initial location for vehicle 2
  console.log('📍 Sending Vehicle 2 location...');
  vehicle2.ws.send(JSON.stringify({
    event: 'location_update',
    data: {
      vehicleId: vehicle2.id,
      lat: vehicle2.coords[0],
      lon: vehicle2.coords[1]
    }
  }));

  // Set up message handlers
  let vehicle1NearbyReceived = false;
  let vehicle2NearbyReceived = false;

  vehicle1.ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[Vehicle 1] Received: ${msg.event}`, msg.data || {});

    if (msg.event === 'nearby_vehicles' && msg.data && msg.data.vehicles) {
      vehicle1NearbyReceived = true;
      console.log(`🎯 Vehicle 1 sees ${msg.data.vehicles.length} nearby vehicles:`);
      msg.data.vehicles.forEach(v => {
        console.log(`  - ${v.vehicleId}: ${v.distance}m away`);
      });
    }
  });

  vehicle2.ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[Vehicle 2] Received: ${msg.event}`, msg.data || {});

    if (msg.event === 'nearby_vehicles' && msg.data && msg.data.vehicles) {
      vehicle2NearbyReceived = true;
      console.log(`🎯 Vehicle 2 sees ${msg.data.vehicles.length} nearby vehicles:`);
      msg.data.vehicles.forEach(v => {
        console.log(`  - ${v.vehicleId}: ${v.distance}m away`);
      });
    }
  });

  // Wait for nearby events
  console.log('\n⏳ Waiting for nearby vehicle detection...');
  await sleep(3000);

  // Send additional location updates to trigger nearby detection
  console.log('📍 Sending additional location updates...');

  vehicle1.ws.send(JSON.stringify({
    event: 'location_update',
    data: {
      vehicleId: vehicle1.id,
      lat: vehicle1.coords[0] + 0.0001,
      lon: vehicle1.coords[1] + 0.0001
    }
  }));

  vehicle2.ws.send(JSON.stringify({
    event: 'location_update',
    data: {
      vehicleId: vehicle2.id,
      lat: vehicle2.coords[0] + 0.0001,
      lon: vehicle2.coords[1] + 0.0001
    }
  }));

  await sleep(2000);

  // Check results
  console.log('\n📊 Test Results:');
  console.log('================');

  if (vehicle1NearbyReceived && vehicle2NearbyReceived) {
    console.log('✅ SUCCESS: Both vehicles can see each other');
    console.log('✅ Nearby devices functionality is working correctly');
  } else if (vehicle1NearbyReceived || vehicle2NearbyReceived) {
    console.log('⚠️  PARTIAL: Only one vehicle received nearby events');
    console.log(`   Vehicle 1 received: ${vehicle1NearbyReceived}`);
    console.log(`   Vehicle 2 received: ${vehicle2NearbyReceived}`);
  } else {
    console.log('❌ FAILED: No nearby vehicle events received');
    console.log('💡 Check server logs for location processing issues');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  vehicle1.ws.close();
  vehicle2.ws.close();

  console.log('🔚 Test completed');
}

// Run the test
testNearbyDevices().catch(console.error);
