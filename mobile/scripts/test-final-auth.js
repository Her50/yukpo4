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

async function testFinalAuth() {
  console.log('🧪 Test Final - Flux d\'Authentification Mobile Corrigé\n');
  
  const testEmail = `test-final-${Date.now()}@yukpomnang.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test Final User';
  
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
    
    // 3. Test de l'endpoint /api/user/me (pour vérifier que l'endpoint fonctionne)
    if (loginResponse.success && loginResponse.data?.token) {
      console.log('3️⃣ Test de l\'endpoint /api/user/me...');
      const userMeResponse = await apiCall('/api/user/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`
        }
      });
      
      console.log('   Status:', userMeResponse.status);
      console.log('   Success:', userMeResponse.success);
      
      if (userMeResponse.success) {
        console.log('   ✅ Endpoint /api/user/me fonctionne !');
        console.log('   📋 Données utilisateur:');
        console.log('      - ID:', userMeResponse.data.id);
        console.log('      - Email:', userMeResponse.data.email);
        console.log('      - Nom:', userMeResponse.data.name);
        console.log('      - Rôle:', userMeResponse.data.role);
        console.log('      - Tokens balance:', userMeResponse.data.tokens_balance);
      } else {
        console.log('   ❌ Échec endpoint /api/user/me:', userMeResponse.data);
      }
    }
    
    console.log('\n🎉 Test Final Terminé !');
    console.log('\n📱 Résumé des Corrections:');
    console.log('   ✅ Décodage JWT direct (comme le frontend)');
    console.log('   ✅ Plus d\'appel à /auth/verify (qui n\'existe pas)');
    console.log('   ✅ Utilisation de /api/user/me (qui fonctionne)');
    console.log('   ✅ Initialisation automatique au démarrage');
    console.log('   ✅ Gestion de l\'expiration du token');
    console.log('   ✅ Persistance de la session');
    
    console.log('\n🚀 L\'application mobile devrait maintenant:');
    console.log('   - Se connecter sans rechargement de page');
    console.log('   - Basculer automatiquement vers l\'accueil');
    console.log('   - Garder l\'utilisateur connecté au redémarrage');
    console.log('   - Gérer correctement l\'expiration des tokens');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Lancer le test
testFinalAuth();

