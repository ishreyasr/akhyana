const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Store active connections
const clients = new Map();

module.exports = (req, res) => {
  // Enable WebSocket upgrade
  if (req.headers['upgrade'] === 'websocket') {
    const ws = new WebSocket.Server({ noServer: true });
    
    ws.handleUpgrade(req, req.socket, Buffer.alloc(0), (client) => {
      handleWebSocketConnection(client);
    });
  } else {
    // HTTP endpoint for health check
    res.status(200).json({ 
      status: 'ok', 
      service: 'V2V WebSocket Server',
      connections: clients.size 
    });
  }
};

function handleWebSocketConnection(ws) {
  let vehicleId = null;
  
  console.log('[WebSocket] New connection');
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'register':
          vehicleId = message.vehicleId;
          clients.set(vehicleId, ws);
          ws.send(JSON.stringify({ type: 'registered', vehicleId }));
          break;
          
        case 'location_update':
          if (vehicleId) {
            // Update location in Supabase
            await supabase
              .from('vehicles')
              .update({
                location: `POINT(${message.longitude} ${message.latitude})`,
                last_seen: new Date().toISOString()
              })
              .eq('vehicle_id', vehicleId);
          }
          break;
          
        case 'emergency_alert':
          // Broadcast emergency alert to all connected clients
          const alertData = {
            type: 'emergency_alert',
            payload: message.payload
          };
          
          clients.forEach((client, id) => {
            if (client.readyState === WebSocket.OPEN && id !== vehicleId) {
              client.send(JSON.stringify(alertData));
            }
          });
          break;
          
        case 'call_signal':
          // Forward call signaling to target peer
          const targetId = message.targetId;
          const targetWs = clients.get(targetId);
          
          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify({
              type: 'call_signal',
              from: vehicleId,
              signal: message.signal
            }));
          }
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Error:', error);
    }
  });
  
  ws.on('close', () => {
    if (vehicleId) {
      clients.delete(vehicleId);
      console.log(`[WebSocket] Client disconnected: ${vehicleId}`);
    }
  });
  
  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
  });
}
