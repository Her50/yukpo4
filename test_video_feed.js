const https = require('https');

// Test simple de l'API VideoFeed
const testVideoFeed = async () => {
    const url = 'https://yukpo-backend-376093909298.europe-west1.run.app/api/content/mixed?limit=20&format=video';
    
    console.log('🔍 Test de l\'API VideoFeed...');
    console.log(`URL: ${url}`);
    
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`\n📊 Status HTTP: ${res.statusCode}`);
                console.log(`\n📦 Réponse brute (${data.length} caractères):`);
                console.log(data.substring(0, 500) + (data.length > 500 ? '...' : ''));
                
                try {
                    const parsed = JSON.parse(data);
                    console.log(`\n✅ JSON valide`);
                    console.log(`📋 Structure:`, Object.keys(parsed));
                    
                    if (parsed.data) {
                        console.log(`📋 data structure:`, Array.isArray(parsed.data) ? `Array[${parsed.data.length}]` : typeof parsed.data);
                        
                        if (Array.isArray(parsed.data) && parsed.data.length > 0) {
                            console.log(`\n🎯 Premier item:`, JSON.stringify(parsed.data[0], null, 2));
                        }
                    }
                    
                    resolve(parsed);
                } catch (e) {
                    console.log(`\n❌ JSON invalide:`, e.message);
                    resolve(data);
                }
            });
        });
        
        req.on('error', (e) => {
            console.log(`\n💥 Erreur réseau:`, e.message);
            reject(e);
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout après 10s'));
        });
    });
};

testVideoFeed().catch(console.error);
