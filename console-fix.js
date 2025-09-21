// 🔧 SCRIPT DE CORRECTION EN TEMPS RÉEL
// À exécuter dans la console de https://yukpomnang-app.netlify.app

console.log('🚀 DIAGNOSTIC ET CORRECTION YUKPOMNANG');

// 1. Diagnostic de la configuration actuelle
console.log('📋 Configuration détectée:');
console.log('  URL:', window.location.href);
console.log('  Hostname:', window.location.hostname);

// 2. Vérifier axios
if (window.axios) {
    console.log('🔧 Axios détecté:');
    console.log('  baseURL:', window.axios.defaults.baseURL);
    
    // CORRECTION FORCÉE
    window.axios.defaults.baseURL = '';
    console.log('✅ Axios baseURL forcé à vide');
} else {
    console.log('❌ Axios non trouvé dans window');
}

// 3. Test direct des endpoints
console.log('🧪 Test des endpoints...');

async function testEndpoints() {
    const endpoints = [
        { url: '/healthz', method: 'GET' },
        { url: '/auth/register', method: 'POST', data: { 
            email: 'console_test_' + Date.now() + '@yukpo.com', 
            password: 'ConsoleTest123!', 
            name: 'Console Test' 
        }}
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`\n🔍 Test: ${endpoint.method} ${endpoint.url}`);
            
            const options = {
                method: endpoint.method,
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (endpoint.data) {
                options.body = JSON.stringify(endpoint.data);
            }
            
            const response = await fetch(endpoint.url, options);
            console.log(`✅ ${endpoint.url}: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.text();
                console.log(`   Réponse: ${data.substring(0, 100)}...`);
                
                if (endpoint.method === 'POST' && endpoint.url === '/auth/register') {
                    console.log('🎉 INSCRIPTION RÉUSSIE VIA CONSOLE !');
                    
                    // Test de connexion immédiate
                    const loginResponse = await fetch('/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: endpoint.data.email,
                            password: endpoint.data.password
                        })
                    });
                    
                    if (loginResponse.ok) {
                        const loginData = await loginResponse.json();
                        console.log('🎉 CONNEXION RÉUSSIE VIA CONSOLE !');
                        console.log('   Token:', loginData.token.substring(0, 30) + '...');
                        
                        // Sauvegarder dans localStorage
                        localStorage.setItem('token', loginData.token);
                        localStorage.setItem('tokens_balance', loginData.tokens_balance.toString());
                        console.log('💾 Token sauvegardé dans localStorage');
                        
                        // Déclencher un événement pour mettre à jour l'interface
                        window.dispatchEvent(new CustomEvent('tokens_updated'));
                        console.log('📡 Événement tokens_updated déclenché');
                        
                        return true;
                    }
                }
            }
        } catch (error) {
            console.log(`❌ ${endpoint.url}: ${error.message}`);
        }
    }
    return false;
}

// 4. Fonctions de debug disponibles
window.yukpoDebug = {
    // Forcer la correction axios
    fixAxios: () => {
        if (window.axios) {
            window.axios.defaults.baseURL = '';
            console.log('✅ Axios baseURL forcé à vide');
        }
    },
    
    // Test complet
    testComplete: testEndpoints,
    
    // Test inscription rapide
    quickRegister: async () => {
        const email = 'quick_' + Date.now() + '@yukpo.com';
        const password = 'QuickTest123!';
        
        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name: 'Quick Test' })
            });
            
            if (response.ok) {
                console.log('✅ Inscription rapide réussie');
                
                // Connexion immédiate
                const loginResponse = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                if (loginResponse.ok) {
                    const data = await loginResponse.json();
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('tokens_balance', data.tokens_balance.toString());
                    window.dispatchEvent(new CustomEvent('tokens_updated'));
                    console.log('🎉 CONNEXION COMPLÈTE ! Rechargez la page.');
                    return true;
                }
            }
        } catch (error) {
            console.log('❌ Erreur:', error.message);
        }
        return false;
    },
    
    // Vérifier la configuration
    checkConfig: () => {
        console.log('📋 Configuration actuelle:');
        console.log('  window.location.hostname:', window.location.hostname);
        console.log('  axios.defaults.baseURL:', window.axios?.defaults?.baseURL);
        console.log('  localStorage.token:', localStorage.getItem('token') ? 'Présent' : 'Absent');
    }
};

console.log('🎯 Fonctions disponibles:');
console.log('  yukpoDebug.fixAxios() - Corriger axios');
console.log('  yukpoDebug.testComplete() - Test complet');
console.log('  yukpoDebug.quickRegister() - Inscription rapide');
console.log('  yukpoDebug.checkConfig() - Vérifier config');

console.log('\n🚀 POUR CORRIGER LE PROBLÈME:');
console.log('1. Exécutez: yukpoDebug.quickRegister()');
console.log('2. Puis rechargez la page (F5)');
console.log('3. L\'application devrait fonctionner !');

// Auto-correction
console.log('\n⚡ AUTO-CORRECTION...');
if (window.axios) {
    window.axios.defaults.baseURL = '';
    console.log('✅ Axios corrigé automatiquement');
}

console.log('🎉 Script de correction chargé !'); 