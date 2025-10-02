# Script pour lancer l'application avec logs détaillés
Write-Host "🚀 Lancement de l'application mobile Yukpomnang" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

# Vérifier qu'on est dans le bon dossier
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erreur : Pas de package.json trouvé" -ForegroundColor Red
    Write-Host "Assurez-vous d'être dans le dossier mobile/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Dossier mobile détecté" -ForegroundColor Green
Write-Host ""

# Vérifier le fichier .env
if (Test-Path ".env") {
    Write-Host "✅ Fichier .env trouvé" -ForegroundColor Green
    Write-Host "Contenu du .env :" -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "EXPO_PUBLIC_API_URL") {
            Write-Host "  $_" -ForegroundColor Cyan
        }
    }
}
else {
    Write-Host "⚠️  Fichier .env manquant !" -ForegroundColor Yellow
    Write-Host "Création du fichier .env..." -ForegroundColor Yellow
    
    $envContent = @"
EXPO_PUBLIC_API_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
EXPO_PUBLIC_DEBUG_MODE=true
"@
    
    Set-Content -Path ".env" -Value $envContent -Encoding UTF8
    Write-Host "✅ Fichier .env créé" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎯 Lancement d'Expo avec cache nettoyé..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Scannez le QR code avec l'application Expo Go" -ForegroundColor Yellow
Write-Host "ou appuyez sur 'w' pour ouvrir dans le navigateur" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔍 OBSERVEZ LES LOGS CI-DESSOUS :" -ForegroundColor Green
Write-Host "   - Cherchez '[AuthContext]' pour voir l'authentification" -ForegroundColor Yellow
Write-Host "   - Cherchez '[AppNavigator]' pour voir la navigation" -ForegroundColor Yellow
Write-Host "   - Cherchez 'ERROR' pour voir les erreurs" -ForegroundColor Yellow
Write-Host ""

# Lancer Expo
npx expo start --clear


