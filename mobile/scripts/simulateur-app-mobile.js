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

// Simulation complète de l'application mobile
class SimulateurAppMobile {
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

    // Simulation des fonctions de gestion du token
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

    // Simulation de setUser avec re-render
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

    // Simulation de l'AppNavigator
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

    // Simulation de la fonction login
    async login(email, password) {
        this.log(`\n🔐 === DÉBUT LOGIN ===`);
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

                        // Simulation du re-render forcé (comme dans notre correction)
                        this.log(`=== DÉBUT RE-RENDER FORCÉ ===`);
                        await new Promise(resolve => setTimeout(resolve, 100));

                        this.log(`setUser(null) - Reset temporaire`);
                        this.setUser(null);

                        await new Promise(resolve => setTimeout(resolve, 50));

                        this.log(`setUser(userData) - Re-set avec données`);
                        this.setUser(userData);
                        this.log(`=== FIN RE-RENDER FORCÉ ===`);

                        this.log(`Login réussi - User final: ${JSON.stringify(this.user)}`);
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
        this.log(`\n📝 === DÉBUT REGISTER ===`);
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
                            // Sauvegarde token
                            await this.saveAuthToken(response.data.token);

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

    // Simulation de l'initialisation au démarrage
    async initializeApp() {
        this.log(`\n🚀 === INITIALISATION APP ===`);
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

    // Afficher l'état actuel de l'application
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

    // Afficher tous les logs
    showAllLogs() {
        console.log(`\n📋 === LOGS COMPLETS DE L'APPLICATION ===`);
        this.logs.forEach(log => console.log(log));
        console.log(`=== FIN LOGS ===\n`);
    }
}

async function simulateurAppMobile() {
    console.log('📱 SIMULATEUR APPLICATION MOBILE - DIAGNOSTIC COMPLET\n');

    const app = new SimulateurAppMobile();

    try {
        // 1. Initialisation de l'app
        await app.initializeApp();
        app.showAppState();

        // 2. Test d'inscription
        console.log('🧪 TEST D\'INSCRIPTION\n');
        const testEmail = `simulateur-${Date.now()}@yukpomnang.com`;
        const testPassword = 'TestPassword123!';
        const testName = 'Simulateur User';

        const registerResult = await app.register({
            name: testName,
            email: testEmail,
            password: testPassword,
            phone: '+237123456789'
        });

        app.showAppState();

        // 3. Test de connexion (avec un nouvel utilisateur)
        console.log('🧪 TEST DE CONNEXION\n');
        const testEmail2 = `simulateur2-${Date.now()}@yukpomnang.com`;

        // D'abord s'inscrire
        await app.register({
            name: 'Test User 2',
            email: testEmail2,
            password: testPassword,
            phone: '+237123456789'
        });

        app.showAppState();

        // Puis se déconnecter et se reconnecter
        app.setUser(null);
        app.showAppState();

        const loginResult = await app.login(testEmail2, testPassword);
        app.showAppState();

        // 4. Analyse finale
        console.log('🔍 === ANALYSE FINALE ===');
        if (app.currentScreen === 'MainStack') {
            console.log('✅ SUCCÈS: L\'application devrait afficher HomeScreen');
            console.log('   - Navigation: MainStack ✅');
            console.log('   - User connecté: ✅');
            console.log('   - Loading terminé: ✅');
        } else {
            console.log('❌ ÉCHEC: L\'application n\'affiche pas HomeScreen');
            console.log(`   - Écran actuel: ${app.currentScreen}`);
            console.log(`   - User connecté: ${!!app.user}`);
            console.log(`   - Loading: ${app.loading}`);
        }

        // Afficher tous les logs
        app.showAllLogs();

    } catch (error) {
        console.error('❌ ERREUR LORS DE LA SIMULATION:', error);
        app.showAllLogs();
    }
}

// Lancer le simulateur
simulateurAppMobile();

