#!/bin/bash
# ✅ Phase 1: Configuration des variables d'environnement Redis

set -e

echo "🔧 Configuration des variables d'environnement Redis"
echo "=================================================="

# ✅ Variables Redis (à adapter selon votre environnement)
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-}"
export REDIS_MAX_CONNECTIONS="${REDIS_MAX_CONNECTIONS:-100}"
export REDIS_POOL_SIZE="${REDIS_POOL_SIZE:-50}"
export REDIS_CONNECTION_TIMEOUT="${REDIS_CONNECTION_TIMEOUT:-10}"
export REDIS_CLUSTER_MODE="${REDIS_CLUSTER_MODE:-false}"
export REDIS_NODES="${REDIS_NODES:-}"

# ✅ Mode cluster (si activé)
if [ "$REDIS_CLUSTER_MODE" = "true" ]; then
    echo "✅ Mode cluster activé"
    if [ -z "$REDIS_NODES" ]; then
        echo "⚠️  REDIS_NODES doit être défini en mode cluster"
        exit 1
    fi
    echo "Nodes: $REDIS_NODES"
else
    echo "✅ Mode standalone"
    echo "URL: $REDIS_URL"
fi

# ✅ Créer fichier .env.local si nécessaire
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
# ✅ Redis Configuration
REDIS_URL=$REDIS_URL
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_MAX_CONNECTIONS=$REDIS_MAX_CONNECTIONS
REDIS_POOL_SIZE=$REDIS_POOL_SIZE
REDIS_CONNECTION_TIMEOUT=$REDIS_CONNECTION_TIMEOUT
REDIS_CLUSTER_MODE=$REDIS_CLUSTER_MODE
REDIS_NODES=$REDIS_NODES
EOF
    echo "✅ Fichier .env.local créé"
else
    echo "✅ Fichier .env.local existe déjà"
fi

# ✅ Test de connexion Redis (si redis-cli disponible)
if command -v redis-cli &> /dev/null; then
    echo ""
    echo "🔍 Test de connexion Redis..."
    if [ -n "$REDIS_PASSWORD" ]; then
        redis-cli -u "$REDIS_URL" -a "$REDIS_PASSWORD" ping
    else
        redis-cli -u "$REDIS_URL" ping
    fi
    if [ $? -eq 0 ]; then
        echo "✅ Connexion Redis réussie"
    else
        echo "⚠️  Connexion Redis échouée (vérifiez la configuration)"
    fi
fi

echo ""
echo "✅ Configuration Redis terminée!"
echo ""
echo "📝 Variables configurées:"
echo "  REDIS_URL=$REDIS_URL"
echo "  REDIS_MAX_CONNECTIONS=$REDIS_MAX_CONNECTIONS"
echo "  REDIS_POOL_SIZE=$REDIS_POOL_SIZE"
echo "  REDIS_CLUSTER_MODE=$REDIS_CLUSTER_MODE"

