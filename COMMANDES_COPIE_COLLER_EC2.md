# 📋 Commandes à Copier-Coller - Migrations EC2

## ✅ **ÉTAPE 1 : Transférer les Migrations (Windows PowerShell)**

```powershell
cd C:\Users\23767\yukpomnang2

$EC2_IP = aws ec2 describe-instances --filters "Name=tag:Name,Values=yukpo-temp-db-creator" --region eu-west-1 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

Write-Host "IP EC2: $EC2_IP"

scp -i "C:\chemin\vers\votre-cle.pem" -r backend/migrations ec2-user@${EC2_IP}:~/migrations/
```

**⚠️ Remplacez `C:\chemin\vers\votre-cle.pem` par le chemin réel de votre clé EC2**

---

## ✅ **ÉTAPE 2 : Sur EC2, Exécuter le Script**

Copiez-collez ce script complet dans votre session EC2 :

```bash
#!/bin/bash
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
MIGRATIONS_DIR=~/migrations

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

echo "🚀 Exécution de ${#MIGRATIONS[@]} migrations (idempotentes)..."
echo ""

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo "📄 $migration"
        OUTPUT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p 5432 -U yukpo_admin -d yukpo -f "$MIGRATIONS_DIR/$migration" 2>&1)
        
        if echo "$OUTPUT" | grep -qi "error" && ! echo "$OUTPUT" | grep -q "already exists"; then
            echo "❌ Erreur"
            echo "$OUTPUT" | grep -i "error" | head -3
            FAILED=$((FAILED + 1))
        else
            echo "✅ Terminée"
            SUCCESS=$((SUCCESS + 1))
        fi
        echo ""
    else
        echo "⚠️  $migration non trouvé"
        FAILED=$((FAILED + 1))
    fi
done

echo "=========================================="
echo "📊 Résumé: ✅ $SUCCESS succès, ❌ $FAILED échecs"
echo "=========================================="
```

**OU** créer le fichier et l'exécuter :

```bash
cat > ~/executer_migrations.sh << 'EOFMIGRATIONS'
#!/bin/bash
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
MIGRATIONS_DIR=~/migrations

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

echo "🚀 Exécution de ${#MIGRATIONS[@]} migrations (idempotentes)..."
echo ""

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo "📄 $migration"
        OUTPUT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p 5432 -U yukpo_admin -d yukpo -f "$MIGRATIONS_DIR/$migration" 2>&1)
        
        if echo "$OUTPUT" | grep -qi "error" && ! echo "$OUTPUT" | grep -q "already exists"; then
            echo "❌ Erreur"
            echo "$OUTPUT" | grep -i "error" | head -3
            FAILED=$((FAILED + 1))
        else
            echo "✅ Terminée"
            SUCCESS=$((SUCCESS + 1))
        fi
        echo ""
    else
        echo "⚠️  $migration non trouvé"
        FAILED=$((FAILED + 1))
    fi
done

echo "=========================================="
echo "📊 Résumé: ✅ $SUCCESS succès, ❌ $FAILED échecs"
echo "=========================================="
EOFMIGRATIONS

chmod +x ~/executer_migrations.sh
~/executer_migrations.sh
```

---

## ✅ **ÉTAPE 3 : Vérifier que Tout Fonctionne**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT COUNT(*) as nb_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
```

**Résultat attendu** : Un nombre de tables (ex: 200+)

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'services', 'deliveries', 'media') ORDER BY table_name;"
```

**Résultat attendu** : Les 4 tables listées

---

## ✅ **ÉTAPE 4 (Optionnel) : Réactiver les Migrations Automatiques**

Quand vous serez prêt, réactiver `ENABLE_AUTO_MIGRATIONS=true` dans ECS :

```bash
# Récupérer la task definition actuelle
TASK_DEF=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].taskDefinition' --output text)

# Récupérer et modifier avec Python
python3 << 'PYTHON'
import json
import subprocess
import sys

task_def = sys.argv[1]
result = subprocess.run(['aws', 'ecs', 'describe-task-definition', '--task-definition', task_def, '--region', 'eu-west-1', '--query', 'taskDefinition'], capture_output=True, text=True)
task_def_json = json.loads(result.stdout)

container = task_def_json['containerDefinitions'][0]
if 'environment' not in container:
    container['environment'] = []

env_vars = container['environment']
found = False
for env in env_vars:
    if env.get('name') == 'ENABLE_AUTO_MIGRATIONS':
        env['value'] = 'true'
        found = True
        break
if not found:
    env_vars.append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'true'})

for f in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    task_def_json.pop(f, None)

with open('/tmp/task-def-final.json', 'w') as f:
    json.dump(task_def_json, f, indent=2)
print("✅ Modifié")
PYTHON "$TASK_DEF"

# Enregistrer et mettre à jour
NEW_TASK_DEF=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def-final.json --region eu-west-1 --query 'taskDefinition.taskDefinitionArn' --output text)
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --task-definition "$NEW_TASK_DEF" --region eu-west-1 --force-new-deployment

echo "✅ ENABLE_AUTO_MIGRATIONS=true réactivé - Service redémarre..."
```

---

## 📝 **Résumé des Étapes**

1. **Transférer** : Exécutez la commande SCP depuis PowerShell
2. **Exécuter** : Copiez-collez le script bash sur EC2
3. **Vérifier** : Exécutez les commandes de vérification
4. **Réactiver** (optionnel) : Quand vous serez prêt, réactivez les migrations auto


