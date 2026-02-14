# 🔍 Commande Simple de Vérification - EC2

## ✅ **Commande Complète (Copier-Coller)**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- ============================================
-- VÉRIFICATION COMPLÈTE DES COLONNES
-- ============================================

-- 1. product_delivery_config
\echo '=== product_delivery_config ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'product_delivery_config'
ORDER BY ordinal_position;

-- 2. courier_applications
\echo ''
\echo '=== courier_applications ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'courier_applications'
ORDER BY ordinal_position;

-- 3. couriers
\echo ''
\echo '=== couriers ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'couriers'
ORDER BY ordinal_position;

-- 4. courier_assets
\echo ''
\echo '=== courier_assets ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'courier_assets'
ORDER BY ordinal_position;

-- 5. media
\echo ''
\echo '=== media ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'media'
ORDER BY ordinal_position;

-- 6. media_engagement
\echo ''
\echo '=== media_engagement ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'media_engagement'
ORDER BY ordinal_position;

-- 7. media_distribution
\echo ''
\echo '=== media_distribution ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'media_distribution'
ORDER BY ordinal_position;

-- 8. delivery_media
\echo ''
\echo '=== delivery_media ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'delivery_media'
ORDER BY ordinal_position;

-- 9. delivery_proof_media
\echo ''
\echo '=== delivery_proof_media ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'delivery_proof_media'
ORDER BY ordinal_position;

-- ============================================
-- VÉRIFICATION COLONNES SPÉCIFIQUES
-- ============================================
\echo ''
\echo '=== Vérification Colonnes Spécifiques ==='
SELECT 
    'product_delivery_config.storage_location_id' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_delivery_config' 
        AND column_name = 'storage_location_id'
    ) as existe
UNION ALL
SELECT 
    'courier_applications.partner_id' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courier_applications' 
        AND column_name = 'partner_id'
    ) as existe
UNION ALL
SELECT 
    'courier_assets.vehicle_image_url' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courier_assets' 
        AND column_name = 'vehicle_image_url'
    ) as existe
UNION ALL
SELECT 
    'media.normalized_ai_tags' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' 
        AND column_name = 'normalized_ai_tags'
    ) as existe
UNION ALL
SELECT 
    'media.normalized_ai_description' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' 
        AND column_name = 'normalized_ai_description'
    ) as existe;
EOFSQL
```

---

## 📊 **Résumé Rapide**

Pour un résumé rapide du nombre de colonnes par table :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    table_name,
    COUNT(*) as nombre_colonnes
FROM information_schema.columns
WHERE table_name IN (
    'product_delivery_config',
    'courier_applications',
    'couriers',
    'courier_assets',
    'media',
    'media_engagement',
    'media_distribution',
    'delivery_media',
    'delivery_proof_media'
)
GROUP BY table_name
ORDER BY table_name;
"
```

---

## 📋 **Colonnes Attendues**

### **product_delivery_config** : ~21 colonnes
### **courier_applications** : ~13 colonnes (dont `partner_id`)
### **couriers** : ~10 colonnes
### **courier_assets** : ~13 colonnes (dont `vehicle_image_url`)
### **media** : ~20 colonnes (dont `normalized_ai_tags`, `normalized_ai_description`)
### **media_engagement** : ~9 colonnes
### **media_distribution** : ~8 colonnes
### **delivery_media** : ~19 colonnes
### **delivery_proof_media** : ~9 colonnes

