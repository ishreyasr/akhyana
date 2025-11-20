/**
 * Complete V2V Dashboard Diagnostic Script
 * This script will help identify why nearby devices aren't appearing
 */

const WebSocket = require('ws');

const API_BASE = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002/v2v';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkBackendHealth() {
  console.log('\n🏥 Checking Backend Health...');
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      const data = await response.text();
      console.log('✅ Backend is healthy:', data);
      return true;
    } else {
      console.log('❌ Backend health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Backend connection failed:', error.message);
    return false;
  }
}

async function checkSupabaseData() {
  console.log('\n📊 Checking Supabase Data...');
  try {
    // Check vehicles in database
    const vehiclesResponse = await fetch(`${API_BASE}/debug/vehicles`);
    if (vehiclesResponse.ok) {
      const vehicles = await vehiclesResponse.json();
      console.log(`✅ Found ${vehicles.length} vehicles in database:`);
      vehicles.forEach(v => {
        console.log(`   - ${v.id}: ${v.driver_name} at (${v.last_lat}, ${v.last_lon})`);
      });
    } else {
      console.log('❌ Could not fetch vehicles from database');
    }

    // Check location history
    const locationsResponse = await fetch(`${API_BASE}/debug/locations`);
    if (locationsResponse.ok) {
      const locations = await locationsResponse.json();
      console.log(`✅ Found ${locations.length} location records in database`);
      if (locations.length > 0) {
        console.log('   Recent locations:');
        locations.slice(0, 3).forEach(l => {
          console.log(`   - ${l.vehicle_id}: (${l.lat}, ${l.lon}) at ${l.created_at}`);
        });
      }
    }
  } catch (error) {
    console.log('❌ Error checking Supabase data:', error.message);
  }
}

async function testWebSocketConnection() {
  console.log('\n🔌 Testing WebSocket Connection...');

  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let connected = false;
    let registered = false;
    let receivedNearby = false;

    const vehicleId = 'diagnostic-vehicle-' + Date.now();

    const timeout = setTimeout(() => {
      if (!connected) {
        console.log('❌ WebSocket connection timeout');
      } else if (!registered) {
        console.log('❌ Vehicle registration timeout');
      } else if (!receivedNearby) {
        console.log('⚠️  No nearby_vehicles events received (this might be normal if no other vehicles)');
      }
      ws.close();
      resolve({ connected, registered, receivedNearby });
    }, 10000);

    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      connected = true;

      // Register vehicle
      ws.send(JSON.stringify({
        event: 'register',
        data: {
          vehicleId: vehicleId,
          driverName: 'Diagnostic Test',
          vehicleInfo: { model: 'Test Car', color: 'blue' }
        }
      }));
      console.log('📤 Sent registration for', vehicleId);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log('📥 Received:', msg.event, JSON.stringify(msg.data || {}, null, 2));

        if (msg.event === 'registered') {
          console.log('✅ Vehicle registered successfully');
          registered = true;

          // Send location update
          setTimeout(() => {
            const location = {
              vehicleId: vehicleId,
              lat: 37.7749 + Math.random() * 0.01, // Random location near SF
              lon: -122.4194 + Math.random() * 0.01
            };
            ws.send(JSON.stringify({
              event: 'location_update',
              data: location
            }));
            console.log('📍 Sent location update:', location.lat.toFixed(6), location.lon.toFixed(6));
          }, 500);
        }

        if (msg.event === 'nearby_vehicles') {
          receivedNearby = true;
          if (msg.data && msg.data.vehicles) {
            console.log(`🎯 Received nearby_vehicles: ${msg.data.vehicles.length} vehicles`);
            msg.data.vehicles.forEach(v => {
              console.log(`   - ${v.vehicleId}: ${v.distance}m away`);
            });
          }
        }

        if (msg.event === 'error') {
          console.log('❌ Received error:', msg.data);
        }

      } catch (e) {
        console.log('❌ Error parsing message:', e.message);
      }
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      clearTimeout(timeout);
      resolve({ connected: false, registered: false, receivedNearby: false });
    });

    ws.on('close', (code, reason) => {
      console.log('🔌 WebSocket closed:', code, reason.toString());
      clearTimeout(timeout);
    });
  });
}

async function testFrontendWebSocket() {
  console.log('\n🌐 Testing Frontend WebSocket Integration...');

  // Simulate what the frontend does
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let dashboardEvents = [];

    const timeout = setTimeout(() => {
      ws.close();
      resolve(dashboardEvents);
    }, 8000);

    ws.on('open', () => {
      console.log('✅ Frontend simulation connected');

      // Simulate auto-registration like the dashboard does
      const userVehicle = {
        vehicleId: 'dashboard-user-' + Date.now(),
        driverName: 'Dashboard User',
        vehicleInfo: {
          licensePlate: 'DASH-001',
          model: 'Dashboard Vehicle',
          color: 'red'
        }
      };

      ws.send(JSON.stringify({
        event: 'register',
        data: userVehicle
      }));
      console.log('📤 Simulating dashboard registration...');
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        dashboardEvents.push(msg);

        console.log('📱 Dashboard would receive:', msg.event);

        if (msg.event === 'registered') {
          console.log('✅ Dashboard vehicle registered');

          // Send location like auto-location would
          setTimeout(() => {
            ws.send(JSON.stringify({
              event: 'location_update',
              data: {
                vehicleId: msg.data.vehicleId,
                lat: 37.7749,
                lon: -122.4194
              }
            }));
            console.log('📍 Dashboard sent location');
          }, 500);
        }

        if (msg.event === 'nearby_vehicles') {
          console.log('🎯 Dashboard received nearby vehicles!');
          if (msg.data && msg.data.vehicles) {
            console.log(`   Count: ${msg.data.vehicles.length}`);
            console.log(`   This is what should appear in "Nearby Vehicles" section`);
          }
        }

      } catch (e) {
        console.log('❌ Frontend parsing error:', e.message);
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

async function checkEnvironmentConfig() {
  console.log('\n⚙️  Checking Environment Configuration...');

  // Check if environment variables are set correctly
  try {
    const envResponse = await fetch(`${API_BASE}/debug/config`);
    if (envResponse.ok) {
      const config = await envResponse.json();
      console.log('✅ Backend configuration:');
      console.log(`   - Nearby radius: ${config.nearbyRadius || 'Not set'}m`);
      console.log(`   - Supabase enabled: ${config.supabaseEnabled ? 'Yes' : 'No'}`);
      console.log(`   - Debug persist: ${config.debugPersist ? 'Yes' : 'No'}`);
    }
  } catch (error) {
    console.log('⚠️  Could not fetch backend config');
  }
}

async function runCompleteDiagnostic() {
  console.log('🔍 V2V DIAGNOSTIC SUITE');
  console.log('======================');
  console.log('This will help identify why nearby devices aren\'t appearing');

  // Step 1: Check backend health
  const backendHealthy = await checkBackendHealth();
  if (!backendHealthy) {
    console.log('\n❌ ISSUE FOUND: Backend is not responding');
    console.log('   Solution: Restart the backend server');
    return;
  }

  // Step 2: Check environment config
  await checkEnvironmentConfig();

  // Step 3: Check Supabase data
  await checkSupabaseData();

  // Step 4: Test WebSocket functionality
  const wsResult = await testWebSocketConnection();

  // Step 5: Test frontend simulation
  await testFrontendWebSocket();

  // Step 6: Provide diagnosis
  console.log('\n🩺 DIAGNOSIS:');
  console.log('=============');

  if (!wsResult.connected) {
    console.log('❌ ISSUE: WebSocket connection failed');
    console.log('   - Check if backend server is running on port 3002');
    console.log('   - Check firewall settings');
  } else if (!wsResult.registered) {
    console.log('❌ ISSUE: Vehicle registration failed');
    console.log('   - Check backend registration logic');
    console.log('   - Check Supabase connection');
  } else {
    console.log('✅ WebSocket and registration working correctly');

    if (!wsResult.receivedNearby) {
      console.log('⚠️  LIKELY ISSUE: No nearby vehicles detected');
      console.log('   - This is normal if you\'re the only vehicle');
      console.log('   - Try running: node .\\Backend\\scripts\\test_nearby_devices.js');
      console.log('   - Then refresh your dashboard');
    } else {
      console.log('✅ Nearby vehicle detection working!');
      console.log('   - If dashboard still doesn\'t show vehicles, check browser console');
      console.log('   - Verify frontend WebSocket connection');
    }
  }

  console.log('\n💡 NEXT STEPS:');
  console.log('===============');
  console.log('1. Run the test script to create nearby vehicles:');
  console.log('   node .\\Backend\\scripts\\test_nearby_devices.js');
  console.log('2. Open dashboard: http://localhost:3000');
  console.log('3. Register/login and check "Nearby Vehicles" section');
  console.log('4. Check browser console for any JavaScript errors');
  console.log('5. If still not working, check realtime subscriptions in Supabase');
}

// Run the diagnostic
runCompleteDiagnostic().catch(console.error);
