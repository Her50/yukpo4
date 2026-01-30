#!/bin/bash
# Script de diagnostic approfondi des migrations AWS
# Usage: ./diagnose_migrations_aws.sh

set -e

echo "🔍 =========================================="
echo "🔍 DIAGNOSTIC APPROFONDI DES MIGRATIONS AWS"
echo "🔍 =========================================="
echo ""

# 1. Vérifier la connexion à la base de données
echo "📊 1. Vérification de la connexion à la base de données..."
export DATABASE_URL=$(aws ssm get-parameter --region us-east-1 --name "/yukpomnang/production/DATABASE_URL" --with-decryption --query "Parameter.Value" --output text)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL non trouvée dans SSM"
    exit 1
fi

echo "✅ DATABASE_URL récupérée depuis SSM"
echo ""

# 2. Vérifier l'état de la table _sqlx_migrations
echo "📊 2. État de la table _sqlx_migrations..."
psql "$DATABASE_URL" -c "
SELECT 
    version,
    name,
    success,
    checksum,
    installed_on
FROM _sqlx_migrations
ORDER BY version DESC
LIMIT 20;
" || echo "⚠️ Table _sqlx_migrations n'existe pas ou erreur"
echo ""

# 3. Vérifier les fonctions hybrid_image_search
echo "📊 3. Fonctions hybrid_image_search existantes..."
psql "$DATABASE_URL" -c "
SELECT 
    p.proname,
    pg_get_function_arguments(p.oid) as args,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'hybrid_image_search'
AND n.nspname = 'public';
" || echo "⚠️ Erreur lors de la vérification des fonctions"
echo ""

# 4. Vérifier l'existence de specialized_reservations
echo "📊 4. État de la table specialized_reservations..."
psql "$DATABASE_URL" -c "
SELECT 
    EXISTS(SELECT FROM information_schema.tables WHERE table_name = 'specialized_reservations') as table_exists,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'specialized_reservations') as column_count;
" || echo "⚠️ Erreur lors de la vérification"
echo ""

# 5. Vérifier la fonction run_audio_cache_cleanup
echo "📊 5. État de la fonction run_audio_cache_cleanup..."
psql "$DATABASE_URL" -c "
SELECT 
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'run_audio_cache_cleanup') as function_exists;
" || echo "⚠️ Erreur lors de la vérification"
echo ""

# 6. Vérifier les erreurs récentes dans les logs
echo "📊 6. Erreurs récentes dans les logs (dernières 10 minutes)..."
aws logs filter-log-events \
  --region us-east-1 \
  --log-group-name /ecs/yukpomnang-backend \
  --start-time $(($(date +%s) - 600))000 \
  --filter-pattern "ERROR" \
  --query 'events[*].message' \
  --output text | grep -E "(hybrid_image_search|specialized_reservations|run_audio_cache_cleanup|migration|Migration)" | tail -20 || echo "Aucune erreur récente trouvée"
echo ""

# 7. Vérifier les migrations qui ont échoué
echo "📊 7. Migrations qui ont échoué dans _sqlx_migrations..."
psql "$DATABASE_URL" -c "
SELECT 
    version,
    name,
    success,
    installed_on
FROM _sqlx_migrations
WHERE success = false
ORDER BY installed_on DESC;
" || echo "⚠️ Aucune migration échouée trouvée ou table n'existe pas"
echo ""

# 8. Vérifier l'ordre des migrations appliquées
echo "📊 8. Dernières migrations appliquées (ordre chronologique)..."
psql "$DATABASE_URL" -c "
SELECT 
    version,
    name,
    success,
    installed_on
FROM _sqlx_migrations
WHERE success = true
ORDER BY installed_on DESC
LIMIT 10;
" || echo "⚠️ Erreur lors de la vérification"
echo ""

# 9. Vérifier si la migration 20260130_001 existe dans la base
echo "📊 9. Vérification de la migration 20260130_001_fix_critical_migrations_aws..."
psql "$DATABASE_URL" -c "
SELECT 
    version,
    name,
    success,
    installed_on
FROM _sqlx_migrations
WHERE name LIKE '%20260130%' OR name LIKE '%fix_critical%'
ORDER BY installed_on DESC;
" || echo "⚠️ Migration 20260130_001 non trouvée"
echo ""

echo "✅ Diagnostic terminé"
echo ""
echo "📋 Résumé des problèmes identifiés:"
echo "   - Vérifiez les résultats ci-dessus pour identifier les problèmes"
echo "   - Si hybrid_image_search a plusieurs versions, elles doivent être supprimées"
echo "   - Si specialized_reservations n'existe pas, elle doit être créée"
echo "   - Si run_audio_cache_cleanup n'existe pas, elle doit être créée"
echo "   - Si la migration 20260130_001 n'a pas été appliquée, vérifiez pourquoi"


