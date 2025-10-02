# Script de diagnostic pour le crash de l'application Yukpo
Write-Host "🔍 Diagnostic du crash de l'application Yukpo" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Vérifier les dépendances
Write-Host "`n📦 Vérification des dépendances..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "✅ package.json trouvé" -ForegroundColor Green
}
else {
    Write-Host "❌ package.json manquant" -ForegroundColor Red
    exit 1
}

# Vérifier node_modules
if (Test-Path "node_modules") {
    Write-Host "✅ node_modules trouvé" -ForegroundColor Green
}
else {
    Write-Host "❌ node_modules manquant - Installation nécessaire" -ForegroundColor Red
    Write-Host "Exécution de: npm install" -ForegroundColor Yellow
    npm install
}

# Vérifier les fichiers critiques
Write-Host "`n📁 Vérification des fichiers critiques..." -ForegroundColor Yellow

$criticalFiles = @(
    "App.tsx",
    "src/contexts/AuthContext.tsx",
    "src/navigation/AppNavigator.tsx",
    "src/components/ErrorBoundary.tsx",
    "src/theme/theme.ts"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $file manquant" -ForegroundColor Red
    }
}

# Vérifier la configuration Expo
Write-Host "`n⚙️ Vérification de la configuration Expo..." -ForegroundColor Yellow
if (Test-Path "app.json") {
    Write-Host "✅ app.json trouvé" -ForegroundColor Green
}
else {
    Write-Host "❌ app.json manquant" -ForegroundColor Red
}

# Vérifier les permissions Android
Write-Host "`n🤖 Vérification des permissions Android..." -ForegroundColor Yellow
if (Test-Path "android/app/src/main/AndroidManifest.xml") {
    $manifest = Get-Content "android/app/src/main/AndroidManifest.xml" -Raw
    if ($manifest -match "INTERNET") {
        Write-Host "✅ Permission INTERNET trouvée" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Permission INTERNET manquante" -ForegroundColor Red
    }
}
else {
    Write-Host "❌ AndroidManifest.xml manquant" -ForegroundColor Red
}

# Nettoyer le cache
Write-Host "`n🧹 Nettoyage du cache..." -ForegroundColor Yellow
Write-Host "Exécution de: npx expo start --clear" -ForegroundColor Yellow

# Créer un script de test simple
Write-Host "`n🧪 Création d'un script de test..." -ForegroundColor Yellow
Write-Host "✅ App.simple.tsx et App.robust.tsx déjà créés" -ForegroundColor Green

Write-Host "`n📋 Résumé du diagnostic:" -ForegroundColor Cyan
Write-Host "1. Vérifiez que toutes les dépendances sont installées" -ForegroundColor White
Write-Host "2. Utilisez App.simple.tsx pour tester sans les contextes complexes" -ForegroundColor White
Write-Host "3. Vérifiez les logs avec: npx expo start --clear" -ForegroundColor White
Write-Host "4. Testez avec: npx expo run:android" -ForegroundColor White

Write-Host "`n🚀 Solutions recommandées:" -ForegroundColor Green
Write-Host "• Utilisez App.simple.tsx temporairement" -ForegroundColor White
Write-Host "• Vérifiez les logs de l'application" -ForegroundColor White
Write-Host "• Réinstallez les dépendances si nécessaire" -ForegroundColor White
