// Full flow: start server (if not already), then POST and GET
const { spawn } = require('child_process');
const net = require('net');
const PORT = parseInt(process.env.V2V_SERVER_PORT || '3002', 10);

function waitPort(port, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tryOnce() {
      const s = net.connect(port, '127.0.0.1', () => { s.destroy(); resolve(); });
      s.on('error', () => { s.destroy(); if (Date.now() - start > timeout) return reject(new Error('timeout')); setTimeout(tryOnce, 150); });
    })();
  });
}

(async () => {
  // Assume separate server already running; just test endpoints
  try { await waitPort(PORT, 2500); } catch { console.error('[TEST] server not up'); process.exit(1); }
  const email = 'flow_' + Date.now() + '@example.com';
  const payload = { email, fullName: 'Flow Tester', password: 'secret12', vehicle: { vehicleId: 'veh-flow' } };
  const post = await fetch('http://localhost:' + PORT + '/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const postBody = await post.text();
  console.log('[FLOW] POST status', post.status, 'body', postBody);
  const get = await fetch('http://localhost:' + PORT + '/user?email=' + encodeURIComponent(email));
  const getBody = await get.text();
  console.log('[FLOW] GET status', get.status, 'body', getBody);
})();
