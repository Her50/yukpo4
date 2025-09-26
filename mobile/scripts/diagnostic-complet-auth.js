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

// Simulation de l'état AuthContext
class MockAuthContext {
    constructor() {
        this.user = null;
        this.loading = true;
        this.logs = [];
    }

    log(message) {
        this.logs.push(`[${new Date().toISOString()}] ${message}`);
        console.log(message);
    }

    setUser(user) {
        this.log(`setUser appelé avec: ${JSON.stringify(user)}`);
        this.user = user;
    }

    setLoading(loading) {
        this.log(`setLoading appelé avec: ${loading}`);
        this.loading = loading;
    }

    // Simulation de la fonction login
    async login(email, password) {
        this.log(`=== DÉBUT LOGIN ===`);
        this.log(`Email: ${email}`);

        try {
            this.setLoading(true);

            // Appel API
            this.log(`Appel API /auth/login...`);
            const response = await apiCall('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            this.log(`Réponse API: Status ${response.status}, Success: ${response.success}`);

            if (response.success && response.data?.token) {
                this.log(`Token reçu: ${response.data.token.substring(0, 50)}...`);

                // Décodage JWT
                const decoded = decodeJWT(response.data.token);
                if (decoded) {
                    this.log(`JWT décodé: ID=${decoded.sub}, Email=${decoded.email}, Role=${decoded.role}`);

                    if (decoded.exp * 1000 > Date.now()) {
                        // Sauvegarde token (simulation)
                        this.log(`Sauvegarde du token...`);

                        // Création objet User
                        const userData = {
                            id: String(decoded.sub),
                            email: decoded.email,
                            role: decoded.role,
                            name: decoded.name || '',
                            credits: decoded.tokens_balance ?? 0,
                            phone: '',
                            photo: '',
                            token: response.data.token
                        };

                        this.log(`Objet User créé: ${JSON.stringify(userData)}`);

                        // Premier setUser
                        this.setUser(userData);
                        this.log(`Premier setUser terminé`);

                        // Simulation du re-render forcé
                        this.log(`=== DÉBUT RE-RENDER FORCÉ ===`);
                        await new Promise(resolve => setTimeout(resolve, 100));

                        this.log(`setUser(null) - Reset temporaire`);
                        this.setUser(null);

                        await new Promise(resolve => setTimeout(resolve, 50));

                        this.log(`setUser(userData) - Re-set avec données`);
                        this.setUser(userData);
                        this.log(`=== FIN RE-RENDER FORCÉ ===`);

                        this.log(`Login réussi - User final: ${JSON.stringify(this.user)}`);
                        return { success: true, user: this.user };
                    } else {
                        this.log(`❌ Token expiré`);
                        throw new Error('Token expiré');
                    }
                } else {
                    this.log(`❌ Erreur décodage JWT`);
                    throw new Error('Erreur décodage JWT');
                }
            } else {
                this.log(`❌ Pas de token dans la réponse: ${JSON.stringify(response.data)}`);
                throw new Error('Pas de token dans la réponse');
            }
        } catch (error) {
            this.log(`❌ Erreur login: ${error.message}`);
            this.setUser(null);
            throw error;
        } finally {
            this.setLoading(false);
            this.log(`=== FIN LOGIN ===`);
        }
    }

    // Simulation de la fonction register
    async register(userData) {
        this.log(`=== DÉBUT REGISTER ===`);
        this.log(`Données: ${JSON.stringify(userData)}`);

        try {
            this.setLoading(true);

            // Appel API
            this.log(`Appel API /auth/register...`);
            const response = await apiCall('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    nom: userData.name,
                    prenom: userData.name,
                    name: userData.name,
                    email: userData.email,
                    password: userData.password,
                    phone: userData.phone || '+237123456789'
                })
            });

            this.log(`Réponse API: Status ${response.status}, Success: ${response.success}`);

            if (response.success) {
                if (response.data?.token) {
                    this.log(`Token reçu lors de l'inscription: ${response.data.token.substring(0, 50)}...`);

                    // Décodage JWT
                    const decoded = decodeJWT(response.data.token);
                    if (decoded) {
                        this.log(`JWT décodé: ID=${decoded.sub}, Email=${decoded.email}, Role=${decoded.role}`);

                        if (decoded.exp * 1000 > Date.now()) {
                            // Sauvegarde token (simulation)
                            this.log(`Sauvegarde du token...`);

                            // Création objet User
                            const newUserData = {
                                id: String(decoded.sub),
                                email: decoded.email,
                                role: decoded.role,
                                name: decoded.name || userData.name,
                                credits: decoded.tokens_balance ?? 0,
                                phone: userData.phone || '',
                                photo: '',
                                token: response.data.token
                            };

                            this.log(`Objet User créé: ${JSON.stringify(newUserData)}`);

                            // Premier setUser
                            this.setUser(newUserData);
                            this.log(`Premier setUser terminé`);

                            // Simulation du re-render forcé
                            this.log(`=== DÉBUT RE-RENDER FORCÉ ===`);
                            await new Promise(resolve => setTimeout(resolve, 100));

                            this.log(`setUser(null) - Reset temporaire`);
                            this.setUser(null);

                            await new Promise(resolve => setTimeout(resolve, 50));

                            this.log(`setUser(newUserData) - Re-set avec données`);
                            this.setUser(newUserData);
                            this.log(`=== FIN RE-RENDER FORCÉ ===`);

                            this.log(`Register réussi - User final: ${JSON.stringify(this.user)}`);
                            return { success: true, user: this.user };
                        } else {
                            this.log(`❌ Token expiré`);
                            throw new Error('Token expiré');
                        }
                    } else {
                        this.log(`❌ Erreur décodage JWT`);
                        throw new Error('Erreur décodage JWT');
                    }
                } else {
                    this.log(`Pas de token direct, appel login automatique...`);
                    return await this.login(userData.email, userData.password);
                }
            } else {
                this.log(`❌ Échec inscription: ${JSON.stringify(response.data)}`);
                throw new Error(response.message || 'Erreur lors de l\'inscription');
            }
        } catch (error) {
            this.log(`❌ Erreur register: ${error.message}`);
            this.setUser(null);
            throw error;
        } finally {
            this.setLoading(false);
            this.log(`=== FIN REGISTER ===`);
        }
    }

    // Simulation de l'AppNavigator
    getNavigationState() {
        this.log(`=== ÉTAT NAVIGATION ===`);
        this.log(`User: ${!!this.user}`);
        this.log(`Loading: ${this.loading}`);
        this.log(`User ID: ${this.user?.id}`);
        this.log(`User Email: ${this.user?.email}`);
        this.log(`User Role: ${this.user?.role}`);

        if (this.loading) {
            this.log(`→ Affichage LoadingScreen`);
            return 'LoadingScreen';
        } else if (this.user) {
            this.log(`→ Affichage MainStack (HomeScreen)`);
            return 'MainStack';
        } else {
            this.log(`→ Affichage AuthStack (Login/Register)`);
            return 'AuthStack';
        }
    }

    // Afficher tous les logs
    showLogs() {
        console.log('\n📋 LOGS COMPLETS:');
        this.logs.forEach(log => console.log(log));
    }
}

async function diagnosticComplet() {
    console.log('🔍 DIAGNOSTIC COMPLET - AUTHENTIFICATION MOBILE\n');

    const testEmail = `diagnostic-${Date.now()}@yukpomnang.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Diagnostic User';

    const authContext = new MockAuthContext();

    try {
        // Test 1: Inscription
        console.log('🧪 TEST 1: INSCRIPTION\n');
        const registerResult = await authContext.register({
            name: testName,
            email: testEmail,
            password: testPassword,
            phone: '+237123456789'
        });

        console.log('\n📊 RÉSULTAT INSCRIPTION:');
        console.log(`Success: ${registerResult.success}`);
        console.log(`User: ${JSON.stringify(registerResult.user)}`);
        console.log(`Navigation: ${authContext.getNavigationState()}`);

        // Reset pour test suivant
        authContext.user = null;
        authContext.loading = false;

        console.log('\n' + '='.repeat(80) + '\n');

        // Test 2: Connexion
        console.log('🧪 TEST 2: CONNEXION\n');
        const loginResult = await authContext.login(testEmail, testPassword);

        console.log('\n📊 RÉSULTAT CONNEXION:');
        console.log(`Success: ${loginResult.success}`);
        console.log(`User: ${JSON.stringify(loginResult.user)}`);
        console.log(`Navigation: ${authContext.getNavigationState()}`);

        console.log('\n' + '='.repeat(80) + '\n');

        // Test 3: État final
        console.log('🧪 TEST 3: ÉTAT FINAL\n');
        console.log(`User final: ${JSON.stringify(authContext.user)}`);
        console.log(`Loading final: ${authContext.loading}`);
        console.log(`Navigation finale: ${authContext.getNavigationState()}`);

        // Analyse
        console.log('\n🔍 ANALYSE:');
        if (authContext.user && !authContext.loading) {
            console.log('✅ SUCCÈS: L\'utilisateur devrait accéder à HomeScreen');
            console.log('   - User défini: ✅');
            console.log('   - Loading false: ✅');
            console.log('   - Navigation: MainStack ✅');
        } else {
            console.log('❌ ÉCHEC: L\'utilisateur ne peut pas accéder à HomeScreen');
            console.log(`   - User défini: ${!!authContext.user ? '✅' : '❌'}`);
            console.log(`   - Loading false: ${!authContext.loading ? '✅' : '❌'}`);
            console.log(`   - Navigation: ${authContext.getNavigationState()}`);
        }

        // Afficher tous les logs
        authContext.showLogs();

    } catch (error) {
        console.error('❌ ERREUR LORS DU DIAGNOSTIC:', error);
        authContext.showLogs();
    }
}

// Lancer le diagnostic
diagnosticComplet();

