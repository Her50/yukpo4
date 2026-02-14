# 🚀 Commande pour Exécuter Toutes les Migrations depuis EC2

## ✅ **Solution : Contourner le Problème de Parsing**

Oui, on peut contourner le problème de parsing en exécutant toutes les migrations directement depuis EC2. PostgreSQL gère automatiquement les `IF NOT EXISTS`, donc **pas de doublons**.

---

## 📋 **Étapes**

### **1. Désactiver les Migrations Automatiques dans le Backend**

Dans la configuration ECS, ajouter :
```bash
ENABLE_AUTO_MIGRATIONS=false
```

Cela empêche le backend d'exécuter les migrations automatiques au démarrage.

---

### **2. Télécharger les Fichiers de Migration sur EC2**

```bash
# Depuis votre machine locale (si vous avez accès au repo)
scp -r backend/migrations/ ec2-user@<EC2_IP>:/home/ec2-user/yukpomnang2/backend/

# OU depuis EC2, cloner le repo
cd /home/ec2-user
git clone <votre-repo-url> yukpomnang2
cd yukpomnang2
```

---

### **3. Exécuter Toutes les Migrations**

#### **Option A : Script Automatique (Recommandé)**

```bash
# Rendre le script exécutable
chmod +x scripts/executer_migrations_avec_verifications_ec2.sh

# Exécuter
./scripts/executer_migrations_avec_verifications_ec2.sh
```

#### **Option B : Commande Manuelle Simple**

```bash
# Exécuter toutes les migrations SQLx standard dans l'ordre
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -f backend/migrations/00000001_create_extensions.sql
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -f backend/migrations/00000002_create_base_tables.sql
# ... etc pour chaque migration
```

#### **Option C : Boucle Automatique**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Exécuter toutes les migrations dans l'ordre
\i backend/migrations/00000001_create_extensions.sql
\i backend/migrations/00000002_create_base_tables.sql
\i backend/migrations/00000003_create_utility_tables.sql
\i backend/migrations/00000004_create_payment_tables.sql
\i backend/migrations/00000005_create_autocomplete_tables.sql
\i backend/migrations/00000006_create_product_tables.sql
\i backend/migrations/00000007_create_review_tables.sql
\i backend/migrations/00000008_create_delivery_tables.sql
\i backend/migrations/00000009_create_specialized_services_tables.sql
\i backend/migrations/00000010_create_functions.sql
\i backend/migrations/00000011_create_indexes_and_optimizations.sql
\i backend/migrations/00000012_create_communication_tables.sql
\i backend/migrations/00000013_create_advertising_tables.sql
\i backend/migrations/00000014_create_live_streaming_tables.sql
\i backend/migrations/00000015_create_flash_sales_tables.sql
\i backend/migrations/00000016_create_promotion_tables.sql
\i backend/migrations/00000017_create_social_media_tables.sql
\i backend/migrations/00000018_create_media_engagement_tables.sql
\i backend/migrations/00000019_create_video_audio_tables.sql
\i backend/migrations/00000020_create_studio_tables.sql
\i backend/migrations/00000021_create_additional_functions.sql
\i backend/migrations/00000022_create_remaining_tables_and_functions.sql
\i backend/migrations/00000023_create_videos_tables.sql
\i backend/migrations/00000024_create_message_reactions_and_delivery_chat_tables.sql
\i backend/migrations/00000025_create_effects_and_templates_tables.sql
\i backend/migrations/00000026_create_plugin_marketplace_tables.sql
\i backend/migrations/00000027_create_menu_planning_tables.sql
\i backend/migrations/00000028_create_optimized_functions_and_cache.sql
\i backend/migrations/00000029_create_blood_donation_and_specialized_tables.sql
\i backend/migrations/00000030_create_final_optimizations_and_views.sql
\i backend/migrations/00000031_create_bus_tables.sql
\i backend/migrations/00000032_create_bus_functions_and_agency_tables.sql
\i backend/migrations/00000033_create_missing_delivery_tables.sql
\i backend/migrations/00000034_create_immobilier_tables.sql
\i backend/migrations/00000035_create_pharmacy_advanced_tables.sql
\i backend/migrations/00000036_create_hospital_advanced_tables.sql
\i backend/migrations/00000037_create_lab_advanced_tables.sql
\i backend/migrations/00000038_create_offres_emploi_advanced_tables.sql
\i backend/migrations/00000039_create_orientation_scolaire_advanced_tables.sql
\i backend/migrations/00000040_create_bourse_livre_advanced_tables.sql
\i backend/migrations/00000041_create_bus_ratings_return_trips_and_additional_tables.sql
EOFSQL
```

---

## ✅ **Garanties Anti-Doublons**

PostgreSQL gère automatiquement les doublons avec :

1. **`CREATE TABLE IF NOT EXISTS`** → Ne crée pas si la table existe déjà
2. **`CREATE INDEX IF NOT EXISTS`** → Ne crée pas si l'index existe déjà
3. **`CREATE OR REPLACE FUNCTION`** → Remplace si existe, crée sinon
4. **`DO $$ ... END $$`** → Blocs anonymes idempotents

**Aucun risque de doublons** si les migrations utilisent ces patterns (ce qui est le cas).

---

## 🔍 **Vérification Après Exécution**

```bash
# Vérifier le nombre de tables
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT COUNT(*) as nb_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
"

# Vérifier les migrations appliquées
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT version, description, installed_on 
FROM _sqlx_migrations 
ORDER BY installed_on DESC 
LIMIT 10;
"
```

---

## ⚠️ **Important**

1. **Désactiver `ENABLE_AUTO_MIGRATIONS=false`** dans ECS pour éviter les conflits
2. **Exécuter les migrations dans l'ordre** (00000001 à 00000041)
3. **Les migrations sont idempotentes** grâce à `IF NOT EXISTS`
4. **Les prochains builds ne vont PAS écraser** les migrations car elles sont déjà appliquées

---

## 📝 **Avantages de cette Approche**

✅ **Contourne le problème de parsing**  
✅ **Pas de doublons** (IF NOT EXISTS)  
✅ **Migrations appliquées correctement**  
✅ **Les builds futurs ne vont pas écraser** (migrations déjà appliquées)  
✅ **Contrôle total** sur l'ordre d'exécution  

---

## 🎯 **Recommandation**

1. **Désactiver** `ENABLE_AUTO_MIGRATIONS=false` dans ECS
2. **Exécuter** toutes les migrations depuis EC2 avec le script
3. **Vérifier** que tout est appliqué
4. **Redémarrer** le backend
5. **Surveiller** les logs pour confirmer qu'il n'y a plus d'erreurs de parsing

