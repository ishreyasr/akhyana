// Create then fetch same user
(async () => {
  const port = process.env.V2V_SERVER_PORT || 3002;
  const email = `roundtrip_${Date.now()}@example.com`;
  const payload = { email, fullName: 'Round Trip', password: 'secret12', vehicle: { vehicleId: 'veh-roundtrip' } };
  console.log('[ROUNDTRIP] POST email', email);
  const post = await fetch(`http://localhost:${port}/user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const postBody = await post.text();
  console.log('[ROUNDTRIP] POST status', post.status, 'body', postBody);
  await new Promise(r => setTimeout(r, 500));
  const get = await fetch(`http://localhost:${port}/user?email=${encodeURIComponent(email)}`);
  const getBody = await get.text();
  console.log('[ROUNDTRIP] GET status', get.status, 'body', getBody);
})();
