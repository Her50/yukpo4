#!/bin/bash

# 🚀 Script de démarrage optimisé pour AWS ECS/Fargate
set -e

echo "🚀 Démarrage de Yukpomnang Backend - AWS Cloud..."

# Vérifier les variables d'environnement critiques
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: DATABASE_URL non définie"
    exit 1
fi

# Variables d'environnement avec valeurs par défaut pour AWS
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}
export RUST_LOG=${RUST_LOG:-info}
export APP_ENV=${APP_ENV:-production}
export AWS_REGION=${AWS_REGION:-us-east-1}

# Configuration du pool de connexions pour AWS RDS
export DB_POOL_SIZE=${DB_POOL_SIZE:-100}
export DB_POOL_MIN_SIZE=${DB_POOL_MIN_SIZE:-20}
export DB_ACQUIRE_TIMEOUT_SECS=${DB_ACQUIRE_TIMEOUT_SECS:-30}

# Vérifier la connectivité à la base de données (AWS RDS)
echo "🔍 Vérification de la connectivité à la base de données AWS RDS..."
MAX_RETRIES=30
RETRY_COUNT=0

# Extraire les informations de connexion de DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")

if [ -z "$DB_HOST" ]; then
    echo "⚠️ Impossible d'extraire DB_HOST de DATABASE_URL, tentative directe..."
    until pg_isready -d "$DATABASE_URL" 2>/dev/null || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⏳ En attente de la base de données AWS RDS... (tentative $RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
else
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⏳ En attente de la base de données AWS RDS ($DB_HOST:$DB_PORT)... (tentative $RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
fi

if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ ERREUR: Impossible de se connecter à la base de données après $MAX_RETRIES tentatives"
    echo "   DB_HOST: ${DB_HOST:-non défini}"
    echo "   DB_PORT: ${DB_PORT:-non défini}"
    echo "   DATABASE_URL: ${DATABASE_URL:0:50}... (tronqué pour sécurité)"
    exit 1
fi

echo "✅ Base de données AWS RDS accessible"

# Vérifier la connectivité Redis (AWS ElastiCache) - optionnel et non-bloquant
if [ -n "$REDIS_URL" ]; then
    echo "🔍 Vérification de la connectivité Redis (AWS ElastiCache)..."
    # ✅ OPTIMISÉ: Réduire à 3 tentatives max (6 secondes) pour ne pas bloquer le démarrage
    # Redis est optionnel - l'application peut fonctionner sans cache Redis
    MAX_REDIS_RETRIES=3
    RETRY_COUNT=0
    REDIS_AVAILABLE=false
    
    # Vérifier si redis-cli est disponible
    if command -v redis-cli &> /dev/null; then
        until redis-cli -u "$REDIS_URL" ping 2>/dev/null || [ $RETRY_COUNT -ge $MAX_REDIS_RETRIES ]; do
            RETRY_COUNT=$((RETRY_COUNT + 1))
            echo "⏳ En attente de Redis (AWS ElastiCache)... (tentative $RETRY_COUNT/$MAX_REDIS_RETRIES)"
            sleep 2
        done
        
        if [ $RETRY_COUNT -lt $MAX_REDIS_RETRIES ]; then
            REDIS_AVAILABLE=true
            echo "✅ Redis (AWS ElastiCache) accessible"
        else
            echo "⚠️ WARNING: Redis non accessible après $MAX_REDIS_RETRIES tentatives, l'application continuera sans cache Redis"
        fi
    else
        echo "⚠️ WARNING: redis-cli non disponible dans l'image, vérification Redis ignorée"
        echo "   L'application démarrera et tentera de se connecter à Redis au runtime"
    fi
else
    echo "ℹ️ REDIS_URL non définie, l'application fonctionnera sans cache Redis"
fi

# Appliquer les migrations si nécessaire (optionnel, peut être géré par AWS ECS task séparée)
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "🔄 Application des migrations..."
    if [ -f "./yukpomnang_backend" ]; then
        ./yukpomnang_backend migrate || echo "⚠️ Migrations non disponibles ou déjà appliquées"
    else
        echo "⚠️ Exécutable non trouvé, migrations ignorées"
    fi
else
    echo "ℹ️ Migrations ignorées (RUN_MIGRATIONS != true)"
fi

# Vérifier la configuration GPU (optionnel pour AWS ECS avec instances GPU)
if [ "$GPU_ENABLED" = "true" ]; then
    echo "🎮 GPU activé - Vérification des capacités..."
    if command -v nvidia-smi &> /dev/null; then
        echo "✅ GPU NVIDIA détecté"
        nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader
    else
        echo "⚠️ GPU activé mais non détecté - Fallback vers CPU (normal sur Fargate standard)"
    fi
else
    echo "⚙️ Mode CPU activé (standard AWS Fargate)"
fi

# Optimiser les paramètres système pour AWS ECS/Fargate
echo "⚡ Optimisation des paramètres système pour AWS..."

# Augmenter les limites de fichiers (si permissions disponibles)
if [ -w /proc/sys/fs/file-max ]; then
    ulimit -n 65536 2>/dev/null || echo "⚠️ Impossible de modifier ulimit (permissions insuffisantes)"
fi

# Afficher les informations système
echo "📊 Informations système:"
echo "   - CPU: $(nproc) cores"
echo "   - Mémoire: $(free -h | awk '/^Mem:/ {print $2}')"
echo "   - Port: $PORT"
echo "   - Host: $HOST"
echo "   - Environnement: $APP_ENV"
echo "   - Région AWS: $AWS_REGION"

# Vérifier que l'exécutable existe
if [ ! -f "./yukpomnang_backend" ]; then
    echo "❌ ERREUR: Exécutable yukpomnang_backend non trouvé!"
    exit 1
fi

# Rendre l'exécutable... exécutable (au cas où)
chmod +x ./yukpomnang_backend

# Démarrer l'application
echo "🚀 Lancement de l'application backend..."
echo "   Command: ./yukpomnang_backend"
echo "   Port: $PORT"
echo "   Host: $HOST"
echo "   Log Level: $RUST_LOG"
echo "   APP_ENV: $APP_ENV"
echo "   DATABASE_URL: ${DATABASE_URL:0:30}... (présent)"
echo "   REDIS_URL: ${REDIS_URL:+présent}${REDIS_URL:-non défini}"
echo "   JWT_SECRET: ${JWT_SECRET:+présent}${JWT_SECRET:-non défini}"

# Utiliser exec pour que le processus principal soit le backend
# Cela permet à AWS ECS de gérer correctement les signaux (SIGTERM, etc.)
# Capturer les erreurs et les logger avant de quitter
if ! ./yukpomnang_backend; then
    EXIT_CODE=$?
    echo "❌ ERREUR: L'application backend a quitté avec le code $EXIT_CODE"
    echo "   Vérifiez les logs ci-dessus pour plus de détails"
    exit $EXIT_CODE
fi 