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

async function testAppReelle() {
    console.log('📱 TEST APPLICATION RÉELLE - DIAGNOSTIC\n');

    const testEmail = `test-reel-${Date.now()}@yukpomnang.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test Reel User';

    try {
        // 1. Test d'inscription
        console.log('1️⃣ TEST D\'INSCRIPTION\n');
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

                    // Simuler l'objet User que devrait créer AuthContext
                    const simulatedUser = {
                        id: String(decoded.sub),
                        email: decoded.email,
                        role: decoded.role,
                        name: decoded.name || testName,
                        credits: decoded.tokens_balance ?? 0,
                        phone: '+237123456789',
                        photo: '',
                        token: registerResponse.data.token
                    };

                    console.log('   📱 Objet User simulé pour AuthContext:');
                    console.log('      - ID:', simulatedUser.id);
                    console.log('      - Email:', simulatedUser.email);
                    console.log('      - Rôle:', simulatedUser.role);
                    console.log('      - Nom:', simulatedUser.name);
                    console.log('      - Credits:', simulatedUser.credits);
                    console.log('      - Token présent:', !!simulatedUser.token);

                    // Vérifier si l'objet User est valide pour la navigation
                    if (simulatedUser.id && simulatedUser.email && simulatedUser.role) {
                        console.log('   ✅ Objet User valide - devrait basculer vers MainStack');
                    } else {
                        console.log('   ❌ Objet User invalide - restera sur AuthStack');
                        console.log('      - ID manquant:', !simulatedUser.id);
                        console.log('      - Email manquant:', !simulatedUser.email);
                        console.log('      - Rôle manquant:', !simulatedUser.role);
                    }
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
        console.log('2️⃣ TEST DE CONNEXION\n');
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

                    // Simuler l'objet User que devrait créer AuthContext
                    const simulatedUser = {
                        id: String(decoded.sub),
                        email: decoded.email,
                        role: decoded.role,
                        name: decoded.name || testName,
                        credits: decoded.tokens_balance ?? 0,
                        phone: '+237123456789',
                        photo: '',
                        token: loginResponse.data.token
                    };

                    console.log('   📱 Objet User simulé pour AuthContext:');
                    console.log('      - ID:', simulatedUser.id);
                    console.log('      - Email:', simulatedUser.email);
                    console.log('      - Rôle:', simulatedUser.role);
                    console.log('      - Nom:', simulatedUser.name);
                    console.log('      - Credits:', simulatedUser.credits);
                    console.log('      - Token présent:', !!simulatedUser.token);

                    // Vérifier si l'objet User est valide pour la navigation
                    if (simulatedUser.id && simulatedUser.email && simulatedUser.role) {
                        console.log('   ✅ Objet User valide - devrait basculer vers MainStack');
                    } else {
                        console.log('   ❌ Objet User invalide - restera sur AuthStack');
                        console.log('      - ID manquant:', !simulatedUser.id);
                        console.log('      - Email manquant:', !simulatedUser.email);
                        console.log('      - Rôle manquant:', !simulatedUser.role);
                    }
                } else {
                    console.log('   ❌ Token expiré');
                }
            } else {
                console.log('   ❌ Erreur décodage JWT');
            }
        } else {
            console.log('   ❌ Échec connexion:', loginResponse.data);
        }

        console.log('\n🔍 DIAGNOSTIC TERMINÉ !');
        console.log('\n📱 POINTS À VÉRIFIER DANS L\'APP MOBILE:');
        console.log('   1. Ouvrez l\'application mobile');
        console.log('   2. Allez dans les paramètres de développement (si disponible)');
        console.log('   3. Activez les logs de débogage');
        console.log('   4. Essayez de vous connecter/inscrire');
        console.log('   5. Regardez les logs dans la console');
        console.log('\n🔍 LOGS À CHERCHER:');
        console.log('   - [AuthContext] Token reçu, décodage JWT...');
        console.log('   - [AuthContext] Utilisateur créé depuis JWT:');
        console.log('   - [AuthContext] setUser appelé avec:');
        console.log('   - [AuthContext] Re-render forcé terminé');
        console.log('   - [AppNavigator] État actuel:');
        console.log('   - [AppNavigator] Utilisateur connecté, affichage MainStack');
        console.log('\n❓ SI LES LOGS NE S\'AFFICHENT PAS:');
        console.log('   - L\'application utilise peut-être une version sans nos corrections');
        console.log('   - Vérifiez que le build EAS est terminé');
        console.log('   - Vérifiez que vous avez installé la bonne APK');
        console.log('   - Vérifiez que l\'application a les permissions de débogage');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
    }
}

// Lancer le test
testAppReelle();
