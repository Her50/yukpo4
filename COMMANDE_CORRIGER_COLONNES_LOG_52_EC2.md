# 🔧 Commande de Correction - Colonnes Manquantes Log 52

## ✅ Commande à Exécuter sur EC2

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Correction complète des colonnes manquantes identifiées dans log 52

-- 1. global_promo_entries : event_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'promo_event_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'event_id'
    ) THEN
        ALTER TABLE global_promo_entries RENAME COLUMN promo_event_id TO event_id;
        RAISE NOTICE '✅ promo_event_id renommé en event_id';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'event_id'
    ) THEN
        ALTER TABLE global_promo_entries ADD COLUMN event_id UUID REFERENCES global_promo_events(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ event_id ajouté';
    END IF;
END $$;

-- 2. global_promo_entries : submitted_by_user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'submitted_by_user_id'
    ) THEN
        ALTER TABLE global_promo_entries
        ADD COLUMN submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ submitted_by_user_id ajouté';
    END IF;
END $$;

-- 3. live_flash_sales : stock_target
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN stock_target INTEGER NOT NULL DEFAULT 0 CHECK (stock_target >= 0);
        RAISE NOTICE '✅ stock_target ajouté';
    END IF;
END $$;

-- 4. live_flash_sales : metadata
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
        RAISE NOTICE '✅ metadata ajouté';
    END IF;
END $$;

-- 5. social_publication_jobs : payload
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'payload'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb;
        RAISE NOTICE '✅ payload ajouté';
    END IF;
END $$;

-- 6. social_publication_jobs : status
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'job_status'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'status'
    ) THEN
        ALTER TABLE social_publication_jobs RENAME COLUMN job_status TO status;
        RAISE NOTICE '✅ job_status renommé en status';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'status'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN status TEXT NOT NULL DEFAULT 'queued';
        RAISE NOTICE '✅ status ajouté';
    END IF;
END $$;

-- Vérification
SELECT
    'global_promo_entries.event_id' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'event_id') as existe
UNION ALL
SELECT 'global_promo_entries.submitted_by_user_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'submitted_by_user_id')
UNION ALL
SELECT 'live_flash_sales.stock_target', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target')
UNION ALL
SELECT 'live_flash_sales.metadata', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'metadata')
UNION ALL
SELECT 'social_publication_jobs.payload', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'payload')
UNION ALL
SELECT 'social_publication_jobs.status', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'status')
ORDER BY colonne;
EOFSQL
```

---

## 📊 Résumé des Corrections

1. ✅ `global_promo_entries.event_id` - Renommage ou ajout
2. ✅ `global_promo_entries.submitted_by_user_id` - Ajout
3. ✅ `live_flash_sales.stock_target` - Ajout
4. ✅ `live_flash_sales.metadata` - Ajout
5. ✅ `social_publication_jobs.payload` - Ajout
6. ✅ `social_publication_jobs.status` - Renommage ou ajout

---

## ⚠️ Note sur Redis

Les erreurs Redis persistent. Vérifiez que :
1. Le `REDIS_URL` dans Secrets Manager utilise bien `rediss://` (avec deux 's')
2. Les Security Groups permettent la connexion depuis ECS vers ElastiCache
3. Le endpoint Redis est correct


