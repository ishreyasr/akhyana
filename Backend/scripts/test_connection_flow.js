#!/usr/bin/env node

/**
 * Test script to simulate the new connection request/approval flow
 * This creates two vehicles and tests the complete flow:
 * 1. Vehicle A sends connection request to Vehicle B
 * 2. Vehicle B receives the request 
 * 3. Vehicle B can approve/decline
 * 4. Both vehicles receive the response
 */

const WebSocket = require('ws');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testConnectionFlow() {
    console.log('🚀 Testing V2V Connection Request/Approval Flow');
    console.log('==================================================');

    const vehicleA = {
        id: 'test-vehicle-A-' + Date.now(),
        coords: [37.7749, -122.4194], // San Francisco
        ws: null,
        events: []
    };

    const vehicleB = {
        id: 'test-vehicle-B-' + Date.now(),
        coords: [37.7752, -122.4197], // ~400m from vehicleA
        ws: null,
        events: []
    };

    let requestReceived = false;
    let responseReceived = false;

    // Connect Vehicle A
    console.log('\n📡 Connecting Vehicle A...');
    vehicleA.ws = new WebSocket('ws://localhost:3002/v2v');

    await new Promise((resolve) => {
        vehicleA.ws.on('open', () => {
            console.log('✅ Vehicle A connected');
            vehicleA.ws.send(JSON.stringify({
                event: 'register',
                data: {
                    vehicleId: vehicleA.id,
                    driverName: 'Driver A',
                    vehicleInfo: { model: 'Tesla Model 3', color: 'blue' }
                }
            }));
            resolve();
        });
    });

    await sleep(1000);

    // Connect Vehicle B
    console.log('\n📡 Connecting Vehicle B...');
    vehicleB.ws = new WebSocket('ws://localhost:3002/v2v');

    await new Promise((resolve) => {
        vehicleB.ws.on('open', () => {
            console.log('✅ Vehicle B connected');
            vehicleB.ws.send(JSON.stringify({
                event: 'register',
                data: {
                    vehicleId: vehicleB.id,
                    driverName: 'Driver B',
                    vehicleInfo: { model: 'Honda Civic', color: 'red' }
                }
            }));
            resolve();
        });
    });

    await sleep(1000);

    // Set up message handlers
    vehicleA.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        vehicleA.events.push(msg);
        console.log(`[Vehicle A] Received: ${msg.event}`, msg.data || {});

        if (msg.event === 'connect_response') {
            responseReceived = true;
            if (msg.data.approved) {
                console.log('🎉 CONNECTION APPROVED! Vehicle A can proceed to connected dashboard');
            } else {
                console.log('❌ CONNECTION DECLINED:', msg.data.reason || 'No reason given');
            }
        }
    });

    vehicleB.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        vehicleB.events.push(msg);
        console.log(`[Vehicle B] Received: ${msg.event}`, msg.data || {});

        if (msg.event === 'connect_request') {
            requestReceived = true;
            console.log('📬 CONNECTION REQUEST RECEIVED! Vehicle B should show approval dialog');
            console.log(`   Requester: ${msg.data.requesterId}`);
            console.log(`   Purpose: ${msg.data.purpose || 'Not specified'}`);

            // Simulate user approval after 3 seconds
            setTimeout(() => {
                console.log('\n🤔 Vehicle B is deciding... (simulating user interaction)');
                setTimeout(() => {
                    console.log('✅ Vehicle B APPROVES the connection request');
                    vehicleB.ws.send(JSON.stringify({
                        event: 'connect_response',
                        data: {
                            requesterId: msg.data.requesterId,
                            targetId: msg.data.targetId,
                            approved: true,
                            reason: 'approved'
                        }
                    }));
                }, 2000);
            }, 1000);
        }
    });

    // Send locations so vehicles can see each other
    console.log('\n📍 Sending vehicle locations...');

    vehicleA.ws.send(JSON.stringify({
        event: 'location_update',
        data: {
            vehicleId: vehicleA.id,
            lat: vehicleA.coords[0],
            lon: vehicleA.coords[1]
        }
    }));

    vehicleB.ws.send(JSON.stringify({
        event: 'location_update',
        data: {
            vehicleId: vehicleB.id,
            lat: vehicleB.coords[0],
            lon: vehicleB.coords[1]
        }
    }));

    await sleep(2000);

    // Vehicle A sends connection request to Vehicle B
    console.log('\n📤 Vehicle A sends connection request to Vehicle B...');
    vehicleA.ws.send(JSON.stringify({
        event: 'connect_request',
        data: {
            requesterId: vehicleA.id,
            targetId: vehicleB.id,
            purpose: 'v2v_communication'
        }
    }));

    // Wait for the complete flow
    console.log('\n⏳ Waiting for connection flow to complete...');
    await sleep(10000);

    // Check results
    console.log('\n📊 Test Results:');
    console.log('================');

    if (requestReceived && responseReceived) {
        console.log('✅ SUCCESS: Complete connection request/approval flow worked!');
        console.log('✅ Vehicle B received the connection request');
        console.log('✅ Vehicle A received the approval response');
        console.log('');
        console.log('🎯 Frontend Integration Points:');
        console.log('  - NearbyDevicesList: Connect button should send connect_request');
        console.log('  - ConnectionDialog: Should handle real WebSocket requests');
        console.log('  - ConnectionApprovalDialog: Should listen for connect_request events');
        console.log('  - Both vehicles: Should redirect to /connected-vehicle on approval');
    } else if (requestReceived) {
        console.log('⚠️  PARTIAL: Request received but no response');
        console.log(`   Request received: ${requestReceived}`);
        console.log(`   Response received: ${responseReceived}`);
    } else {
        console.log('❌ FAILED: Connection request flow did not work');
        console.log('💡 Check server logs and WebSocket connection');
    }

    // Show event summary
    console.log('\n📋 Event Summary:');
    console.log('Vehicle A events:', vehicleA.events.map(e => e.event));
    console.log('Vehicle B events:', vehicleB.events.map(e => e.event));

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    vehicleA.ws.close();
    vehicleB.ws.close();

    console.log('🔚 Test completed');
}

// Run the test
testConnectionFlow().catch(console.error);
