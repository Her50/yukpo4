#!/bin/bash
# Script pour appliquer la migration de manière sécurisée
# Vérifie les index existants avant d'appliquer

set -e

echo "🔍 Vérification des index existants sur la table services..."

# Variables de connexion (à adapter selon votre configuration)
DB_HOST="${DB_HOST:-dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com}"
DB_NAME="${DB_NAME:-yukpo_db}"
DB_USER="${DB_USER:-yukpo_db_user}"
DB_PASSWORD="${DB_PASSWORD:-88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4}"

export PGPASSWORD="$DB_PASSWORD"

echo "📊 Liste des index existants sur 'services':"
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    indexname,
    CASE 
        WHEN indexdef LIKE '%to_tsvector%' THEN 'tsvector'
        WHEN indexdef LIKE '%trgm%' THEN 'trigram'
        WHEN indexdef LIKE '%GIN%' THEN 'GIN'
        ELSE 'autre'
    END as type_index
FROM pg_indexes
WHERE tablename = 'services'
ORDER BY indexname;
"

echo ""
echo "✅ Application de la migration (vérifie existence avant création)..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "../migrations/20251129_001_optimize_search_tsvector_performance.sql"

echo ""
echo "✅ Migration appliquée avec succès !"
echo "📊 Vérification des nouveaux index créés:"
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND indexname LIKE '%tsvector%'
ORDER BY indexname;
"

unset PGPASSWORD

