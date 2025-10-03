# 🚀 Script de build de production FIXÉ pour Yukpomnang Mobile
# Ce script corrige le problème de connexion Metro en forçant le mode standalone

Write-Host "🚀 BUILD DE PRODUCTION FIXÉ - YUKPOMNANG MOBILE" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "app.json")) {
    Write-Host "❌ Erreur: app.json non trouvé. Exécutez ce script depuis le dossier mobile/" -ForegroundColor Red
    exit 1
}

# Nettoyer les builds précédents
Write-Host "🧹 Nettoyage des builds précédents..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path ".expo") { Remove-Item -Recurse -Force ".expo" }

# Vérifier la configuration EAS
Write-Host "🔧 Vérification de la configuration EAS..." -ForegroundColor Yellow
$easConfig = Get-Content "eas.json" | ConvertFrom-Json

# Forcer la configuration de production standalone
$productionConfig = @{
    "developmentClient" = $false
    "distribution" = "internal"
    "env" = @{
        "EXPO_PUBLIC_API_URL" = "https://yukpomnang.onrender.com"
        "EXPO_PUBLIC_ENVIRONMENT" = "production"
        "NODE_ENV" = "production"
        "EXPO_USE_HERMES" = "true"
    }
    "android" = @{
        "buildType" = "apk"
        "gradleCommand" = ":app:assembleRelease"
        "credentialsSource" = "remote"
        "image" = "latest"
        "withoutCredentials" = $false
    }
}

# Mettre à jour la configuration EAS
$easConfig.build.production = $productionConfig
$easConfig | ConvertTo-Json -Depth 10 | Set-Content "eas.json"

Write-Host "✅ Configuration EAS mise à jour pour le mode standalone" -ForegroundColor Green

# Vérifier la configuration app.json
Write-Host "🔧 Vérification de la configuration app.json..." -ForegroundColor Yellow
$appConfig = Get-Content "app.json" | ConvertFrom-Json

# Ajouter les configurations pour forcer le mode standalone
$appConfig.expo.updates = @{
    "enabled" = $false
}
$appConfig.expo.runtimeVersion = @{
    "policy" = "sdkVersion"
}

# Sauvegarder la configuration app.json
$appConfig | ConvertTo-Json -Depth 10 | Set-Content "app.json"

Write-Host "✅ Configuration app.json mise à jour pour le mode standalone" -ForegroundColor Green

# Installer les dépendances
Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
npm ci --production
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'installation des dépendances" -ForegroundColor Red
    exit 1
}

# Build de production avec EAS
Write-Host "🔨 Build de production avec EAS..." -ForegroundColor Yellow
Write-Host "⚠️  IMPORTANT: Ce build va créer un APK standalone (pas de connexion Metro)" -ForegroundColor Magenta

# Utiliser le profil de production
npx eas build --platform android --profile production --local
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du build EAS" -ForegroundColor Red
    Write-Host "🔄 Tentative avec le profil standalone..." -ForegroundColor Yellow
    
    # Fallback avec le profil standalone
    npx eas build --platform android --profile standalone --local
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors du build standalone" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Build de production terminé avec succès!" -ForegroundColor Green
Write-Host "📱 L'APK généré est maintenant en mode standalone (pas de connexion Metro)" -ForegroundColor Green
Write-Host "🎯 L'application ne tentera plus de se connecter au serveur de développement" -ForegroundColor Green

# Afficher les informations sur le build
Write-Host "`n📋 INFORMATIONS DU BUILD:" -ForegroundColor Cyan
Write-Host "- Mode: Production Standalone" -ForegroundColor White
Write-Host "- Bundle: Intégré dans l'APK" -ForegroundColor White
Write-Host "- Metro: Désactivé" -ForegroundColor White
Write-Host "- API: https://yukpomnang.onrender.com" -ForegroundColor White

Write-Host "`n🎉 BUILD TERMINÉ! L'application ne devrait plus crasher au démarrage." -ForegroundColor Green

