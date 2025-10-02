/**
 * Test de connexion réelle avec un compte utilisateur
 * Usage: node test-real-login.js email@example.com motdepasse
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

async function testRealLogin(email, password) {
  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('🔐 Test de connexion réelle Yukpomnang Mobile', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');
  
  log(`\n📧 Email: ${email}`, 'blue');
  log(`🔑 Password: ${'*'.repeat(password.length)}`, 'blue');
  log(`📡 API URL: ${API_BASE_URL}`, 'blue');
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Yukpomnang-Mobile/1.0.0',
  };
  
  log('\n🚀 Envoi de la requête de connexion...', 'yellow');
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
    });
    
    log(`\n📥 Réponse reçue:`, 'blue');
    log(`   Status: ${response.status} ${response.statusText}`, 'blue');
    
    const data = await response.json();
    
    log(`\n📄 Données reçues:`, 'blue');
    console.log(JSON.stringify(data, null, 2));
    
    if (response.ok && data.token) {
      log('\n✅ CONNEXION RÉUSSIE !', 'green');
      log(`\n🎟️  Token JWT reçu:`, 'green');
      log(`   ${data.token.substring(0, 50)}...`, 'green');
      
      // Décoder le JWT (partie payload)
      try {
        const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
        log(`\n👤 Informations utilisateur décodées:`, 'cyan');
        console.log(JSON.stringify(payload, null, 2));
      } catch (e) {
        log(`   (Impossible de décoder le token)`, 'yellow');
      }
      
      // Test avec le token reçu
      log(`\n🔍 Test de l'endpoint /api/user/me avec le token...`, 'yellow');
      
      const meResponse = await fetch(`${API_BASE_URL}/api/user/me`, {
        method: 'GET',
        headers: {
          ...headers,
          'Authorization': `Bearer ${data.token}`,
        },
      });
      
      log(`   Status: ${meResponse.status}`, 'blue');
      
      if (meResponse.ok) {
        const userData = await meResponse.json();
        log(`\n✅ Authentification réussie !`, 'green');
        log(`\n👤 Données utilisateur:`, 'cyan');
        console.log(JSON.stringify(userData, null, 2));
      } else {
        log(`\n⚠️  Token non accepté par /api/user/me`, 'yellow');
        const errorData = await meResponse.json().catch(() => ({}));
        console.log(errorData);
      }
      
      return true;
    } else if (response.status === 401) {
      log('\n❌ ÉCHEC DE CONNEXION: Identifiants incorrects', 'red');
      log(`   Message: ${data.error || data.message || 'Non spécifié'}`, 'red');
      return false;
    } else {
      log(`\n❌ ERREUR: ${response.status}`, 'red');
      log(`   Message: ${data.error || data.message || 'Non spécifié'}`, 'red');
      return false;
    }
  } catch (error) {
    log(`\n❌ ERREUR RÉSEAU: ${error.message}`, 'red');
    console.error(error);
    return false;
  } finally {
    log('\n═══════════════════════════════════════════════════════\n', 'cyan');
  }
}

// Récupérer les arguments de ligne de commande
const args = process.argv.slice(2);

if (args.length < 2) {
  log('❌ Usage: node test-real-login.js <email> <password>', 'red');
  log('\nExemple:', 'yellow');
  log('  node test-real-login.js user@example.com mypassword123', 'yellow');
  process.exit(1);
}

const [email, password] = args;

// Exécuter le test
testRealLogin(email, password).then(success => {
  process.exit(success ? 0 : 1);
});


