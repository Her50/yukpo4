-- Script pour aligner toutes les tables existantes avec le code Rust
-- À exécuter UNE SEULE FOIS sur EC2 après avoir aligné les migrations SQL

-- ============================================================================
-- 1. global_promo_events : Ajouter les colonnes manquantes
-- ============================================================================

-- Ajouter slug si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'slug'
    ) THEN
        ALTER TABLE global_promo_events ADD COLUMN slug TEXT;
        -- Générer un slug unique pour les enregistrements existants
        UPDATE global_promo_events SET slug = 'event-' || id::text WHERE slug IS NULL;
        ALTER TABLE global_promo_events ALTER COLUMN slug SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_global_promo_events_slug_unique ON global_promo_events(slug);
        RAISE NOTICE '✅ Colonne slug ajoutée à global_promo_events';
    END IF;
END $$;

-- Ajouter theme si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'theme'
    ) THEN
        ALTER TABLE global_promo_events ADD COLUMN theme TEXT NOT NULL DEFAULT 'general';
        RAISE NOTICE '✅ Colonne theme ajoutée à global_promo_events';
    END IF;
END $$;

-- Ajouter display_name si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'display_name'
    ) THEN
        ALTER TABLE global_promo_events ADD COLUMN display_name TEXT NOT NULL DEFAULT 'Event';
        RAISE NOTICE '✅ Colonne display_name ajoutée à global_promo_events';
    END IF;
END $$;

-- Ajouter status si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'status'
    ) THEN
        ALTER TABLE global_promo_events
        ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'live', 'archived'));
        RAISE NOTICE '✅ Colonne status ajoutée à global_promo_events';
    END IF;
END $$;

-- Ajouter recurrence_rule si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'recurrence_rule'
    ) THEN
        ALTER TABLE global_promo_events ADD COLUMN recurrence_rule TEXT;
        RAISE NOTICE '✅ Colonne recurrence_rule ajoutée à global_promo_events';
    END IF;
END $$;

-- Ajouter config si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'config'
    ) THEN
        ALTER TABLE global_promo_events ADD COLUMN config JSONB NOT NULL DEFAULT '{}'::JSONB;
        RAISE NOTICE '✅ Colonne config ajoutée à global_promo_events';
    END IF;
END $$;

-- Ajouter created_by_user_id si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'created_by_user_id'
    ) THEN
        ALTER TABLE global_promo_events ADD COLUMN created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Colonne created_by_user_id ajoutée à global_promo_events';
    END IF;
END $$;

-- ============================================================================
-- 2. social_publication_jobs : Vérifier attempt
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'attempt'
    ) THEN
        ALTER TABLE social_publication_jobs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ Colonne attempt ajoutée à social_publication_jobs';
    END IF;
END $$;

-- ============================================================================
-- Vérification finale
-- ============================================================================

SELECT 
    'global_promo_events' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'global_promo_events'
    AND column_name IN ('slug', 'theme', 'display_name', 'status', 'recurrence_rule', 'config', 'created_by_user_id')
ORDER BY column_name;

SELECT 
    'social_publication_jobs' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'social_publication_jobs'
    AND column_name = 'attempt';


