# 🔧 Correction Finale Définitive - EC2

## ⚠️ Problème

Les tables existent déjà avec l'ancienne structure. `CREATE TABLE IF NOT EXISTS` ne les modifie pas.

## ✅ Solution : Ajouter les Colonnes Manquantes

Exécutez cette commande sur EC2 pour ajouter toutes les colonnes manquantes :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Correction définitive : Ajouter toutes les colonnes manquantes

-- 1. global_promo_entries : submitted_by_user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'submitted_by_user_id'
    ) THEN
        ALTER TABLE global_promo_entries
        ADD COLUMN submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ submitted_by_user_id ajouté à global_promo_entries';
    END IF;
END $$;

-- 2. global_promo_entries : event_id (si promo_event_id existe, le renommer)
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

-- 3. live_flash_sales : metadata
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
        RAISE NOTICE '✅ metadata ajouté à live_flash_sales';
    END IF;
END $$;

-- 4. live_flash_sales : stock_target
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN stock_target INTEGER NOT NULL DEFAULT 0 CHECK (stock_target >= 0);
        RAISE NOTICE '✅ stock_target ajouté à live_flash_sales';
    END IF;
END $$;

-- 5. social_publication_jobs : status (renommer job_status si existe)
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

-- 6. social_publication_jobs : payload
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

-- 7. social_publication_jobs : media_id et platform (si publication_id existe)
DO $$
BEGIN
    -- Vérifier si la table utilise publication_id (ancienne structure)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'publication_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'media_id'
    ) THEN
        -- Ajouter media_id et platform
        ALTER TABLE social_publication_jobs
        ADD COLUMN media_id INTEGER REFERENCES media(id) ON DELETE CASCADE;
        ALTER TABLE social_publication_jobs
        ADD COLUMN platform TEXT;
        
        -- Migrer les données depuis social_publications si possible
        UPDATE social_publication_jobs spj
        SET media_id = sp.media_id,
            platform = sp.platform
        FROM social_publications sp
        WHERE spj.publication_id = sp.id
        AND sp.media_id IS NOT NULL;
        
        RAISE NOTICE '✅ media_id et platform ajoutés (migration depuis publication_id)';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'media_id'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ media_id ajouté';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'platform'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE '✅ platform ajouté';
    END IF;
END $$;

-- Vérification finale
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
UNION ALL
SELECT 'social_publication_jobs.media_id', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'media_id')
UNION ALL
SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform')
ORDER BY colonne;
EOFSQL
```

---

## 📊 Après Exécution

Toutes les colonnes manquantes seront ajoutées. Les erreurs devraient disparaître au prochain redémarrage du backend.

