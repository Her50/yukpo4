# 🚀 Exécuter les Migrations Sans Cloner le Repository

## ✅ **Solution : Transférer les Migrations via SCP**

### Étape 1 : Depuis votre Machine Windows

```powershell
# Dans PowerShell, aller dans le répertoire du projet
cd C:\Users\23767\yukpomnang2

# Transférer le dossier migrations
# Remplacez EC2_IP par l'IP de votre instance EC2
# Remplacez le chemin vers votre clé .pem

scp -i "C:\chemin\vers\votre-cle.pem" -r backend/migrations ec2-user@EC2_IP:~/migrations/
```

### Étape 2 : Sur EC2, Exécuter les Migrations

```bash
# Vérifier que les migrations sont là
ls -la ~/migrations/*.sql | head -10

# Exécuter les migrations une par une
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql \
    -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
    -p 5432 \
    -U yukpo_admin \
    -d yukpo \
    -f ~/migrations/00000001_create_extensions.sql

# Continuer pour les autres migrations...
```

---

## ✅ **Alternative : Script Automatique sur EC2**

Une fois les migrations transférées, créez ce script sur EC2 :

```bash
cat > ~/executer_toutes_migrations.sh << 'SCRIPT'
#!/bin/bash
MIGRATIONS_DIR=~/migrations
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

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

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo "📄 Exécution de: $migration"
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p 5432 \
            -U yukpo_admin \
            -d yukpo \
            -f "$MIGRATIONS_DIR/$migration" 2>&1 | grep -v "already exists" | grep -v "NOTICE" || true
        echo "✅ $migration terminée"
        echo ""
    else
        echo "⚠️  $migration non trouvé"
    fi
done
SCRIPT

chmod +x ~/executer_toutes_migrations.sh
~/executer_toutes_migrations.sh
```

---

## 🔍 **Trouver l'IP de votre Instance EC2**

```bash
# Depuis votre machine Windows (PowerShell)
aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=yukpo-temp-db-creator" \
    --region eu-west-1 \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text
```



