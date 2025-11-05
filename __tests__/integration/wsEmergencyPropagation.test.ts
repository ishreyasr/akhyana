/* @ts-nocheck */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { server, CONFIG } from '../../Backend/server.js';

// Test emergency alert broadcast fan-out between two clients.

describe('Emergency Alert Propagation', () => {
    let address: any;
    beforeAll((done) => {
        process.env.V2V_EMBEDDED = '1';
        const s = server.listen(0, () => { address = s.address(); done(); });
    });
    afterAll(() => { try { server.close(); } catch { }; });

    function connectVehicle(id: string) {
        return new Promise((resolve) => {
            const ws = new WebSocket(`ws://127.0.0.1:${address.port}${CONFIG.WS_PATH}`);
            ws.on('open', () => {
                ws.send(JSON.stringify({ event: 'register', data: { vehicleId: id } }));
            });
            ws.on('message', (m) => {
                const msg = JSON.parse(m.toString());
                if (msg.event === 'registered') resolve(ws);
            });
        });
    }

    it('broadcasts emergency alert to other registered vehicle', async () => {
        const a: any = await connectVehicle('veh-A');
        const b: any = await connectVehicle('veh-B');

        let received: any = null;
        b.on('message', (m: any) => {
            const msg = JSON.parse(m.toString());
            if (msg.event === 'emergency_alert') { received = msg; }
        });

        a.send(JSON.stringify({ event: 'emergency_alert', data: { senderId: 'veh-A', vehicleInfo: { type: 'test' } } }));

        await new Promise(r => setTimeout(r, 150));
        expect(received).toBeTruthy();
        expect(received.data.data.senderId || received.data.senderId).toBe('veh-A');
        try { a.close(); b.close(); } catch { }
    });
});
