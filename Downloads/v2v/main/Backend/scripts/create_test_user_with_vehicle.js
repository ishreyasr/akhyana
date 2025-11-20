#!/usr/bin/env node

const bcrypt = require('bcryptjs');

// Test user with proper vehicle data including license plate
const testUser = {
    email: 'test@example.com',
    fullName: 'Shreyas Test',
    vehicle: {
        vehicleId: 'test-vehicle-001',
        licensePlate: 'DL-25-AB-1234',
        vehicleType: 'Sedan',
        brand: 'Toyota',
        model: 'Camry'
    },
    password: 'password123'
};

// Test user 2 (for connected vehicle testing)
const testUser2 = {
    email: 'shreyu@example.com',
    fullName: 'Shreyu Connected',
    vehicle: {
        vehicleId: 'test-vehicle-002',
        licensePlate: 'KA-05-CD-5678',
        vehicleType: 'SUV',
        brand: 'Honda',
        model: 'CR-V'
    },
    password: 'password123'
};

async function createTestUsers() {
    try {
        console.log('Creating test users with proper vehicle data...');

        // Hash passwords
        const hashedPassword1 = await bcrypt.hash(testUser.password, 12);
        const hashedPassword2 = await bcrypt.hash(testUser2.password, 12);

        const users = [
            { ...testUser, password_hash: hashedPassword1 },
            { ...testUser2, password_hash: hashedPassword2 }
        ];

        delete users[0].password;
        delete users[1].password;

        console.log('Test users to create:');
        console.log(JSON.stringify(users, null, 2));

        // You would typically insert these into your Supabase database
        console.log('\nTo add these users to Supabase, insert them into the v2v_users table:');
        console.log('INSERT INTO v2v_users (email, full_name, vehicle, password_hash) VALUES');
        users.forEach((user, index) => {
            const comma = index < users.length - 1 ? ',' : ';';
            console.log(`('${user.email}', '${user.fullName}', '${JSON.stringify(user.vehicle)}', '${user.password_hash}')${comma}`);
        });

    } catch (error) {
        console.error('Error creating test users:', error);
    }
}

createTestUsers();
