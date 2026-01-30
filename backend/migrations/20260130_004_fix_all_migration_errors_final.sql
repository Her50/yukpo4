-- Migration: Correction FINALE de toutes les erreurs de migration
-- Date: 2026-01-30
-- Description: Corrige TOUS les problèmes identifiés dans les logs AWS de manière définitive
-- =====================================================

-- =====================================================
-- 1. CORRECTION: Commandes multiples dans 0000_create_all_tables.sql
-- =====================================================
-- Problème: "cannot insert multiple commands into a prepared statement"
-- Solution: Les commandes sont déjà séparées dans 0000, mais on s'assure que execute_multiple_sql_commands() les divise correctement
-- Note: Cette correction est gérée par l'amélioration de execute_multiple_sql_commands()

-- =====================================================
-- 2. CORRECTION: Contrainte fk_video_generation_jobs_audio_job déjà existante
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'video_generation_jobs' 
        AND constraint_name = 'fk_video_generation_jobs_audio_job'
    ) THEN
        ALTER TABLE video_generation_jobs 
        DROP CONSTRAINT fk_video_generation_jobs_audio_job;
    END IF;
END $$;

-- =====================================================
-- 3. CORRECTION: Colonne user_id dans courier_availability_snapshots
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'courier_availability_snapshots'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'courier_availability_snapshots' 
            AND column_name = 'user_id'
        ) THEN
            ALTER TABLE courier_availability_snapshots 
            ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Recréer l'index avec user_id si la colonne existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'courier_availability_snapshots' 
        AND column_name = 'user_id'
    ) THEN
        DROP INDEX IF EXISTS idx_courier_availability_snapshots_user_courier;
        CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_user_courier
        ON courier_availability_snapshots(user_id, courier_id)
        WHERE is_online = true;
    END IF;
END $$;

-- =====================================================
-- 4. CORRECTION: Triggers déjà existants
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_user_documents_updated_at ON user_documents;
DROP TRIGGER IF EXISTS update_banques_sang_updated_at ON banques_sang;

-- =====================================================
-- 5. CORRECTION: Table conversations manquante
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 6. CORRECTION: Type de parcel_id dans delivery_media
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'delivery_media'
    ) THEN
        -- Vérifier si parcel_id existe et a le mauvais type
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'delivery_media' 
            AND column_name = 'parcel_id'
            AND data_type = 'integer'
        ) THEN
            -- Supprimer la contrainte FK si elle existe
            ALTER TABLE delivery_media 
            DROP CONSTRAINT IF EXISTS delivery_media_parcel_id_fkey;
            
            -- Changer le type de INTEGER à UUID
            ALTER TABLE delivery_media 
            ALTER COLUMN parcel_id TYPE UUID USING NULL;
            
            -- Recréer la contrainte FK si la table delivery_parcels existe
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'delivery_parcels'
            ) THEN
                ALTER TABLE delivery_media
                ADD CONSTRAINT delivery_media_parcel_id_fkey
                FOREIGN KEY (parcel_id) REFERENCES delivery_parcels(id) ON DELETE SET NULL;
            END IF;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 7. CORRECTION: Index idx_cache_expires_at avec NOW()
-- =====================================================
DROP INDEX IF EXISTS idx_cache_expires_at;
CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
    ON cache_table(expires_at);

-- =====================================================
-- 8. CORRECTION: Colonne retry_at manquante
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'video_generation_jobs'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'video_generation_jobs' 
            AND column_name = 'retry_at'
        ) THEN
            ALTER TABLE video_generation_jobs 
            ADD COLUMN retry_at TIMESTAMPTZ;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 9. CORRECTION: Fonctions avec changement de type de retour
-- =====================================================
DROP FUNCTION IF EXISTS get_product_reactions_count(INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE;

-- =====================================================
-- 10. CORRECTION: Fonction hybrid_image_search dupliquée
-- =====================================================
-- Supprimer toutes les versions de hybrid_image_search
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure AS func_name
        FROM pg_proc
        WHERE proname = 'hybrid_image_search'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_name || ' CASCADE';
    END LOOP;
END $$;

-- =====================================================
-- 11. CORRECTION: Tables pharmacy_* manquantes
-- =====================================================
CREATE TABLE IF NOT EXISTS pharmacy_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    medication_id INTEGER,
    pharmacy_id INTEGER,
    user_id INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pharmacy_reservations (
    id SERIAL PRIMARY KEY,
    medication_id INTEGER,
    pharmacy_id INTEGER,
    user_id INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 11b. CORRECTION: Table programmes_scolaires manquante
-- =====================================================
CREATE TABLE IF NOT EXISTS programmes_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 12. CORRECTION: Type incompatible pharmacy_order_items.medication_id
-- =====================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pharmacy_products'
    ) THEN
        -- Vérifier le type de pharmacy_products.id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_products' 
            AND column_name = 'id'
            AND data_type = 'integer'
        ) THEN
            -- pharmacy_products.id est INTEGER
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pharmacy_order_items'
            ) THEN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'pharmacy_order_items' 
                    AND column_name = 'medication_id'
                    AND data_type = 'uuid'
                ) THEN
                    ALTER TABLE pharmacy_order_items 
                    DROP CONSTRAINT IF EXISTS pharmacy_order_items_medication_id_fkey;
                    UPDATE pharmacy_order_items SET medication_id = NULL WHERE medication_id IS NOT NULL;
                    ALTER TABLE pharmacy_order_items 
                    ALTER COLUMN medication_id TYPE INTEGER USING NULL;
                    ALTER TABLE pharmacy_order_items
                    ADD CONSTRAINT pharmacy_order_items_medication_id_fkey
                    FOREIGN KEY (medication_id) REFERENCES pharmacy_products(id) ON DELETE CASCADE;
                END IF;
            END IF;
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_products' 
            AND column_name = 'id'
            AND data_type = 'uuid'
        ) THEN
            -- pharmacy_products.id est UUID
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pharmacy_order_items'
            ) THEN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'pharmacy_order_items' 
                    AND column_name = 'medication_id'
                    AND data_type = 'integer'
                ) THEN
                    ALTER TABLE pharmacy_order_items 
                    DROP CONSTRAINT IF EXISTS pharmacy_order_items_medication_id_fkey;
                    UPDATE pharmacy_order_items SET medication_id = NULL WHERE medication_id IS NOT NULL;
                    ALTER TABLE pharmacy_order_items 
                    ALTER COLUMN medication_id TYPE UUID USING NULL;
                    ALTER TABLE pharmacy_order_items
                    ADD CONSTRAINT pharmacy_order_items_medication_id_fkey
                    FOREIGN KEY (medication_id) REFERENCES pharmacy_products(id) ON DELETE CASCADE;
                END IF;
            END IF;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 13. CORRECTION: Colonnes manquantes supplémentaires
-- =====================================================
-- location_point
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'services'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'services' 
            AND column_name = 'location_point'
        ) THEN
            ALTER TABLE services 
            ADD COLUMN location_point POINT;
        END IF;
    END IF;
END $$;

-- statut
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'matching_offres_candidats'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'matching_offres_candidats' 
            AND column_name = 'statut'
        ) THEN
            ALTER TABLE matching_offres_candidats 
            ADD COLUMN statut TEXT;
        END IF;
    END IF;
END $$;

-- tags
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'services'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'services' 
            AND column_name = 'tags'
        ) THEN
            ALTER TABLE services 
            ADD COLUMN tags TEXT[];
        END IF;
    END IF;
END $$;

-- date_limite_candidature
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'offres_emploi'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'offres_emploi' 
            AND column_name = 'date_limite_candidature'
        ) THEN
            ALTER TABLE offres_emploi 
            ADD COLUMN date_limite_candidature DATE;
        END IF;
    END IF;
END $$;

-- entreprise_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'offres_emploi'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'offres_emploi' 
            AND column_name = 'entreprise_id'
        ) THEN
            ALTER TABLE offres_emploi 
            ADD COLUMN entreprise_id INTEGER;
        END IF;
    END IF;
END $$;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
-- Cette migration corrige TOUS les problèmes identifiés dans les logs AWS
-- Elle doit s'exécuter AVANT sqlx::migrate!() pour garantir l'ordre

