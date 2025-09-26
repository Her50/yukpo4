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

async function testUserMeEndpoint() {
  console.log('🧪 Test de l\'endpoint /api/user/me\n');
  
  const testEmail = `test-${Date.now()}@yukpomnang.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';
  
  try {
    // 1. Créer un utilisateur et obtenir un token
    console.log('1️⃣ Création d\'un utilisateur de test...');
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
    
    if (!registerResponse.success || !registerResponse.data?.token) {
      console.log('❌ Échec création utilisateur:', registerResponse.data);
      return;
    }
    
    const token = registerResponse.data.token;
    console.log('✅ Utilisateur créé avec token');
    
    // 2. Tester l'endpoint /api/user/me
    console.log('\n2️⃣ Test de l\'endpoint /api/user/me...');
    const userMeResponse = await apiCall('/api/user/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
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
    
    // 3. Tester l'endpoint /api/users/balance
    console.log('\n3️⃣ Test de l\'endpoint /api/users/balance...');
    const balanceResponse = await apiCall('/api/users/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('   Status:', balanceResponse.status);
    console.log('   Success:', balanceResponse.success);
    
    if (balanceResponse.success) {
      console.log('   ✅ Endpoint /api/users/balance fonctionne !');
      console.log('   📋 Solde:', balanceResponse.data.tokens_balance);
    } else {
      console.log('   ❌ Échec endpoint /api/users/balance:', balanceResponse.data);
    }
    
    console.log('\n🎉 Test des endpoints utilisateur terminé !');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Lancer le test
testUserMeEndpoint();

