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

async function testSimpleAuth() {
  console.log('🧪 Test Simple - Authentification\n');
  
  const testEmail = `test-simple-${Date.now()}@yukpomnang.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test Simple User';
  
  try {
    // Test de connexion
    console.log('1️⃣ Test de connexion...');
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
      console.log('   📋 Tokens balance:', loginResponse.data.tokens_balance);
    } else {
      console.log('   ❌ Échec connexion:', loginResponse.data);
      
      // Essayer l'inscription si la connexion échoue
      console.log('\n2️⃣ Tentative d\'inscription...');
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
        console.log('   📋 Token reçu:', registerResponse.data.token.substring(0, 50) + '...');
        console.log('   📋 Tokens balance:', registerResponse.data.tokens_balance);
      } else {
        console.log('   ❌ Échec inscription:', registerResponse.data);
      }
    }
    
    console.log('\n🎉 Test Simple Terminé !');
    console.log('\n📱 Le problème dans l\'app mobile pourrait être:');
    console.log('   1. L\'état loading reste à true');
    console.log('   2. L\'état user n\'est pas mis à jour');
    console.log('   3. L\'AppNavigator ne détecte pas le changement d\'état');
    console.log('   4. Un problème de re-render React');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Lancer le test
testSimpleAuth();

