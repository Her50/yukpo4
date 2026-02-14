# 🔧 Corriger les Nouvelles Erreurs - Log 51

## ❌ **Erreurs Identifiées**

1. **`e.event_id` n'existe pas** dans `global_promo_entries` (probablement `promo_event_id`)
2. **`lfs.stock_target` n'existe pas** dans `live_flash_sales`
3. **`payload` n'existe pas** dans `social_publication_jobs`
4. **Redis timeout** (peut-être pas encore redémarré avec le nouveau secret)

---

## ✅ **Commande SQL pour EC2**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. Vérifier et renommer promo_event_id → event_id dans global_promo_entries
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'promo_event_id'
    ) THEN
        ALTER TABLE global_promo_entries RENAME COLUMN promo_event_id TO event_id;
        RAISE NOTICE 'promo_event_id renomme en event_id';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'event_id'
    ) THEN
        RAISE NOTICE 'event_id existe deja';
    ELSE
        ALTER TABLE global_promo_entries ADD COLUMN event_id UUID;
        RAISE NOTICE 'event_id cree';
    END IF;
END $$;

-- 2. Ajouter stock_target à live_flash_sales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target'
    ) THEN
        ALTER TABLE live_flash_sales ADD COLUMN stock_target INTEGER NOT NULL DEFAULT 100 CHECK (stock_target > 0);
        RAISE NOTICE 'stock_target ajoute a live_flash_sales';
    ELSE
        RAISE NOTICE 'stock_target existe deja dans live_flash_sales';
    END IF;
END $$;

-- 3. Ajouter payload à social_publication_jobs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'payload'
    ) THEN
        ALTER TABLE social_publication_jobs ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb;
        RAISE NOTICE 'payload ajoute a social_publication_jobs';
    ELSE
        RAISE NOTICE 'payload existe deja dans social_publication_jobs';
    END IF;
END $$;

-- Vérification finale
SELECT 
    'global_promo_entries.event_id' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'event_id') as existe
UNION ALL 
SELECT 'live_flash_sales.stock_target', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target')
UNION ALL 
SELECT 'social_publication_jobs.payload', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'payload');
EOFSQL
```

---

## ✅ **Note sur Redis**

Les erreurs Redis peuvent persister car :
1. Le service ECS vient de redémarrer (attendre 2-3 minutes)
2. Les Security Groups peuvent bloquer la connexion

Attendez 2-3 minutes puis vérifiez à nouveau. Si les erreurs Redis persistent, vérifiez les Security Groups.
