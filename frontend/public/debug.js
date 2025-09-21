// Script de debug à exécuter dans la console du navigateur
// Copier-coller ce code dans la console de https://yukpomnang-app.netlify.app

console.log('🔍 DIAGNOSTIC YUKPOMNANG - DÉBUT');

// 1. Vérifier la configuration actuelle
console.log('📍 Configuration détectée:');
console.log('  URL:', window.location.href);
console.log('  Hostname:', window.location.hostname);
console.log('  Protocol:', window.location.protocol);

// 2. Vérifier les variables d'environnement
console.log('📋 Variables d\'environnement:');
console.log('  VITE_API_BASE_URL:', import.meta?.env?.VITE_API_BASE_URL || 'undefined');

// 3. Vérifier la configuration axios
console.log('🔧 Configuration axios:');
if (window.axios) {
    console.log('  axios.defaults.baseURL:', window.axios.defaults.baseURL);
    console.log('  axios disponible:', true);
} else {
    console.log('  axios disponible:', false);
}

// 4. Test direct des endpoints avec fetch
console.log('🧪 Tests directs avec fetch:');

async function testEndpoint(url, method = 'GET', body = null) {
    try {
        console.log(`  Testing: ${method} ${url}`);
        
        const options = {
            method: method,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        console.log(`  ✅ ${url}: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.text();
            console.log(`     Réponse: ${data.substring(0, 100)}...`);
        }
        
        return response;
    } catch (error) {
        console.log(`  ❌ ${url}: ${error.message}`);
        return null;
    }
}

// Tests séquentiels
(async () => {
    console.log('🚀 Début des tests...');
    
    // Test 1: Health check
    await testEndpoint('/healthz');
    
    // Test 2: Inscription
    const testEmail = `debug_${Date.now()}@yukpo.com`;
    const registerResponse = await testEndpoint('/auth/register', 'POST', {
        email: testEmail,
        password: 'DebugTest123!',
        name: 'Debug User'
    });
    
    if (registerResponse && registerResponse.ok) {
        console.log('✅ Inscription réussie, test de connexion...');
        
        // Test 3: Connexion
        const loginResponse = await testEndpoint('/auth/login', 'POST', {
            email: testEmail,
            password: 'DebugTest123!'
        });
        
        if (loginResponse && loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('✅ Connexion réussie, token:', loginData.token.substring(0, 30));
            
            // Test 4: Endpoint protégé
            const profileResponse = await fetch('/api/user/me', {
                headers: {
                    'Authorization': `Bearer ${loginData.token}`,
                    'Accept': 'application/json'
                }
            });
            
            console.log(`✅ Profil: ${profileResponse.status} ${profileResponse.statusText}`);
        }
    }
    
    console.log('🎯 TESTS TERMINÉS');
})();

// 5. Fonction pour tester exactement comme le fait React
window.debugYukpo = {
    // Test comme useUserServices
    testUserServices: async () => {
        console.log('🧪 Test useUserServices simulation...');
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.log('❌ Pas de token dans localStorage');
            return;
        }
        
        try {
            // Exactement comme dans useUserServices.ts ligne 24
            const response = await fetch('/api/prestataire/services', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            
            console.log(`useUserServices test: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Services récupérés:', data);
            }
        } catch (error) {
            console.log('❌ Erreur useUserServices:', error);
        }
    },
    
    // Test comme LoginPage
    testLogin: async (email = 'test@example.com', password = 'test123') => {
        console.log('🧪 Test LoginPage simulation...');
        
        try {
            // Exactement comme dans LoginPage.tsx ligne 54
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            console.log(`LoginPage test: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Login réussi:', data);
                localStorage.setItem('token', data.token);
                return data;
            }
        } catch (error) {
            console.log('❌ Erreur LoginPage:', error);
        }
    }
};

console.log('🎯 Fonctions de debug disponibles:');
console.log('  debugYukpo.testLogin() - Tester la connexion');
console.log('  debugYukpo.testUserServices() - Tester les services');

console.log('🔍 DIAGNOSTIC YUKPOMNANG - FIN'); 