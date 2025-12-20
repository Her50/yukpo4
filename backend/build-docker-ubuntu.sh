#!/bin/bash
# Script de build Docker sur Ubuntu avec vérifications SQLx
# Usage: ./build-docker-ubuntu.sh

set -e

echo "🐳 Build Docker - SQLx Offline Mode"
echo "===================================="
echo ""

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    echo "   Installez Docker: apt-get update && apt-get install -y docker.io"
    exit 1
fi

echo "✅ Docker trouvé: $(docker --version)"
echo ""

# Vérifier que le cache SQLx existe
CACHE_DIR=".sqlx"
if [ ! -d "$CACHE_DIR" ]; then
    echo "❌ Le dossier .sqlx n'existe pas!"
    echo ""
    echo "   Génération du cache SQLx..."
    export DATABASE_URL="${DATABASE_URL:-postgresql://user:password@host:port/database}"
    export SQLX_OFFLINE=false
    cargo sqlx prepare --workspace
    echo ""
fi

CACHE_COUNT=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "📊 Cache SQLx: $CACHE_COUNT fichiers"

if [ $CACHE_COUNT -lt 200 ]; then
    echo "⚠️  Attention: Cache semble incomplet (< 200 fichiers)"
    echo "   Recommandation: Exécutez ./fix-sqlx-cache-ubuntu.sh"
    echo ""
fi

# Vérifier que le Dockerfile existe
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile non trouvé!"
    exit 1
fi

echo ""
echo "🏗️  Lancement du build Docker..."
echo "   Cela peut prendre 30-60 minutes..."
echo ""

# Lancer le build
START_TIME=$(date +%s)

docker build -f Dockerfile -t yukpo-backend:latest .

BUILD_EXIT_CODE=$?
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ BUILD RÉUSSI"
    echo "   Durée: ${DURATION}s ($(($DURATION / 60))m $(($DURATION % 60))s)"
    echo ""
    
    # Afficher les infos de l'image
    echo "📦 Image créée:"
    docker images yukpo-backend:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
    
    echo "🚀 Pour tester l'image:"
    echo "   docker run --rm -p 3001:3001 \\"
    echo "     -e DATABASE_URL='postgresql://...' \\"
    echo "     yukpo-backend:latest"
else
    echo "❌ BUILD ÉCHOUÉ"
    echo "   Durée: ${DURATION}s"
    echo ""
    echo "🔍 Vérifiez les erreurs ci-dessus"
    echo ""
    echo "💡 Solutions courantes:"
    echo "   1. Cache SQLx incomplet: ./fix-sqlx-cache-ubuntu.sh"
    echo "   2. Erreurs SQLx: Vérifiez que SQLX_OFFLINE=true est dans le Dockerfile"
    echo "   3. Erreurs de compilation Rust: Corrigez les erreurs affichées"
    exit 1
fi


