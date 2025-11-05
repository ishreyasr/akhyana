/**
 * Advanced Location-Based Proximity Test
 * Tests vehicles at various distances to show coordinate-based detection
 */

const WebSocket = require('ws');

// Test locations around San Francisco with precise distances
const locations = {
  // Financial District, San Francisco
  center: { lat: 37.7749, lon: -122.4194, name: 'Financial District' },

  // Different distances from center
  nearby_100m: { lat: 37.7758, lon: -122.4194, name: '~100m North' },
  nearby_250m: { lat: 37.7771, lon: -122.4194, name: '~250m North' },
  nearby_400m: { lat: 37.7785, lon: -122.4194, name: '~400m North' },
  nearby_600m: { lat: 37.7803, lon: -122.4194, name: '~600m North (outside radius)' },

  // Different directions
  east_300m: { lat: 37.7749, lon: -122.4167, name: '~300m East' },
  west_200m: { lat: 37.7749, lon: -122.4212, name: '~200m West' },
  south_150m: { lat: 37.7735, lon: -122.4194, name: '~150m South' },

  // Diagonal distances
  northeast_350m: { lat: 37.7780, lon: -122.4167, name: '~350m Northeast' },
  southwest_450m: { lat: 37.7718, lon: -122.4221, name: '~450m Southwest' }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createVehicle(vehicleId, location, shouldRegister = true) {
  console.log(`\n🚗 Creating ${vehicleId} at ${location.name}`);
  console.log(`   📍 Coordinates: ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`);

  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3002/v2v');
    const vehicleData = {
      id: vehicleId,
      location: location,
      ws: ws,
      nearbyVehicles: []
    };

    ws.on('open', async () => {
      console.log(`   ✅ ${vehicleId} connected`);

      if (shouldRegister) {
        // Register vehicle
        ws.send(JSON.stringify({
          event: 'register',
          data: {
            vehicleId: vehicleId,
            driverName: `Driver ${vehicleId}`,
            vehicleInfo: {
              model: 'Test Vehicle',
              color: ['red', 'blue', 'green', 'yellow', 'black'][Math.floor(Math.random() * 5)]
            }
          }
        }));

        // Wait a bit then send location
        await sleep(500);
        ws.send(JSON.stringify({
          event: 'location_update',
          data: {
            vehicleId: vehicleId,
            lat: location.lat,
            lon: location.lon
          }
        }));

        console.log(`   📍 ${vehicleId} location sent`);
      }

      resolve(vehicleData);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.event === 'nearby_vehicles' && msg.data && msg.data.vehicles) {
          vehicleData.nearbyVehicles = msg.data.vehicles;
          console.log(`   🎯 ${vehicleId} sees ${msg.data.vehicles.length} nearby vehicles:`);
          msg.data.vehicles.forEach(v => {
            console.log(`      - ${v.vehicleId}: ${v.distance}m away`);
          });
        }

        if (msg.event === 'proximity_event') {
          const eventType = msg.data.eventType === 'enter' ? '🟢 ENTERED' : '🔴 EXITED';
          console.log(`   ${eventType} proximity: ${msg.data.peerVehicleId} (${msg.data.distanceM || 'N/A'}m)`);
        }

        if (msg.event === 'registered') {
          console.log(`   ✅ ${vehicleId} registered successfully`);
        }

      } catch (e) {
        console.error(`   ❌ ${vehicleId} message parse error:`, e.message);
      }
    });

    ws.on('error', (error) => {
      console.error(`   💥 ${vehicleId} WebSocket error:`, error.message);
    });
  });
}

async function demonstrateLocationBasedProximity() {
  console.log('🌍 Location-Based Proximity Detection Test');
  console.log('==========================================');
  console.log('This test demonstrates coordinate-based vehicle detection');
  console.log('Radius: 500m (vehicles beyond this distance won\'t be detected)');
  console.log('');

  const vehicles = [];

  // Create center vehicle first
  vehicles.push(await createVehicle('center-vehicle', locations.center));
  await sleep(1000);

  // Create vehicles at various distances
  console.log('\n📍 Creating vehicles at different distances...');

  const vehicleConfigs = [
    { id: 'vehicle-100m', location: locations.nearby_100m },
    { id: 'vehicle-250m', location: locations.nearby_250m },
    { id: 'vehicle-400m', location: locations.nearby_400m },
    { id: 'vehicle-600m', location: locations.nearby_600m }, // Should NOT be detected (outside 500m radius)
    { id: 'vehicle-east', location: locations.east_300m },
    { id: 'vehicle-west', location: locations.west_200m },
    { id: 'vehicle-south', location: locations.south_150m },
    { id: 'vehicle-ne', location: locations.northeast_350m },
    { id: 'vehicle-sw', location: locations.southwest_450m }
  ];

  // Create vehicles with small delays
  for (const config of vehicleConfigs) {
    vehicles.push(await createVehicle(config.id, config.location));
    await sleep(800); // Allow time for proximity detection
  }

  // Wait for all proximity events to be processed
  console.log('\n⏳ Waiting for proximity detection to complete...');
  await sleep(3000);

  // Summary of results
  console.log('\n📊 PROXIMITY DETECTION RESULTS');
  console.log('===============================');

  vehicles.forEach(vehicle => {
    const nearbyCount = vehicle.nearbyVehicles.length;
    console.log(`${vehicle.id}:`);
    console.log(`  Location: ${vehicle.location.name}`);
    console.log(`  Detected nearby: ${nearbyCount} vehicles`);

    if (nearbyCount > 0) {
      vehicle.nearbyVehicles.forEach(nearby => {
        const withinRadius = nearby.distance <= 500 ? '✅' : '❌';
        console.log(`    ${withinRadius} ${nearby.vehicleId}: ${nearby.distance}m`);
      });
    }
    console.log('');
  });

  // Validate results
  console.log('🔍 VALIDATION:');
  console.log('==============');

  const centerVehicle = vehicles.find(v => v.id === 'center-vehicle');
  if (centerVehicle) {
    const detectedIds = centerVehicle.nearbyVehicles.map(v => v.vehicleId);
    console.log(`Center vehicle detected: ${detectedIds.join(', ')}`);

    // Should NOT detect vehicle-600m (outside 500m radius)
    const detected600m = detectedIds.includes('vehicle-600m');
    console.log(`🎯 600m vehicle detection: ${detected600m ? '❌ FAILED (should not detect)' : '✅ CORRECT (not detected)'}`);

    // Should detect vehicles within 500m
    const expectedNearby = ['vehicle-100m', 'vehicle-250m', 'vehicle-400m', 'vehicle-east', 'vehicle-west', 'vehicle-south', 'vehicle-ne', 'vehicle-sw'];
    const actualNearby = expectedNearby.filter(id => detectedIds.includes(id));
    console.log(`🎯 Nearby vehicles detected: ${actualNearby.length}/${expectedNearby.length}`);

    if (actualNearby.length === expectedNearby.length && !detected600m) {
      console.log('✅ Location-based proximity detection working correctly!');
    } else {
      console.log('⚠️  Some issues detected with proximity detection');
    }
  }

  // Cleanup
  console.log('\n🧹 Cleaning up connections...');
  vehicles.forEach(vehicle => {
    if (vehicle.ws) {
      vehicle.ws.close();
    }
  });

  console.log('🔚 Test completed');
}

// Helper function to calculate actual distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
}

// Verify our test coordinates
console.log('🧮 Pre-calculated distances from center:');
Object.entries(locations).forEach(([key, location]) => {
  if (key !== 'center') {
    const distance = calculateDistance(
      locations.center.lat, locations.center.lon,
      location.lat, location.lon
    );
    console.log(`  ${location.name}: ${distance}m`);
  }
});

// Run the test
demonstrateLocationBasedProximity().catch(console.error);
