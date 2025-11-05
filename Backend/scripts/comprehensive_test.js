#!/usr/bin/env node
/**
 * Comprehensive location and nearby test
 */
const WebSocket = require('ws');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testVehicle(id, coords) {
  return new Promise((resolve) => {
    const events = [];
    const ws = new WebSocket('ws://localhost:3002/v2v');

    let stepIndex = 0;

    ws.on('open', () => {
      console.log(`[${id}] Connected`);

      // Register vehicle
      ws.send(JSON.stringify({
        event: 'register',
        data: {
          vehicleId: id,
          driverName: `Driver ${id}`,
          vehicleInfo: { model: 'TestCar', color: 'blue' }
        }
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        events.push(msg);
        console.log(`[${id}] <- ${msg.event}`, msg.data || {});

        if (msg.event === 'registered') {
          console.log(`[${id}] ✓ Registered, sending location updates...`);

          // Send location updates with delays
          coords.forEach((coord, idx) => {
            setTimeout(() => {
              const payload = { vehicleId: id, lat: coord[0], lon: coord[1] };
              console.log(`[${id}] -> location_update #${idx + 1}`, payload);
              ws.send(JSON.stringify({ event: 'location_update', data: payload }));
            }, 1000 * (idx + 1));
          });

          // Close after all updates + buffer
          setTimeout(() => {
            ws.close();
          }, 1000 * (coords.length + 2));
        }

        if (msg.event === 'nearby_vehicles') {
          console.log(`[${id}] ✓ NEARBY VEHICLES:`, msg.data.vehicles?.map(v => `${v.vehicleId} (${v.distance}m)`) || []);
        }

        if (msg.event === 'proximity_event') {
          console.log(`[${id}] ✓ PROXIMITY EVENT:`, msg.data.eventType, msg.data.peerVehicleId, `${msg.data.distanceM}m`);
        }

        if (msg.event === 'error') {
          console.error(`[${id}] ❌ ERROR:`, msg.data);
        }

      } catch (e) {
        console.error(`[${id}] Parse error:`, e);
      }
    });

    ws.on('close', () => {
      console.log(`[${id}] Disconnected`);
      resolve(events);
    });

    ws.on('error', (err) => {
      console.error(`[${id}] WebSocket error:`, err.message);
      resolve(events);
    });
  });
}

async function main() {
  console.log('=== Comprehensive V2V Location Test ===');

  // Two vehicles close to each other
  const vehicle1Coords = [
    [37.7749, -122.4194],  // SF Financial District
    [37.7750, -122.4195],  // Move slightly
    [37.7751, -122.4196]   // Move again
  ];

  const vehicle2Coords = [
    [37.7752, -122.4197],  // ~400m from vehicle1
    [37.7753, -122.4198],  // Move closer
    [37.7754, -122.4199]   // Move again
  ];

  console.log('Starting vehicle tests...');

  // Start both vehicles with a small delay
  const [events1, events2] = await Promise.all([
    testVehicle('vehicle-A', vehicle1Coords),
    sleep(200).then(() => testVehicle('vehicle-B', vehicle2Coords))
  ]);

  console.log('\n=== Test Results ===');
  console.log(`Vehicle A total events: ${events1.length}`);
  console.log(`Vehicle B total events: ${events2.length}`);

  const nearbyEvents1 = events1.filter(e => e.event === 'nearby_vehicles');
  const nearbyEvents2 = events2.filter(e => e.event === 'nearby_vehicles');
  const proximityEvents1 = events1.filter(e => e.event === 'proximity_event');
  const proximityEvents2 = events2.filter(e => e.event === 'proximity_event');

  console.log(`Vehicle A nearby events: ${nearbyEvents1.length}`);
  console.log(`Vehicle B nearby events: ${nearbyEvents2.length}`);
  console.log(`Vehicle A proximity events: ${proximityEvents1.length}`);
  console.log(`Vehicle B proximity events: ${proximityEvents2.length}`);

  if (nearbyEvents1.length === 0 && nearbyEvents2.length === 0) {
    console.log('\n❌ NO nearby_vehicles events - location persistence issue');
  } else {
    console.log('\n✅ Location system working - nearby events detected');
  }

  console.log('\n=== Next Steps ===');
  console.log('1. Check Supabase tables for data:');
  console.log('   - vehicles table should have vehicle-A and vehicle-B');
  console.log('   - location_history should have location updates');
  console.log('   - proximity_events should have enter/exit events');
  console.log('2. Check server logs for DEBUG_LOCATIONS and DEBUG_PERSIST messages');
}

main().catch(console.error);
