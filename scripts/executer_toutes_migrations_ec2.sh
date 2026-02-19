#!/bin/bash
# =====================================================
# Script pour Exécuter Toutes les Migrations depuis EC2
# Date: 2026-02-14
# =====================================================

set -e  # Arrêter en cas d'erreur

# Configuration
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_PORT="5432"
DB_USER="yukpo_admin"
DB_NAME="yukpo"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Démarrage de l'exécution de toutes les migrations depuis EC2${NC}"
echo ""

# Fonction pour exécuter une migration
execute_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file")
    
    echo -e "${YELLOW}📄 Exécution de: $migration_name${NC}"
    
    # Exécuter la migration avec gestion d'erreurs
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" 2>&1 | tee /tmp/migration_output.log; then
        # Vérifier s'il y a des erreurs critiques (pas juste des warnings)
        if grep -q "ERROR:" /tmp/migration_output.log; then
            # Ignorer les erreurs "already exists" qui sont normales
            if ! grep -q "already exists" /tmp/migration_output.log; then
                echo -e "${RED}❌ Erreur dans $migration_name${NC}"
                echo "   Vérifiez /tmp/migration_output.log pour plus de détails"
                return 1
            else
                echo -e "${GREEN}✅ $migration_name (déjà appliquée)${NC}"
            fi
        else
            echo -e "${GREEN}✅ $migration_name appliquée avec succès${NC}"
        fi
    else
        echo -e "${RED}❌ Échec de $migration_name${NC}"
        return 1
    fi
    
    echo ""
    return 0
}

# Vérifier que le répertoire migrations existe
MIGRATIONS_DIR="./backend/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ Répertoire $MIGRATIONS_DIR introuvable${NC}"
    echo "   Assurez-vous d'être dans le répertoire racine du projet"
    exit 1
fi

echo -e "${GREEN}📁 Répertoire migrations trouvé: $MIGRATIONS_DIR${NC}"
echo ""

# Liste des migrations dans l'ordre (SQLx standard)
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

# Exécuter les migrations dans l'ordre
SUCCESS_COUNT=0
FAILED_COUNT=0
SKIPPED_COUNT=0

for migration in "${MIGRATIONS[@]}"; do
    migration_path="$MIGRATIONS_DIR/$migration"
    
    if [ ! -f "$migration_path" ]; then
        echo -e "${YELLOW}⚠️  Fichier introuvable: $migration (ignoré)${NC}"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi
    
    if execute_migration "$migration_path"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        FAILED_COUNT=$((FAILED_COUNT + 1))
        echo -e "${RED}❌ Arrêt après échec de $migration${NC}"
        echo "   Vous pouvez continuer manuellement ou corriger l'erreur"
        read -p "   Continuer malgré l'erreur ? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            break
        fi
    fi
    
    # Petite pause pour éviter la surcharge
    sleep 0.5
done

# Résumé
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}📊 Résumé de l'exécution${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Succès: $SUCCESS_COUNT${NC}"
echo -e "${YELLOW}⚠️  Ignorés: $SKIPPED_COUNT${NC}"
echo -e "${RED}❌ Échecs: $FAILED_COUNT${NC}"
echo ""

if [ $FAILED_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 Toutes les migrations ont été appliquées avec succès !${NC}"
else
    echo -e "${YELLOW}⚠️  Certaines migrations ont échoué. Vérifiez les logs ci-dessus.${NC}"
fi



