# Script de configuration .env pour le frontend Yukpo
# Ce script aide a creer et configurer le fichier .env

Write-Host "Configuration du fichier .env pour le frontend Yukpo" -ForegroundColor Cyan
Write-Host ""

# Verifier si .env existe deja
if (Test-Path ".env") {
    Write-Host "Le fichier .env existe deja." -ForegroundColor Yellow
    $overwrite = Read-Host "Voulez-vous le remplacer ? (o/n)"
    if ($overwrite -ne "o" -and $overwrite -ne "O") {
        Write-Host "Configuration annulee." -ForegroundColor Red
        exit
    }
}

Write-Host "Creation du fichier .env..." -ForegroundColor Green

# Contenu du fichier .env
$envContent = @"
# Configuration du frontend Yukpo

# Configuration de l'API backend
# IMPORTANT : Cette URL doit correspondre au port du backend Rust (3001)
VITE_APP_API_URL=http://127.0.0.1:3001
VITE_APP_EMBEDDING_URL=http://localhost:8000

# Configuration Google Maps API
# IMPORTANT : Cette variable doit etre renseignee pour que la carte fonctionne dans l'application.
# Elle est utilisee dans le code via import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY
# Obtenez votre cle sur : https://console.cloud.google.com/apis/credentials
VITE_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Configuration de l'environnement
VITE_APP_ENV=development
VITE_APP_DEBUG=true

# Configuration des cles API
VITE_APP_YUKPO_API_KEY=yukpo_frontend_key_2024

# Configuration des services
VITE_APP_AI_SERVICE_URL=https://api.openai.com/v1
VITE_APP_PINECONE_API_KEY=your_pinecone_api_key_here

# Configuration de l'interface
VITE_APP_TITLE=Yukpo - Services Intelligents
VITE_APP_DESCRIPTION=Plateforme de services intelligents avec IA
"@

# Ecrire le contenu dans le fichier .env
$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "Fichier .env cree avec succes !" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration requise :" -ForegroundColor Yellow
Write-Host "1. Remplacez 'your_google_maps_api_key_here' par votre vraie cle Google Maps API" -ForegroundColor White
Write-Host "2. Obtenez votre cle sur : https://console.cloud.google.com/apis/credentials" -ForegroundColor White
Write-Host "3. Assurez-vous que les ports 3001 (backend) et 8000 (embedding) sont corrects" -ForegroundColor White
Write-Host ""
Write-Host "Pour demarrer le frontend :" -ForegroundColor Cyan
Write-Host "   npm install" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Documentation : https://developers.google.com/maps/documentation/javascript/get-api-key" -ForegroundColor Blue 