#!/usr/bin/env node

/**
 * Test de connexion à l'API Yukpomnang
 * 
 * Usage: node test-api-backend.js
 */

const https = require('https');

const API_BASE_URL = 'yukpomnang.onrender.com';

console.log('🔍 Test de connexion à l\'API Yukpomnang');
console.log('='.repeat(60));

// Test 1: Health check
async function testHealthCheck() {
    return new Promise((resolve) => {
        console.log('\n📡 Test 1: Health Check');
        console.log(`URL: https://${API_BASE_URL}/health`);

        const req = https.get(`https://${API_BASE_URL}/health`, (res) => {
            console.log(`✅ Status: ${res.statusCode}`);
            console.log(`Headers:`, JSON.stringify(res.headers, null, 2));

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`Response: ${data}`);
                resolve(res.statusCode === 200);
            });
        });

        req.on('error', (error) => {
            console.error(`❌ Erreur: ${error.message}`);
            resolve(false);
        });

        req.setTimeout(5000, () => {
            console.error('❌ Timeout (5s)');
            req.destroy();
            resolve(false);
        });
    });
}

// Test 2: Balance endpoint (nécessite authentification)
async function testBalanceEndpoint() {
    return new Promise((resolve) => {
        console.log('\n📡 Test 2: Balance Endpoint (sans auth)');
        console.log(`URL: https://${API_BASE_URL}/api/users/balance`);

        const req = https.get(`https://${API_BASE_URL}/api/users/balance`, (res) => {
            console.log(`Status: ${res.statusCode}`);

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`Response: ${data}`);
                // 401 est normal ici (pas de token)
                if (res.statusCode === 401) {
                    console.log('✅ Endpoint accessible (401 = auth requise, normal)');
                    resolve(true);
                } else {
                    resolve(res.statusCode < 500);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ Erreur: ${error.message}`);
            resolve(false);
        });

        req.setTimeout(5000, () => {
            console.error('❌ Timeout (5s)');
            req.destroy();
            resolve(false);
        });
    });
}

// Test 3: Service creation endpoint structure
async function testServiceCreateEndpoint() {
    return new Promise((resolve) => {
        console.log('\n📡 Test 3: Service Create Endpoint (sans data)');
        console.log(`URL: https://${API_BASE_URL}/api/services/create`);

        const postData = JSON.stringify({
            user_id: 999,
            data: {}
        });

        const options = {
            hostname: API_BASE_URL,
            port: 443,
            path: '/api/services/create',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, JSON.stringify(res.headers, null, 2));

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`Response: ${data}`);
                // 401 ou 400 sont acceptables (pas de token ou data invalide)
                if (res.statusCode === 401 || res.statusCode === 400) {
                    console.log(`✅ Endpoint accessible (${res.statusCode} = normal sans auth/data valide)`);
                    resolve(true);
                } else if (res.statusCode === 500) {
                    console.error('❌ Erreur 500 détectée !');
                    console.error('Cela suggère un problème serveur ou de validation');
                    resolve(false);
                } else {
                    resolve(res.statusCode < 500);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`❌ Erreur: ${error.message}`);
            resolve(false);
        });

        req.setTimeout(5000, () => {
            console.error('❌ Timeout (5s)');
            req.destroy();
            resolve(false);
        });

        req.write(postData);
        req.end();
    });
}

// Exécuter tous les tests
async function runAllTests() {
    console.log('Démarrage des tests...\n');

    const results = {
        health: await testHealthCheck(),
        balance: await testBalanceEndpoint(),
        create: await testServiceCreateEndpoint()
    };

    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSULTATS');
    console.log('='.repeat(60));
    console.log(`Health Check:           ${results.health ? '✅ OK' : '❌ ÉCHEC'}`);
    console.log(`Balance Endpoint:       ${results.balance ? '✅ OK' : '❌ ÉCHEC'}`);
    console.log(`Service Create:         ${results.create ? '✅ OK' : '❌ ÉCHEC'}`);

    const allPassed = Object.values(results).every(r => r);

    console.log('\n' + '='.repeat(60));
    if (allPassed) {
        console.log('✅ TOUS LES TESTS PASSENT');
        console.log('L\'API est accessible depuis votre réseau.');
    } else {
        console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ');
        console.log('Problème de connexion à l\'API détecté.');
    }
    console.log('='.repeat(60));
}

// Lancer les tests
runAllTests().catch(console.error);

