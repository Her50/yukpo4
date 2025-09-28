# Script pour corriger la configuration frontend
Write-Host "🔧 Configuration de l'environnement frontend..." -ForegroundColor Yellow

# Créer le fichier .env dans le frontend
$envContent = @"
# Configuration du frontend Yukpo pour la production

# Configuration de l'API backend
# IMPORTANT : Cette URL doit correspondre au backend déployé sur Render
VITE_APP_API_URL=https://yukpomnang.onrender.com

# Configuration Google Maps API
# IMPORTANT : Cette variable doit être renseignée pour que la carte fonctionne dans l'application.
VITE_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Configuration de l'environnement
VITE_APP_ENV=production
VITE_APP_DEBUG=false

# Configuration des clés API
VITE_APP_YUKPO_API_KEY=yukpo_frontend_key_2024

# Configuration des services
VITE_APP_AI_SERVICE_URL=https://api.openai.com/v1
VITE_APP_PINECONE_API_KEY=your_pinecone_api_key_here

# Configuration de l'interface
VITE_APP_TITLE=Yukpo - Services Intelligents
VITE_APP_DESCRIPTION=Plateforme de services intelligents avec IA
"@

# Écrire le fichier .env
$envContent | Out-File -FilePath "frontend/.env" -Encoding UTF8

Write-Host "✅ Fichier .env créé dans frontend/.env" -ForegroundColor Green
Write-Host "🔗 URL backend configurée: https://yukpomnang.onrender.com" -ForegroundColor Cyan

# Afficher le contenu pour vérification
Write-Host "`n📄 Contenu du fichier .env:" -ForegroundColor Yellow
Get-Content "frontend\.env"
