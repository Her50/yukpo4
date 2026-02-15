-- Correction complète des colonnes manquantes identifiées dans log 52
-- Date: 2026-02-14

-- ============================================
-- 1. global_promo_entries : event_id
-- ============================================
-- Vérifier si promo_event_id existe et le renommer en event_id
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
        -- Si event_id n'existe pas du tout, l'ajouter
        ALTER TABLE global_promo_entries ADD COLUMN event_id UUID REFERENCES global_promo_events(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ event_id ajouté';
    ELSE
        RAISE NOTICE 'ℹ️ event_id existe déjà';
    END IF;
END $$;

-- ============================================
-- 2. global_promo_entries : submitted_by_user_id
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_entries' AND column_name = 'submitted_by_user_id'
    ) THEN
        ALTER TABLE global_promo_entries
        ADD COLUMN submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ submitted_by_user_id ajouté à global_promo_entries';
    ELSE
        RAISE NOTICE 'ℹ️ submitted_by_user_id existe déjà';
    END IF;
END $$;

-- ============================================
-- 3. live_flash_sales : stock_target
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN stock_target INTEGER NOT NULL DEFAULT 0 CHECK (stock_target >= 0);
        RAISE NOTICE '✅ stock_target ajouté à live_flash_sales';
    ELSE
        RAISE NOTICE 'ℹ️ stock_target existe déjà';
    END IF;
END $$;

-- ============================================
-- 4. live_flash_sales : metadata
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
        RAISE NOTICE '✅ metadata ajouté à live_flash_sales';
    ELSE
        RAISE NOTICE 'ℹ️ metadata existe déjà';
    END IF;
END $$;

-- ============================================
-- 5. social_publication_jobs : payload
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'payload'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb;
        RAISE NOTICE '✅ payload ajouté à social_publication_jobs';
    ELSE
        RAISE NOTICE 'ℹ️ payload existe déjà';
    END IF;
END $$;

-- ============================================
-- 6. social_publication_jobs : status
-- ============================================
-- Vérifier si job_status existe et le renommer en status, ou ajouter status
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
        RAISE NOTICE '✅ status ajouté à social_publication_jobs';
    ELSE
        RAISE NOTICE 'ℹ️ status existe déjà';
    END IF;
END $$;

-- ============================================
-- Vérification finale
-- ============================================
SELECT
    'global_promo_entries.event_id' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'event_id') as existe
UNION ALL
SELECT
    'global_promo_entries.submitted_by_user_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_entries' AND column_name = 'submitted_by_user_id')
UNION ALL
SELECT
    'live_flash_sales.stock_target',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target')
UNION ALL
SELECT
    'live_flash_sales.metadata',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'metadata')
UNION ALL
SELECT
    'social_publication_jobs.payload',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'payload')
UNION ALL
SELECT
    'social_publication_jobs.status',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'status')
ORDER BY colonne;


