# Script pour corriger le fichier .env du mobile
Write-Host "Correction du fichier .env mobile..." -ForegroundColor Green

# Contenu basé sur le frontend qui fonctionne
$envContent = @"
# Configuration mobile basée sur le frontend qui fonctionne
# URLs API (vides pour utiliser les valeurs par défaut du code)
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_EMBEDDING_URL=

# Configuration Google Maps API (même clé que le frontend)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ

# Configuration de l'environnement
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_DEBUG=false

# Configuration des clés API (même que le frontend)
EXPO_PUBLIC_YUKPO_API_KEY=yukpo_frontend_key_2024
EXPO_PUBLIC_AI_SERVICE_URL=https://api.openai.com/v1
EXPO_PUBLIC_PINECONE_API_KEY=pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ

# Configuration de l'interface
EXPO_PUBLIC_APP_TITLE=Yukpo - Services Intelligents
EXPO_PUBLIC_APP_DESCRIPTION=Plateforme de services intelligents avec IA

# Performance & Optimization
EXPO_PUBLIC_MAX_RETRIES=3
EXPO_PUBLIC_TIMEOUT=30000
EXPO_PUBLIC_CACHE_ENABLED=true
EXPO_PUBLIC_LAZY_LOADING=true
EXPO_PUBLIC_COMPRESSION=true

# Production
EXPO_PUBLIC_HOT_RELOAD=false
EXPO_PUBLIC_SOURCE_MAPS=false
EXPO_PUBLIC_DEVTOOLS=false

# Security
EXPO_PUBLIC_CSP_ENABLED=true
"@

# Créer le fichier .env
$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "Fichier .env corrige avec succes!" -ForegroundColor Green
Write-Host "URLs API vides pour utiliser les valeurs par defaut" -ForegroundColor Yellow
