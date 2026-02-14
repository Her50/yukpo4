-- Script pour corriger les colonnes manquantes identifiées dans les logs
-- À exécuter sur la base de données PostgreSQL

-- 1. Vérifier et ajouter display_name à global_promo_events si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_events' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE global_promo_events 
        ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
        
        -- Mettre à jour les valeurs existantes si nécessaire
        UPDATE global_promo_events 
        SET display_name = COALESCE(theme, slug, 'Event') 
        WHERE display_name = '';
    END IF;
END $$;

-- 2. Vérifier et ajouter promo_price_cfa à live_flash_sales si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_flash_sales' 
        AND column_name = 'promo_price_cfa'
    ) THEN
        ALTER TABLE live_flash_sales 
        ADD COLUMN promo_price_cfa NUMERIC(14,2) NOT NULL DEFAULT 0 
        CHECK (promo_price_cfa >= 0);
    END IF;
END $$;

-- 3. Vérifier et ajouter suggested_status à delivery_proximity_suggestions si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_proximity_suggestions' 
        AND column_name = 'suggested_status'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions 
        ADD COLUMN suggested_status TEXT;
    END IF;
END $$;

-- 4. Vérifier et ajouter awaiting_courier_confirmation à l'enum delivery_status si manquante
DO $$
BEGIN
    -- Vérifier si la valeur existe dans l'enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'awaiting_courier_confirmation' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        -- Ajouter la valeur à l'enum
        ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'awaiting_courier_confirmation';
    END IF;
END $$;

-- 5. Vérifier que la table live_flash_sales existe et a toutes les colonnes nécessaires
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'live_flash_sales'
    ) THEN
        RAISE NOTICE 'Table live_flash_sales n''existe pas. Création nécessaire via migrations.';
    END IF;
END $$;

-- 6. Vérifier que la table global_promo_events existe et a toutes les colonnes nécessaires
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'global_promo_events'
    ) THEN
        RAISE NOTICE 'Table global_promo_events n''existe pas. Création nécessaire via migrations.';
    END IF;
END $$;

-- 7. Vérifier que la table delivery_proximity_suggestions existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'delivery_proximity_suggestions'
    ) THEN
        RAISE NOTICE 'Table delivery_proximity_suggestions n''existe pas. Création nécessaire via migrations.';
    END IF;
END $$;

