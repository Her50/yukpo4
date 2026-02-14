# 📥 Télécharger les Migrations depuis GitHub

## ✅ **Commande Complète pour EC2**

Le repository est privé, donc vous devez utiliser un token GitHub ou télécharger manuellement. Voici la commande corrigée :

```bash
mkdir -p ~/migrations
cd ~/migrations

# Liste complète des migrations avec leurs noms exacts
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

# Télécharger chaque migration
for migration in "${MIGRATIONS[@]}"; do
    echo "📥 Téléchargement de $migration..."
    # Si le repo est public, utilisez cette URL
    curl -L "https://raw.githubusercontent.com/Her50/yukpo4/main/backend/migrations/$migration" \
        -o "$migration" \
        -H "Accept: application/vnd.github.v3.raw" \
        2>/dev/null || echo "⚠️  Échec: $migration"
done

echo ""
echo "✅ Téléchargement terminé"
echo "📊 Fichiers téléchargés:"
ls -1 *.sql | wc -l
```

---

## ✅ **Si le Repository est Privé (Avec Token GitHub)**

Si le repository est privé, vous devez créer un token GitHub :

1. Allez sur : https://github.com/settings/tokens
2. Créez un token avec permission `repo`
3. Utilisez-le dans la commande :

```bash
GITHUB_TOKEN="votre_token_ici"

for migration in "${MIGRATIONS[@]}"; do
    echo "📥 Téléchargement de $migration..."
    curl -L "https://raw.githubusercontent.com/Her50/yukpo4/main/backend/migrations/$migration" \
        -o "$migration" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3.raw" \
        2>/dev/null || echo "⚠️  Échec: $migration"
done
```

---

## ✅ **Alternative : Utiliser SCP depuis Windows**

Si le téléchargement GitHub ne fonctionne pas, utilisez SCP depuis votre machine Windows :

```powershell
# Dans PowerShell
cd C:\Users\23767\yukpomnang2

$EC2_IP = aws ec2 describe-instances --filters "Name=tag:Name,Values=yukpo-temp-db-creator" --region eu-west-1 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

scp -i "C:\chemin\vers\cle.pem" -r backend\migrations ec2-user@${EC2_IP}:~/migrations/
```

---

## ✅ **Vérification après Téléchargement**

```bash
# Vérifier que les fichiers sont là
ls -la ~/migrations/*.sql | head -10

# Compter
ls -1 ~/migrations/*.sql | wc -l

# Devrait afficher 41
```

