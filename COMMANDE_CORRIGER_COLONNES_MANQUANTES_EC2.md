# 🔧 Corriger les Colonnes Manquantes - Logs 48, 49, 50

## ✅ **Erreurs Identifiées**

1. **`global_promo_events.starts_at`** n'existe pas (le hint suggère `start_date`)
2. **`live_flash_sales.ending_notification_sent_at`** n'existe pas
3. **`social_publication_jobs.platform`** n'existe pas
4. **Erreurs Redis** (timeout de connexion) - problème séparé de configuration

---

## ✅ **Commande pour Corriger sur EC2**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. global_promo_events.starts_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'starts_at'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'global_promo_events'
            AND column_name = 'start_date'
        ) THEN
            ALTER TABLE global_promo_events
            RENAME COLUMN start_date TO starts_at;
            RAISE NOTICE '✅ Colonne start_date renommée en starts_at';
        ELSE
            ALTER TABLE global_promo_events
            ADD COLUMN starts_at TIMESTAMPTZ;
            
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_events'
                AND column_name = 'ends_at'
            ) THEN
                UPDATE global_promo_events
                SET starts_at = ends_at - INTERVAL '1 day'
                WHERE starts_at IS NULL;
            END IF;
            
            ALTER TABLE global_promo_events
            ALTER COLUMN starts_at SET NOT NULL;
            
            RAISE NOTICE '✅ Colonne starts_at ajoutée';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️ Colonne starts_at existe déjà';
    END IF;
END $$;

-- 2. live_flash_sales.ending_notification_sent_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales'
        AND column_name = 'ending_notification_sent_at'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN ending_notification_sent_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Colonne ending_notification_sent_at ajoutée';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne ending_notification_sent_at existe déjà';
    END IF;
END $$;

-- 3. social_publication_jobs.platform
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs'
        AND column_name = 'platform'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        
        UPDATE social_publication_jobs
        SET platform = 'unknown'
        WHERE platform IS NULL;
        
        RAISE NOTICE '✅ Colonne platform ajoutée';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne platform existe déjà';
    END IF;
END $$;

-- Vérification
SELECT 
    'global_promo_events.starts_at' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'starts_at') as existe
UNION ALL
SELECT 'live_flash_sales.ending_notification_sent_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at')
UNION ALL
SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform');
EOFSQL
```

---

## ✅ **Note sur les Erreurs Redis**

Les erreurs Redis (timeout) sont un problème de configuration séparé. Vérifiez :
- La configuration Redis dans Secrets Manager
- La connectivité réseau entre ECS et ElastiCache
- Les Security Groups

Les erreurs de colonnes manquantes sont plus critiques et doivent être corrigées en premier.



