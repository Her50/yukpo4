-- Script pour corriger les nouvelles erreurs identifiées dans log 51
-- À exécuter sur la base de données PostgreSQL

-- 1. Vérifier et renommer promo_event_id → event_id dans global_promo_entries
DO $$
BEGIN
    -- Vérifier quelle colonne existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'promo_event_id'
    ) THEN
        -- Renommer promo_event_id en event_id
        ALTER TABLE global_promo_entries RENAME COLUMN promo_event_id TO event_id;
        RAISE NOTICE '✅ promo_event_id renommé en event_id';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'event_id'
    ) THEN
        RAISE NOTICE 'ℹ️ event_id existe déjà';
    ELSE
        -- Créer event_id si aucune des deux n'existe
        ALTER TABLE global_promo_entries ADD COLUMN event_id UUID;
        RAISE NOTICE '✅ event_id créé';
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
        RAISE NOTICE '✅ stock_target ajouté à live_flash_sales';
    ELSE
        RAISE NOTICE 'ℹ️ stock_target existe déjà dans live_flash_sales';
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
        RAISE NOTICE '✅ payload ajouté à social_publication_jobs';
    ELSE
        RAISE NOTICE 'ℹ️ payload existe déjà dans social_publication_jobs';
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


