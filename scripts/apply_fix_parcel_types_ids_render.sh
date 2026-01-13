#!/bin/bash

# Script pour appliquer directement la migration fix_parcel_types_ids sur Render
# Usage sur Render: 
#   1. Via Shell Render: ./scripts/apply_fix_parcel_types_ids_render.sh
#   2. Ou: cd backend && cargo run --bin apply_fix_parcel_types_ids

set -e  # Arrêter en cas d'erreur

echo "🔧 Application de la migration fix_parcel_types_ids sur Render..."
echo "📊 Vérification de l'environnement..."

# Vérifier que DATABASE_URL est définie
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: DATABASE_URL n'est pas définie"
    exit 1
fi

echo "✅ DATABASE_URL trouvée"

# Aller dans le dossier backend
cd backend || {
    echo "❌ ERREUR: Impossible d'accéder au dossier backend"
    exit 1
}

echo "🔄 Compilation et exécution de la migration..."
echo ""

# Compiler et exécuter le binaire
cargo run --bin apply_fix_parcel_types_ids

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration appliquée avec succès sur Render!"
else
    echo ""
    echo "❌ Erreur lors de l'application de la migration"
    exit 1
fi

