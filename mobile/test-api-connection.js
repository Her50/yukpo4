/**
 * Script de test de connexion à l'API Backend
 * Simule les requêtes de l'application mobile
 */

const API_BASE_URL = 'https://yukpomnang.onrender.com';

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test 1: Vérifier que le backend répond
async function testBackendHealth() {
  log('\n🔍 Test 1: Vérification de l\'état du backend', 'cyan');
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    
    if (response.ok) {
      log(`✅ Backend opérationnel !`, 'green');
      log(`   Status: ${data.status || 'OK'}`, 'green');
      return true;
    } else {
      log(`❌ Backend ne répond pas correctement (${response.status})`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Erreur de connexion: ${error.message}`, 'red');
    return false;
  }
}

// Test 2: Simuler une requête mobile avec headers
async function testMobileHeaders() {
  log('\n🔍 Test 2: Simulation de requête mobile avec headers', 'cyan');
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Yukpomnang-Mobile/1.0.0',
  };
  
  log(`   Headers envoyés:`, 'yellow');
  Object.entries(headers).forEach(([key, value]) => {
    log(`     ${key}: ${value}`, 'yellow');
  });
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers,
    });
    
    log(`\n   Response Status: ${response.status}`, 'blue');
    log(`   Headers CORS reçus:`, 'blue');
    log(`     Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin') || 'non défini'}`, 'blue');
    log(`     Access-Control-Allow-Methods: ${response.headers.get('access-control-allow-methods') || 'non défini'}`, 'blue');
    log(`     Access-Control-Allow-Headers: ${response.headers.get('access-control-allow-headers') || 'non défini'}`, 'blue');
    
    if (response.ok) {
      log(`\n✅ Requête mobile acceptée !`, 'green');
      return true;
    } else {
      log(`\n❌ Requête mobile rejetée (${response.status})`, 'red');
      return false;
    }
  } catch (error) {
    log(`\n❌ Erreur: ${error.message}`, 'red');
    return false;
  }
}

// Test 3: Simuler une connexion (sans vraies credentials)
async function testLoginEndpoint() {
  log('\n🔍 Test 3: Test de l\'endpoint /auth/login', 'cyan');
  
  const testCredentials = {
    email: 'test@example.com',
    password: 'testpassword123',
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Yukpomnang-Mobile/1.0.0',
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify(testCredentials),
    });
    
    log(`   Response Status: ${response.status}`, 'blue');
    
    let data;
    try {
      data = await response.json();
      log(`   Response Body:`, 'blue');
      log(`   ${JSON.stringify(data, null, 2)}`, 'blue');
    } catch {
      const text = await response.text();
      log(`   Response Text: ${text}`, 'blue');
    }
    
    // On s'attend à une erreur 401 (credentials invalides), pas à une erreur réseau
    if (response.status === 401 || response.status === 400) {
      log(`\n✅ Endpoint accessible ! (erreur ${response.status} attendue avec fausses credentials)`, 'green');
      return true;
    } else if (response.ok) {
      log(`\n✅ Endpoint accessible et répond correctement !`, 'green');
      return true;
    } else {
      log(`\n⚠️  Endpoint répond avec status ${response.status}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`\n❌ Erreur: ${error.message}`, 'red');
    return false;
  }
}

// Test 4: Vérifier si l'endpoint /api/user/me est accessible
async function testAuthenticatedEndpoint() {
  log('\n🔍 Test 4: Test de l\'endpoint /api/user/me (sans token)', 'cyan');
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Yukpomnang-Mobile/1.0.0',
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/me`, {
      method: 'GET',
      headers,
    });
    
    log(`   Response Status: ${response.status}`, 'blue');
    
    // On s'attend à une erreur 401 (non authentifié)
    if (response.status === 401) {
      log(`\n✅ Endpoint protégé fonctionne correctement ! (401 attendu sans token)`, 'green');
      return true;
    } else if (response.ok) {
      log(`\n⚠️  Endpoint accessible sans authentification (pas sécurisé !)`, 'yellow');
      return true;
    } else {
      log(`\n⚠️  Endpoint répond avec status ${response.status}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`\n❌ Erreur: ${error.message}`, 'red');
    return false;
  }
}

// Exécuter tous les tests
async function runAllTests() {
  log('═══════════════════════════════════════════════════════', 'cyan');
  log('🚀 Test de connexion API Mobile Yukpomnang', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');
  log(`\n📡 URL Backend: ${API_BASE_URL}`, 'blue');
  
  const results = {
    backendHealth: await testBackendHealth(),
    mobileHeaders: await testMobileHeaders(),
    loginEndpoint: await testLoginEndpoint(),
    authenticatedEndpoint: await testAuthenticatedEndpoint(),
  };
  
  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('📊 RÉSUMÉ DES TESTS', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  
  log(`\n✅ Tests réussis: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'yellow');
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`   ${icon} ${test}`, color);
  });
  
  if (passedTests === totalTests) {
    log('\n🎉 Tous les tests ont réussi ! Le backend est prêt pour les requêtes mobiles.', 'green');
  } else {
    log('\n⚠️  Certains tests ont échoué. Vérifiez la configuration du backend.', 'yellow');
  }
  
  log('\n═══════════════════════════════════════════════════════\n', 'cyan');
}

// Exécuter les tests
runAllTests().catch(error => {
  log(`\n❌ Erreur fatale: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});


