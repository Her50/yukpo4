-- Script pour corriger les colonnes manquantes identifiées dans les logs 48, 49, 50
-- À exécuter sur la base de données PostgreSQL

-- 1. global_promo_events.starts_at
-- Le hint suggère start_date, mais le code utilise starts_at
-- Vérifier d'abord quelle colonne existe
DO $$
BEGIN
    -- Vérifier si starts_at existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'starts_at'
    ) THEN
        -- Vérifier si start_date existe (peut-être créée avec un autre nom)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'global_promo_events'
            AND column_name = 'start_date'
        ) THEN
            -- Renommer start_date en starts_at
            ALTER TABLE global_promo_events
            RENAME COLUMN start_date TO starts_at;
            RAISE NOTICE '✅ Colonne start_date renommée en starts_at dans global_promo_events';
        ELSE
            -- Créer starts_at
            ALTER TABLE global_promo_events
            ADD COLUMN starts_at TIMESTAMPTZ;
            
            -- Si ends_at existe, utiliser sa valeur comme référence
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_events'
                AND column_name = 'ends_at'
            ) THEN
                UPDATE global_promo_events
                SET starts_at = ends_at - INTERVAL '1 day'
                WHERE starts_at IS NULL;
            END IF;
            
            -- Rendre NOT NULL si possible
            ALTER TABLE global_promo_events
            ALTER COLUMN starts_at SET NOT NULL;
            
            RAISE NOTICE '✅ Colonne starts_at ajoutée à global_promo_events';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️ Colonne starts_at existe déjà dans global_promo_events';
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
        RAISE NOTICE '✅ Colonne ending_notification_sent_at ajoutée à live_flash_sales';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne ending_notification_sent_at existe déjà dans live_flash_sales';
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
        
        -- Mettre à jour les valeurs existantes si nécessaire
        UPDATE social_publication_jobs
        SET platform = 'unknown'
        WHERE platform IS NULL;
        
        RAISE NOTICE '✅ Colonne platform ajoutée à social_publication_jobs';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne platform existe déjà dans social_publication_jobs';
    END IF;
END $$;

-- Vérification finale
SELECT 
    'global_promo_events.starts_at' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'starts_at') as existe
UNION ALL
SELECT 'live_flash_sales.ending_notification_sent_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at')
UNION ALL
SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform');


