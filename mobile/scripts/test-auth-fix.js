const https = require('https');

const API_BASE_URL = 'https://yukpomnang.onrender.com';

// Fonction pour faire des appels API
async function apiCall(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${API_BASE_URL}${endpoint}`);

        const requestOptions = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: jsonData,
                        success: res.statusCode >= 200 && res.statusCode < 300
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: data,
                        success: false,
                        error: 'Invalid JSON response'
                    });
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Test de décodage JWT (simulation)
function decodeJWT(token) {
    try {
        // Décoder le payload (partie centrale du JWT)
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Token JWT invalide');
        }

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload;
    } catch (error) {
        console.error('Erreur décodage JWT:', error);
        return null;
    }
}

async function testAuthFlow() {
    console.log('🧪 Test du flux d\'authentification corrigé\n');

    const testEmail = `test-${Date.now()}@yukpomnang.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test User';

    try {
        // 1. Test d'inscription
        console.log('1️⃣ Test d\'inscription...');
        const registerResponse = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                nom: testName,
                prenom: testName,
                name: testName,
                email: testEmail,
                password: testPassword,
                phone: '+237123456789'
            })
        });

        console.log('   Status:', registerResponse.status);
        console.log('   Success:', registerResponse.success);

        if (registerResponse.success && registerResponse.data?.token) {
            console.log('   ✅ Inscription réussie avec token');

            // Décoder le JWT
            const decoded = decodeJWT(registerResponse.data.token);
            if (decoded) {
                console.log('   📋 Token décodé:');
                console.log('      - ID utilisateur:', decoded.sub);
                console.log('      - Email:', decoded.email);
                console.log('      - Rôle:', decoded.role);
                console.log('      - Nom:', decoded.name);
                console.log('      - Tokens balance:', decoded.tokens_balance);
                console.log('      - Expiration:', new Date(decoded.exp * 1000).toLocaleString());

                // Vérifier si le token est valide
                if (decoded.exp * 1000 > Date.now()) {
                    console.log('   ✅ Token valide (non expiré)');
                } else {
                    console.log('   ❌ Token expiré');
                }
            } else {
                console.log('   ❌ Erreur décodage JWT');
            }
        } else {
            console.log('   ❌ Échec inscription:', registerResponse.data);
        }

        console.log('');

        // 2. Test de connexion
        console.log('2️⃣ Test de connexion...');
        const loginResponse = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });

        console.log('   Status:', loginResponse.status);
        console.log('   Success:', loginResponse.success);

        if (loginResponse.success && loginResponse.data?.token) {
            console.log('   ✅ Connexion réussie avec token');

            // Décoder le JWT
            const decoded = decodeJWT(loginResponse.data.token);
            if (decoded) {
                console.log('   📋 Token décodé:');
                console.log('      - ID utilisateur:', decoded.sub);
                console.log('      - Email:', decoded.email);
                console.log('      - Rôle:', decoded.role);
                console.log('      - Nom:', decoded.name);
                console.log('      - Tokens balance:', decoded.tokens_balance);
                console.log('      - Expiration:', new Date(decoded.exp * 1000).toLocaleString());

                // Vérifier si le token est valide
                if (decoded.exp * 1000 > Date.now()) {
                    console.log('   ✅ Token valide (non expiré)');
                } else {
                    console.log('   ❌ Token expiré');
                }
            } else {
                console.log('   ❌ Erreur décodage JWT');
            }
        } else {
            console.log('   ❌ Échec connexion:', loginResponse.data);
        }

        console.log('');

        // 3. Test de vérification de token
        if (loginResponse.success && loginResponse.data?.token) {
            console.log('3️⃣ Test de vérification de token...');
            const verifyResponse = await apiCall('/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${loginResponse.data.token}`
                }
            });

            console.log('   Status:', verifyResponse.status);
            console.log('   Success:', verifyResponse.success);

            if (verifyResponse.success) {
                console.log('   ✅ Token vérifié avec succès');
                console.log('   📋 Données utilisateur:', verifyResponse.data);
            } else {
                console.log('   ❌ Échec vérification token:', verifyResponse.data);
            }
        }

        console.log('\n🎉 Test du flux d\'authentification terminé !');
        console.log('\n📱 Le mobile devrait maintenant:');
        console.log('   - Décoder le JWT après connexion/inscription');
        console.log('   - Créer l\'objet utilisateur depuis le JWT');
        console.log('   - Basculer vers la page d\'accueil automatiquement');
        console.log('   - Persister l\'utilisateur au redémarrage de l\'app');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
    }
}

// Lancer le test
testAuthFlow();

