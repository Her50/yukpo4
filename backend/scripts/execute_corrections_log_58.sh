#!/bin/bash
# Script pour exécuter les corrections SQL du Log 58 sur EC2
# Usage: ./execute_corrections_log_58.sh

set -e  # Arrêter en cas d'erreur

# Configuration de la base de données
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_PORT="5432"
DB_USER="yukpo_admin"
DB_NAME="yukpo"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

# Chemin du script SQL
SQL_SCRIPT="$(dirname "$0")/corrections_sql_log_58.sql"

echo "🔧 Exécution des corrections SQL - Log 58"
echo "=========================================="
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "Script: $SQL_SCRIPT"
echo ""

# Vérifier que le script SQL existe
if [ ! -f "$SQL_SCRIPT" ]; then
    echo "❌ Erreur: Le fichier $SQL_SCRIPT n'existe pas"
    exit 1
fi

# Exécuter le script SQL
echo "📝 Exécution des corrections..."
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$SQL_SCRIPT"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Corrections SQL exécutées avec succès!"
    echo ""
    echo "📊 Vérifications effectuées:"
    echo "  - Colonne last_synced_at dans live_session_analytics"
    echo "  - Colonne highlighted dans global_promo_products"
    echo "  - Index idx_offres_date_limite recréé"
    echo "  - Vue matérialisée hashtag_stats_materialized corrigée"
else
    echo ""
    echo "❌ Erreur lors de l'exécution des corrections SQL"
    exit 1
fi

