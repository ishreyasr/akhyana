// Simple launcher to load .env.local manually in Windows PowerShell environments
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
  console.log('[launcher] Loaded .env.local');
} else {
  console.warn('[launcher] .env.local missing');
}
// Provide fallbacks
process.env.V2V_SERVER_PORT = process.env.V2V_SERVER_PORT || '3002';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
require('./server.js');