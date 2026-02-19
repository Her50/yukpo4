-- Correction des colonnes manquantes identifiées dans log 54

-- 1. Ajouter status à global_promo_events si manquant
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
    ELSE
        RAISE NOTICE 'ℹ️ Colonne status existe déjà dans global_promo_events';
    END IF;
END $$;

-- 2. Ajouter attempt à social_publication_jobs si manquant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'attempt'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ Colonne attempt ajoutée à social_publication_jobs';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne attempt existe déjà dans social_publication_jobs';
    END IF;
END $$;

-- Vérification
SELECT 
    'global_promo_events.status' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'status'
    ) as existe
UNION ALL
SELECT 
    'social_publication_jobs.attempt' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'attempt'
    ) as existe;



