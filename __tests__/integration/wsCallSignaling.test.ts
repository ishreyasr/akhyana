/* @ts-nocheck */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { server, CONFIG, callSessions } from '../../Backend/server.js';

// Call signaling: initiate then answer -> session transitions to active.

describe('Call Signaling', () => {
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

    it('records call session after offer/answer', async () => {
        const caller: any = await connectVehicle('veh-call-A');
        const callee: any = await connectVehicle('veh-call-B');

        let offerReceived = false;
        let answerReceived = false;

        callee.on('message', (m: any) => {
            const msg = JSON.parse(m.toString());
            if (msg.event === 'call_initiate') {
                offerReceived = true;
                // Respond with answer
                callee.send(JSON.stringify({ event: 'webrtc_answer', data: { callerId: 'veh-call-A', calleeId: 'veh-call-B', sdp: { type: 'answer' } } }));
            }
        });

        caller.on('message', (m: any) => {
            const msg = JSON.parse(m.toString());
            if (msg.event === 'webrtc_answer') answerReceived = true;
        });

        caller.send(JSON.stringify({ event: 'call_initiate', data: { callerId: 'veh-call-A', calleeId: 'veh-call-B', sdp: { type: 'offer' } } }));

        await new Promise(r => setTimeout(r, 250));

        expect(offerReceived).toBe(true);
        expect(answerReceived).toBe(true);

        // Validate session stored and active
        const sessions = Array.from(callSessions.values());
        const session = sessions.find(s => s.callerId === 'veh-call-A' && s.calleeId === 'veh-call-B');
        expect(session).toBeTruthy();
        expect(session.state).toBe('active');

        try { caller.close(); callee.close(); } catch { }
    });
});
