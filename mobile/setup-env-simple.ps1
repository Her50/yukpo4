# Script simple de configuration de l'environnement mobile
Write-Host "Configuration de l'environnement mobile..." -ForegroundColor Green

# Contenu du fichier .env
$envContent = @"
EXPO_PUBLIC_API_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_DEV_MODE=false
EXPO_PUBLIC_DEBUG_TRANSLATION=false
"@

# Créer le fichier .env
$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "Fichier .env cree avec succes" -ForegroundColor Green
Write-Host "URL du backend: https://yukpomnang.onrender.com" -ForegroundColor Yellow
