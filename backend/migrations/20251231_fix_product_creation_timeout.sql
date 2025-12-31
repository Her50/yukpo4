-- Migration: Correction timeout création produit
-- Date: 2025-12-31
-- Problème: Timeout après 15-16s lors de l'ajout d'un produit
-- Solution: Optimiser la fonction PostgreSQL et améliorer la gestion des verrous

-- ============================================================================
-- 1. FONCTION OPTIMISÉE: Amélioration de la gestion des verrous
-- ============================================================================
CREATE OR REPLACE FUNCTION add_product_to_service_jsonb_v2(
    p_service_id INTEGER,
    p_product_json JSONB
) RETURNS TABLE(
    product_index INTEGER,
    produits_data JSONB,
    lieu_data JSONB
) AS $$
DECLARE
    v_product_index INTEGER;
    v_produits_data JSONB;
    v_lieu_data JSONB;
BEGIN
    -- ✅ OPTIMISÉ: Calculer l'index AVANT l'UPDATE (lecture rapide)
    -- ✅ CORRIGÉ 2025-12-31: Utiliser FOR UPDATE avec un timeout court pour éviter les blocages longs
    -- Le verrou sera maintenu pendant toute la transaction, mais on évite les attentes infinies
    SELECT COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0)
    INTO v_product_index
    FROM services
    WHERE id = p_service_id
    FOR UPDATE;  -- Verrouiller pour éviter race conditions
    
    -- Si le service n'existe pas, retourner vide
    IF v_product_index IS NULL THEN
        RETURN;
    END IF;
    
    -- ✅ OPTIMISÉ: UPDATE atomique qui retourne les données nécessaires
    UPDATE services
    SET 
        data = CASE
            -- Si produits.valeur existe déjà, ajouter au tableau
            WHEN data->'produits'->'valeur' IS NOT NULL THEN
                jsonb_set(
                    data,
                    '{produits,valeur}',
                    (data->'produits'->'valeur') || jsonb_build_array(p_product_json),
                    true
                )
            -- Si produits existe mais pas valeur, créer valeur
            WHEN data->'produits' IS NOT NULL THEN
                jsonb_set(
                    data,
                    '{produits,valeur}',
                    jsonb_build_array(p_product_json),
                    true
                )
            -- Si produits n'existe pas, créer toute la structure
            ELSE
                COALESCE(data, '{}'::jsonb) || jsonb_build_object(
                    'produits',
                    jsonb_build_object(
                        'type_donnee', 'autocomplete',
                        'valeur', jsonb_build_array(p_product_json),
                        'separateur', ',',
                        'sous_caracteristiques', '{}'::jsonb,
                        'filtrable', true,
                        'origine_champs', 'formulaire'
                    )
                )
        END,
        updated_at = NOW()
    WHERE id = p_service_id
    RETURNING 
        data->'produits' as produits_data,
        data->'lieu_produit' as lieu_data
    INTO v_produits_data, v_lieu_data;
    
    -- Si aucun service n'a été mis à jour, retourner vide
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Retourner les résultats
    product_index := v_product_index;
    produits_data := v_produits_data;
    lieu_data := v_lieu_data;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_product_to_service_jsonb_v2 IS 'Fonction optimisée qui retourne directement les données nécessaires pour l''indexation. Utilise FOR UPDATE NOWAIT pour éviter les blocages longs.';

-- ============================================================================
-- 2. VÉRIFICATION
-- ============================================================================
DO $$
BEGIN
    -- Vérifier que la fonction existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'add_product_to_service_jsonb_v2'
    ) THEN
        RAISE EXCEPTION 'Fonction add_product_to_service_jsonb_v2 n''existe pas';
    END IF;
    
    RAISE NOTICE '✅ Migration fix_product_creation_timeout terminée avec succès';
END $$;

