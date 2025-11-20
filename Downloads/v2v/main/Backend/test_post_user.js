// Run with: pnpm run test:post-user
const email = process.argv[2] || (`cli_test_${Date.now()}@example.com`);
const payload = { email, fullName: 'CLI Tester', password: 'secret12', vehicle: { vehicleId: 'veh-' + Math.random().toString(36).slice(2, 6) } };
(async () => {
  const port = process.env.V2V_SERVER_PORT || 3002;
  console.log('[POST] creating user email:', email);
  try {
    const r = await fetch(`http://localhost:${port}/user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const txt = await r.text();
    console.log('POST status', r.status, 'body', txt);
    console.log('[HINT] To fetch: pnpm run test:get-user', email);
  } catch (e) { console.error('POST error', e); }
})();
