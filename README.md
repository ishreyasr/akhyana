# Akhyana - V2V Dashboard

Vehicle-to-Vehicle (V2V) communication dashboard with WebRTC calling and emergency alerts.

## Features

- 🎙️ **Free WebRTC Voice Calling** using PeerJS
- 🚨 **Emergency Alert System** with real-time notifications
- 📍 **Location-based Proximity Detection**
- 🔔 **Real-time Vehicle Status Updates**
- 📱 **Responsive Design** for mobile and desktop
- 🎯 **Auto-connection** for emergency responses

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Node.js, WebSocket, PeerJS
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Real-time**: WebSocket for V2V communication
- **WebRTC**: PeerJS for peer-to-peer voice calling

## Local Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ishreyasr/akhyana.git
cd akhyana
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

4. Run the development servers:
```bash
# Start all servers (Frontend, PeerJS, WebSocket)
start-all-servers.bat  # Windows
# or
./start-all-servers.sh  # macOS/Linux
```

5. Open http://localhost:3000

### Running Individual Servers

```bash
# Frontend (Next.js)
pnpm dev

# PeerJS Server (port 9000)
node Backend/peerjs-server.js

# WebSocket Server (port 3002)
node Backend/server.js
```

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

### Backend Servers

The backend servers (PeerJS & WebSocket) need to be deployed separately:

**Option 1: Railway**
1. Create new project on [Railway](https://railway.app)
2. Deploy `Backend/peerjs-server.js`
3. Deploy `Backend/server.js`
4. Update frontend env vars with deployment URLs

**Option 2: Render**
1. Create web service on [Render](https://render.com)
2. Deploy each server as separate service
3. Update frontend env vars

**Option 3: Self-hosted VPS**
- Use PM2 for process management
- Set up Nginx reverse proxy
- Configure SSL certificates

### Environment Variables for Production

```env
# Vercel Dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_PEERJS_HOST=your-peerjs-server.railway.app
NEXT_PUBLIC_PEERJS_PORT=443
NEXT_PUBLIC_WS_URL=wss://your-websocket-server.railway.app
```

## Project Structure

```
├── app/                    # Next.js app router pages
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── v2v-dashboard/    # V2V-specific components
├── hooks/                # Custom React hooks
├── utils/                # Utility functions
├── Backend/              # Node.js backend servers
│   ├── peerjs-server.js  # PeerJS signaling server
│   └── server.js         # WebSocket V2V server
├── types/                # TypeScript type definitions
└── docs/                 # Documentation

```

## Key Features Explained

### WebRTC Voice Calling
- Uses PeerJS (free alternative to paid services)
- Peer-to-peer connection (no media server needed)
- Real-time audio level monitoring
- Auto-cleanup on disconnect

### Emergency Alert System
- Broadcast to nearby vehicles
- Popup notifications with Connect/Ignore options
- Auto-clear emergency badges after 5 minutes
- Session storage for emergency context

### Location Services
- PostGIS for spatial queries
- Real-time proximity detection
- Automatic location updates
- Distance calculation

## Testing

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:components
pnpm test:integration
pnpm test:e2e
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check the [documentation](./docs/)

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- WebRTC powered by [PeerJS](https://peerjs.com/)
- Database by [Supabase](https://supabase.com/)
