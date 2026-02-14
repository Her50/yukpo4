# 🔧 Correction Finale - Renommage des Colonnes EC2

## ✅ **Commande Complète à Exécuter sur EC2**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. Renommer start_date → starts_at dans global_promo_events
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'start_date'
    ) THEN
        ALTER TABLE global_promo_events
        RENAME COLUMN start_date TO starts_at;
        RAISE NOTICE '✅ Colonne start_date renommée en starts_at';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'starts_at'
    ) THEN
        RAISE NOTICE 'ℹ️ Colonne starts_at existe déjà';
    ELSE
        ALTER TABLE global_promo_events
        ADD COLUMN starts_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Colonne starts_at créée';
    END IF;
END $$;

-- 2. Renommer end_date → ends_at dans global_promo_events
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'end_date'
    ) THEN
        ALTER TABLE global_promo_events
        RENAME COLUMN end_date TO ends_at;
        RAISE NOTICE '✅ Colonne end_date renommée en ends_at';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'ends_at'
    ) THEN
        RAISE NOTICE 'ℹ️ Colonne ends_at existe déjà';
    ELSE
        ALTER TABLE global_promo_events
        ADD COLUMN ends_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Colonne ends_at créée';
    END IF;
END $$;

-- 3. Ajouter ending_notification_sent_at à live_flash_sales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales'
        AND column_name = 'ending_notification_sent_at'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN ending_notification_sent_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Colonne ending_notification_sent_at ajoutée à live_flash_sales';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne ending_notification_sent_at existe déjà';
    END IF;
END $$;

-- 4. Ajouter platform à social_publication_jobs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs'
        AND column_name = 'platform'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE '✅ Colonne platform ajoutée à social_publication_jobs';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne platform existe déjà';
    END IF;
END $$;

-- Vérification finale
SELECT 
    'global_promo_events.starts_at' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'starts_at') as existe
UNION ALL
SELECT 'global_promo_events.ends_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'ends_at')
UNION ALL
SELECT 'live_flash_sales.ending_notification_sent_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at')
UNION ALL
SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform');
EOFSQL
```

---

## 📊 **Résultat Attendu**

```
NOTICE:  ✅ Colonne start_date renommée en starts_at
NOTICE:  ✅ Colonne end_date renommée en ends_at
NOTICE:  ✅ Colonne ending_notification_sent_at ajoutée à live_flash_sales
NOTICE:  ✅ Colonne platform ajoutée à social_publication_jobs

                          colonne                          | existe
-----------------------------------------------------------+--------
 global_promo_events.starts_at                             | t
 global_promo_events.ends_at                               | t
 live_flash_sales.ending_notification_sent_at              | t
 social_publication_jobs.platform                          | t
```

---

## ✅ **Après cette correction**

Les erreurs dans les logs devraient disparaître car :
1. ✅ `global_promo_events.starts_at` existera (renommé depuis `start_date`)
2. ✅ `live_flash_sales.ending_notification_sent_at` existera
3. ✅ `social_publication_jobs.platform` existera

