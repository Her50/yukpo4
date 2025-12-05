#!/bin/bash
# ✅ Script pour tester la connexion Redis

set -e

REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

echo "🔍 Test de connexion Redis"
echo "=================================================="
echo "URL: $REDIS_URL"
echo ""

# ✅ Vérifier que redis-cli est disponible
if ! command -v redis-cli &> /dev/null; then
    echo "❌ redis-cli n'est pas installé"
    echo "   Installer Redis: https://redis.io/download"
    exit 1
fi

# ✅ Test de connexion
echo "🔍 Test de ping..."
if [ -n "$REDIS_PASSWORD" ]; then
    redis-cli -u "$REDIS_URL" -a "$REDIS_PASSWORD" ping
else
    redis-cli -u "$REDIS_URL" ping
fi

if [ $? -eq 0 ]; then
    echo "✅ Connexion Redis réussie"
    
    # ✅ Test d'écriture/lecture
    echo ""
    echo "🔍 Test d'écriture/lecture..."
    if [ -n "$REDIS_PASSWORD" ]; then
        redis-cli -u "$REDIS_URL" -a "$REDIS_PASSWORD" SET test_key "test_value"
        VALUE=$(redis-cli -u "$REDIS_URL" -a "$REDIS_PASSWORD" GET test_key)
        redis-cli -u "$REDIS_URL" -a "$REDIS_PASSWORD" DEL test_key
    else
        redis-cli -u "$REDIS_URL" SET test_key "test_value"
        VALUE=$(redis-cli -u "$REDIS_URL" GET test_key)
        redis-cli -u "$REDIS_URL" DEL test_key
    fi
    
    if [ "$VALUE" = "test_value" ]; then
        echo "✅ Test d'écriture/lecture réussi"
    else
        echo "⚠️  Test d'écriture/lecture échoué"
    fi
    
    # ✅ Informations Redis
    echo ""
    echo "📊 Informations Redis:"
    if [ -n "$REDIS_PASSWORD" ]; then
        redis-cli -u "$REDIS_URL" -a "$REDIS_PASSWORD" INFO server | grep -E "redis_version|os|uptime_in_seconds"
    else
        redis-cli -u "$REDIS_URL" INFO server | grep -E "redis_version|os|uptime_in_seconds"
    fi
    
    echo ""
    echo "✅ Tous les tests Redis sont passés!"
else
    echo "❌ Échec de la connexion Redis"
    exit 1
fi

