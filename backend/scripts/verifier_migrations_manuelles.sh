#!/bin/bash
# Script pour vérifier les migrations manuelles sur EC2
# Usage: ./verifier_migrations_manuelles.sh

set -e  # Arrêter en cas d'erreur

# Configuration de la base de données
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_PORT="5432"
DB_USER="yukpo_admin"
DB_NAME="yukpo"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

# Chemin du script SQL
SQL_SCRIPT="$(dirname "$0")/verifier_migrations_manuelles.sql"

echo "🔍 Vérification des migrations manuelles"
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
echo "📝 Exécution des vérifications..."
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$SQL_SCRIPT"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Vérifications terminées avec succès!"
    echo ""
    echo "📊 Vérifications effectuées:"
    echo "  - Nombre total de tables"
    echo "  - Index dupliqués"
    echo "  - Fonctions totales"
    echo "  - Vues matérialisées"
    echo "  - Tables critiques du Log 58"
    echo "  - Index critiques"
    echo "  - Fonctions critiques"
    echo "  - Résumé des erreurs potentielles"
else
    echo ""
    echo "❌ Erreur lors de l'exécution des vérifications"
    exit 1
fi

