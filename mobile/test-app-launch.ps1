# Script de test pour verifier le lancement de l'application
Write-Host "Test de lancement de l'application Yukpomnang" -ForegroundColor Green

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur: package.json non trouvé. Assurez-vous d'être dans le répertoire mobile/" -ForegroundColor Red
    exit 1
}

Write-Host "Repertoire correct detecte" -ForegroundColor Green

# Verifier les dependances
Write-Host "Verification des dependances..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "❌ node_modules non trouvé. Exécutez 'npm install' d'abord" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dépendances installées" -ForegroundColor Green

# Vérifier les fichiers critiques
Write-Host "📁 Vérification des fichiers critiques..." -ForegroundColor Yellow
$criticalFiles = @(
    "App.tsx",
    "app.json",
    "src/config/appConfig.ts",
    "src/config/splashConfig.ts",
    "src/services/api.ts",
    "src/services/errorHandler.ts"
)

foreach ($file in $criticalFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Fichier manquant: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Tous les fichiers critiques sont présents" -ForegroundColor Green

# Vérifier les assets
Write-Host "🖼️ Vérification des assets..." -ForegroundColor Yellow
$assets = @(
    "assets/icon.png",
    "assets/splash.png",
    "assets/adaptive-icon.png"
)

foreach ($asset in $assets) {
    if (-not (Test-Path $asset)) {
        Write-Host "⚠️ Asset manquant: $asset" -ForegroundColor Yellow
    }
}

Write-Host "✅ Vérification des assets terminée" -ForegroundColor Green

# Démarrer l'application
Write-Host "🚀 Démarrage de l'application..." -ForegroundColor Green
Write-Host "📱 Ouvrez l'application Expo Go sur votre téléphone et scannez le QR code" -ForegroundColor Cyan
Write-Host "🔍 Surveillez les logs pour détecter d'éventuelles erreurs" -ForegroundColor Cyan

try {
    npm start
}
catch {
    Write-Host "❌ Erreur lors du démarrage: $_" -ForegroundColor Red
    exit 1
}
