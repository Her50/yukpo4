// Script de test pour l'API backend avec différents modes de transport
const http = require('http');

const API_BASE = 'http://localhost:8080'; // Adapter si nécessaire
const ENDPOINT = '/api/navigation/routes';

// Données de test
const testData = {
    origin: { lat: 4.0510564, lng: 9.7678687 }, // Douala
    destination: { lat: 3.8480304, lng: 11.5020759 }, // Yaoundé
    alternatives: true,
    avoid: [],
    traffic_model: 'best_guess'
};

const modes = ['driving', 'walking', 'bicycling', 'transit'];

function testBackendAPI(mode) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            ...testData,
            mode: mode
        });

        const options = {
            hostname: 'localhost',
            port: 8080,
            path: ENDPOINT,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        console.log(`\n=== Test backend mode: ${mode} ===`);
        console.log(`Data: ${postData}`);

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`Status: ${res.statusCode}`);
                    console.log(`Response:`, JSON.stringify(result, null, 2));
                    resolve(result);
                } catch (error) {
                    console.error(`Parse error:`, error);
                    console.log(`Raw response:`, data);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`Request error:`, error);
            reject(error);
        });

        req.setTimeout(20000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.write(postData);
        req.end();
    });
}

async function testAllModes() {
    console.log('Testing backend navigation API...');
    
    for (const mode of modes) {
        try {
            await testBackendAPI(mode);
        } catch (error) {
            console.error(`Failed to test mode ${mode}:`, error.message);
        }
        
        // Attendre 2 secondes entre les requêtes
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n=== Test completed ===');
}

testAllModes().catch(console.error);
