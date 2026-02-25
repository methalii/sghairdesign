// Quick API test
const http = require('http');

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`${method} ${path} => ${res.statusCode}`);
                try { console.log(JSON.parse(data)); } catch { console.log(data); }
                resolve({ status: res.statusCode, data: JSON.parse(data) });
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function test() {
    console.log('=== Testing S&G API ===\n');

    // 1. Get settings
    await request('GET', '/api/settings');

    // 2. Create appointment
    const apt = await request('POST', '/api/appointments', {
        first_name: 'Test',
        last_name: 'Kullanici',
        phone: '05311234567',
        date: '2026-02-26',
        time: '14:00'
    });

    // 3. Check booked slots
    await request('GET', '/api/appointments/booked/2026-02-26');

    // 4. Try double-booking (should fail 409)
    await request('POST', '/api/appointments', {
        first_name: 'Duplicate',
        last_name: 'Test',
        phone: '05399999999',
        date: '2026-02-26',
        time: '14:00'
    });

    // 5. Get all appointments
    await request('GET', '/api/appointments');

    // 6. Delete appointment
    if (apt.data?.id) {
        await request('DELETE', `/api/appointments/${apt.data.id}`);
    }

    // 7. Verify booked slots are empty again
    await request('GET', '/api/appointments/booked/2026-02-26');

    // 8. Admin verify (correct password)
    await request('POST', '/api/admin/verify', { password: 'sg2024' });

    // 9. Admin verify (wrong password)
    await request('POST', '/api/admin/verify', { password: 'wrong' });

    console.log('\n=== All tests completed ===');
}

test().catch(console.error);
