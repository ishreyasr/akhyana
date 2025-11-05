const { PeerServer } = require('peer');

let peerServer;

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Initialize PeerServer if not already initialized
  if (!peerServer) {
    peerServer = PeerServer({
      port: 9000,
      path: '/peerjs',
      allow_discovery: true,
    });
    console.log('[PeerJS] Server initialized on serverless function');
  }

  // Handle the request
  if (req.url.startsWith('/peerjs')) {
    // Let PeerJS handle its routes
    peerServer(req, res);
  } else {
    res.status(200).json({ 
      status: 'ok', 
      service: 'PeerJS Server',
      path: '/peerjs'
    });
  }
};
