# Script de test autonome pour diagnostiquer le flux d'authentification
# Ce script simule le comportement de l'application et identifie les problèmes

Write-Host "🧪 Test Autonome - Diagnostic du Flux d'Authentification" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# Test 1: Vérifier les imports et dépendances
Write-Host "`n🔍 Test 1: Vérification des imports..." -ForegroundColor Yellow

$homeScreenPath = "src/screens/HomeScreen.tsx"
$authContextPath = "src/contexts/AuthContext.tsx"
$appNavigatorPath = "src/navigation/AppNavigator.tsx"

if (Test-Path $homeScreenPath) {
    Write-Host "✅ HomeScreen.tsx trouvé" -ForegroundColor Green
} else {
    Write-Host "❌ HomeScreen.tsx manquant" -ForegroundColor Red
}

if (Test-Path $authContextPath) {
    Write-Host "✅ AuthContext.tsx trouvé" -ForegroundColor Green
} else {
    Write-Host "❌ AuthContext.tsx manquant" -ForegroundColor Red
}

if (Test-Path $appNavigatorPath) {
    Write-Host "✅ AppNavigator.tsx trouvé" -ForegroundColor Green
} else {
    Write-Host "❌ AppNavigator.tsx manquant" -ForegroundColor Red
}

# Test 2: Vérifier les imports problématiques
Write-Host "`n🔍 Test 2: Analyse des imports problématiques..." -ForegroundColor Yellow

$homeScreenContent = Get-Content $homeScreenPath -Raw
$authContextContent = Get-Content $authContextPath -Raw

# Vérifier useGlobalIAStats
if ($homeScreenContent -match "useGlobalIAStats") {
    Write-Host "❌ PROBLÈME: useGlobalIAStats utilisé dans HomeScreen" -ForegroundColor Red
    Write-Host "   Solution: Remplacer par un état local" -ForegroundColor Yellow
} else {
    Write-Host "✅ useGlobalIAStats corrigé" -ForegroundColor Green
}

# Vérifier les navigations problématiques
if ($homeScreenContent -match "navigate.*MesServices") {
    Write-Host "❌ PROBLÈME: Navigation vers 'MesServices' (n'existe pas)" -ForegroundColor Red
    Write-Host "   Solution: Utiliser 'MyServices'" -ForegroundColor Yellow
} else {
    Write-Host "✅ Navigation 'MesServices' corrigée" -ForegroundColor Green
}

if ($homeScreenContent -match "navigate.*MonProfil") {
    Write-Host "❌ PROBLÈME: Navigation vers 'MonProfil' (n'existe pas)" -ForegroundColor Red
    Write-Host "   Solution: Utiliser 'Profile'" -ForegroundColor Yellow
} else {
    Write-Host "✅ Navigation 'MonProfil' corrigée" -ForegroundColor Green
}

# Test 3: Vérifier la logique d'authentification
Write-Host "`n🔍 Test 3: Analyse de la logique d'authentification..." -ForegroundColor Yellow

if ($authContextContent -match "setLoading\(false\)") {
    Write-Host "✅ setLoading(false) présent dans AuthContext" -ForegroundColor Green
} else {
    Write-Host "❌ PROBLÈME: setLoading(false) manquant" -ForegroundColor Red
}

if ($authContextContent -match "setUser\(userData\)") {
    Write-Host "✅ setUser(userData) présent dans AuthContext" -ForegroundColor Green
} else {
    Write-Host "❌ PROBLÈME: setUser(userData) manquant" -ForegroundColor Red
}

# Test 4: Vérifier App.tsx
Write-Host "`n🔍 Test 4: Vérification d'App.tsx..." -ForegroundColor Yellow

$appContent = Get-Content "App.tsx" -Raw

if ($appContent -match "GlobalIAStatsProvider") {
    Write-Host "✅ GlobalIAStatsProvider présent dans App.tsx" -ForegroundColor Green
} else {
    Write-Host "❌ PROBLÈME: GlobalIAStatsProvider manquant dans App.tsx" -ForegroundColor Red
}

if ($appContent -match "AuthProvider") {
    Write-Host "✅ AuthProvider présent dans App.tsx" -ForegroundColor Green
} else {
    Write-Host "❌ PROBLÈME: AuthProvider manquant dans App.tsx" -ForegroundColor Red
}

# Test 5: Simulation du flux d'authentification
Write-Host "`n🔍 Test 5: Simulation du flux d'authentification..." -ForegroundColor Yellow

Write-Host "Simulation du comportement:" -ForegroundColor White
Write-Host "1. Utilisateur se connecte" -ForegroundColor White
Write-Host "2. AuthContext.login() appelé" -ForegroundColor White
Write-Host "3. setLoading(true) -> LoadingScreen affiché" -ForegroundColor White
Write-Host "4. API appelée, token reçu" -ForegroundColor White
Write-Host "5. setUser(userData) -> user défini" -ForegroundColor White
Write-Host "6. setLoading(false) -> MainStack affiché" -ForegroundColor White
Write-Host "7. MainTabs -> HomeScreen affiché" -ForegroundColor White

# Résumé des problèmes identifiés
Write-Host "`n📋 RÉSUMÉ DES PROBLÈMES IDENTIFIÉS:" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$problems = @()

if ($homeScreenContent -match "useGlobalIAStats") {
    $problems += "❌ useGlobalIAStats non fourni dans le contexte"
}

if ($homeScreenContent -match "navigate.*MesServices") {
    $problems += "❌ Navigation vers écran inexistant 'MesServices'"
}

if ($homeScreenContent -match "navigate.*MonProfil") {
    $problems += "❌ Navigation vers écran inexistant 'MonProfil'"
}

if ($problems.Count -eq 0) {
    Write-Host "✅ Aucun problème critique identifié" -ForegroundColor Green
    Write-Host "L'écran blanc pourrait être causé par:" -ForegroundColor Yellow
    Write-Host "- Erreur réseau lors de l'appel API" -ForegroundColor White
    Write-Host "- Token invalide ou expiré" -ForegroundColor White
    Write-Host "- Problème de configuration du backend" -ForegroundColor White
} else {
    foreach ($problem in $problems) {
        Write-Host $problem -ForegroundColor Red
    }
}

Write-Host "`nTest autonome termine." -ForegroundColor Green
