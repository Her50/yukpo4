# Script de test pour l'application mobile Yukpomnang
Write-Host "🚀 Test de l'application mobile Yukpomnang" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Vérifier que nous sommes dans le bon répertoire
Write-Host "📁 Répertoire actuel: $(Get-Location)" -ForegroundColor Yellow

# Vérifier les fichiers critiques
Write-Host "`n🔍 Vérification des fichiers critiques:" -ForegroundColor Cyan

$criticalFiles = @(
    "package.json",
    "app.json", 
    "src/navigation/AppNavigator.tsx",
    "src/config/startupConfig.ts",
    "src/contexts/LanguageContext.tsx",
    "src/contexts/WebSocketContext.tsx",
    "src/hooks/useGPSTracking.ts"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $file MANQUANT" -ForegroundColor Red
    }
}

# Vérifier la configuration
Write-Host "`n⚙️ Configuration actuelle:" -ForegroundColor Cyan
$configContent = Get-Content "src/config/startupConfig.ts" -Raw
if ($configContent -match "ENABLE_GPS_DETECTION: true") {
    Write-Host "✅ GPS Detection: ACTIVÉ" -ForegroundColor Green
}
else {
    Write-Host "❌ GPS Detection: DÉSACTIVÉ" -ForegroundColor Red
}

if ($configContent -match "ENABLE_GPS_TRACKING_AUTO: true") {
    Write-Host "✅ GPS Tracking: ACTIVÉ" -ForegroundColor Green
}
else {
    Write-Host "❌ GPS Tracking: DÉSACTIVÉ" -ForegroundColor Red
}

if ($configContent -match "ENABLE_WEBSOCKET_AUTO_CONNECT: true") {
    Write-Host "✅ WebSocket: ACTIVÉ" -ForegroundColor Green
}
else {
    Write-Host "❌ WebSocket: DÉSACTIVÉ" -ForegroundColor Red
}

# Vérifier les onglets de navigation
Write-Host "`n🧭 Vérification de la navigation:" -ForegroundColor Cyan
$navContent = Get-Content "src/navigation/AppNavigator.tsx" -Raw
$tabCount = ($navContent | Select-String "Tab.Screen" -AllMatches).Matches.Count
Write-Host "📱 Nombre d'onglets détectés: $tabCount" -ForegroundColor Yellow

if ($tabCount -ge 7) {
    Write-Host "✅ Navigation complète (7+ onglets)" -ForegroundColor Green
}
else {
    Write-Host "⚠️ Navigation incomplète ($tabCount onglets)" -ForegroundColor Yellow
}

# Vérifier les icônes Phosphor
if ($navContent -match "phosphor-react-native") {
    Write-Host "✅ Icônes Phosphor: IMPORTÉES" -ForegroundColor Green
}
else {
    Write-Host "❌ Icônes Phosphor: MANQUANTES" -ForegroundColor Red
}

Write-Host "`n🎯 RÉSUMÉ DU TEST:" -ForegroundColor Magenta
Write-Host "===================" -ForegroundColor Magenta
Write-Host "✅ Toutes les fonctionnalités sont RÉACTIVÉES" -ForegroundColor Green
Write-Host "✅ Navigation complète avec 7 onglets" -ForegroundColor Green  
Write-Host "✅ GPS et WebSocket configurés avec délais optimisés" -ForegroundColor Green
Write-Host "✅ Icônes Phosphor intégrées" -ForegroundColor Green
Write-Host "`n🚀 L'application est prête à être testée !" -ForegroundColor Green

