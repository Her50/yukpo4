#!/bin/bash
# Script bash pour appliquer les migrations menu planning sur la base de données
# Usage: ./apply_menu_planning_migration.sh

set -e  # Arrêter en cas d'erreur

# Configuration base de données
DB_HOST="dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com"
DB_NAME="yukpo_db"
DB_USER="yukpo_db_user"
DB_PASSWORD="88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}"

echo "==================================="
echo "Application des migrations Menu Planning"
echo "==================================="
echo ""

# Chemin vers le fichier de migration
MIGRATION_FILE="backend/migrations/20250127_create_menu_planning_tables.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Erreur: Fichier de migration non trouvé: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Fichier de migration trouvé: $MIGRATION_FILE"

# Vérifier si psql est disponible
if ! command -v psql &> /dev/null; then
    echo ""
    echo "⚠️  psql n'est pas installé."
    echo ""
    echo "Option 1: Installer PostgreSQL client"
    echo "  - Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  - macOS: brew install postgresql"
    echo ""
    echo "Option 2: Utiliser Docker"
    echo "  docker run -it --rm -v \$(pwd):/migrations postgres psql \$DB_URL -f /migrations/$MIGRATION_FILE"
    echo ""
    exit 1
fi

echo "✅ psql trouvé: $(which psql)"
echo ""

# Statistiques du fichier
LINES=$(wc -l < "$MIGRATION_FILE")
SIZE=$(du -h "$MIGRATION_FILE" | cut -f1)

echo "📝 Contenu de la migration:"
echo "  - Taille: $SIZE"
echo "  - Lignes: $LINES"
echo ""

echo "⚠️  ATTENTION: Vous allez appliquer les migrations sur la base de données!"
echo "   Base: $DB_NAME"
echo "   Host: $DB_HOST"
echo ""
read -p "Continuer? (oui/non): " confirmation

if [ "$confirmation" != "oui" ]; then
    echo "❌ Opération annulée"
    exit 0
fi

echo ""
echo "🚀 Application de la migration..."

# Appliquer la migration
export PGPASSWORD="$DB_PASSWORD"

if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"; then
    echo ""
    echo "✅ Migration appliquée avec succès!"
    echo ""
    echo "📊 Vérification des tables créées..."
    
    # Vérifier les tables créées
    VERIFY_QUERY="SELECT '✅ ' || table_name as status FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('family_profiles', 'recipes', 'menu_plans', 'planned_meals', 'recipe_favorites', 'shopping_lists', 'shopping_list_items', 'nutrition_analytics') ORDER BY table_name;"
    
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "$VERIFY_QUERY"
    
    echo ""
    echo "==================================="
    echo "✅ Migration complétée avec succès!"
    echo "==================================="
    
else
    echo ""
    echo "❌ Erreur lors de l'application de la migration"
    exit 1
fi

# Nettoyer
unset PGPASSWORD

echo ""
echo "📝 Prochaines étapes:"
echo "   1. Vérifier que les tables sont créées correctement"
echo "   2. Vérifier les index avec: \\d+ table_name dans psql"
echo "   3. Tester le service menu planning via l'API"
echo ""

