// Script de test pour l'API Google Directions avec différents modes de transport
const https = require('https');

// Clé API (remplacer par la vraie clé)
const API_KEY = 'AIzaSyAqdecyujdttsHAnmu6cpXwL-eFu0urCzA';

// Coordonnées de test (Douala → Yaoundé)
const origin = '4.0510564,9.7678687';
const destination = '3.8480304,11.5020759';

const modes = ['driving', 'walking', 'bicycling', 'transit'];

function testDirectionsAPI(mode) {
    return new Promise((resolve, reject) => {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${API_KEY}&language=fr&units=metric&mode=${mode}`;
        
        console.log(`\n=== Test mode: ${mode} ===`);
        console.log(`URL: ${url}`);
        
        const req = https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`Status: ${result.status}`);
                    console.log(`Routes found: ${result.routes?.length || 0}`);
                    
                    if (result.status !== 'OK') {
                        console.log(`Error: ${result.error_message || 'No error message'}`);
                        console.log(`Full response:`, JSON.stringify(result, null, 2));
                    } else if (result.routes && result.routes.length > 0) {
                        const route = result.routes[0];
                        console.log(`Distance: ${route.legs?.[0]?.distance?.text || 'N/A'}`);
                        console.log(`Duration: ${route.legs?.[0]?.duration?.text || 'N/A'}`);
                        console.log(`Steps: ${route.legs?.[0]?.steps?.length || 0}`);
                    }
                    
                    resolve(result);
                } catch (error) {
                    console.error(`Parse error for mode ${mode}:`, error);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error(`Request error for mode ${mode}:`, error);
            reject(error);
        });
        
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error(`Timeout for mode ${mode}`));
        });
    });
}

async function testAllModes() {
    console.log('Testing Google Directions API for all travel modes...');
    
    for (const mode of modes) {
        try {
            await testDirectionsAPI(mode);
        } catch (error) {
            console.error(`Failed to test mode ${mode}:`, error.message);
        }
        
        // Attendre 1 seconde entre les requêtes pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n=== Test completed ===');
}

testAllModes().catch(console.error);
