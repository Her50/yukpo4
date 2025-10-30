const https = require('https');

// Configuration
const API_BASE_URL = 'yukpomnang.onrender.com';
const TEST_USER_ID = 17; // ID de l'utilisateur qui a l'erreur

// Payload minimal pour tester la création de service
const testPayload = {
    user_id: TEST_USER_ID,
    data: {
        type: "prestation_service",
        nom: "Test Service",
        description: "Service de test pour diagnostiquer l'erreur 500",
        prix: 1000,
        categoriePrestation: "informatique",
        ville: "Douala",
        // Données minimales requises
        titre_service: {
            valeur: "Test Service",
            type: "text"
        },
        description_service: {
            valeur: "Service de test",
            type: "text"
        },
        prix_service: {
            valeur: 1000,
            type: "number"
        }
    }
};

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_BASE_URL,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Yukpomnang-Debug-Tool/1.0'
            }
        };

        if (data) {
            const jsonData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        }

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: responseData
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testServiceCreation() {
    console.log('🔍 Test de création de service...');
    console.log('📊 Payload envoyé:', JSON.stringify(testPayload, null, 2));
    
    try {
        const response = await makeRequest('/api/services/create', 'POST', testPayload);
        
        console.log('\n📈 Résultat:');
        console.log('Status Code:', response.statusCode);
        console.log('Headers:', response.headers);
        console.log('Response Body:', response.data);
        
        if (response.statusCode === 500) {
            console.log('\n❌ ERREUR 500 DÉTECTÉE');
            console.log('🔍 Analyse des logs backend nécessaires...');
            console.log('\n📋 Pour diagnostiquer:');
            console.log('1. Vérifiez les logs sur Render.com');
            console.log('2. Cherchez les logs contenant:');
            console.log('   - [DEBUG][HANDLE_CREER_SERVICE]');
            console.log('   - [creer_service]');
            console.log('   - Erreur SQL lors de l\'insertion');
            console.log('   - Échec insertion service');
        } else if (response.statusCode === 201) {
            console.log('\n✅ Service créé avec succès!');
        } else {
            console.log('\n⚠️  Statut inattendu:', response.statusCode);
        }
        
    } catch (error) {
        console.error('❌ Erreur de connexion:', error.message);
    }
}

async function testHealthCheck() {
    console.log('🏥 Test de santé du backend...');
    
    try {
        const response = await makeRequest('/health');
        console.log('Status:', response.statusCode);
        console.log('Response:', response.data);
        return response.statusCode === 200;
    } catch (error) {
        console.error('❌ Backend inaccessible:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Diagnostic de l\'erreur 500 - Création de service');
    console.log('=' .repeat(60));
    
    // Test 1: Vérifier que le backend est accessible
    const isHealthy = await testHealthCheck();
    if (!isHealthy) {
        console.log('❌ Backend inaccessible, arrêt du test');
        return;
    }
    
    console.log('\n' + '=' .repeat(60));
    
    // Test 2: Tenter la création de service
    await testServiceCreation();
    
    console.log('\n' + '=' .repeat(60));
    console.log('📝 Instructions pour les logs backend:');
    console.log('1. Allez sur https://dashboard.render.com');
    console.log('2. Sélectionnez votre service backend');
    console.log('3. Allez dans l\'onglet "Logs"');
    console.log('4. Cherchez les logs récents avec:');
    console.log('   - [DEBUG][HANDLE_CREER_SERVICE]');
    console.log('   - [creer_service]');
    console.log('   - Erreur SQL');
    console.log('5. Copiez les logs d\'erreur et partagez-les');
}

main().catch(console.error);
