#!/usr/bin/env node
/**
 * Focused WebSocket location test - register vehicle and send location updates
 */
const WebSocket = require('ws');

function createVehicleTest(id, coords) {
  return new Promise((resolve) => {
    const events = [];
    const ws = new WebSocket('ws://localhost:3002/v2v');

    ws.on('open', () => {
      console.log(`[${id}] WebSocket connected`);

      // 1. Register
      ws.send(JSON.stringify({
        event: 'register',
        data: {
          vehicleId: id,
          driverName: `Driver ${id}`,
          vehicleInfo: { model: 'TestCar', color: 'blue' }
        }
      }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        events.push(msg);
        console.log(`[${id}] <- ${msg.event}`, msg.data ? Object.keys(msg.data) : '');

        if (msg.event === 'registered') {
          console.log(`[${id}] Registered! Sending location updates...`);

          // Send location updates
          coords.forEach((coord, idx) => {
            setTimeout(() => {
              const payload = { vehicleId: id, lat: coord[0], lon: coord[1] };
              console.log(`[${id}] -> location_update`, payload);
              ws.send(JSON.stringify({ event: 'location_update', data: payload }));
            }, 500 * (idx + 1));
          });

          // Close after all updates
          setTimeout(() => {
            ws.close();
          }, 500 * (coords.length + 2));
        }

        if (msg.event === 'nearby_vehicles' && msg.data?.vehicles?.length > 0) {
          console.log(`[${id}] Found nearby vehicles:`, msg.data.vehicles.map(v => v.vehicleId));
        }

        if (msg.event === 'error') {
          console.error(`[${id}] ERROR:`, msg.data);
        }

      } catch (e) {
        console.error(`[${id}] Parse error:`, e);
      }
    });

    ws.on('close', () => {
      console.log(`[${id}] WebSocket closed`);
      resolve(events);
    });

    ws.on('error', (err) => {
      console.error(`[${id}] WebSocket error:`, err.message);
      resolve(events);
    });
  });
}

async function main() {
  console.log('=== WebSocket Location Test ===');

  // Two vehicles close to each other in SF
  const vehicle1Coords = [
    [37.7749, -122.4194],  // SF downtown
    [37.7750, -122.4195]   // Slight movement
  ];

  const vehicle2Coords = [
    [37.7752, -122.4196],  // ~30m away
    [37.7753, -122.4197]   // Slight movement
  ];

  // Start both vehicles concurrently
  const [events1, events2] = await Promise.all([
    createVehicleTest('test-vehicle-1', vehicle1Coords),
    createVehicleTest('test-vehicle-2', vehicle2Coords)
  ]);

  console.log('\n=== Test Summary ===');
  console.log(`Vehicle 1 events: ${events1.length}`);
  console.log(`Vehicle 2 events: ${events2.length}`);

  // Check for nearby_vehicles events
  const vehicle1Nearby = events1.filter(e => e.event === 'nearby_vehicles');
  const vehicle2Nearby = events2.filter(e => e.event === 'nearby_vehicles');

  console.log(`Vehicle 1 nearby events: ${vehicle1Nearby.length}`);
  console.log(`Vehicle 2 nearby events: ${vehicle2Nearby.length}`);

  if (vehicle1Nearby.length === 0 && vehicle2Nearby.length === 0) {
    console.log('\n❌ NO nearby_vehicles events detected - location persistence may be failing');
  } else {
    console.log('\n✅ nearby_vehicles events detected - location system working');
  }

  console.log('\nNow check Supabase tables: vehicles, location_history');
}

main().catch(console.error);
