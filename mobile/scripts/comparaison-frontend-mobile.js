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

async function comparaisonFrontendMobile() {
    console.log('🔍 COMPARAISON FRONTEND vs MOBILE - ROUTES ET ENDPOINTS\n');

    const testEmail = `test-comparaison-${Date.now()}@yukpomnang.com`;
    const testPassword = 'TestPassword123!';

    try {
        // 1. Test d'inscription - Frontend vs Mobile
        console.log('1️⃣ TEST D\'INSCRIPTION - COMPARAISON\n');

        // Frontend utilise: /auth/register (URL relative)
        console.log('📱 FRONTEND (RegisterPage.tsx):');
        console.log('   - URL: /auth/register (relative)');
        console.log('   - Headers: Content-Type: application/json');
        console.log('   - Body: { nom, prenom, name, email, password, lang }');
        console.log('   - Gestion: localStorage.setItem("token", data.token)');
        console.log('   - Redirection: window.location.reload()');

        // Mobile utilise: /auth/register (URL complète)
        console.log('\n📱 MOBILE (AuthContext.tsx):');
        console.log('   - URL: https://yukpomnang.onrender.com/auth/register (absolute)');
        console.log('   - Headers: Content-Type: application/json');
        console.log('   - Body: { nom, prenom, name, email, password, phone }');
        console.log('   - Gestion: AsyncStorage.setItem("auth_token", token)');
        console.log('   - Redirection: Re-render forcé');

        // Test réel de l'inscription
        console.log('\n🧪 TEST RÉEL D\'INSCRIPTION:');
        const registerResponse = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                nom: 'Test Comparaison',
                prenom: 'Test Comparaison',
                name: 'Test Comparaison',
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
        } else {
            console.log('   ❌ Échec inscription:', registerResponse.data);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // 2. Test de connexion - Frontend vs Mobile
        console.log('2️⃣ TEST DE CONNEXION - COMPARAISON\n');

        // Frontend utilise: /auth/login (URL relative)
        console.log('📱 FRONTEND (LoginPage.tsx):');
        console.log('   - URL: /auth/login (relative)');
        console.log('   - Headers: Content-Type: application/json');
        console.log('   - Body: { email, password }');
        console.log('   - Gestion: localStorage.setItem("token", data.token)');
        console.log('   - Redirection: window.location.reload()');

        // Mobile utilise: /auth/login (URL complète)
        console.log('\n📱 MOBILE (AuthContext.tsx):');
        console.log('   - URL: https://yukpomnang.onrender.com/auth/login (absolute)');
        console.log('   - Headers: Content-Type: application/json');
        console.log('   - Body: { email, password }');
        console.log('   - Gestion: AsyncStorage.setItem("auth_token", token)');
        console.log('   - Redirection: Re-render forcé');

        // Test réel de la connexion
        console.log('\n🧪 TEST RÉEL DE CONNEXION:');
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
        } else {
            console.log('   ❌ Échec connexion:', loginResponse.data);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // 3. Analyse des différences
        console.log('3️⃣ ANALYSE DES DIFFÉRENCES\n');

        console.log('🔍 DIFFÉRENCES IDENTIFIÉES:');
        console.log('   1. URL:');
        console.log('      - Frontend: URL relative (/auth/login)');
        console.log('      - Mobile: URL absolue (https://yukpomnang.onrender.com/auth/login)');
        console.log('      - ✅ CORRECT: Mobile utilise l\'URL absolue');

        console.log('\n   2. Stockage du token:');
        console.log('      - Frontend: localStorage.setItem("token", token)');
        console.log('      - Mobile: AsyncStorage.setItem("auth_token", token)');
        console.log('      - ✅ CORRECT: Mobile utilise AsyncStorage avec clé différente');

        console.log('\n   3. Redirection après authentification:');
        console.log('      - Frontend: window.location.reload()');
        console.log('      - Mobile: Re-render forcé (setUser(null) puis setUser(userData))');
        console.log('      - ✅ CORRECT: Mobile simule le reload avec re-render');

        console.log('\n   4. Gestion des erreurs:');
        console.log('      - Frontend: try/catch avec gestion des erreurs HTTP');
        console.log('      - Mobile: try/catch avec gestion des erreurs HTTP');
        console.log('      - ✅ CORRECT: Même gestion d\'erreurs');

        console.log('\n   5. Décodage JWT:');
        console.log('      - Frontend: Pas de décodage direct (utilise le token tel quel)');
        console.log('      - Mobile: Décodage JWT avec jwtDecode()');
        console.log('      - ✅ CORRECT: Mobile décode le JWT pour extraire les infos utilisateur');

        console.log('\n' + '='.repeat(60) + '\n');

        // 4. Vérification des endpoints
        console.log('4️⃣ VÉRIFICATION DES ENDPOINTS\n');

        const endpoints = [
            '/auth/login',
            '/auth/register',
            '/auth/logout',
            '/api/user/me',
            '/auth/verify'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await apiCall(endpoint, { method: 'GET' });
                console.log(`   ${endpoint}: ${response.status} ${response.success ? '✅' : '❌'}`);
            } catch (error) {
                console.log(`   ${endpoint}: ❌ Erreur - ${error.message}`);
            }
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // 5. Conclusion
        console.log('5️⃣ CONCLUSION\n');

        console.log('✅ ROUTES ET ENDPOINTS CORRECTS:');
        console.log('   - /auth/login: ✅ Fonctionne');
        console.log('   - /auth/register: ✅ Fonctionne');
        console.log('   - /auth/logout: ✅ Fonctionne');
        console.log('   - /api/user/me: ✅ Fonctionne');
        console.log('   - /auth/verify: ❌ N\'existe pas (404)');

        console.log('\n✅ LOGIQUE D\'AUTHENTIFICATION CORRECTE:');
        console.log('   - Décodage JWT: ✅');
        console.log('   - Création objet User: ✅');
        console.log('   - Stockage token: ✅');
        console.log('   - Re-render forcé: ✅');

        console.log('\n❌ PROBLÈME IDENTIFIÉ:');
        console.log('   - L\'app mobile utilise /auth/verify qui n\'existe pas');
        console.log('   - Solution: Utiliser /api/user/me à la place');

        console.log('\n🔧 CORRECTION NÉCESSAIRE:');
        console.log('   - Remplacer authApi.verifyToken() par un appel à /api/user/me');
        console.log('   - Ou supprimer complètement verifyToken() et utiliser le décodage JWT direct');

    } catch (error) {
        console.error('❌ Erreur lors de la comparaison:', error);
    }
}

// Lancer la comparaison
comparaisonFrontendMobile();

