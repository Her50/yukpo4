#!/bin/bash

# 🚀 Script de démarrage optimisé pour Google Cloud Run
# Version simplifiée pour démarrage rapide
set -e

echo "🚀 Démarrage de Yukpomnang Backend - Google Cloud Run..."

# Variables d'environnement avec valeurs par défaut pour Cloud Run
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}
export RUST_LOG=${RUST_LOG:-info}
export APP_ENV=${APP_ENV:-production}

# Configuration du pool de connexions pour Cloud SQL
export DB_POOL_SIZE=${DB_POOL_SIZE:-50}
export DB_POOL_MIN_SIZE=${DB_POOL_SIZE:-5}
export DB_ACQUIRE_TIMEOUT_SECS=${DB_ACQUIRE_TIMEOUT_SECS:-30}

# Vérifications minimales pour Cloud Run (timeout réduit)
echo "🔍 Vérifications rapides..."

# Vérifier DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: DATABASE_URL non définie"
    exit 1
fi

# Vérification rapide de la base de données (timeout court pour Cloud Run)
echo "🔍 Vérification rapide de la base de données Cloud SQL..."
MAX_RETRIES=5
RETRY_COUNT=0

if command -v pg_isready >/dev/null 2>&1; then
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p' || echo "")
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
    
    if [ -n "$DB_HOST" ]; then
        until pg_isready -h "$DB_HOST" -p "$DB_PORT" -t 2 2>/dev/null || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
            RETRY_COUNT=$((RETRY_COUNT + 1))
            echo "⏳ En attente de Cloud SQL... (tentative $RETRY_COUNT/$MAX_RETRIES)"
            sleep 1
        done
    fi
fi

if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "⚠️ WARNING: Base de données non accessible après $MAX_RETRIES tentatives"
    echo "   L'application tentera de se connecter au démarrage"
else
    echo "✅ Base de données accessible"
fi

# Vérifier l'exécutable
if [ ! -f "./yukpomnang_backend" ]; then
    echo "❌ ERREUR: Exécutable yukpomnang_backend non trouvé!"
    exit 1
fi

chmod +x ./yukpomnang_backend

# Informations système
echo "📊 Configuration Cloud Run:"
echo "   - Port: $PORT"
echo "   - Host: $HOST"
echo "   - Environnement: $APP_ENV"
echo "   - Log Level: $RUST_LOG"

# Démarrer l'application directement (pas de vérifications Redis/MongoDB bloquantes)
echo "🚀 Lancement de l'application backend..."
echo "   Commande: ./yukpomnang_backend"
echo ""

# Utiliser exec pour que le processus principal soit le backend
exec ./yukpomnang_backend

