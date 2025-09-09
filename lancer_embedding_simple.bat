@echo off
echo 🧠 Démarrage du microservice d'embedding Yukpo...

REM Aller dans le dossier microservice_embedding
cd /d "%~dp0microservice_embedding"

REM Vérifier si l'environnement virtuel existe
if not exist venv (
    echo [PY] Création de l'environnement virtuel Python...
    C:\Python313\python.exe -m venv venv
)

REM Activer l'environnement virtuel
call venv\Scripts\activate.bat

REM Vérifier que le fichier .env existe
if not exist .env (
    echo [ERREUR] Fichier .env manquant
    echo [INFO] Création du fichier .env...
    python -c "content='''# Configuration du microservice d'embedding Yukpo

# Cle API pour securiser le microservice
YUKPO_API_KEY=yukpo_embedding_key_2024

# Configuration Pinecone (base de donnees vectorielle)
PINECONE_API_KEY=pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=service-embeddings

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
EMBEDDING_TIMEOUT=60'''; open('.env', 'w', encoding='utf-8').write(content); print('✅ Fichier .env créé')"
)

REM Lancer le microservice
echo [EMBEDDING] Démarrage du microservice embedding...
echo [INFO] Le service sera accessible sur http://localhost:8000
echo [INFO] Appuyez sur Ctrl+C pour arrêter le service
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000 