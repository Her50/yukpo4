#!/usr/bin/env node

/**
 * Script de test pour l'authentification mobile Yukpo
 * Teste l'inscription et la connexion d'un utilisateur
 */

const https = require('https');
const { performance } = require('perf_hooks');

// Configuration
const API_BASE_URL = 'https://yukpomnang.onrender.com';
const TEST_USER = {
  name: 'Test Mobile User',
  email: `test.mobile.${Date.now()}@yukpo.com`,
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
function makeApiCall(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Yukpo-Mobile-Test/1.0'
      }
    };

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
  log('blue', '🧪 Test d\'inscription mobile...');
  
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
      log('cyan', `📧 Email: ${TEST_USER.email}`);
      log('cyan', `👤 Nom: ${TEST_USER.name}`);
      
      if (response.data.token) {
        log('green', '🔑 Token reçu');
        return response.data.token;
      } else {
        log('yellow', '⚠️ Aucun token reçu, connexion manuelle nécessaire');
        return null;
      }
    } else {
      log('red', `❌ Échec de l'inscription (${response.status})`);
      log('red', 'Réponse:', response.data);
      return null;
    }
  } catch (error) {
    log('red', '❌ Erreur lors de l\'inscription:', error.message);
    return null;
  }
}

// Test de connexion
async function testLogin() {
  log('blue', '🧪 Test de connexion mobile...');
  
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
      log('cyan', `📧 Email: ${TEST_USER.email}`);
      
      if (response.data.token) {
        log('green', '🔑 Token reçu');
        return response.data.token;
      } else {
        log('red', '❌ Aucun token reçu');
        return null;
      }
    } else {
      log('red', `❌ Échec de la connexion (${response.status})`);
      log('red', 'Réponse:', response.data);
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
      return true;
    } else {
      log('red', `❌ Token invalide (${response.status})`);
      log('red', 'Réponse:', response.data);
      return false;
    }
  } catch (error) {
    log('red', '❌ Erreur lors de la vérification du token:', error.message);
    return false;
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

    // Test du profil utilisateur
    const profileResponse = await makeApiCall('/api/user/profile', 'GET', null, token);
    if (profileResponse.status === 200) {
      log('green', '👤 Profil utilisateur accessible');
    } else {
      log('yellow', '⚠️ Profil utilisateur non accessible');
    }

    return true;
  } catch (error) {
    log('red', '❌ Erreur lors du test de l\'API utilisateur:', error.message);
    return false;
  }
}

// Fonction pour faire des appels API avec token
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
        'User-Agent': 'Yukpo-Mobile-Test/1.0'
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

// Test principal
async function runTests() {
  log('magenta', '🚀 Démarrage des tests d\'authentification mobile Yukpo');
  log('cyan', `🌐 API Base URL: ${API_BASE_URL}`);
  log('cyan', `👤 Utilisateur de test: ${TEST_USER.email}`);
  
  console.log('\n' + '='.repeat(60) + '\n');

  let token = null;
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
    const tokenValid = await testTokenVerification(token);
    if (!tokenValid) {
      allTestsPassed = false;
    }
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // Test 4: API utilisateur
    log('bright', '👤 ÉTAPE 4: Test de l\'API utilisateur');
    const userApiValid = await testUserApi(token);
    if (!userApiValid) {
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
  } else {
    log('red', '❌ CERTAINS TESTS ONT ÉCHOUÉ');
    log('red', '⚠️ Vérifiez la configuration du backend et de l\'API');
  }

  log('cyan', `📊 Résumé des tests:`);
  log('cyan', `   - Utilisateur test: ${TEST_USER.email}`);
  log('cyan', `   - API Base URL: ${API_BASE_URL}`);
  log('cyan', `   - Token reçu: ${token ? 'Oui' : 'Non'}`);
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


