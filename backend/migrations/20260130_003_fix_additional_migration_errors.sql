-- Migration: Correction des erreurs supplémentaires identifiées dans les logs AWS
-- Date: 2026-01-30
-- Description: Corrige les problèmes restants identifiés dans log-events-viewer-result (1).csv
-- =====================================================

-- =====================================================
-- 1. CORRECTION: Fonction get_product_reactions_count
-- =====================================================
-- Problème: "cannot change return type of existing function"
--          "Row type defined by OUT parameters is different"
-- Solution: DROP la fonction avant de la recréer
DROP FUNCTION IF EXISTS get_product_reactions_count(INTEGER, TEXT) CASCADE;

-- La fonction sera recréée par les migrations suivantes avec le bon type de retour

-- =====================================================
-- 2. CORRECTION: Fonction cleanup_expired_cache
-- =====================================================
-- Problème: "cannot change return type of existing function"
-- Solution: DROP la fonction avant de la recréer
DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE;

-- La fonction sera recréée par les migrations suivantes

-- =====================================================
-- 3. CORRECTION: Index idx_cache_expires_at avec NOW()
-- =====================================================
-- Problème: "functions in index predicate must be marked IMMUTABLE"
--          NOW() n'est pas IMMUTABLE
-- Solution: Supprimer l'index partiel ou utiliser une fonction IMMUTABLE
-- Note: L'index partiel avec NOW() n'est pas possible, on le supprime
DROP INDEX IF EXISTS idx_cache_expires_at;

-- Recréer l'index sans prédicat (ou avec un prédicat IMMUTABLE si nécessaire)
CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
    ON cache_table(expires_at);

-- =====================================================
-- 4. CORRECTION: Colonne user_id dans courier_availability_snapshots
-- =====================================================
-- Problème: "column user_id does not exist"
-- Solution: Ajouter la colonne si elle n'existe pas
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

-- Recréer l'index avec user_id si la colonne existe maintenant
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
-- 5. CORRECTION: Type incompatible pharmacy_order_items.medication_id
-- =====================================================
-- Problème: "foreign key constraint pharmacy_order_items_medication_id_fkey cannot be implemented"
--          "Key columns medication_id and id are of incompatible types: uuid and integer"
-- Solution: Vérifier et corriger le type selon la définition de pharmacy_products.id
DO $$
BEGIN
    -- Vérifier le type de pharmacy_products.id
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pharmacy_products'
    ) THEN
        -- Vérifier si pharmacy_products.id est INTEGER ou UUID
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_products' 
            AND column_name = 'id'
            AND data_type = 'integer'
        ) THEN
            -- pharmacy_products.id est INTEGER, donc medication_id doit être INTEGER
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pharmacy_order_items'
            ) THEN
                -- Vérifier si medication_id existe et a le mauvais type
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'pharmacy_order_items' 
                    AND column_name = 'medication_id'
                    AND data_type = 'uuid'
                ) THEN
                    -- Supprimer la contrainte FK si elle existe
                    ALTER TABLE pharmacy_order_items 
                    DROP CONSTRAINT IF EXISTS pharmacy_order_items_medication_id_fkey;
                    
                    -- Convertir UUID en INTEGER (en supprimant les valeurs existantes car conversion impossible)
                    -- Note: Cette conversion est destructive, donc on vide la colonne d'abord
                    UPDATE pharmacy_order_items SET medication_id = NULL WHERE medication_id IS NOT NULL;
                    
                    -- Changer le type
                    ALTER TABLE pharmacy_order_items 
                    ALTER COLUMN medication_id TYPE INTEGER USING NULL;
                    
                    -- Recréer la contrainte FK
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
            -- pharmacy_products.id est UUID, donc medication_id doit être UUID
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'pharmacy_order_items'
            ) THEN
                -- Vérifier si medication_id existe et a le mauvais type
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'pharmacy_order_items' 
                    AND column_name = 'medication_id'
                    AND data_type = 'integer'
                ) THEN
                    -- Supprimer la contrainte FK si elle existe
                    ALTER TABLE pharmacy_order_items 
                    DROP CONSTRAINT IF EXISTS pharmacy_order_items_medication_id_fkey;
                    
                    -- Convertir INTEGER en UUID (en supprimant les valeurs existantes car conversion impossible)
                    UPDATE pharmacy_order_items SET medication_id = NULL WHERE medication_id IS NOT NULL;
                    
                    -- Changer le type
                    ALTER TABLE pharmacy_order_items 
                    ALTER COLUMN medication_id TYPE UUID USING NULL;
                    
                    -- Recréer la contrainte FK
                    ALTER TABLE pharmacy_order_items
                    ADD CONSTRAINT pharmacy_order_items_medication_id_fkey
                    FOREIGN KEY (medication_id) REFERENCES pharmacy_products(id) ON DELETE CASCADE;
                END IF;
            END IF;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 6. CORRECTION: Contrainte fk_video_generation_jobs_audio_job déjà existante
-- =====================================================
-- Problème: "constraint fk_video_generation_jobs_audio_job already exists"
-- Solution: Supprimer la contrainte avant de la recréer
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
-- 7. CORRECTION: Trigger trigger_update_user_documents_updated_at déjà existant
-- =====================================================
-- Problème: "trigger trigger_update_user_documents_updated_at already exists"
-- Solution: DROP le trigger avant de le recréer (déjà géré dans les migrations, mais on s'assure)
DROP TRIGGER IF EXISTS trigger_update_user_documents_updated_at ON user_documents;

-- =====================================================
-- 8. CORRECTION: Commandes multiples dans les migrations
-- =====================================================
-- Problème: "cannot insert multiple commands into a prepared statement"
-- Solution: Les migrations doivent être divisées en commandes individuelles
-- Note: Cette correction est gérée par execute_multiple_sql_commands() améliorée
-- Cette section sert de rappel pour les futures migrations

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
-- Cette migration corrige les erreurs supplémentaires identifiées dans les logs AWS
-- Les fonctions seront recréées par les migrations suivantes avec les bons types

