// Simple smoke test client for the hybrid server
const WebSocket = require('ws');

function run(id, lat, lon) {
  return new Promise(resolve => {
    const ws = new WebSocket('ws://localhost:3002/v2v');
    ws.on('open', () => {
      ws.send(JSON.stringify({ event: 'register', data: { vehicleId: id, driverName: 'Driver-' + id, vehicleInfo: { model: 'Test', color: 'White' } } }));
      setTimeout(() => ws.send(JSON.stringify({ event: 'location_update', data: { vehicleId: id, lat, lon } })), 200);
      setTimeout(() => ws.send(JSON.stringify({ event: 'heartbeat' })), 1000);
      setTimeout(() => resolve(ws), 1500);
    });
    ws.on('message', msg => console.log(id, '<<', msg.toString()));
  });
}

(async () => {
  const a = await run('vehA', 37.7749, -122.4194);
  const b = await run('vehB', 37.7752, -122.4187);
  // Send message
  a.send(JSON.stringify({ event: 'send_message', data: { senderId: 'vehA', recipientId: 'vehB', content: 'Hello B!' } }));
  // Emergency alert
  setTimeout(() => {
    b.send(JSON.stringify({ event: 'emergency_alert', data: { senderId: 'vehB', vehicleInfo: { model: 'Unit', color: 'Red' } } }));
  }, 800);
  // WebRTC signaling simulation
  setTimeout(() => {
    a.send(JSON.stringify({ event: 'call_initiate', data: { callerId: 'vehA', calleeId: 'vehB' } }));
    a.send(JSON.stringify({ event: 'webrtc_offer', data: { targetId: 'vehB', sdp: 'fake-offer' } }));
  }, 1200);
  setTimeout(() => {
    b.send(JSON.stringify({ event: 'webrtc_answer', data: { targetId: 'vehA', sdp: 'fake-answer' } }));
    b.send(JSON.stringify({ event: 'ice_candidate', data: { targetId: 'vehA', candidate: { candidate: 'fake-cand' } } }));
  }, 1600);
  setTimeout(() => {
    a.close();
    b.close();
    process.exit(0);
  }, 4000);
})();
