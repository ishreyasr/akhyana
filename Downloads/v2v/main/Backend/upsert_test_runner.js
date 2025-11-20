// Automated test: spin up server (via launch-server), perform POST /user then GET /user
require('./launch-server.js');

const email = 'auto_test_' + Date.now() + '@example.com';
const payload = { email, fullName: 'Auto Tester', password: 'secret12', vehicle: { vehicleId: 'veh-' + Math.random().toString(36).slice(2, 8) } };

async function run() {
  await new Promise(r => setTimeout(r, 1200)); // wait for server start
  try {
    const postResp = await fetch('http://localhost:' + (process.env.V2V_SERVER_PORT || '3002') + '/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const postText = await postResp.text();
    console.log('[TEST] POST /user status', postResp.status, 'body:', postText);
  } catch (e) {
    console.error('[TEST] POST failed', e);
    process.exit(1);
  }
  await new Promise(r => setTimeout(r, 800));
  try {
    const url = 'http://localhost:' + (process.env.V2V_SERVER_PORT || '3002') + '/user?email=' + encodeURIComponent(email);
    const getResp = await fetch(url);
    const getText = await getResp.text();
    console.log('[TEST] GET /user status', getResp.status, 'body:', getText);
  } catch (e) {
    console.error('[TEST] GET failed', e);
  }
  // Allow logs to flush
  setTimeout(() => process.exit(0), 1000);
}
run();
