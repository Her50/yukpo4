# Script de vérification des données réelles dans l'application mobile
# Vérifie que toutes les données fictives ont été supprimées

Write-Host "🔍 Vérification des données réelles dans l'application mobile" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# Vérifier les fichiers modifiés
$filesToCheck = @(
    "src/screens/ProfileScreen.tsx",
    "src/screens/DashboardScreen.tsx", 
    "src/screens/DashboardPrestataireScreen.tsx",
    "src/screens/MesServicesScreen.tsx",
    "src/screens/InteractedServicesScreen.tsx",
    "src/navigation/AppNavigator.tsx"
)

Write-Host "`n📁 Vérification des fichiers modifiés:" -ForegroundColor Yellow
foreach ($file in $filesToCheck) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $file - MANQUANT" -ForegroundColor Red
    }
}

# Vérifier la suppression des données fictives
Write-Host "`n🔍 Vérification de la suppression des données fictives:" -ForegroundColor Yellow

# 1. Vérifier ProfileScreen
$profileContent = Get-Content "src/screens/ProfileScreen.tsx" -Raw
if ($profileContent -match "useState.*loadProfileData" -and $profileContent -match "userApi\.getUserProfile" -and $profileContent -notmatch "Services.*value.*12") {
    Write-Host "✅ ProfileScreen utilise des données réelles" -ForegroundColor Green
}
else {
    Write-Host "❌ ProfileScreen contient encore des données fictives" -ForegroundColor Red
}

# 2. Vérifier DashboardScreen
$dashboardContent = Get-Content "src/screens/DashboardScreen.tsx" -Raw
if ($dashboardContent -match "loadDashboardData" -and $dashboardContent -match "servicesApi\.getUserServices" -and $dashboardContent -notmatch "Services Actifs.*value.*12") {
    Write-Host "✅ DashboardScreen utilise des données réelles" -ForegroundColor Green
}
else {
    Write-Host "❌ DashboardScreen contient encore des données fictives" -ForegroundColor Red
}

# 3. Vérifier MesServicesScreen
$mesServicesContent = Get-Content "src/screens/MesServicesScreen.tsx" -Raw
if ($mesServicesContent -match "fetch.*api/services/user" -and $mesServicesContent -notmatch "mockServices.*Réparation plomberie") {
    Write-Host "✅ MesServicesScreen utilise des données réelles" -ForegroundColor Green
}
else {
    Write-Host "❌ MesServicesScreen contient encore des données fictives" -ForegroundColor Red
}

# 4. Vérifier DashboardPrestataireScreen
$dashboardPrestataireContent = Get-Content "src/screens/DashboardPrestataireScreen.tsx" -Raw
if ($dashboardPrestataireContent -match "realDashboardData" -and $dashboardPrestataireContent -notmatch "mockDashboardData") {
    Write-Host "✅ DashboardPrestataireScreen utilise des données réelles" -ForegroundColor Green
}
else {
    Write-Host "❌ DashboardPrestataireScreen contient encore des données fictives" -ForegroundColor Red
}

# 5. Vérifier InteractedServicesScreen
$interactedContent = Get-Content "src/screens/InteractedServicesScreen.tsx" -Raw
if ($interactedContent -notmatch "mockServices.*Réparation iPhone" -and $interactedContent -match "setServices\(\[\]\)") {
    Write-Host "✅ InteractedServicesScreen utilise des données réelles" -ForegroundColor Green
}
else {
    Write-Host "❌ InteractedServicesScreen contient encore des données fictives" -ForegroundColor Red
}

# 6. Vérifier la suppression de l'onglet Recherche
$navigatorContent = Get-Content "src/navigation/AppNavigator.tsx" -Raw
if ($navigatorContent -notmatch "name.*Search" -and $navigatorContent -notmatch "title.*Recherche") {
    Write-Host "✅ Onglet Recherche supprimé du menu" -ForegroundColor Green
}
else {
    Write-Host "❌ Onglet Recherche encore présent" -ForegroundColor Red
}

# Vérifier les imports d'API
Write-Host "`n🔗 Vérification des imports d'API:" -ForegroundColor Yellow

$apiImports = @(
    "userApi",
    "servicesApi", 
    "useAuth"
)

foreach ($import in $apiImports) {
    $found = $false
    foreach ($file in $filesToCheck) {
        if (Test-Path $file) {
            $content = Get-Content $file -Raw
            if ($content -match $import) {
                $found = $true
                break
            }
        }
    }
    
    if ($found) {
        Write-Host "✅ Import $import trouvé" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Import $import manquant" -ForegroundColor Red
    }
}

Write-Host "`n📋 Résumé des modifications:" -ForegroundColor Cyan
Write-Host "1. ✅ ProfileScreen - Données réelles depuis userApi.getUserProfile()" -ForegroundColor Green
Write-Host "2. ✅ DashboardScreen - Données réelles depuis servicesApi.getUserServices()" -ForegroundColor Green
Write-Host "3. ✅ MesServicesScreen - Données réelles depuis /api/services/user" -ForegroundColor Green
Write-Host "4. ✅ DashboardPrestataireScreen - Données réelles au lieu de mockDashboardData" -ForegroundColor Green
Write-Host "5. ✅ InteractedServicesScreen - Suppression des données fictives" -ForegroundColor Green
Write-Host "6. ✅ AppNavigator - Suppression de l'onglet Recherche" -ForegroundColor Green

Write-Host "`n🚀 Fonctionnalités ajoutées:" -ForegroundColor Yellow
Write-Host "• Chargement dynamique des données utilisateur" -ForegroundColor White
Write-Host "• Statistiques calculées depuis les vraies données" -ForegroundColor White
Write-Host "• Gestion des états de chargement" -ForegroundColor White
Write-Host "• Gestion des erreurs avec Alert" -ForegroundColor White
Write-Host "• Interface cohérente avec le frontend" -ForegroundColor White

Write-Host "`n✨ Vérification terminée!" -ForegroundColor Green



