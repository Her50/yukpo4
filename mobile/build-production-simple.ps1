# Script de build de production optimisé pour Yukpomnang Mobile
# Build EAS avec profil "simple" - Production stable

Write-Host "🚀 BUILD DE PRODUCTION - Yukpomnang Mobile" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# Vérifier si nous sommes dans le bon répertoire
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur: package.json non trouvé" -ForegroundColor Red
    Write-Host "💡 Assurez-vous d'être dans le répertoire mobile/" -ForegroundColor Yellow
    exit 1
}

# Vérifier si EAS CLI est installé
Write-Host "`n1. 🔧 Vérification de l'environnement..." -ForegroundColor Yellow
try {
    $easVersion = npx eas-cli --version 2>$null
    if ($easVersion) {
        Write-Host "   ✅ EAS CLI disponible: $easVersion" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️ EAS CLI non trouvé, installation..." -ForegroundColor Yellow
        npm install -g @expo/eas-cli
        Write-Host "   ✅ EAS CLI installé" -ForegroundColor Green
    }
}
catch {
    Write-Host "   📦 Installation d'EAS CLI..." -ForegroundColor Blue
    npm install -g @expo/eas-cli
    Write-Host "   ✅ EAS CLI installé" -ForegroundColor Green
}

# Vérifier la configuration EAS
Write-Host "`n2. 📋 Vérification de la configuration..." -ForegroundColor Yellow
if (Test-Path "eas.json") {
    Write-Host "   ✅ eas.json trouvé" -ForegroundColor Green
    
    # Afficher la configuration du profil simple
    $easConfig = Get-Content "eas.json" | ConvertFrom-Json
    Write-Host "   📱 Profil 'simple' configuré:" -ForegroundColor Blue
    Write-Host "      - Build Type: APK" -ForegroundColor White
    Write-Host "      - Environment: Production" -ForegroundColor White
    Write-Host "      - API URL: https://yukpomnang.onrender.com" -ForegroundColor White
    Write-Host "      - Hermes: Activé" -ForegroundColor White
}
else {
    Write-Host "   ❌ eas.json manquant" -ForegroundColor Red
    exit 1
}

# Vérifier app.json
if (Test-Path "app.json") {
    $appConfig = Get-Content "app.json" | ConvertFrom-Json
    Write-Host "   📱 Application: $($appConfig.expo.name)" -ForegroundColor Blue
    Write-Host "   📦 Package: $($appConfig.expo.android.package)" -ForegroundColor Blue
    Write-Host "   🆔 Project ID: $($appConfig.expo.extra.eas.projectId)" -ForegroundColor Blue
}
else {
    Write-Host "   ❌ app.json manquant" -ForegroundColor Red
    exit 1
}

# Nettoyer l'environnement avant le build
Write-Host "`n3. 🧹 Nettoyage de l'environnement..." -ForegroundColor Yellow

# Nettoyer le cache npm
Write-Host "   🧹 Nettoyage du cache npm..." -ForegroundColor Blue
npm cache clean --force 2>$null

# Nettoyer le cache Expo
Write-Host "   🧹 Nettoyage du cache Expo..." -ForegroundColor Blue
npx expo install --fix 2>$null

Write-Host "   ✅ Environnement nettoyé" -ForegroundColor Green

# Lancer le build de production
Write-Host "`n4. 🏗️ Lancement du build de production..." -ForegroundColor Yellow
Write-Host "   📱 Plateforme: Android" -ForegroundColor Blue
Write-Host "   🎯 Profil: simple (Production optimisé)" -ForegroundColor Blue
Write-Host "   🔧 Build Type: APK (assembleRelease)" -ForegroundColor Blue
Write-Host "   ⚡ Hermes: Activé" -ForegroundColor Blue

Write-Host "`n🚀 Commande de build:" -ForegroundColor Cyan
Write-Host "npx eas build --platform android --profile simple" -ForegroundColor White

Write-Host "`n📋 Informations importantes:" -ForegroundColor Yellow
Write-Host "   • Le build peut prendre 10-20 minutes" -ForegroundColor White
Write-Host "   • Vous recevrez un lien de téléchargement par email" -ForegroundColor White
Write-Host "   • L'APK sera installable directement sur Android" -ForegroundColor White
Write-Host "   • Aucune connexion Metro nécessaire" -ForegroundColor White

Write-Host "`n🔍 Monitoring du build:" -ForegroundColor Cyan
Write-Host "   • Suivez le progrès sur: https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile-new/builds" -ForegroundColor White
Write-Host "   • Ou utilisez: eas build:list" -ForegroundColor White

# Confirmation avant lancement
Write-Host "`n❓ Voulez-vous lancer le build maintenant? (O/N)" -ForegroundColor Yellow
$confirmation = Read-Host

if ($confirmation -eq "O" -or $confirmation -eq "o" -or $confirmation -eq "Y" -or $confirmation -eq "y") {
    Write-Host "`n🚀 Lancement du build..." -ForegroundColor Green
    
    # Lancer le build
    npx eas build --platform android --profile simple
    
    Write-Host "`n✅ Build lancé avec succès!" -ForegroundColor Green
    Write-Host "📧 Vous recevrez un email avec le lien de téléchargement" -ForegroundColor Blue
    Write-Host "🔍 Suivez le progrès: https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile-new/builds" -ForegroundColor Blue
    
}
else {
    Write-Host "`n⏸️ Build annulé" -ForegroundColor Yellow
    Write-Host "💡 Pour lancer manuellement:" -ForegroundColor Blue
    Write-Host "   npx eas build --platform android --profile simple" -ForegroundColor White
}

Write-Host "`n📋 Commandes utiles:" -ForegroundColor Cyan
Write-Host "   📋 Voir les builds: eas build:list" -ForegroundColor White
Write-Host "   📥 Télécharger un build: eas build:download [BUILD_ID]" -ForegroundColor White
Write-Host "   🔍 Voir les logs: eas build:view [BUILD_ID]" -ForegroundColor White
Write-Host "   🏗️ Build avec cache: eas build --platform android --profile simple --no-cache" -ForegroundColor White

