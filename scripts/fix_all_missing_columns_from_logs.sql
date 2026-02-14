-- =====================================================
-- Script de Correction de Toutes les Colonnes Manquantes
-- Date: 2026-02-14
-- Basé sur l'analyse des logs (44, 46, 47)
-- =====================================================

-- =====================================================
-- 1. live_flash_sales.scheduled_notification_sent_at
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales'
        AND column_name = 'scheduled_notification_sent_at'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN scheduled_notification_sent_at TIMESTAMPTZ;
        
        RAISE NOTICE '✅ Colonne scheduled_notification_sent_at ajoutée à live_flash_sales';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne scheduled_notification_sent_at existe déjà dans live_flash_sales';
    END IF;
END $$;

-- =====================================================
-- 2. global_promo_events.status
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE global_promo_events
        ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'live', 'archived'));
        
        -- Mettre à jour les valeurs existantes
        UPDATE global_promo_events
        SET status = 'draft'
        WHERE status IS NULL;
        
        RAISE NOTICE '✅ Colonne status ajoutée à global_promo_events';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne status existe déjà dans global_promo_events';
    END IF;
END $$;

-- =====================================================
-- 3. social_publication_jobs.media_id
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs'
        AND column_name = 'media_id'
    ) THEN
        -- Vérifier si la table existe
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'social_publication_jobs'
        ) THEN
            ALTER TABLE social_publication_jobs
            ADD COLUMN media_id INTEGER REFERENCES media(id) ON DELETE CASCADE;
            
            RAISE NOTICE '✅ Colonne media_id ajoutée à social_publication_jobs';
        ELSE
            RAISE NOTICE '⚠️ Table social_publication_jobs n''existe pas';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️ Colonne media_id existe déjà dans social_publication_jobs';
    END IF;
END $$;

-- =====================================================
-- 4. delivery_proximity_suggestions.auto_confirm_after_seconds
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'delivery_proximity_suggestions'
        AND column_name = 'auto_confirm_after_seconds'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions
        ADD COLUMN auto_confirm_after_seconds INTEGER;
        
        RAISE NOTICE '✅ Colonne auto_confirm_after_seconds ajoutée à delivery_proximity_suggestions';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne auto_confirm_after_seconds existe déjà dans delivery_proximity_suggestions';
    END IF;
END $$;

-- =====================================================
-- 5. delivery_proximity_suggestions.status
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'delivery_proximity_suggestions'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions
        ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'auto_confirmed', 'cancelled'));
        
        -- Mettre à jour les valeurs existantes
        UPDATE delivery_proximity_suggestions
        SET status = 'pending'
        WHERE status IS NULL;
        
        RAISE NOTICE '✅ Colonne status ajoutée à delivery_proximity_suggestions';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne status existe déjà dans delivery_proximity_suggestions';
    END IF;
END $$;

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================
SELECT 
    'live_flash_sales.scheduled_notification_sent_at' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_flash_sales' 
        AND column_name = 'scheduled_notification_sent_at'
    ) as existe
UNION ALL
SELECT 
    'global_promo_events.status',
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_events' 
        AND column_name = 'status'
    )
UNION ALL
SELECT 
    'social_publication_jobs.media_id',
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'social_publication_jobs' 
        AND column_name = 'media_id'
    )
UNION ALL
SELECT 
    'delivery_proximity_suggestions.auto_confirm_after_seconds',
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_proximity_suggestions' 
        AND column_name = 'auto_confirm_after_seconds'
    )
UNION ALL
SELECT 
    'delivery_proximity_suggestions.status',
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_proximity_suggestions' 
        AND column_name = 'status'
    );

