# Script de configuration de l'environnement mobile pour Yukpomnang
# Ce script configure les variables d'environnement nécessaires pour l'application mobile

Write-Host "🔧 Configuration de l'environnement mobile Yukpomnang..." -ForegroundColor Green

# Créer le fichier .env pour l'application mobile
$envContent = @"
# Configuration mobile pour Yukpomnang
# URL du backend Rust (port 3001)
EXPO_PUBLIC_API_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com

# Configuration de l'environnement
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_DEV_MODE=false

# Configuration de débogage
EXPO_PUBLIC_DEBUG_TRANSLATION=false

# Configuration Google Maps (si nécessaire)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
"@

# Écrire le fichier .env
$envContent | Out-File -FilePath "mobile\.env" -Encoding UTF8

Write-Host "✅ Fichier .env créé avec succès dans mobile/.env" -ForegroundColor Green

# Vérifier que le fichier a été créé
if (Test-Path "mobile\.env") {
    Write-Host "✅ Configuration terminée avec succès !" -ForegroundColor Green
    Write-Host "📱 L'application mobile peut maintenant se connecter au backend" -ForegroundColor Cyan
    Write-Host "🌐 URL du backend: https://yukpomnang.onrender.com" -ForegroundColor Yellow
} else {
    Write-Host "❌ Erreur lors de la création du fichier .env" -ForegroundColor Red
}

Write-Host "`n🚀 Prochaines étapes:" -ForegroundColor Magenta
Write-Host "1. Redémarrer l'application mobile" -ForegroundColor White
Write-Host "2. Tester la connexion et l'inscription" -ForegroundColor White
Write-Host "3. Vérifier que les boutons sont bien positionnés" -ForegroundColor White
