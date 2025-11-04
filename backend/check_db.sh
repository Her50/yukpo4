#!/bin/bash
# Script de vérification rapide de la base de données
# Usage: ./check_db.sh

echo "🔍 DIAGNOSTIC RAPIDE - BASE DE DONNÉES"
echo ""

# Source les variables d'environnement
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL non définie dans .env"
    exit 1
fi

echo "✅ Connexion à la base de données..."
echo ""

# Requête 1: Vérifier table autocomplete_combinations
echo "1️⃣ Table autocomplete_combinations :"
psql $DATABASE_URL -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_combinations') as exists;"

echo ""
echo "2️⃣ Colonnes critiques :"
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name IN ('product_vector', 'product_labels', 'location_labels', 'usage_count') ORDER BY column_name;"

echo ""
echo "3️⃣ Nombre d'enregistrements :"
psql $DATABASE_URL -c "SELECT COUNT(*) as total, COUNT(CASE WHEN usage_count >= 2 THEN 1 END) as populaires FROM autocomplete_combinations;"

echo ""
echo "4️⃣ TOP 3 produits :"
psql $DATABASE_URL -c "SELECT product_vector, usage_count FROM autocomplete_combinations ORDER BY usage_count DESC LIMIT 3;"

echo ""
echo "✅ Diagnostic terminé"

