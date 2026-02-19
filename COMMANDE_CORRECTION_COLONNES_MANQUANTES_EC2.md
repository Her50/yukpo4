# 🔧 Commande de Correction des Colonnes Manquantes - EC2

## ⚠️ **Erreurs Identifiées dans les Logs**

D'après l'analyse des logs (44, 46, 47), les colonnes suivantes sont manquantes :

1. ❌ `live_flash_sales.scheduled_notification_sent_at`
2. ❌ `global_promo_events.status`
3. ❌ `social_publication_jobs.media_id`
4. ❌ `delivery_proximity_suggestions.auto_confirm_after_seconds`
5. ❌ `delivery_proximity_suggestions.status`

---

## ✅ **Commande de Correction Complète**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. live_flash_sales.scheduled_notification_sent_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales'
        AND column_name = 'scheduled_notification_sent_at'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN scheduled_notification_sent_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. global_promo_events.status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE global_promo_events
        ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'live', 'archived'));
        
        UPDATE global_promo_events
        SET status = 'draft'
        WHERE status IS NULL;
    END IF;
END $$;

-- 3. social_publication_jobs.media_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'social_publication_jobs'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs'
        AND column_name = 'media_id'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN media_id INTEGER REFERENCES media(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. delivery_proximity_suggestions.auto_confirm_after_seconds
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'delivery_proximity_suggestions'
        AND column_name = 'auto_confirm_after_seconds'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions
        ADD COLUMN auto_confirm_after_seconds INTEGER;
    END IF;
END $$;

-- 5. delivery_proximity_suggestions.status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'delivery_proximity_suggestions'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions
        ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'auto_confirmed', 'cancelled'));
        
        UPDATE delivery_proximity_suggestions
        SET status = 'pending'
        WHERE status IS NULL;
    END IF;
END $$;

-- Vérification finale
SELECT 
    'live_flash_sales.scheduled_notification_sent_at' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'scheduled_notification_sent_at') as existe
UNION ALL
SELECT 'global_promo_events.status', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'status')
UNION ALL
SELECT 'social_publication_jobs.media_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'media_id')
UNION ALL
SELECT 'delivery_proximity_suggestions.auto_confirm_after_seconds', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_proximity_suggestions' AND column_name = 'auto_confirm_after_seconds')
UNION ALL
SELECT 'delivery_proximity_suggestions.status', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_proximity_suggestions' AND column_name = 'status');
EOFSQL
```

---

## 📊 **Résumé des Erreurs**

### **Erreurs Récurrentes dans les Logs**

1. **Erreurs de parsing SQL** : Beaucoup de "syntax error at end of input"
   - Les CREATE TABLE sont toujours tronquées
   - Le parsing SQL dans `auto_migrate.rs` doit être amélioré

2. **Colonnes manquantes** :
   - `live_flash_sales.scheduled_notification_sent_at` ❌
   - `global_promo_events.status` ❌
   - `social_publication_jobs.media_id` ❌
   - `delivery_proximity_suggestions.auto_confirm_after_seconds` ❌
   - `delivery_proximity_suggestions.status` ❌

3. **Erreur de route Axum** : 
   - Conflit `/api/navigation/destinations/{id}` vs `/api/navigation/destinations/{label}`
   - La correction n'a pas été déployée

4. **Erreurs Redis** : Timeouts de connexion (problème d'infrastructure)

---

## 🎯 **Actions Requises**

1. ✅ Exécuter le script de correction des colonnes manquantes
2. ⚠️ Améliorer le parsing SQL dans `auto_migrate.rs` (toujours des CREATE TABLE tronquées)
3. ⚠️ Redéployer la correction de route Axum
4. ⚠️ Vérifier la configuration Redis

---

## 📝 **Note**

Le problème de parsing SQL persiste. Les CREATE TABLE sont toujours tronquées, ce qui empêche la création correcte des tables. Il faut continuer à améliorer la logique de parsing dans `auto_migrate.rs`.



