#!/bin/bash
# Script simple pour tester la connexion Redis

echo "🔍 Test de connexion Redis"
echo "=========================="
echo ""

# URL Redis fournie
REDIS_URL="rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379"

echo "📋 URL Redis (masquée):"
echo "   rediss://default:***@superb-sole-7762.upstash.io:6379"
echo ""

# Vérifier si redis-cli est disponible
if command -v redis-cli &> /dev/null; then
    echo "🧪 Test avec redis-cli..."
    # Extraire les informations de l'URL
    # Format: rediss://user:password@host:port
    # Note: redis-cli ne supporte pas directement rediss://, il faut utiliser --tls
    echo "   ⚠️  redis-cli nécessite une configuration TLS spéciale pour rediss://"
    echo "   💡 Utilisez plutôt le script Rust test_redis.rs"
else
    echo "   ⚠️  redis-cli n'est pas installé"
    echo "   💡 Installez-le avec: sudo apt-get install redis-tools (Linux) ou brew install redis (macOS)"
fi

echo ""
echo "💡 Pour tester avec Rust:"
echo "   cd backend"
echo "   cargo run --bin test_redis"

