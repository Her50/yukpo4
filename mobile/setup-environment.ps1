# Script PowerShell pour configurer l'environnement de l'application mobile
# Ce script crée le fichier .env avec les bonnes configurations

Write-Host "Configuration de l'environnement pour l'application mobile Yukpomnang..." -ForegroundColor Green

# Contenu du fichier .env
$envContent = @"
# Configuration de l'environnement pour l'application mobile Yukpomnang
# Ces variables sont accessibles via process.env.EXPO_PUBLIC_*

# URL de l'API backend (remplacez par votre URL de production)
EXPO_PUBLIC_API_URL=https://yukpomnang-backend.onrender.com

# Environnement (development, production, staging)
EXPO_PUBLIC_ENVIRONMENT=production

# Clé API Google Translate (optionnelle)
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=

# Configuration de débogage
EXPO_PUBLIC_DEBUG_MODE=false
"@

# Créer le fichier .env
try {
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "Fichier .env créé avec succès!" -ForegroundColor Green
    Write-Host "Veuillez redémarrer l'application Expo pour que les changements prennent effet." -ForegroundColor Yellow
} catch {
    Write-Host "Erreur lors de la création du fichier .env: $_" -ForegroundColor Red
}

Write-Host "Configuration terminée!" -ForegroundColor Green
