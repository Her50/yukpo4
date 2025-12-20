#!/bin/bash
# Script pour exécuter les diagnostics SQL sur la base de données Render

DB_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com:5432/yukpo_db"

echo "🔍 Diagnostic de la recherche et vérification du produit Toyota Avensis 200"
echo "=================================================================="
echo ""

echo "1️⃣ Vérification du produit dans services.data..."
psql "$DB_URL" -f scripts/check_toyota_avensis.sql

echo ""
echo "2️⃣ Diagnostic performance recherche..."
psql "$DB_URL" -f scripts/diagnostic_recherche.sql

echo ""
echo "✅ Diagnostic terminé !"
echo ""
echo "📝 Pour réindexer les produits manquants, exécutez:"
echo "   psql \"$DB_URL\" -f scripts/fix_missing_autocomplete_products.sql"

