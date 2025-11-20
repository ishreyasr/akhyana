/**
 * Local PeerJS Signaling Server
 * Free, self-hosted alternative to PeerJS cloud
 * 
 * Run: node Backend/peerjs-server.js
 */

const { PeerServer } = require('peer');

const PORT = process.env.PORT || process.env.PEERJS_PORT || 9000;

const server = PeerServer({
    port: PORT,
    path: '/peerjs',
    // Enable CORS for local development
    allow_discovery: true,
    // Optional: Enable SSL in production
    // ssl: {
    //   key: fs.readFileSync('/path/to/key.pem'),
    //   cert: fs.readFileSync('/path/to/cert.pem')
    // }
});

server.on('connection', (client) => {
    console.log('🔵 PeerJS client connected:', client.getId());
});

server.on('disconnect', (client) => {
    console.log('🔴 PeerJS client disconnected:', client.getId());
});

console.log('🚀 PeerJS signaling server running on:');
console.log(`   http://localhost:${PORT}/peerjs`);
console.log('');
console.log('Configure your app to use:');
console.log(`   host: 'localhost'`);
console.log(`   port: ${PORT}`);
console.log(`   path: '/peerjs'`);
