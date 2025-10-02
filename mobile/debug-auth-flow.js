/**
 * Script de debug détaillé du flux d'authentification
 * Simule exactement ce que fait l'application mobile
 */

const API_BASE_URL = 'https://yukpomnang.onrender.com';

// Simulation d'AsyncStorage
const AsyncStorage = {
    storage: new Map(),
    async getItem(key) {
        const value = this.storage.get(key);
        console.log(`[AsyncStorage] getItem('${key}') → ${value ? 'trouvé' : 'null'}`);
        return value || null;
    },
    async setItem(key, value) {
        this.storage.set(key, value);
        console.log(`[AsyncStorage] setItem('${key}', '${value.substring(0, 50)}...')`);
    },
    async removeItem(key) {
        this.storage.delete(key);
        console.log(`[AsyncStorage] removeItem('${key}')`);
    }
};

// Simulation de jwtDecode
function jwtDecode(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('[jwtDecode] Token décodé:', JSON.stringify(payload, null, 2));
        return payload;
    } catch (error) {
        console.error('[jwtDecode] Erreur de décodage:', error.message);
        throw error;
    }
}

// Couleurs
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Simulation de authApi.login (exactement comme dans api.ts)
async function authApiLogin(email, password) {
    log('\n[authApi.login] Début de la fonction', 'cyan');

    const endpoint = '/auth/login';
    const token = await AsyncStorage.getItem('auth_token');

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Yukpomnang-Mobile/1.0.0',
        ...(token && { Authorization: `Bearer ${token}` }),
    };

    log(`[authApi.login] Requête vers: ${API_BASE_URL}${endpoint}`, 'blue');
    log(`[authApi.login] Headers:`, 'blue');
    console.log(headers);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, password }),
        });

        log(`[authApi.login] Status reçu: ${response.status}`, response.ok ? 'green' : 'red');

        let data;
        try {
            data = await response.json();
            log(`[authApi.login] Réponse JSON parsée:`, 'blue');
            console.log(JSON.stringify(data, null, 2));
        } catch (jsonError) {
            log(`[authApi.login] Erreur parsing JSON: ${jsonError.message}`, 'red');
            const textData = await response.text();
            log(`[authApi.login] Texte brut: ${textData}`, 'red');
            data = { error: 'Invalid JSON response', raw: textData };
        }

        if (!response.ok) {
            return {
                success: false,
                error: data?.message || `Erreur ${response.status}`,
                data: data,
            };
        }

        // Sauvegarder le token si présent (comme dans api.ts ligne 167-172)
        if (data?.token) {
            log(`[authApi.login] Token reçu, sauvegarde dans AsyncStorage`, 'green');
            await AsyncStorage.setItem('auth_token', data.token);
            if (data.tokens_balance !== undefined) {
                await AsyncStorage.setItem('tokens_balance', data.tokens_balance.toString());
            }
        } else {
            log(`[authApi.login] ⚠️  Aucun token dans la réponse !`, 'yellow');
        }

        return {
            success: true,
            data: data,
        };
    } catch (error) {
        log(`[authApi.login] Erreur réseau: ${error.message}`, 'red');
        return {
            success: false,
            error: error.message || 'Une erreur inattendue s\'est produite',
            data: null,
        };
    }
}

// Simulation de AuthContext.login (exactement comme dans AuthContext.tsx)
async function authContextLogin(email, password) {
    log('\n[AuthContext.login] Début de la fonction', 'cyan');

    let loading = true;
    log('[AuthContext] setLoading(true)', 'blue');

    try {
        log(`[AuthContext] Tentative de connexion pour: ${email}`, 'blue');

        const response = await authApiLogin(email, password);
        log(`[AuthContext] Réponse login complète:`, 'blue');
        console.log(JSON.stringify(response, null, 2));

        if (response.success && response.data?.token) {
            log('[AuthContext] Token reçu, décodage JWT...', 'green');
            const decoded = jwtDecode(response.data.token);
            log('[AuthContext] Token décodé:', 'green');
            console.log(JSON.stringify(decoded, null, 2));

            if (decoded.exp * 1000 > Date.now()) {
                // Sauvegarder le token
                await AsyncStorage.setItem('auth_token', response.data.token);
                log('[AuthContext] Token sauvegardé dans AsyncStorage', 'green');

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

                log('[AuthContext] Utilisateur créé depuis JWT:', 'green');
                console.log(JSON.stringify(userData, null, 2));

                log('[AuthContext] ✅ setUser() appelé avec userData', 'green');

                // Vérifier que le token est bien sauvegardé
                const savedToken = await AsyncStorage.getItem('auth_token');
                log(`[AuthContext] Vérification: Token bien sauvegardé ? ${!!savedToken}`, savedToken ? 'green' : 'red');

                return { success: true, user: userData };
            } else {
                log('[AuthContext] ❌ Token expiré', 'red');
                throw new Error('Token expiré');
            }
        } else {
            log('[AuthContext] ❌ Échec de la connexion:', 'red');
            console.log(response);
            throw new Error(response.error || 'Token non reçu lors de la connexion');
        }
    } catch (error) {
        log(`[AuthContext] ❌ Erreur connexion: ${error.message}`, 'red');
        throw error;
    } finally {
        loading = false;
        log('[AuthContext] setLoading(false)', 'blue');
        log('[AuthContext] Connexion terminée', 'cyan');
    }
}

// Simulation de checkAuthStatus (au démarrage de l'app)
async function checkAuthStatus() {
    log('\n[AuthContext.checkAuthStatus] Vérification au démarrage', 'cyan');

    try {
        const token = await AsyncStorage.getItem('auth_token');
        log(`[AuthContext] Token trouvé au démarrage: ${!!token}`, token ? 'green' : 'yellow');

        if (token) {
            const decoded = jwtDecode(token);
            log('[AuthContext] Token décodé:', 'green');
            console.log(JSON.stringify(decoded, null, 2));

            if (decoded.exp * 1000 > Date.now()) {
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

                log('[AuthContext] ✅ Utilisateur connecté depuis JWT:', 'green');
                console.log(JSON.stringify(userData, null, 2));
                return { user: userData, loading: false };
            } else {
                log('[AuthContext] Token expiré, déconnexion...', 'yellow');
                await AsyncStorage.removeItem('auth_token');
                return { user: null, loading: false };
            }
        } else {
            log('[AuthContext] Aucun token trouvé', 'yellow');
            return { user: null, loading: false };
        }
    } catch (error) {
        log(`[AuthContext] ❌ Erreur vérification auth: ${error.message}`, 'red');
        await AsyncStorage.removeItem('auth_token');
        return { user: null, loading: false };
    }
}

// Test complet
async function runFullAuthFlow(email, password) {
    log('═══════════════════════════════════════════════════════', 'cyan');
    log('🔐 DEBUG COMPLET DU FLUX D\'AUTHENTIFICATION', 'cyan');
    log('═══════════════════════════════════════════════════════', 'cyan');

    log(`\n📧 Email: ${email}`, 'blue');
    log(`🔑 Password: ${'*'.repeat(password.length)}`, 'blue');
    log(`📡 API URL: ${API_BASE_URL}`, 'blue');

    // Étape 1 : Vérification au démarrage (comme au lancement de l'app)
    log('\n\n┌─────────────────────────────────────────────────────┐', 'magenta');
    log('│ ÉTAPE 1 : Vérification au démarrage (useEffect)     │', 'magenta');
    log('└─────────────────────────────────────────────────────┘', 'magenta');

    let state = await checkAuthStatus();
    log(`\n[État] user: ${!!state.user}, loading: ${state.loading}`, state.user ? 'green' : 'yellow');

    // Étape 2 : Tentative de connexion
    log('\n\n┌─────────────────────────────────────────────────────┐', 'magenta');
    log('│ ÉTAPE 2 : Tentative de connexion (handleLogin)      │', 'magenta');
    log('└─────────────────────────────────────────────────────┘', 'magenta');

    try {
        const result = await authContextLogin(email, password);

        if (result.success) {
            log('\n✅ CONNEXION RÉUSSIE !', 'green');
            log('\n👤 Utilisateur connecté:', 'cyan');
            console.log(JSON.stringify(result.user, null, 2));

            // Étape 3 : Vérification après connexion
            log('\n\n┌─────────────────────────────────────────────────────┐', 'magenta');
            log('│ ÉTAPE 3 : Vérification après connexion              │', 'magenta');
            log('└─────────────────────────────────────────────────────┘', 'magenta');

            state = await checkAuthStatus();
            log(`\n[État final] user: ${!!state.user}, loading: ${state.loading}`, state.user ? 'green' : 'red');

            if (state.user) {
                log('\n✅ L\'utilisateur devrait être visible dans AuthContext', 'green');
                log('✅ AppNavigator devrait afficher MainStack', 'green');
            } else {
                log('\n❌ PROBLÈME : L\'utilisateur n\'est pas détecté après connexion !', 'red');
                log('❌ AppNavigator affichera AuthStack au lieu de MainStack', 'red');
            }

            return true;
        } else {
            log('\n❌ ÉCHEC DE CONNEXION', 'red');
            return false;
        }
    } catch (error) {
        log(`\n❌ ERREUR FATALE: ${error.message}`, 'red');
        console.error(error);
        return false;
    } finally {
        log('\n═══════════════════════════════════════════════════════\n', 'cyan');
    }
}

// Récupérer les arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    log('❌ Usage: node debug-auth-flow.js <email> <password>', 'red');
    log('\nExemple:', 'yellow');
    log('  node debug-auth-flow.js user@example.com mypassword123', 'yellow');
    process.exit(1);
}

const [email, password] = args;

// Exécuter le test
runFullAuthFlow(email, password).then(success => {
    process.exit(success ? 0 : 1);
});


