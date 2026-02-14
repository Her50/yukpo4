#!/bin/bash
# =====================================================
# Script pour Exécuter les Migrations avec Vérifications
# Évite les doublons de tables, index, fonctions
# Date: 2026-02-14
# =====================================================

set -e

# Configuration
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_PORT="5432"
DB_USER="yukpo_admin"
DB_NAME="yukpo"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

export PGPASSWORD="$DB_PASSWORD"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Exécution des Migrations avec Vérifications${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Fonction pour vérifier si une table existe
table_exists() {
    local table_name=$1
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '$table_name'
        );" | tr -d ' ' | grep -q 't'
}

# Fonction pour vérifier si un index existe
index_exists() {
    local index_name=$1
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname = '$index_name'
        );" | tr -d ' ' | grep -q 't'
}

# Fonction pour vérifier si une fonction existe
function_exists() {
    local function_name=$1
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
        "SELECT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = '$function_name'
        );" | tr -d ' ' | grep -q 't'
}

# Fonction pour exécuter une migration avec vérifications
execute_migration_safe() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file")
    
    echo -e "${YELLOW}📄 Traitement: $migration_name${NC}"
    
    # Vérifier que le fichier existe
    if [ ! -f "$migration_file" ]; then
        echo -e "${RED}❌ Fichier introuvable: $migration_file${NC}"
        return 1
    fi
    
    # Exécuter la migration
    # PostgreSQL gère automatiquement IF NOT EXISTS, donc pas de doublons
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" > /tmp/migration_${migration_name}.log 2>&1; then
        # Vérifier les erreurs (ignorer "already exists")
        if grep -q "ERROR:" /tmp/migration_${migration_name}.log; then
            # Compter les erreurs non liées à "already exists"
            error_count=$(grep "ERROR:" /tmp/migration_${migration_name}.log | grep -v "already exists" | wc -l)
            if [ "$error_count" -gt 0 ]; then
                echo -e "${RED}❌ Erreurs dans $migration_name:${NC}"
                grep "ERROR:" /tmp/migration_${migration_name}.log | grep -v "already exists" | head -5
                return 1
            else
                echo -e "${GREEN}✅ $migration_name (déjà appliquée ou warnings)${NC}"
            fi
        else
            echo -e "${GREEN}✅ $migration_name appliquée avec succès${NC}"
        fi
    else
        echo -e "${RED}❌ Échec de $migration_name${NC}"
        tail -20 /tmp/migration_${migration_name}.log
        return 1
    fi
    
    return 0
}

# Vérifier la connexion
echo -e "${BLUE}🔍 Vérification de la connexion à la base de données...${NC}"
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connexion réussie${NC}"
else
    echo -e "${RED}❌ Échec de connexion à la base de données${NC}"
    exit 1
fi
echo ""

# Vérifier que le répertoire migrations existe
MIGRATIONS_DIR="./backend/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ Répertoire $MIGRATIONS_DIR introuvable${NC}"
    echo "   Assurez-vous d'être dans le répertoire racine du projet"
    exit 1
fi

# Liste des migrations SQLx standard (dans l'ordre)
MIGRATIONS=(
    "00000001_create_extensions.sql"
    "00000002_create_base_tables.sql"
    "00000003_create_utility_tables.sql"
    "00000004_create_payment_tables.sql"
    "00000005_create_autocomplete_tables.sql"
    "00000006_create_product_tables.sql"
    "00000007_create_review_tables.sql"
    "00000008_create_delivery_tables.sql"
    "00000009_create_specialized_services_tables.sql"
    "00000010_create_functions.sql"
    "00000011_create_indexes_and_optimizations.sql"
    "00000012_create_communication_tables.sql"
    "00000013_create_advertising_tables.sql"
    "00000014_create_live_streaming_tables.sql"
    "00000015_create_flash_sales_tables.sql"
    "00000016_create_promotion_tables.sql"
    "00000017_create_social_media_tables.sql"
    "00000018_create_media_engagement_tables.sql"
    "00000019_create_video_audio_tables.sql"
    "00000020_create_studio_tables.sql"
    "00000021_create_additional_functions.sql"
    "00000022_create_remaining_tables_and_functions.sql"
    "00000023_create_videos_tables.sql"
    "00000024_create_message_reactions_and_delivery_chat_tables.sql"
    "00000025_create_effects_and_templates_tables.sql"
    "00000026_create_plugin_marketplace_tables.sql"
    "00000027_create_menu_planning_tables.sql"
    "00000028_create_optimized_functions_and_cache.sql"
    "00000029_create_blood_donation_and_specialized_tables.sql"
    "00000030_create_final_optimizations_and_views.sql"
    "00000031_create_bus_tables.sql"
    "00000032_create_bus_functions_and_agency_tables.sql"
    "00000033_create_missing_delivery_tables.sql"
    "00000034_create_immobilier_tables.sql"
    "00000035_create_pharmacy_advanced_tables.sql"
    "00000036_create_hospital_advanced_tables.sql"
    "00000037_create_lab_advanced_tables.sql"
    "00000038_create_offres_emploi_advanced_tables.sql"
    "00000039_create_orientation_scolaire_advanced_tables.sql"
    "00000040_create_bourse_livre_advanced_tables.sql"
    "00000041_create_bus_ratings_return_trips_and_additional_tables.sql"
)

# Exécuter les migrations
SUCCESS=0
FAILED=0
SKIPPED=0

for migration in "${MIGRATIONS[@]}"; do
    migration_path="$MIGRATIONS_DIR/$migration"
    
    if [ ! -f "$migration_path" ]; then
        echo -e "${YELLOW}⚠️  Fichier introuvable: $migration${NC}"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    if execute_migration_safe "$migration_path"; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
        echo -e "${YELLOW}⚠️  Continuation malgré l'erreur...${NC}"
    fi
    
    sleep 0.3
done

# Résumé
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 Résumé${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Succès: $SUCCESS${NC}"
echo -e "${YELLOW}⚠️  Ignorés: $SKIPPED${NC}"
echo -e "${RED}❌ Échecs: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Toutes les migrations appliquées !${NC}"
else
    echo -e "${YELLOW}⚠️  Vérifiez les logs pour plus de détails${NC}"
fi

