#!/bin/bash
# Script de build Docker avec cache SQLx offline (Option A)

set -e

echo "🔍 Vérification du cache SQLx..."
if [ ! -d ".sqlx" ]; then
    echo "❌ Erreur: Le dossier .sqlx n'existe pas!"
    echo "   Exécutez d'abord: cargo sqlx prepare -- --lib"
    exit 1
fi

echo "✅ Cache SQLx trouvé dans .sqlx/"

echo ""
echo "🏗️  Construction de l'image Docker..."
docker build -f Dockerfile -t yukpo-backend:latest .

echo ""
echo "✅ Build terminé avec succès!"
echo ""
echo "📦 Image créée: yukpo-backend:latest"
echo ""
echo "Pour tester l'image:"
echo "  docker run --rm -p 3001:3001 -e DATABASE_URL='...' yukpo-backend:latest"


