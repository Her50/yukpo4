# Script de configuration pour Yukpomnang Mobile (PowerShell)
# Ce script configure l'environnement de développement

Write-Host "🚀 Configuration de Yukpomnang Mobile..." -ForegroundColor Green

# Vérifier Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js détecté : $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Node.js n'est pas installé. Veuillez installer Node.js v16 ou plus récent." -ForegroundColor Red
    exit 1
}

# Vérifier npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm détecté : $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ npm n'est pas installé." -ForegroundColor Red
    exit 1
}

# Vérifier Expo CLI
try {
    $expoVersion = expo --version
    Write-Host "✅ Expo CLI détecté : $expoVersion" -ForegroundColor Green
}
catch {
    Write-Host "📦 Installation d'Expo CLI..." -ForegroundColor Yellow
    npm install -g @expo/cli
}

# Vérifier EAS CLI
try {
    $easVersion = eas --version
    Write-Host "✅ EAS CLI détecté : $easVersion" -ForegroundColor Green
}
catch {
    Write-Host "📦 Installation d'EAS CLI..." -ForegroundColor Yellow
    npm install -g @expo/eas-cli
}

# Installer les dépendances
Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
npm install

# Créer le fichier .env s'il n'existe pas
if (-not (Test-Path ".env")) {
    Write-Host "📝 Création du fichier .env..." -ForegroundColor Yellow
    Copy-Item "env.example" ".env"
    Write-Host "⚠️  Veuillez configurer vos clés API dans le fichier .env" -ForegroundColor Yellow
}

# Vérifier la configuration
Write-Host "🔍 Vérification de la configuration..." -ForegroundColor Yellow

# Vérifier app.json
if (-not (Test-Path "app.json")) {
    Write-Host "❌ Fichier app.json manquant" -ForegroundColor Red
    exit 1
}

# Vérifier eas.json
if (-not (Test-Path "eas.json")) {
    Write-Host "❌ Fichier eas.json manquant" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Configuration terminée !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "1. Configurez vos clés API dans le fichier .env" -ForegroundColor White
Write-Host "2. Connectez-vous à Expo : eas login" -ForegroundColor White
Write-Host "3. Configurez EAS : eas build:configure" -ForegroundColor White
Write-Host "4. Lancez l'application : npm start" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation :" -ForegroundColor Cyan
Write-Host "- README.md : Guide d'utilisation" -ForegroundColor White
Write-Host "- DEPLOYMENT.md : Guide de déploiement" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Bon développement !" -ForegroundColor Green

