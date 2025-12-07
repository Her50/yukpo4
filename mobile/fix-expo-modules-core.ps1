# Script de correction pour l'erreur expo-modules-core
# Résout le problème de résolution de module expo-modules-core

Write-Host "🔍 Correction de l'erreur expo-modules-core..." -ForegroundColor Cyan
Write-Host ""

# Vérifier qu'on est dans le bon répertoire
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur: package.json introuvable. Exécutez ce script depuis le dossier mobile/" -ForegroundColor Red
    exit 1
}

# Étape 1: Vérifier que expo-constants est dans package.json
Write-Host "📋 Étape 1: Vérification de expo-constants dans package.json..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json

if (-not ($packageJson.dependencies.'expo-constants')) {
    Write-Host "⚠️  expo-constants n'est pas dans package.json" -ForegroundColor Yellow
    Write-Host "   Ajout en cours..." -ForegroundColor Yellow
    $packageJson.dependencies | Add-Member -MemberType NoteProperty -Name "expo-constants" -Value "~17.0.0" -Force
    $packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"
    Write-Host "✅ expo-constants ajouté" -ForegroundColor Green
}
else {
    Write-Host "✅ expo-constants déjà présent" -ForegroundColor Green
}

# Étape 2: Nettoyer node_modules et package-lock.json
Write-Host ""
Write-Host "📋 Étape 2: Nettoyage des dépendances..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   Suppression de node_modules..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    Write-Host "✅ node_modules supprimé" -ForegroundColor Green
}

if (Test-Path "package-lock.json") {
    Write-Host "   Suppression de package-lock.json..." -ForegroundColor Gray
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
    Write-Host "✅ package-lock.json supprimé" -ForegroundColor Green
}

# Étape 3: Réinstaller les dépendances
Write-Host ""
Write-Host "📋 Étape 3: Réinstallation des dépendances (cela peut prendre quelques minutes)..." -ForegroundColor Yellow
Write-Host "   npm install..." -ForegroundColor Gray
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'installation des dépendances" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dépendances réinstallées" -ForegroundColor Green

# Étape 4: Vérifier avec expo doctor
Write-Host ""
Write-Host "📋 Étape 4: Vérification avec expo doctor..." -ForegroundColor Yellow
npx expo doctor

# Étape 5: Nettoyer le cache Metro
Write-Host ""
Write-Host "📋 Étape 5: Nettoyage du cache Metro..." -ForegroundColor Yellow
Write-Host "   Suppression du cache Metro..." -ForegroundColor Gray

# Supprimer les caches Metro
if (Test-Path ".expo") {
    Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
}

if (Test-Path "$env:TEMP\metro-*") {
    Remove-Item -Recurse -Force "$env:TEMP\metro-*" -ErrorAction SilentlyContinue
}

Write-Host "✅ Cache Metro nettoyé" -ForegroundColor Green

# Résumé
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Correction terminée avec succès!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Démarrez le serveur: npm start -- --clear" -ForegroundColor White
Write-Host "2. Ou utilisez: npx expo start --clear" -ForegroundColor White
Write-Host ""
Write-Host "Si le problème persiste, consultez DIAGNOSTIC_EXPO_MODULES_CORE.md" -ForegroundColor Gray
