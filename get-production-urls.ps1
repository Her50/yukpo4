# Script pour récupérer les URLs de production
Write-Host "RÉCUPÉRATION URLs PRODUCTION - MongoDB & Redis" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Yellow

Write-Host "`nOuverture des dashboards..." -ForegroundColor Green
Start-Process "https://cloud.mongodb.com"
Start-Process "https://console.upstash.com"

Write-Host "`n🍃 MONGODB ATLAS (Gratuit permanent)" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host "1. Dashboard MongoDB Atlas ouvert" -ForegroundColor White
Write-Host "2. Sign up/Login avec GitHub/Google" -ForegroundColor White
Write-Host "3. Create Database > M0 Sandbox (GRATUIT)" -ForegroundColor White
Write-Host "4. Nom cluster: yukpomnang-cluster" -ForegroundColor White
Write-Host "5. Connect > Connect your application" -ForegroundColor White
Write-Host "6. Copiez l'URL: mongodb+srv://..." -ForegroundColor White

$mongoUrl = Read-Host "`nCollez votre URL MongoDB Atlas ici"

Write-Host "`n⚡ UPSTASH REDIS (Gratuit)" -ForegroundColor Red
Write-Host "=========================" -ForegroundColor Red
Write-Host "1. Dashboard Upstash ouvert" -ForegroundColor White
Write-Host "2. Sign up/Login avec GitHub/Google" -ForegroundColor White
Write-Host "3. Create database > yukpomnang-cache" -ForegroundColor White
Write-Host "4. Region: US-East-1 (gratuit)" -ForegroundColor White
Write-Host "5. Details > Copy Redis URL" -ForegroundColor White
Write-Host "6. Format: redis://default:password@..." -ForegroundColor White

$redisUrl = Read-Host "`nCollez votre URL Upstash Redis ici"

# Validation des URLs
Write-Host "`n✅ VALIDATION DES URLs:" -ForegroundColor Green

if ($mongoUrl -and $mongoUrl.StartsWith("mongodb")) {
    Write-Host "✅ MongoDB URL valide: $($mongoUrl.Substring(0,30))..." -ForegroundColor Green
} else {
    Write-Host "❌ MongoDB URL invalide ou manquante" -ForegroundColor Red
    $mongoUrl = "mongodb://localhost:27017"
}

if ($redisUrl -and $redisUrl.StartsWith("redis://")) {
    Write-Host "✅ Redis URL valide: $($redisUrl.Substring(0,30))..." -ForegroundColor Green
} else {
    Write-Host "❌ Redis URL invalide ou manquante" -ForegroundColor Red
    $redisUrl = "redis://localhost:6379"
}

# Génération du fichier de configuration
Write-Host "`n📝 GÉNÉRATION CONFIGURATION RENDER..." -ForegroundColor Cyan

$configUpdate = @"
# URLs DE PRODUCTION À UTILISER DANS RENDER

# MongoDB Atlas (Production)
MONGODB_URL=$mongoUrl

# Upstash Redis (Production)  
REDIS_URL=$redisUrl

# Variables complètes à ajouter dans Render:
GOOGLE_MAPS_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
YUKPO_API_KEY=yukpo_embedding_key_2024
ENABLE_AI_OPTIMIZATIONS=true
ENVIRONMENT=production
MONGODB_URL=$mongoUrl
REDIS_URL=$redisUrl
EMBEDDING_TIMEOUT_SECONDS=60
SEARCH_DEFAULT_LANGUAGE=fr
SEARCH_DEFAULT_LAT=4.0
SEARCH_DEFAULT_LON=9.7
"@

$configUpdate | Out-File -FilePath "production-urls-ready.txt" -Encoding UTF8
$configUpdate | Set-Clipboard

Write-Host "`n✅ CONFIGURATION GÉNÉRÉE!" -ForegroundColor Green
Write-Host "📁 Fichier: production-urls-ready.txt" -ForegroundColor White
Write-Host "📋 Configuration copiée dans le presse-papier" -ForegroundColor White

Write-Host "`n🎯 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Retournez sur Render.com > Environment" -ForegroundColor White
Write-Host "2. Modifiez MONGODB_URL avec: $mongoUrl" -ForegroundColor White
Write-Host "3. Modifiez REDIS_URL avec: $redisUrl" -ForegroundColor White
Write-Host "4. Ajoutez les autres variables manquantes" -ForegroundColor White
Write-Host "5. Save, rebuild, and deploy" -ForegroundColor White

Write-Host "`n🚀 URLs de production prêtes!" -ForegroundColor Green 