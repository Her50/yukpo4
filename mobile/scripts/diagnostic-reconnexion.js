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

// Simulation AsyncStorage
class MockAsyncStorage {
    constructor() {
        this.storage = new Map();
    }

    async getItem(key) {
        return this.storage.get(key) || null;
    }

    async setItem(key, value) {
        this.storage.set(key, value);
    }

    async removeItem(key) {
        this.storage.delete(key);
    }
}

// Simulation complète du problème de reconnexion
class SimulateurReconnexion {
    constructor() {
        this.asyncStorage = new MockAsyncStorage();
        this.user = null;
        this.loading = true;
        this.currentScreen = 'LoadingScreen';
        this.logs = [];
        this.renderCount = 0;
    }

    log(message) {
        const timestamp = new Date().toISOString();
        this.logs.push(`[${timestamp}] ${message}`);
        console.log(`[${timestamp}] ${message}`);
    }

    async getAuthToken() {
        return await this.asyncStorage.getItem('auth_token');
    }

    async saveAuthToken(token) {
        await this.asyncStorage.setItem('auth_token', token);
        this.log(`Token sauvegardé dans AsyncStorage`);
    }

    async removeAuthToken() {
        await this.asyncStorage.removeItem('auth_token');
        this.log(`Token supprimé d'AsyncStorage`);
    }

    setUser(user) {
        this.log(`setUser appelé avec: ${user ? JSON.stringify(user) : 'null'}`);
        this.user = user;
        this.renderCount++;
        this.log(`Re-render #${this.renderCount} déclenché`);
        this.updateCurrentScreen();
    }

    setLoading(loading) {
        this.log(`setLoading appelé avec: ${loading}`);
        this.loading = loading;
        this.updateCurrentScreen();
    }

    updateCurrentScreen() {
        this.log(`=== MISE À JOUR ÉCRAN (Render #${this.renderCount}) ===`);
        this.log(`État: user=${!!this.user}, loading=${this.loading}`);

        if (this.loading) {
            this.currentScreen = 'LoadingScreen';
            this.log(`→ Affichage LoadingScreen`);
        } else if (this.user) {
            this.currentScreen = 'MainStack';
            this.log(`→ Affichage MainStack (HomeScreen)`);
            this.log(`   User ID: ${this.user.id}`);
            this.log(`   User Email: ${this.user.email}`);
            this.log(`   User Role: ${this.user.role}`);
        } else {
            this.currentScreen = 'AuthStack';
            this.log(`→ Affichage AuthStack (Login/Register)`);
        }

        this.log(`Écran actuel: ${this.currentScreen}`);
        this.log(`=== FIN MISE À JOUR ÉCRAN ===`);
    }

    // Simulation de l'initialisation au démarrage (qui fonctionne)
    async initializeApp() {
        this.log(`\n🚀 === INITIALISATION APP (REDÉMARRAGE) ===`);
        this.log(`Démarrage de l'application...`);

        try {
            const token = await this.getAuthToken();
            if (token) {
                this.log(`Token trouvé au démarrage, décodage...`);
                const decoded = decodeJWT(token);

                if (decoded && decoded.exp * 1000 > Date.now()) {
                    const userData = {
                        id: String(decoded.sub),
                        email: decoded.email,
                        role: decoded.role,
                        name: decoded.name || '',
                        credits: decoded.tokens_balance ?? 0,
                        phone: '',
                        photo: '',
                        token: token
                    };

                    this.log(`Utilisateur initialisé depuis token: ${JSON.stringify(userData)}`);
                    this.setUser(userData);
                    this.log(`✅ INITIALISATION RÉUSSIE - HomeScreen affiché`);
                } else {
                    this.log(`Token expiré au démarrage, suppression`);
                    await this.removeAuthToken();
                }
            } else {
                this.log(`Aucun token au démarrage`);
            }
        } catch (error) {
            this.log(`Erreur initialisation utilisateur: ${error.message}`);
            await this.removeAuthToken();
        } finally {
            this.setLoading(false);
            this.log(`Initialisation terminée, loading = false`);
            this.log(`Écran initial: ${this.currentScreen}`);
            this.log(`=== FIN INITIALISATION APP ===`);
        }
    }

    // Simulation de la déconnexion
    async logout() {
        this.log(`\n🚪 === DÉCONNEXION ===`);
        this.log(`Déconnexion de l'utilisateur...`);

        await this.removeAuthToken();
        this.setUser(null);
        this.log(`Utilisateur déconnecté`);
        this.log(`Écran après déconnexion: ${this.currentScreen}`);
        this.log(`=== FIN DÉCONNEXION ===`);
    }

    // Simulation de la reconnexion (qui pose problème)
    async login(email, password) {
        this.log(`\n🔐 === RECONNEXION (PROBLÉMATIQUE) ===`);
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
                        // Sauvegarde token
                        await this.saveAuthToken(response.data.token);

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

                        this.log(`Reconnexion réussie - User final: ${JSON.stringify(this.user)}`);
                        this.log(`Écran final: ${this.currentScreen}`);

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
            this.log(`❌ Erreur reconnexion: ${error.message}`);
            this.setUser(null);
            throw error;
        } finally {
            this.setLoading(false);
            this.log(`=== FIN RECONNEXION ===`);
        }
    }

    showAppState() {
        console.log(`\n📱 === ÉTAT ACTUEL DE L'APPLICATION ===`);
        console.log(`Écran affiché: ${this.currentScreen}`);
        console.log(`User connecté: ${!!this.user}`);
        console.log(`Loading: ${this.loading}`);
        console.log(`Nombre de re-renders: ${this.renderCount}`);
        if (this.user) {
            console.log(`User ID: ${this.user.id}`);
            console.log(`User Email: ${this.user.email}`);
            console.log(`User Role: ${this.user.role}`);
        }
        console.log(`=== FIN ÉTAT APPLICATION ===\n`);
    }
}

async function diagnosticReconnexion() {
    console.log('🔍 DIAGNOSTIC RECONNEXION - PROBLÈME SPÉCIFIQUE\n');

    const app = new SimulateurReconnexion();

    try {
        // 1. Simulation du redémarrage (qui fonctionne)
        console.log('🧪 ÉTAPE 1: REDÉMARRAGE DU TÉLÉPHONE (FONCTIONNE)\n');
        await app.initializeApp();
        app.showAppState();

        // 2. Simulation de la déconnexion
        console.log('🧪 ÉTAPE 2: DÉCONNEXION\n');
        await app.logout();
        app.showAppState();

        // 3. Simulation de la reconnexion (qui pose problème)
        console.log('🧪 ÉTAPE 3: RECONNEXION (PROBLÉMATIQUE)\n');
        const testEmail = `test-reconnexion-${Date.now()}@yukpomnang.com`;
        const testPassword = 'TestPassword123!';

        // D'abord créer un utilisateur
        const registerResponse = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                nom: 'Test Reconnexion',
                prenom: 'Test Reconnexion',
                name: 'Test Reconnexion',
                email: testEmail,
                password: testPassword,
                phone: '+237123456789'
            })
        });

        if (registerResponse.success) {
            console.log('✅ Utilisateur créé pour le test');

            // Maintenant tester la reconnexion
            const loginResult = await app.login(testEmail, testPassword);
            app.showAppState();

            // 4. Analyse du problème
            console.log('🔍 === ANALYSE DU PROBLÈME ===');
            if (app.currentScreen === 'MainStack') {
                console.log('✅ SUCCÈS: La reconnexion devrait fonctionner');
                console.log('   - Navigation: MainStack ✅');
                console.log('   - User connecté: ✅');
                console.log('   - Loading terminé: ✅');
            } else {
                console.log('❌ ÉCHEC: La reconnexion ne fonctionne pas');
                console.log(`   - Écran actuel: ${app.currentScreen}`);
                console.log(`   - User connecté: ${!!app.user}`);
                console.log(`   - Loading: ${app.loading}`);

                console.log('\n🔍 CAUSES POSSIBLES:');
                console.log('   1. Problème de re-render React');
                console.log('   2. Problème de timing dans setUser');
                console.log('   3. Problème de navigation dans AppNavigator');
                console.log('   4. Problème de persistance du token');
                console.log('   5. Problème de décodage JWT');
            }
        }

    } catch (error) {
        console.error('❌ ERREUR LORS DU DIAGNOSTIC:', error);
    }
}

// Lancer le diagnostic
diagnosticReconnexion();

