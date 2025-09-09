# Script de configuration de l'environnement pour Yukpo
Write-Host "Configuration de l'environnement Yukpo" -ForegroundColor Green

# Vérifier si le fichier .env existe
$envFile = ".env"
if (Test-Path $envFile) {
    Write-Host "Le fichier .env existe deja" -ForegroundColor Yellow
    $overwrite = Read-Host "Voulez-vous le remplacer ? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Configuration annulee" -ForegroundColor Red
        exit
    }
}

# Créer le contenu du fichier .env
$envContent = @"
# Configuration Google Maps API
VITE_APP_GOOGLE_MAPS_API_KEY=VOTRE_CLE_API_GOOGLE_MAPS

# Configuration Backend
VITE_APP_API_URL=http://localhost:3001

# Configuration Environnement
VITE_APP_ENV=development
"@

# Écrire le fichier .env
$envContent | Out-File -FilePath $envFile -Encoding UTF8

Write-Host "Fichier .env cree avec succes" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes :" -ForegroundColor Cyan
Write-Host "1. Obtenir une cle API Google Maps sur https://console.cloud.google.com/"
Write-Host "2. Remplacer VOTRE_CLE_API_GOOGLE_MAPS par votre vraie cle API"
Write-Host "3. Redemarrer le serveur de developpement avec npm run dev"
Write-Host ""
Write-Host "Documentation complete : https://developers.google.com/maps/documentation/javascript/get-api-key" 