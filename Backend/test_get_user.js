// Run with: pnpm run test:get-user <email>
const email = process.argv[2];
if (!email) { console.error('Usage: pnpm run test:get-user <email>'); process.exit(1); }
(async () => {
  const port = process.env.V2V_SERVER_PORT || 3002;
  try {
    const r = await fetch(`http://localhost:${port}/user?email=${encodeURIComponent(email)}`);
    const txt = await r.text();
    console.log('GET status', r.status, 'body', txt);
  } catch (e) { console.error('GET error', e); }
})();
