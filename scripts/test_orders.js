import fetch from 'node-fetch';

async function test() {
    try {
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: 'jeet1122',
                password: 'password', // Assumed password. If wrong, we'll get unauthorized
                role: 'seller'
            })
        });
        const loginData = await loginRes.json();
        console.log('Login:', loginData);

        if (loginData.data && loginData.data.token) {
            const token = loginData.data.token;
            console.log('Fetching orders...');
            const ordersRes = await fetch('http://localhost:5000/api/orders/seller', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const ordersData = await ordersRes.json();
            console.log('Orders Response:', ordersRes.status, JSON.stringify(ordersData, null, 2));
        }
    } catch (e) { console.error(e); }
}

test();
