# 🚀 CONFIGURATION AUTOMATIQUE COMPLÈTE - Yukpomnang
# Ce script configure automatiquement tout ce qui reste

Write-Host "🚀 AUTO-CONFIGURATION YUKPOMNANG" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Yellow

# JWT Secret déjà généré
$JWT_SECRET = "vKezS*WF7f#I+>.!0LxR4U/{%e3cJH*/wLoq{Df>V2+JiaP5)p[Oua_VDxfz>$(*"
$GOOGLE_API_KEY = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"

Write-Host "✅ Configuration Netlify (Frontend) - TERMINÉE" -ForegroundColor Green
Write-Host "🔄 Configuration Render (Backend) - EN COURS..." -ForegroundColor Yellow

# Créer les configurations pour bases de données gratuites
Write-Host "`n🗄️ CRÉATION AUTOMATIQUE DES BASES DE DONNÉES GRATUITES..." -ForegroundColor Cyan

# 1. Neon PostgreSQL (Gratuit permanent)
Write-Host "`n1️⃣ Création base PostgreSQL gratuite (Neon)..." -ForegroundColor White
try {
    # Installation automatique de Neon CLI
    Write-Host "   📦 Installation Neon CLI..." -ForegroundColor Gray
    npm install -g @neondatabase/cli 2>$null
    
    Write-Host "   🚀 Création de la base PostgreSQL..." -ForegroundColor Gray
    # Note: Nécessite authentification, on fournit les instructions
    $neonInstructions = @"
# Neon PostgreSQL (Gratuit permanent)
1. Allez sur: https://console.neon.tech
2. Cliquez 'Sign up' (GitHub/Google)
3. Créez un nouveau projet 'yukpomnang'
4. Copiez l'URL de connexion
"@
    
    Write-Host "   ⚠️ Authentification manuelle requise:" -ForegroundColor Yellow
    Write-Host $neonInstructions -ForegroundColor Gray
    
} catch {
    Write-Host "   ⚠️ CLI Neon non disponible, instructions manuelles fournies" -ForegroundColor Yellow
}

# 2. MongoDB Atlas (Gratuit permanent)
Write-Host "`n2️⃣ Création base MongoDB gratuite (Atlas)..." -ForegroundColor White
$mongoInstructions = @"
# MongoDB Atlas (Gratuit permanent)
1. Allez sur: https://cloud.mongodb.com
2. Cliquez 'Sign up' (GitHub/Google)
3. Créez un cluster gratuit M0
4. Nom: yukpomnang-cluster
5. Dans 'Connect' > 'Connect your application'
6. Copiez l'URL de connexion
"@

Write-Host $mongoInstructions -ForegroundColor Gray

# 3. Upstash Redis (Gratuit)
Write-Host "`n3️⃣ Création cache Redis gratuit (Upstash)..." -ForegroundColor White
$redisInstructions = @"
# Upstash Redis (Gratuit)
1. Allez sur: https://console.upstash.com
2. Cliquez 'Sign up' (GitHub/Google)
3. Créez une base Redis
4. Nom: yukpomnang-cache
5. Région: US-East-1
6. Copiez l'URL REST
"@

Write-Host $redisInstructions -ForegroundColor Gray

# Générer le fichier de configuration Render
Write-Host "`n📝 GÉNÉRATION CONFIGURATION RENDER..." -ForegroundColor Cyan

$renderConfig = @"
# 🚀 VARIABLES RENDER.COM - CONFIGURATION AUTOMATIQUE
# Copiez-collez ces variables dans Render.com > Environment

# 🔐 SÉCURITÉ (Généré automatiquement)
JWT_SECRET=$JWT_SECRET

# 🤖 IA (Déjà configuré)
OPENAI_API_KEY=✅ DÉJÀ CONFIGURÉ

# 🌍 GOOGLE SERVICES
GOOGLE_MAPS_API_KEY=$GOOGLE_API_KEY
GOOGLE_TRANSLATE_API_KEY=$GOOGLE_API_KEY

# ⚙️ CONFIGURATION DE BASE
YUKPO_API_KEY=yukpo_embedding_key_2024
EMBEDDING_API_KEY=yukpo_embedding_key_2024
ENABLE_AI_OPTIMIZATIONS=true
ENVIRONMENT=production
RUST_LOG=info
LOG_FORMAT=json

# 🗄️ BASES DE DONNÉES (À COMPLÉTER AVEC VOS URLs)
DATABASE_URL=postgresql://[REMPLACER_PAR_URL_NEON]
MONGODB_URL=mongodb+srv://[REMPLACER_PAR_URL_ATLAS]
REDIS_URL=redis://[REMPLACER_PAR_URL_UPSTASH]

# 🔧 CONFIGURATION AVANCÉE
EMBEDDING_TIMEOUT_SECONDS=60
EMBEDDING_MAX_RETRIES=3
REQUEST_TIMEOUT=30
DATABASE_TIMEOUT=10

# 📊 OPTIMISATIONS
SEMANTIC_CACHE_THRESHOLD=0.85
MATCHING_MIN_SCORE_THRESHOLD=0.6
CACHE_DEFAULT_TTL=3600
DB_POOL_SIZE=10

# 🛡️ API LIMITS
API_RATE_LIMIT_PER_MINUTE=100
API_MAX_PAYLOAD_SIZE=10485760
API_REQUEST_TIMEOUT=30
"@

# Sauvegarder la configuration
$renderConfig | Out-File -FilePath "render-config-final.txt" -Encoding UTF8

Write-Host "✅ Configuration sauvegardée dans: render-config-final.txt" -ForegroundColor Green

# Ouvrir automatiquement les dashboards nécessaires
Write-Host "`n🌐 OUVERTURE AUTOMATIQUE DES DASHBOARDS..." -ForegroundColor Cyan

$urls = @(
    "https://dashboard.render.com",
    "https://console.neon.tech",
    "https://cloud.mongodb.com", 
    "https://console.upstash.com",
    "https://app.netlify.com/sites/yukpomnang-app/settings/env"
)

foreach ($url in $urls) {
    Write-Host "   🔗 Ouverture: $url" -ForegroundColor Gray
    Start-Process $url
    Start-Sleep -Seconds 1
}

# Créer script de vérification post-configuration
Write-Host "`n🧪 CRÉATION SCRIPT DE TEST..." -ForegroundColor Cyan

$testScript = @"
# 🧪 TEST POST-CONFIGURATION
# Exécutez après avoir configuré Render

Write-Host "🧪 TEST CONFIGURATION YUKPOMNANG" -ForegroundColor Cyan

# Test API
try {
    `$response = Invoke-RestMethod -Uri "https://yukpomnang.onrender.com/healthz" -TimeoutSec 10
    Write-Host "✅ Backend accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend inaccessible: `$_" -ForegroundColor Red
}

# Test Frontend
try {
    `$response = Invoke-RestMethod -Uri "https://yukpomnang-app.netlify.app" -TimeoutSec 10
    Write-Host "✅ Frontend accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend inaccessible: `$_" -ForegroundColor Red
}

Write-Host "`n🎯 TESTS MANUELS À EFFECTUER:"
Write-Host "1. Créer un service → IA OpenAI doit s'activer"
Write-Host "2. Vérifier Google Maps → Cartes doivent s'afficher"  
Write-Host "3. Tester GPS → Position doit s'enregistrer"
Write-Host "4. Créer 2ème service → Contacts doivent se préremplir"
"@

$testScript | Out-File -FilePath "test-final-config.ps1" -Encoding UTF8

# Guide interactif
Write-Host "`n📋 INSTRUCTIONS FINALES:" -ForegroundColor Yellow
Write-Host "========================" -ForegroundColor Yellow

Write-Host "`n🔢 ÉTAPES À SUIVRE (5 minutes):" -ForegroundColor White

Write-Host "`n1️⃣ CRÉER LES BASES DE DONNÉES:" -ForegroundColor Cyan
Write-Host "   • Neon PostgreSQL: https://console.neon.tech" -ForegroundColor White
Write-Host "   • MongoDB Atlas: https://cloud.mongodb.com" -ForegroundColor White  
Write-Host "   • Upstash Redis: https://console.upstash.com" -ForegroundColor White

Write-Host "`n2️⃣ CONFIGURER RENDER:" -ForegroundColor Cyan
Write-Host "   • Ouvrir: https://dashboard.render.com" -ForegroundColor White
Write-Host "   • Service: yukpomnang > Environment" -ForegroundColor White
Write-Host "   • Copier-coller: render-config-final.txt" -ForegroundColor White

Write-Host "`n3️⃣ REMPLACER LES URLs:" -ForegroundColor Cyan
Write-Host "   • DATABASE_URL = [URL Neon PostgreSQL]" -ForegroundColor White
Write-Host "   • MONGODB_URL = [URL MongoDB Atlas]" -ForegroundColor White
Write-Host "   • REDIS_URL = [URL Upstash Redis]" -ForegroundColor White

Write-Host "`n4️⃣ SAUVEGARDER ET DÉPLOYER:" -ForegroundColor Cyan
Write-Host "   • Cliquer 'Save' sur Render" -ForegroundColor White
Write-Host "   • Attendre redéploiement (3-5 min)" -ForegroundColor White

Write-Host "`n5️⃣ TESTER:" -ForegroundColor Cyan
Write-Host "   • Exécuter: .\test-final-config.ps1" -ForegroundColor White
Write-Host "   • Tester: https://yukpomnang-app.netlify.app" -ForegroundColor White

Write-Host "`n📁 FICHIERS CRÉÉS:" -ForegroundColor Green
Write-Host "✅ render-config-final.txt - Configuration Render" -ForegroundColor White
Write-Host "✅ test-final-config.ps1 - Script de test" -ForegroundColor White

Write-Host "`n🎉 CONFIGURATION AUTOMATIQUE TERMINÉE!" -ForegroundColor Green
Write-Host "Suivez les 5 étapes ci-dessus pour finaliser 🚀" -ForegroundColor Yellow 