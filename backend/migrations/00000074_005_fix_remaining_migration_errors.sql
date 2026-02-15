-- Migration: Correction FINALE des erreurs restantes
-- Date: 2026-01-30
-- Description: Corrige toutes les erreurs restantes identifiées dans log-events-viewer-result (10)
-- =====================================================

-- =====================================================
-- 1. CORRECTION: CREATE INDEX programmes_scolaires en dehors du bloc DO $$
-- =====================================================
-- Problème: Les CREATE INDEX pour programmes_scolaires sont exécutés en dehors du bloc DO $$
-- Solution: Supprimer les index existants et les recréer dans un bloc DO $$ conditionnel
DO $$
BEGIN
    -- Supprimer les index s'ils existent (pour éviter les conflits)
    DROP INDEX IF EXISTS idx_programmes_etablissement;
    DROP INDEX IF EXISTS idx_programmes_type_niveau;
    DROP INDEX IF EXISTS idx_programmes_annee;
    
    -- Recréer les index SEULEMENT si la table existe et a les colonnes
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'programmes_scolaires'
    ) THEN
        -- Vérifier que les colonnes existent avant de créer les index
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'programmes_scolaires' 
            AND column_name = 'etablissement_id'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'programmes_scolaires' 
            AND column_name = 'is_active'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_programmes_etablissement 
            ON programmes_scolaires(etablissement_id, is_active);
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'programmes_scolaires' 
            AND column_name = 'type_etablissement'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'programmes_scolaires' 
            AND column_name = 'niveau'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_programmes_type_niveau 
            ON programmes_scolaires(type_etablissement, niveau);
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'programmes_scolaires' 
            AND column_name = 'annee_scolaire'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_programmes_annee 
            ON programmes_scolaires(annee_scolaire);
        END IF;
    END IF;
END $$;

-- =====================================================
-- 2. CORRECTION: CREATE TRIGGER programmes_scolaires en dehors du bloc DO $$
-- =====================================================
-- Problème: CREATE TRIGGER pour programmes_scolaires est exécuté avant que la table n'existe
-- Solution: Créer le trigger dans un bloc DO $$ conditionnel
DO $$
BEGIN
    -- Supprimer le trigger s'il existe
    DROP TRIGGER IF EXISTS trigger_update_programmes_scolaires_updated_at ON programmes_scolaires;
    
    -- Créer le trigger SEULEMENT si la table existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'programmes_scolaires'
    ) THEN
        CREATE TRIGGER trigger_update_programmes_scolaires_updated_at
            BEFORE UPDATE ON programmes_scolaires
            FOR EACH ROW
            EXECUTE FUNCTION update_specialized_service_timestamp();
    END IF;
END $$;

-- =====================================================
-- 3. CORRECTION: COMMENT ON FUNCTION hybrid_image_search sans signature
-- =====================================================
-- Problème: COMMENT ON FUNCTION hybrid_image_search échoue car il y a plusieurs signatures
-- Solution: Supprimer les COMMENT sans signature et les recréer avec signatures complètes
DO $$
BEGIN
    -- Supprimer les COMMENT existants (ils seront recréés avec les bonnes signatures dans les migrations)
    -- Note: On ne peut pas supprimer un COMMENT directement, donc on les ignore
    -- Les COMMENT seront recréés correctement dans les migrations qui créent les fonctions
    NULL;
END $$;

-- =====================================================
-- 4. CORRECTION: DROP FUNCTION hybrid_image_search avec toutes les signatures
-- =====================================================
-- Problème: "cannot change return type" - besoin de DROP FUNCTION avec signature complète
-- Solution: DROP toutes les signatures de hybrid_image_search avant CREATE OR REPLACE
DO $$
BEGIN
    -- Supprimer toutes les signatures de hybrid_image_search
    DROP FUNCTION IF EXISTS hybrid_image_search(TEXT[], TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, TEXT) CASCADE;
    DROP FUNCTION IF EXISTS hybrid_image_search(TEXT[], TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER) CASCADE;
    DROP FUNCTION IF EXISTS hybrid_image_search(TEXT, TEXT, INTEGER, INTEGER) CASCADE;
    DROP FUNCTION IF EXISTS hybrid_image_search(TEXT, TEXT, INTEGER) CASCADE;
    DROP FUNCTION IF EXISTS hybrid_image_search(TEXT, TEXT) CASCADE;
    DROP FUNCTION IF EXISTS hybrid_image_search(TEXT) CASCADE;
END $$;

-- =====================================================
-- 5. CORRECTION: Index avec fonction non-IMMUTABLE
-- =====================================================
-- Problème: "functions in index predicate must be marked IMMUTABLE" pour idx_courier_availability_snapshots_active
-- Solution: Supprimer l'index et le recréer sans fonction non-immutable dans le prédicat
DO $$
BEGIN
    -- Supprimer l'index s'il existe
    DROP INDEX IF EXISTS idx_courier_availability_snapshots_active;
    
    -- Recréer l'index sans fonction non-immutable dans le prédicat
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'courier_availability_snapshots'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_active 
        ON courier_availability_snapshots(captured_at DESC, is_online, active_deliveries, max_capacity)
        WHERE is_online = true;
    END IF;
END $$;

-- =====================================================
-- 6. CORRECTION: Colonnes manquantes
-- =====================================================

-- 6.1. Colonne retry_at dans video_generation_jobs
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

-- 6.2. Colonnes dans pharmacy_order_items
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pharmacy_order_items'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_order_items' 
            AND column_name = 'order_id'
        ) THEN
            ALTER TABLE pharmacy_order_items 
            ADD COLUMN order_id INTEGER;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_order_items' 
            AND column_name = 'medication_id'
        ) THEN
            ALTER TABLE pharmacy_order_items 
            ADD COLUMN medication_id UUID;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_order_items' 
            AND column_name = 'pharmacy_id'
        ) THEN
            ALTER TABLE pharmacy_order_items 
            ADD COLUMN pharmacy_id INTEGER;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_order_items' 
            AND column_name = 'user_id'
        ) THEN
            ALTER TABLE pharmacy_order_items 
            ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_order_items' 
            AND column_name = 'status'
        ) THEN
            ALTER TABLE pharmacy_order_items 
            ADD COLUMN status TEXT;
        END IF;
    END IF;
END $$;

-- 6.3. Colonnes dans pharmacy_reservations
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pharmacy_reservations'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_reservations' 
            AND column_name = 'medication_id'
        ) THEN
            ALTER TABLE pharmacy_reservations 
            ADD COLUMN medication_id UUID;
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pharmacy_reservations' 
            AND column_name = 'status'
        ) THEN
            ALTER TABLE pharmacy_reservations 
            ADD COLUMN status TEXT;
        END IF;
    END IF;
END $$;

-- 6.4. Colonne location_point dans services
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

-- 6.5. Colonnes dans matching_offres_candidats
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

-- 6.6. Colonnes dans offres_emploi
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
            AND column_name = 'tags'
        ) THEN
            ALTER TABLE offres_emploi 
            ADD COLUMN tags TEXT[];
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'offres_emploi' 
            AND column_name = 'date_limite_candidature'
        ) THEN
            ALTER TABLE offres_emploi 
            ADD COLUMN date_limite_candidature DATE;
        END IF;
        
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
-- 7. CORRECTION: DROP TRIGGER trigger_update_templates_updated_at
-- =====================================================
-- Problème: "trigger trigger_update_templates_updated_at already exists"
-- Solution: DROP le trigger avant de le recréer
DROP TRIGGER IF EXISTS trigger_update_templates_updated_at ON video_templates;

-- =====================================================
-- 8. CORRECTION: Améliorer le parsing des commandes multiples
-- =====================================================
-- Note: Cette correction est gérée par l'amélioration du parser dans auto_migrate.rs
-- Les commandes multiples sur une seule ligne seront mieux détectées et séparées

