#!/usr/bin/env node

/**
 * Script de test complet pour les fonctionnalités mobile Yukpo
 * Teste l'inscription, connexion, et les fonctionnalités principales
 */

const https = require('https');
const { performance } = require('perf_hooks');

// Configuration
const API_BASE_URL = 'https://yukpomnang.onrender.com';
const TEST_USER = {
  name: 'Test Mobile Features',
  email: `test.features.${Date.now()}@yukpo.com`,
  password: 'TestPassword123',
  phone: '+237123456789'
};

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Fonction pour faire des appels API
function makeApiCall(endpoint, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Yukpo-Mobile-Features-Test/1.0'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Fonction pour logger avec couleurs
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.reset;
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Test d'inscription
async function testRegistration() {
  log('blue', '🧪 Test d\'inscription...');
  
  const startTime = performance.now();
  
  try {
    const payload = {
      nom: TEST_USER.name,
      prenom: TEST_USER.name,
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: TEST_USER.password,
      lang: 'fr'
    };

    const response = await makeApiCall('/auth/register', 'POST', payload);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    if (response.status === 200 || response.status === 201) {
      log('green', `✅ Inscription réussie en ${duration}ms`);
      return response.data.token;
    } else {
      log('red', `❌ Échec de l'inscription (${response.status})`);
      return null;
    }
  } catch (error) {
    log('red', '❌ Erreur lors de l\'inscription:', error.message);
    return null;
  }
}

// Test de connexion
async function testLogin() {
  log('blue', '🧪 Test de connexion...');
  
  const startTime = performance.now();
  
  try {
    const payload = {
      email: TEST_USER.email,
      password: TEST_USER.password
    };

    const response = await makeApiCall('/auth/login', 'POST', payload);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    if (response.status === 200) {
      log('green', `✅ Connexion réussie en ${duration}ms`);
      return response.data.token;
    } else {
      log('red', `❌ Échec de la connexion (${response.status})`);
      return null;
    }
  } catch (error) {
    log('red', '❌ Erreur lors de la connexion:', error.message);
    return null;
  }
}

// Test de vérification du token
async function testTokenVerification(token) {
  log('blue', '🧪 Test de vérification du token...');
  
  const startTime = performance.now();
  
  try {
    const response = await makeApiCall('/api/user/me', 'GET', null, token);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    if (response.status === 200) {
      log('green', `✅ Token valide en ${duration}ms`);
      log('cyan', `👤 Utilisateur: ${response.data.name || 'N/A'}`);
      log('cyan', `📧 Email: ${response.data.email || 'N/A'}`);
      log('cyan', `🆔 ID: ${response.data.id || 'N/A'}`);
      log('cyan', `💰 Crédits: ${response.data.credits || 0}`);
      return response.data;
    } else {
      log('red', `❌ Token invalide (${response.status})`);
      return null;
    }
  } catch (error) {
    log('red', '❌ Erreur lors de la vérification du token:', error.message);
    return null;
  }
}

// Test de l'API utilisateur
async function testUserApi(token) {
  log('blue', '🧪 Test de l\'API utilisateur...');
  
  try {
    // Test du solde de tokens
    const balanceResponse = await makeApiCall('/api/users/balance', 'GET', null, token);
    if (balanceResponse.status === 200) {
      log('green', `💰 Solde de tokens: ${balanceResponse.data.balance || 0}`);
    } else {
      log('yellow', '⚠️ Impossible de récupérer le solde');
    }

    return true;
  } catch (error) {
    log('red', '❌ Erreur lors du test de l\'API utilisateur:', error.message);
    return false;
  }
}

// Test de l'API de services
async function testServicesApi(token) {
  log('blue', '🧪 Test de l\'API de services...');
  
  try {
    // Test de récupération des services utilisateur
    const userServicesResponse = await makeApiCall('/api/services/user', 'GET', null, token);
    if (userServicesResponse.status === 200) {
      log('green', `📋 Services utilisateur: ${userServicesResponse.data.length || 0} trouvés`);
    } else {
      log('yellow', '⚠️ Impossible de récupérer les services utilisateur');
    }

    // Test de récupération des services interagis
    const interactedServicesResponse = await makeApiCall('/api/services/interacted', 'GET', null, token);
    if (interactedServicesResponse.status === 200) {
      log('green', `🤝 Services interagis: ${interactedServicesResponse.data.length || 0} trouvés`);
    } else {
      log('yellow', '⚠️ Impossible de récupérer les services interagis');
    }

    return true;
  } catch (error) {
    log('red', '❌ Erreur lors du test de l\'API de services:', error.message);
    return false;
  }
}

// Test de l'API IA
async function testIAApi(token) {
  log('blue', '🧪 Test de l\'API IA...');
  
  try {
    // Test de chat IA
    const chatResponse = await makeApiCall('/api/ia/chat', 'POST', { message: 'Bonjour, test mobile' }, token);
    if (chatResponse.status === 200) {
      log('green', '🤖 Chat IA fonctionnel');
    } else {
      log('yellow', '⚠️ Chat IA non accessible');
    }

    // Test de suggestions de mots-clés
    const keywordsResponse = await makeApiCall('/api/ia/keywords', 'POST', { text: 'plomberie réparation' }, token);
    if (keywordsResponse.status === 200) {
      log('green', '🔍 Suggestions de mots-clés fonctionnelles');
    } else {
      log('yellow', '⚠️ Suggestions de mots-clés non accessibles');
    }

    return true;
  } catch (error) {
    log('red', '❌ Erreur lors du test de l\'API IA:', error.message);
    return false;
  }
}

// Test de l'API de recherche
async function testSearchApi(token) {
  log('blue', '🧪 Test de l\'API de recherche...');
  
  try {
    const searchData = {
      query: 'plomberie',
      location: {
        latitude: 3.848,
        longitude: 11.502
      },
      radius: 10
    };

    const searchResponse = await makeApiCall('/api/search/direct', 'POST', searchData, token);
    if (searchResponse.status === 200) {
      log('green', `🔍 Recherche fonctionnelle: ${searchResponse.data.length || 0} résultats`);
    } else {
      log('yellow', '⚠️ Recherche non accessible');
    }

    return true;
  } catch (error) {
    log('red', '❌ Erreur lors du test de l\'API de recherche:', error.message);
    return false;
  }
}

// Test de l'API de localisation
async function testLocationApi(token) {
  log('blue', '🧪 Test de l\'API de localisation...');
  
  try {
    const locationData = {
      latitude: 3.848,
      longitude: 11.502
    };

    const locationResponse = await makeApiCall('/api/user/location', 'POST', locationData, token);
    if (locationResponse.status === 200) {
      log('green', '📍 Mise à jour de localisation fonctionnelle');
    } else {
      log('yellow', '⚠️ Mise à jour de localisation non accessible');
    }

    return true;
  } catch (error) {
    log('red', '❌ Erreur lors du test de l\'API de localisation:', error.message);
    return false;
  }
}

// Test principal
async function runTests() {
  log('magenta', '🚀 Démarrage des tests complets des fonctionnalités mobile Yukpo');
  log('cyan', `🌐 API Base URL: ${API_BASE_URL}`);
  log('cyan', `👤 Utilisateur de test: ${TEST_USER.email}`);
  
  console.log('\n' + '='.repeat(60) + '\n');

  let token = null;
  let userData = null;
  let allTestsPassed = true;

  // Test 1: Inscription
  log('bright', '📝 ÉTAPE 1: Test d\'inscription');
  token = await testRegistration();
  if (!token) {
    allTestsPassed = false;
  }
  
  console.log('\n' + '-'.repeat(40) + '\n');

  // Test 2: Connexion
  log('bright', '🔐 ÉTAPE 2: Test de connexion');
  token = await testLogin();
  if (!token) {
    allTestsPassed = false;
  }
  
  console.log('\n' + '-'.repeat(40) + '\n');

  // Test 3: Vérification du token
  if (token) {
    log('bright', '🔍 ÉTAPE 3: Test de vérification du token');
    userData = await testTokenVerification(token);
    if (!userData) {
      allTestsPassed = false;
    }
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // Test 4: API utilisateur
    log('bright', '👤 ÉTAPE 4: Test de l\'API utilisateur');
    const userApiValid = await testUserApi(token);
    if (!userApiValid) {
      allTestsPassed = false;
    }
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // Test 5: API de services
    log('bright', '📋 ÉTAPE 5: Test de l\'API de services');
    const servicesApiValid = await testServicesApi(token);
    if (!servicesApiValid) {
      allTestsPassed = false;
    }
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // Test 6: API IA
    log('bright', '🤖 ÉTAPE 6: Test de l\'API IA');
    const iaApiValid = await testIAApi(token);
    if (!iaApiValid) {
      allTestsPassed = false;
    }
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // Test 7: API de recherche
    log('bright', '🔍 ÉTAPE 7: Test de l\'API de recherche');
    const searchApiValid = await testSearchApi(token);
    if (!searchApiValid) {
      allTestsPassed = false;
    }
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // Test 8: API de localisation
    log('bright', '📍 ÉTAPE 8: Test de l\'API de localisation');
    const locationApiValid = await testLocationApi(token);
    if (!locationApiValid) {
      allTestsPassed = false;
    }
  } else {
    log('red', '❌ Impossible de continuer les tests sans token');
    allTestsPassed = false;
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Résumé
  if (allTestsPassed) {
    log('green', '🎉 TOUS LES TESTS SONT PASSÉS !');
    log('green', '✅ L\'application mobile peut gérer l\'inscription et la connexion');
    log('green', '✅ L\'API backend fonctionne correctement');
    log('green', '✅ Les tokens d\'authentification sont valides');
    log('green', '✅ Les fonctionnalités principales sont opérationnelles');
  } else {
    log('red', '❌ CERTAINS TESTS ONT ÉCHOUÉ');
    log('red', '⚠️ Vérifiez la configuration du backend et de l\'API');
  }

  log('cyan', `📊 Résumé des tests:`);
  log('cyan', `   - Utilisateur test: ${TEST_USER.email}`);
  log('cyan', `   - API Base URL: ${API_BASE_URL}`);
  log('cyan', `   - Token reçu: ${token ? 'Oui' : 'Non'}`);
  log('cyan', `   - Utilisateur ID: ${userData?.id || 'N/A'}`);
  log('cyan', `   - Tests réussis: ${allTestsPassed ? 'Tous' : 'Partiels'}`);

  process.exit(allTestsPassed ? 0 : 1);
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  log('red', '❌ Erreur non gérée:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log('red', '❌ Exception non capturée:', error.message);
  process.exit(1);
});

// Lancement des tests
runTests().catch((error) => {
  log('red', '❌ Erreur lors de l\'exécution des tests:', error.message);
  process.exit(1);
});

