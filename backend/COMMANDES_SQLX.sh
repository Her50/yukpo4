#!/bin/bash
# Script pour générer les métadonnées SQLx après ajout de nouvelles requêtes

set -e  # Arrêter en cas d'erreur

echo "🔍 Vérification de l'environnement..."

# Vérifier que DATABASE_URL est configuré
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL n'est pas configuré dans .env"
    echo "📝 Ajoutez DATABASE_URL=postgresql://user:password@localhost:5432/yukpomnang"
    exit 1
fi

echo "✅ DATABASE_URL configuré"

echo ""
echo "📦 Étape 1/3 : Application des migrations..."
sqlx migrate run

echo ""
echo "🔨 Étape 2/3 : Génération des métadonnées SQLx..."
cargo sqlx prepare --workspace

echo ""
echo "📊 Étape 3/3 : Vérification..."
metadata_count=$(ls -1 .sqlx/query-*.json 2>/dev/null | wc -l)
echo "✅ $metadata_count fichiers metadata générés"

echo ""
echo "🎯 Prochaines étapes :"
echo "1. Commit les métadonnées :"
echo "   git add .sqlx/"
echo "   git commit -m 'Add SQLx metadata for new queries'"
echo ""
echo "2. Tester la compilation offline :"
echo "   export SQLX_OFFLINE=true"
echo "   cargo build"

echo ""
echo "✅ Génération terminée !"

