@echo off
echo 🔧 Réparation du fichier .env corrompu...

cd /d "%~dp0microservice_embedding"

REM Supprimer l'ancien fichier .env s'il existe
if exist .env (
    echo [BACKUP] Sauvegarde de l'ancien fichier .env...
    copy .env .env.backup >nul
    del .env
)

REM Créer un nouveau fichier .env propre
echo [REPAIR] Création d'un nouveau fichier .env propre...
python -c "content='''# Configuration du microservice d'embedding Yukpo

# Cle API pour securiser le microservice
YUKPO_API_KEY=yukpo_embedding_key_2024

# Configuration Pinecone (base de donnees vectorielle)
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment_here
PINECONE_INDEX_NAME=yukpo-services

# Configuration Redis (optionnel, pour le rate limiting)
REDIS_URL=redis://localhost:6379/0

# Configuration du modele d'embedding
EMBEDDING_MODEL=all-mpnet-base-v2
EMBEDDING_DIMENSION=768

# Configuration du serveur
HOST=0.0.0.0
PORT=8000

# Configuration de l'environnement
ENVIRONMENT=development
LOG_LEVEL=INFO

# Configuration GPU/CPU
USE_GPU=false
CUDA_VISIBLE_DEVICES=

# Configuration des timeouts
REQUEST_TIMEOUT=30
EMBEDDING_TIMEOUT=60'''; open('.env', 'w', encoding='utf-8').write(content); print('✅ Fichier .env créé avec succès')"

echo.
echo ✅ Réparation terminée !
echo 📝 N'oubliez pas de configurer vos vraies clés API dans le fichier .env
echo.
pause 