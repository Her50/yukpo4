# Script de test pour la configuration Android
Write-Host "🔍 Test de la configuration Android pour Yukpomnang Mobile" -ForegroundColor Cyan

# Vérifier les fichiers de configuration
Write-Host "`n📁 Vérification des fichiers de configuration..." -ForegroundColor Yellow

$configFiles = @(
    "app.json",
    "android/app/src/main/AndroidManifest.xml",
    "android/app/src/main/res/xml/network_security_config.xml"
)

foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file existe" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $file manquant" -ForegroundColor Red
    }
}

# Vérifier les permissions dans app.json
Write-Host "`n🔐 Vérification des permissions Android..." -ForegroundColor Yellow

$appJson = Get-Content "app.json" | ConvertFrom-Json
$permissions = $appJson.expo.android.permissions

$requiredPermissions = @(
    "INTERNET",
    "ACCESS_NETWORK_STATE", 
    "ACCESS_WIFI_STATE",
    "ACCESS_FINE_LOCATION",
    "ACCESS_COARSE_LOCATION",
    "CAMERA",
    "READ_EXTERNAL_STORAGE",
    "WRITE_EXTERNAL_STORAGE",
    "RECORD_AUDIO"
)

foreach ($permission in $requiredPermissions) {
    if ($permissions -contains $permission) {
        Write-Host "✅ Permission $permission configurée" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Permission $permission manquante" -ForegroundColor Red
    }
}

# Vérifier la configuration de sécurité réseau
Write-Host "`n🌐 Vérification de la sécurité réseau..." -ForegroundColor Yellow

if ($appJson.expo.android.usesCleartextTraffic -eq $false) {
    Write-Host "✅ usesCleartextTraffic désactivé (sécurisé)" -ForegroundColor Green
}
else {
    Write-Host "⚠️ usesCleartextTraffic activé (non sécurisé)" -ForegroundColor Yellow
}

if ($appJson.expo.android.networkSecurityConfig) {
    Write-Host "✅ Configuration de sécurité réseau définie" -ForegroundColor Green
}
else {
    Write-Host "❌ Configuration de sécurité réseau manquante" -ForegroundColor Red
}

# Vérifier les composants critiques
Write-Host "`n🧩 Vérification des composants critiques..." -ForegroundColor Yellow

$criticalComponents = @(
    "src/components/ErrorBoundary.tsx",
    "src/services/errorHandler.ts",
    "src/config/appConfig.ts"
)

foreach ($component in $criticalComponents) {
    if (Test-Path $component) {
        Write-Host "✅ $component existe" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $component manquant" -ForegroundColor Red
    }
}

# Vérifier la configuration de l'API
Write-Host "`n🔌 Vérification de la configuration API..." -ForegroundColor Yellow

if (Test-Path ".env") {
    Write-Host "✅ Fichier .env existe" -ForegroundColor Green
    
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "EXPO_PUBLIC_API_BASE_URL") {
        Write-Host "✅ EXPO_PUBLIC_API_BASE_URL configuré" -ForegroundColor Green
    }
    else {
        Write-Host "❌ EXPO_PUBLIC_API_BASE_URL manquant" -ForegroundColor Red
    }
}
else {
    Write-Host "❌ Fichier .env manquant" -ForegroundColor Red
}

# Recommandations
Write-Host "`n💡 Recommandations pour éviter les plantages:" -ForegroundColor Cyan
Write-Host "1. Vérifiez que votre API backend est accessible depuis l'appareil mobile"
Write-Host "2. Testez avec un appareil physique plutôt qu'un émulateur"
Write-Host "3. Vérifiez les logs avec: npx expo start --tunnel"
Write-Host "4. Assurez-vous que le backend accepte les requêtes CORS"
Write-Host "5. Testez la connexion réseau sur l'appareil"

Write-Host "`n🚀 Configuration Android vérifiée!" -ForegroundColor Green

