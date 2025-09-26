# Script de diagnostic pour l'application mobile Yukpomnang
# Ce script vérifie les problèmes courants qui peuvent causer des crashes

Write-Host "=== Diagnostic de l'application mobile Yukpomnang ===" -ForegroundColor Cyan

# Vérifier si Node.js est installé
Write-Host "1. Vérification de Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✓ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Node.js n'est pas installé ou pas dans le PATH" -ForegroundColor Red
}

# Vérifier si npm est installé
Write-Host "2. Vérification de npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "   ✓ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ npm n'est pas installé ou pas dans le PATH" -ForegroundColor Red
}

# Vérifier si Expo CLI est installé
Write-Host "3. Vérification d'Expo CLI..." -ForegroundColor Yellow
try {
    $expoVersion = npx expo --version
    Write-Host "   ✓ Expo CLI version: $expoVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Expo CLI n'est pas installé" -ForegroundColor Red
    Write-Host "   Solution: npm install -g @expo/cli" -ForegroundColor Blue
}

# Vérifier les dépendances
Write-Host "4. Vérification des dépendances..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "   ✓ package.json trouvé" -ForegroundColor Green
    
    if (Test-Path "node_modules") {
        Write-Host "   ✓ node_modules trouvé" -ForegroundColor Green
    } else {
        Write-Host "   ✗ node_modules manquant" -ForegroundColor Red
        Write-Host "   Solution: npm install" -ForegroundColor Blue
    }
} else {
    Write-Host "   ✗ package.json manquant" -ForegroundColor Red
}

# Vérifier le fichier .env
Write-Host "5. Vérification de la configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "   ✓ Fichier .env trouvé" -ForegroundColor Green
} else {
    Write-Host "   ✗ Fichier .env manquant" -ForegroundColor Red
    Write-Host "   Solution: Exécutez setup-environment.ps1" -ForegroundColor Blue
}

# Vérifier les fichiers de configuration critiques
Write-Host "6. Vérification des fichiers de configuration..." -ForegroundColor Yellow
$criticalFiles = @(
    "src/config/environment.ts",
    "src/services/api.ts",
    "src/contexts/AuthContext.tsx",
    "App.tsx"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "   ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file manquant" -ForegroundColor Red
    }
}

# Vérifier les logs d'erreur
Write-Host "7. Vérification des logs..." -ForegroundColor Yellow
if (Test-Path "logs") {
    Write-Host "   ✓ Dossier logs trouvé" -ForegroundColor Green
} else {
    Write-Host "   ! Dossier logs non trouvé (normal)" -ForegroundColor Yellow
}

Write-Host "`n=== Recommandations ===" -ForegroundColor Cyan
Write-Host "1. Assurez-vous que toutes les dépendances sont installées: npm install" -ForegroundColor White
Write-Host "2. Configurez l'environnement: .\setup-environment.ps1" -ForegroundColor White
Write-Host "3. Redémarrez l'application: npx expo start --clear" -ForegroundColor White
Write-Host "4. Vérifiez les logs dans la console Expo" -ForegroundColor White
Write-Host "5. Testez sur un émulateur ou un appareil physique" -ForegroundColor White

Write-Host "`n=== Diagnostic terminé ===" -ForegroundColor Cyan
