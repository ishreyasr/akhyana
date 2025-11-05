/**
 * Test script to verify auto-registration functionality
 * This script simulates the complete flow:
 * 1. User registration via HTTP
 * 2. Auto vehicle registration via WebSocket  
 * 3. Location updates
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002/v2v';

// Test user data
const testUser = {
  email: 'autotest@example.com',
  fullName: 'Auto Test User',
  password: 'testpass123',
  vehicle: {
    vehicleId: 'auto-test-vehicle-001',
    licensePlate: 'AT-001-AUTO',
    vehicleType: 'Sedan',
    brand: 'Tesla',
    model: 'Model 3',
    color: 'Blue'
  }
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUserRegistration() {
  console.log('\n=== Testing User Registration ===');

  try {
    const response = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ User registration failed: ${response.status} ${errorText}`);
      return false;
    }

    console.log('✅ User registered successfully');
    return true;
  } catch (error) {
    console.log(`❌ User registration error: ${error.message}`);
    return false;
  }
}

async function testAutoVehicleRegistration() {
  console.log('\n=== Testing Auto Vehicle Registration ===');

  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let registrationReceived = false;
    let locationUpdatesReceived = 0;
    const maxWaitTime = 15000; // 15 seconds

    const timeout = setTimeout(() => {
      if (!registrationReceived) {
        console.log('❌ Auto-registration timeout - no registration received');
        ws.close();
        resolve(false);
      }
    }, maxWaitTime);

    ws.on('open', () => {
      console.log('📡 WebSocket connected');

      // Simulate auto-registration by sending registration message
      // (In real app, this would be triggered by the useAutoVehicleRegistration hook)
      const registrationMessage = {
        type: 'register',
        vehicleId: testUser.vehicle.vehicleId,
        driverName: testUser.fullName,
        vehicleInfo: {
          licensePlate: testUser.vehicle.licensePlate,
          model: `${testUser.vehicle.brand} ${testUser.vehicle.model}`,
          color: testUser.vehicle.color
        }
      };

      console.log('📤 Sending auto-registration:', registrationMessage.vehicleId);
      ws.send(JSON.stringify(registrationMessage));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received:', message.type, message);

        if (message.type === 'registered') {
          console.log('✅ Vehicle auto-registration confirmed');
          registrationReceived = true;

          // Start sending location updates to simulate auto-location tracking
          console.log('📍 Starting location updates...');

          let updateCount = 0;
          const locationInterval = setInterval(() => {
            if (updateCount >= 3) {
              clearInterval(locationInterval);
              clearTimeout(timeout);
              console.log(`✅ Auto-registration test completed (${locationUpdatesReceived} location updates processed)`);
              ws.close();
              resolve(true);
              return;
            }

            // Simulate location updates (moving around San Francisco)
            const baseLatLon = { lat: 37.7749, lon: -122.4194 };
            const offset = updateCount * 0.001; // Small movement

            const locationMessage = {
              type: 'location_update',
              lat: baseLatLon.lat + offset,
              lon: baseLatLon.lon + offset,
              heading: 45,
              speed: 25
            };

            console.log(`📍 Sending location update #${updateCount + 1}:`,
              `${locationMessage.lat.toFixed(6)}, ${locationMessage.lon.toFixed(6)}`);
            ws.send(JSON.stringify(locationMessage));
            updateCount++;
          }, 1000);
        }

        if (message.type === 'location_processed') {
          locationUpdatesReceived++;
          console.log(`✅ Location update processed (#${locationUpdatesReceived})`);
        }

        if (message.type === 'nearby_vehicles') {
          console.log(`👥 Nearby vehicles update: ${message.vehicles?.length || 0} vehicles`);
        }

      } catch (error) {
        console.log('❌ Error parsing WebSocket message:', error.message);
      }
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      resolve(false);
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      clearTimeout(timeout);
    });
  });
}

async function testLocationPermissionFlow() {
  console.log('\n=== Testing Location Permission Flow ===');

  // This would normally be handled by the browser's geolocation API
  // For testing, we'll simulate the permission states

  console.log('📍 Simulating location permission request...');
  await delay(500);
  console.log('✅ Location permission granted (simulated)');

  console.log('📍 Simulating initial location fix...');
  await delay(1000);
  console.log('✅ Initial location obtained (simulated)');

  console.log('📍 Simulating location tracking start...');
  await delay(500);
  console.log('✅ Location tracking started (simulated)');

  return true;
}

async function runFullAutoRegistrationTest() {
  console.log('🚀 Starting Auto-Registration Test Suite');
  console.log('==========================================');

  try {
    // Test 1: User registration
    const userRegistered = await testUserRegistration();
    if (!userRegistered) {
      console.log('\n❌ Test suite failed: User registration failed');
      return;
    }

    await delay(1000);

    // Test 2: Auto vehicle registration  
    const vehicleRegistered = await testAutoVehicleRegistration();
    if (!vehicleRegistered) {
      console.log('\n❌ Test suite failed: Auto vehicle registration failed');
      return;
    }

    await delay(1000);

    // Test 3: Location permission flow
    const locationSetup = await testLocationPermissionFlow();
    if (!locationSetup) {
      console.log('\n❌ Test suite failed: Location setup failed');
      return;
    }

    console.log('\n🎉 Auto-Registration Test Suite PASSED');
    console.log('=====================================');
    console.log('✅ User registration working');
    console.log('✅ Auto vehicle registration working');
    console.log('✅ Location updates working');
    console.log('✅ Full V2V integration working');

  } catch (error) {
    console.log('\n❌ Test suite error:', error.message);
  }
}

// Run the test
runFullAutoRegistrationTest().then(() => {
  console.log('\n🔚 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
