#!/bin/bash
# =====================================================
# Script pour Exécuter les Migrations depuis EC2
# avec Vérification Automatique du Chemin
# =====================================================

set -e

# Configuration
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_PORT="5432"
DB_USER="yukpo_admin"
DB_NAME="yukpo"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Exécution des Migrations depuis EC2${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Vérifier le répertoire actuel
CURRENT_DIR=$(pwd)
echo -e "${YELLOW}📁 Répertoire actuel: $CURRENT_DIR${NC}"

# 2. Chercher le dossier migrations
echo -e "${YELLOW}🔍 Recherche du dossier migrations...${NC}"

MIGRATIONS_DIR=""
POSSIBLE_PATHS=(
    "$CURRENT_DIR/backend/migrations"
    "$CURRENT_DIR/migrations"
    "$HOME/yukpomnang2/backend/migrations"
    "$HOME/yukpomnang2/migrations"
    "$(find ~ -type d -name 'migrations' -path '*/backend/migrations' 2>/dev/null | head -1)"
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ] && [ -f "$path/00000001_create_extensions.sql" ]; then
        MIGRATIONS_DIR="$path"
        break
    fi
done

if [ -z "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ Dossier migrations non trouvé${NC}"
    echo ""
    echo -e "${YELLOW}📦 Solutions possibles:${NC}"
    echo "   1. Cloner le repository:"
    echo "      cd ~ && git clone <URL_REPO>"
    echo ""
    echo "   2. Transférer les migrations via SCP depuis votre machine:"
    echo "      scp -i KEY.pem -r backend/migrations ec2-user@EC2_IP:~/yukpomnang2/backend/"
    echo ""
    echo "   3. Créer le dossier et télécharger les migrations depuis GitHub"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Migrations trouvées dans: $MIGRATIONS_DIR${NC}"
echo ""

# 3. Se placer dans le répertoire parent
cd "$(dirname "$MIGRATIONS_DIR")"
MIGRATIONS_BASE="$(basename "$MIGRATIONS_DIR")"

# 4. Liste des migrations
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

SUCCESS=0
FAILED=0
SKIPPED=0

# 5. Exécuter les migrations
echo -e "${BLUE}📋 Exécution de ${#MIGRATIONS[@]} migrations...${NC}"
echo ""

for migration in "${MIGRATIONS[@]}"; do
    MIGRATION_PATH="$MIGRATIONS_BASE/$migration"
    
    if [ ! -f "$MIGRATION_PATH" ]; then
        echo -e "${YELLOW}⚠️  $migration non trouvé (ignoré)${NC}"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    echo -e "${YELLOW}📄 Exécution de: $migration${NC}"
    
    # Exécuter la migration
    OUTPUT=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$MIGRATION_PATH" \
        2>&1)
    
    # Filtrer les messages "already exists" (normaux)
    ERRORS=$(echo "$OUTPUT" | grep -v "already exists" | grep -v "NOTICE" | grep -i "error" || true)
    
    if [ -z "$ERRORS" ]; then
        echo -e "${GREEN}✅ $migration terminée${NC}"
        SUCCESS=$((SUCCESS + 1))
    else
        # Vérifier si c'est juste un "already exists"
        if echo "$OUTPUT" | grep -q "already exists"; then
            echo -e "${GREEN}✅ $migration (déjà appliquée)${NC}"
            SUCCESS=$((SUCCESS + 1))
        else
            echo -e "${RED}❌ $migration - Erreurs:${NC}"
            echo "$ERRORS" | head -5
            FAILED=$((FAILED + 1))
        fi
    fi
    
    echo ""
    sleep 0.2
done

# 6. Résumé
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 Résumé${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Succès: $SUCCESS${NC}"
echo -e "${YELLOW}⚠️  Ignorés: $SKIPPED${NC}"
echo -e "${RED}❌ Échecs: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Toutes les migrations ont été exécutées avec succès !${NC}"
else
    echo -e "${RED}⚠️  Certaines migrations ont échoué. Vérifiez les erreurs ci-dessus.${NC}"
fi

