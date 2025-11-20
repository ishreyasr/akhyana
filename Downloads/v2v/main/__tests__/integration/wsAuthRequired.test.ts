/* @ts-nocheck */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { server, CONFIG } from '../../Backend/server.js';

// Ensures REQUIRE_AUTH flag forces token requirement and invalid token rejected

describe('WS Auth Required Register', () => {
    let address: any;
    beforeAll((done) => {
        process.env.REQUIRE_AUTH = '1';
        process.env.V2V_EMBEDDED = '1';
        const s = server.listen(0, () => { address = s.address(); done(); });
    });
    afterAll(() => {
        try { server.close(); } catch { }
    });

    function connect(headers?: any) {
        return new WebSocket(`ws://127.0.0.1:${address.port}${CONFIG.WS_PATH}`, { headers });
    }

    it('rejects register without token', async () => {
        const ws = connect();
        const errors: any[] = [];
        await new Promise((resolve) => {
            ws.on('open', () => {
                ws.send(JSON.stringify({ event: 'register', data: { vehicleId: 'veh-no-token' } }));
            });
            ws.on('message', m => {
                const msg = JSON.parse(m.toString());
                if (msg.event === 'error') { errors.push(msg); resolve(null); }
            });
        });
        expect(errors.length).toBe(1);
        expect(errors[0].data.code).toBe('auth_failed');
        try { ws.close(); } catch { }
    });

    it('accepts register with dummy token when firebase not active', async () => {
        const ws = connect({ Authorization: 'Bearer dummy' });
        const events: any[] = [];
        await new Promise((resolve) => {
            ws.on('open', () => {
                ws.send(JSON.stringify({ event: 'register', data: { vehicleId: 'veh-ok', authToken: 'dummy' } }));
            });
            ws.on('message', m => {
                const msg = JSON.parse(m.toString());
                events.push(msg);
                if (msg.event === 'registered') resolve(null);
            });
        });
        expect(events.find(e => e.event === 'registered')).toBeTruthy();
        try { ws.close(); } catch { }
    });
});
