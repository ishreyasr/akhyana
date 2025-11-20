// @ts-nocheck
import { WebSocket } from 'ws';
// Import server after setting EMBEDDED flag so it doesn't auto-listen
process.env.V2V_EMBEDDED = '1';
const { server, CONFIG } = require('../../../Backend/server.js');

function connect(path = CONFIG.WS_PATH, token?: string) {
    return new WebSocket(`ws://localhost:${CONFIG.PORT}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
}

describe('Auth Register', () => {
    let started = false;
    beforeAll((done) => {
        if (server.listening) return done();
        server.listen(CONFIG.PORT, () => { started = true; done(); });
    });
    afterAll((done) => {
        try { server.close(() => done()); } catch { done(); }
    });

    test('rejects register without token when REQUIRE_AUTH=1', (done) => {
        process.env.REQUIRE_AUTH = '1';
        const ws = connect();
        ws.on('open', () => {
            ws.send(JSON.stringify({ event: 'register', data: { vehicleId: 'veh-noauth' } }));
        });
        ws.on('message', (raw: any) => {
            const msg = JSON.parse(raw.toString());
            if (msg.event === 'error' && msg.data.code === 'auth_failed') {
                ws.close();
                done();
            }
        });
    });
});
