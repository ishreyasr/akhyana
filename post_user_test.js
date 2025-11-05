const http = require('http');
const data = JSON.stringify({ email: 'diag7@test.com', fullName: 'Diag7', password: 'secret12', vehicle: { vehicleId: 'veh-diag7' } });
const req = http.request({ hostname: 'localhost', port: 3002, path: '/user', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => { console.log('STATUS', res.statusCode); console.log('BODY', body); });
});
req.on('error', e => console.error('ERR', e));
req.write(data);
req.end();
