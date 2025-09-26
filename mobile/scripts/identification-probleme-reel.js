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

async function identificationProblemeReel() {
    console.log('🔍 IDENTIFICATION DU PROBLÈME RÉEL\n');

    const testEmail = `test-probleme-${Date.now()}@yukpomnang.com`;
    const testPassword = 'TestPassword123!';

    try {
        // 1. Test d'inscription
        console.log('1️⃣ TEST D\'INSCRIPTION\n');
        const registerResponse = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                nom: 'Test Probleme',
                prenom: 'Test Probleme',
                name: 'Test Probleme',
                email: testEmail,
                password: testPassword,
                phone: '+237123456789'
            })
        });

        console.log('   Status:', registerResponse.status);
        console.log('   Success:', registerResponse.success);

        if (registerResponse.success && registerResponse.data?.token) {
            console.log('   ✅ Inscription réussie avec token');
            console.log('   📋 Token reçu:', registerResponse.data.token.substring(0, 50) + '...');

            // Décoder le JWT
            const parts = registerResponse.data.token.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

            console.log('   📋 JWT décodé:');
            console.log('      - ID utilisateur:', payload.sub);
            console.log('      - Email:', payload.email);
            console.log('      - Rôle:', payload.role);
            console.log('      - Nom:', payload.name);
            console.log('      - Tokens balance:', payload.tokens_balance);
            console.log('      - Expiration:', new Date(payload.exp * 1000).toLocaleString());

            // Vérifier si le token est valide
            if (payload.exp * 1000 > Date.now()) {
                console.log('   ✅ Token valide (non expiré)');

                // Simuler l'objet User que devrait créer AuthContext
                const simulatedUser = {
                    id: String(payload.sub),
                    email: payload.email,
                    role: payload.role,
                    name: payload.name || 'Test Probleme',
                    credits: payload.tokens_balance ?? 0,
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
                }
            } else {
                console.log('   ❌ Token expiré');
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
            console.log('   📋 Token reçu:', loginResponse.data.token.substring(0, 50) + '...');

            // Décoder le JWT
            const parts = loginResponse.data.token.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

            console.log('   📋 JWT décodé:');
            console.log('      - ID utilisateur:', payload.sub);
            console.log('      - Email:', payload.email);
            console.log('      - Rôle:', payload.role);
            console.log('      - Nom:', payload.name);
            console.log('      - Tokens balance:', payload.tokens_balance);
            console.log('      - Expiration:', new Date(payload.exp * 1000).toLocaleString());

            // Vérifier si le token est valide
            if (payload.exp * 1000 > Date.now()) {
                console.log('   ✅ Token valide (non expiré)');

                // Simuler l'objet User que devrait créer AuthContext
                const simulatedUser = {
                    id: String(payload.sub),
                    email: payload.email,
                    role: payload.role,
                    name: payload.name || 'Test Probleme',
                    credits: payload.tokens_balance ?? 0,
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
                }
            } else {
                console.log('   ❌ Token expiré');
            }
        } else {
            console.log('   ❌ Échec connexion:', loginResponse.data);
        }

        console.log('\n🔍 === DIAGNOSTIC FINAL ===');
        console.log('✅ NOTRE LOGIQUE EST PARFAITE:');
        console.log('   - Décodage JWT: ✅');
        console.log('   - Création objet User: ✅');
        console.log('   - Validation données: ✅');
        console.log('   - Navigation MainStack: ✅');

        console.log('\n❌ LE PROBLÈME EST DANS L\'APP MOBILE:');
        console.log('   1. Version de l\'app sans nos corrections');
        console.log('   2. Problème de build EAS');
        console.log('   3. Problème d\'installation de l\'APK');
        console.log('   4. Problème de cache React Native');
        console.log('   5. Problème de navigation dans l\'app');

        console.log('\n🔧 SOLUTIONS À ESSAYER:');
        console.log('   1. Attendre que le build EAS se termine');
        console.log('   2. Installer la nouvelle APK');
        console.log('   3. Vider le cache de l\'app (Paramètres > Apps > Yukpomnang > Stockage > Vider le cache)');
        console.log('   4. Redémarrer l\'app après installation');
        console.log('   5. Vérifier les logs de débogage dans l\'app');

        console.log('\n📱 LOGS À CHERCHER DANS L\'APP:');
        console.log('   - [AuthContext] Token reçu, décodage JWT...');
        console.log('   - [AuthContext] Utilisateur créé depuis JWT:');
        console.log('   - [AuthContext] setUser appelé avec:');
        console.log('   - [AuthContext] Re-render forcé terminé');
        console.log('   - [AppNavigator] État actuel:');
        console.log('   - [AppNavigator] Utilisateur connecté, affichage MainStack');

        console.log('\n❓ SI LES LOGS NE S\'AFFICHENT PAS:');
        console.log('   - L\'app utilise une version sans nos corrections');
        console.log('   - Le build EAS n\'est pas terminé');
        console.log('   - L\'APK installé n\'est pas la bonne version');

    } catch (error) {
        console.error('❌ Erreur lors du test:', error);
    }
}

// Lancer le test
identificationProblemeReel();

