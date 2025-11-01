#!/bin/bash
# Script bash pour appliquer les migrations manquantes en production
# Migrations à appliquer :
# - 20251026_create_image_analyses_table.sql (table image_analyses)
# - 20250122_create_hybrid_image_search_function.sql (fonction hybrid_image_search)
# - 20251031_002_create_search_history.sql (table search_history)

echo "=== Application des migrations manquantes ==="
echo "Migrations pour recherche par image hybride"

# Vérifier si DATABASE_URL est définie
if [ -z "$DATABASE_URL" ]; then
    echo "ERREUR: DATABASE_URL n'est pas définie"
    echo "Veuillez définir la variable d'environnement DATABASE_URL"
    exit 1
fi

echo "Connexion à la base de données..."
echo "URL: ${DATABASE_URL:0:50}..."

# Fonction pour appliquer une migration
apply_migration() {
    local file=$1
    local description=$2
    
    echo ""
    echo "=== Application: $description ==="
    echo "Fichier: $file"
    
    if [ ! -f "$file" ]; then
        echo "   ✗ Fichier non trouvé: $file"
        return 1
    fi
    
    # Appliquer la migration avec psql
    if psql "$DATABASE_URL" -f "$file" 2>&1; then
        echo "   ✓ Migration appliquée avec succès!"
        return 0
    else
        exit_code=$?
        echo "   ⚠ Code de retour: $exit_code"
        
        # Vérifier si c'est une erreur "already exists" (normal si migration déjà appliquée)
        if psql "$DATABASE_URL" -f "$file" 2>&1 | grep -qE "already exists|existe déjà|duplicate"; then
            echo "   ℹ Migration déjà appliquée (normal)"
            return 0
        else
            echo "   ✗ Erreur lors de l'application de la migration"
            return 1
        fi
    fi
}

# Appliquer les migrations
apply_migration "migrations/20251026_create_image_analyses_table.sql" "Table image_analyses"
apply_migration "migrations/20250122_create_hybrid_image_search_function.sql" "Fonction hybrid_image_search"
apply_migration "migrations/20251031_002_create_search_history.sql" "Table search_history"

echo ""
echo "=== Vérification des objets créés ==="

# Vérifier image_analyses
echo ""
echo "Vérification table image_analyses..."
if psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'image_analyses');" | grep -q "t"; then
    echo "   ✓ Table image_analyses existe"
else
    echo "   ✗ Table image_analyses n'existe pas"
fi

# Vérifier hybrid_image_search
echo ""
echo "Vérification fonction hybrid_image_search..."
if psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'hybrid_image_search');" | grep -q "t"; then
    echo "   ✓ Fonction hybrid_image_search existe"
else
    echo "   ✗ Fonction hybrid_image_search n'existe pas"
fi

# Vérifier search_history
echo ""
echo "Vérification table search_history..."
if psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'search_history');" | grep -q "t"; then
    echo "   ✓ Table search_history existe"
else
    echo "   ✗ Table search_history n'existe pas"
fi

echo ""
echo "=== Migration terminée ==="
echo "Si des erreurs persistent, vérifiez les logs ci-dessus"

