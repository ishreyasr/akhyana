/* @ts-nocheck */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { server, CONFIG } from '../../Backend/server.js';

// Proximity enter/exit by moving vehicle B inside and outside radius of A.

describe('Proximity Enter/Exit Events', () => {
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

    it('emits enter then exit events', async () => {
        const a: any = await connectVehicle('veh-prox-A');
        const b: any = await connectVehicle('veh-prox-B');

        const events: any[] = [];
        a.on('message', (m: any) => {
            const msg = JSON.parse(m.toString());
            if (msg.event === 'proximity_event') events.push(msg.data);
        });

        // Place A at fixed point
        a.send(JSON.stringify({ event: 'location_update', data: { vehicleId: 'veh-prox-A', lat: 37.7749, lon: -122.4194 } }));
        // Move B inside radius (~100m away)
        b.send(JSON.stringify({ event: 'location_update', data: { vehicleId: 'veh-prox-B', lat: 37.7755, lon: -122.4189 } }));

        await new Promise(r => setTimeout(r, 300));

        // Move B far outside radius
        b.send(JSON.stringify({ event: 'location_update', data: { vehicleId: 'veh-prox-B', lat: 37.8044, lon: -122.2712 } })); // Oakland ~12km

        await new Promise(r => setTimeout(r, 400));

        const hasEnter = events.some(e => e.eventType === 'enter' && e.peerVehicleId === 'veh-prox-B');
        const hasExit = events.some(e => e.eventType === 'exit' && e.peerVehicleId === 'veh-prox-B');

        expect(hasEnter).toBe(true);
        expect(hasExit).toBe(true);

        try { a.close(); b.close(); } catch { }
    });
});
