-- =====================================================
-- Script de Correction Directe des Erreurs de Migrations
-- Date: 2026-02-13
-- À exécuter directement sur la base de données
-- =====================================================

-- =====================================================
-- 1. DROP la fonction record_publicite_impression
--    pour résoudre le conflit de signature
-- =====================================================
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR(50));
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR(50), VARCHAR(50));
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER);

-- =====================================================
-- 2. Créer la table delivery_proximity_suggestions
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'delivery_proximity_suggestions'
    ) THEN
        CREATE TABLE delivery_proximity_suggestions (
            id SERIAL PRIMARY KEY,
            delivery_id INTEGER NOT NULL,
            suggested_courier_id INTEGER,
            proximity_score DOUBLE PRECISION,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_delivery 
            ON delivery_proximity_suggestions(delivery_id);
        
        CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_created 
            ON delivery_proximity_suggestions(status, created_at);

        COMMENT ON TABLE delivery_proximity_suggestions IS 
            'Suggestions de proximité pour les livraisons - utilisée pour le monitoring toutes les 30s';

        RAISE NOTICE '✅ Table delivery_proximity_suggestions créée avec succès';
    ELSE
        RAISE NOTICE 'ℹ️ Table delivery_proximity_suggestions existe déjà';
    END IF;
END $$;

-- =====================================================
-- 3. Recréer la fonction record_publicite_impression
--    avec la signature correcte (INTEGER avec DEFAULT)
-- =====================================================
CREATE OR REPLACE FUNCTION record_publicite_impression(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_placement VARCHAR(50) DEFAULT 'feed'
) RETURNS INTEGER AS $$
DECLARE
    v_impression_id INTEGER;
BEGIN
    INSERT INTO publicite_impressions (publicite_id, user_id, placement)
    VALUES (p_publicite_id, p_user_id, p_placement)
    RETURNING id INTO v_impression_id;
    
    RETURN v_impression_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_publicite_impression IS 
    'Enregistre une impression publicitaire et retourne l''ID de l''impression';

-- =====================================================
-- 4. VÉRIFICATION
-- =====================================================
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_function_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'delivery_proximity_suggestions'
    ) INTO v_table_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'record_publicite_impression'
        AND pg_get_function_identity_arguments(p.oid) = 'integer, integer, character varying'
    ) INTO v_function_exists;
    
    IF v_table_exists AND v_function_exists THEN
        RAISE NOTICE '✅ Toutes les corrections ont été appliquées avec succès';
    ELSE
        RAISE WARNING '⚠️ Certaines corrections n''ont pas été appliquées';
        RAISE NOTICE '   Table delivery_proximity_suggestions: %', v_table_exists;
        RAISE NOTICE '   Fonction record_publicite_impression: %', v_function_exists;
    END IF;
END $$;

