#!/bin/bash
# ✅ Script pour appliquer les migrations sur Render
# Usage: ./scripts/apply_migrations_render.sh

set -e

echo "🚀 Application des migrations sur Render..."

# Variables d'environnement Render
export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
export SQLX_OFFLINE=false

# Aller dans le dossier backend
cd backend

# Vérifier que sqlx-cli est installé
if ! command -v sqlx &> /dev/null; then
    echo "📦 Installation de sqlx-cli..."
    cargo install sqlx-cli --features postgres
fi

# Appliquer les migrations
echo "📊 Application des migrations..."
sqlx migrate run

echo "✅ Migrations appliquées avec succès!"

# Vérifier les tables créées
echo "🔍 Vérification des tables créées..."
sqlx migrate info

echo "✅ Vérification terminée!"

