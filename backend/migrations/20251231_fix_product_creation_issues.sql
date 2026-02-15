-- Migration: Correction définitive performance création produit
-- Date: 2025-12-31
-- Problème: SELECT complet du JSONB après UPDATE cause 1-3s de latence
-- Solution: Fonction PostgreSQL qui retourne directement les données nécessaires
-- ✅ MISE À JOUR 2026-01-02: Optimisation supplémentaire pour éviter les verrous longs

-- ============================================================================
-- 1. FONCTION OPTIMISÉE: Retourne index + données nécessaires pour indexation
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
    v_current_data JSONB;
BEGIN
    -- ✅ OPTIMISÉ 2026-01-02: Lire les données AVANT le verrou (lecture rapide)
    -- Cela permet de calculer l'index sans verrouiller la ligne
    SELECT 
        COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0),
        data
    INTO v_product_index, v_current_data
    FROM services
    WHERE id = p_service_id AND is_active = true;
    
    -- Si le service n'existe pas, retourner vide
    IF v_product_index IS NULL OR v_current_data IS NULL THEN
        RETURN;
    END IF;
    
    -- ✅ OPTIMISÉ 2026-01-02: Calculer le nouveau JSONB en mémoire (plus rapide que jsonb_set)
    -- Construire directement le nouveau tableau produits.valeur
    DECLARE
        v_new_produits_valeur JSONB;
        v_new_data JSONB;
    BEGIN
        -- Construire le nouveau tableau produits.valeur
        IF v_current_data->'produits'->'valeur' IS NOT NULL THEN
            -- Ajouter au tableau existant
            v_new_produits_valeur := (v_current_data->'produits'->'valeur') || jsonb_build_array(p_product_json);
        ELSE
            -- Créer un nouveau tableau
            v_new_produits_valeur := jsonb_build_array(p_product_json);
        END IF;
        
        -- Construire le nouveau data JSONB
        IF v_current_data->'produits' IS NOT NULL THEN
            -- Mettre à jour seulement produits.valeur
            v_new_data := jsonb_set(
                v_current_data,
                '{produits,valeur}',
                v_new_produits_valeur,
                true
            );
        ELSE
            -- Créer toute la structure produits
            v_new_data := v_current_data || jsonb_build_object(
                'produits',
                jsonb_build_object(
                    'type_donnee', 'autocomplete',
                    'valeur', v_new_produits_valeur,
                    'separateur', ',',
                    'sous_caracteristiques', '{}'::jsonb,
                    'filtrable', true,
                    'origine_champs', 'formulaire'
                )
            );
        END IF;
        
        -- ✅ OPTIMISÉ 2026-01-02: UPDATE atomique sans verrou long
        -- On construit le JSONB en mémoire avant l'UPDATE, ce qui est plus rapide
        -- et évite de verrouiller la ligne pendant le calcul
        UPDATE services
        SET 
            data = v_new_data,
            updated_at = NOW()
        WHERE id = p_service_id
        AND is_active = true
        RETURNING 
            data->'produits' as produits_data,
            data->'lieu_produit' as lieu_data
        INTO v_produits_data, v_lieu_data;
        
        -- Si aucun service n'a été mis à jour (non trouvé ou inactif)
        IF NOT FOUND THEN
            RETURN;
        END IF;
    END;
    
    -- Retourner les résultats
    product_index := v_product_index;
    produits_data := v_produits_data;
    lieu_data := v_lieu_data;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_product_to_service_jsonb_v2 IS 'Fonction optimisée qui évite les verrous longs. Lit les données AVANT le verrou, construit le nouveau JSONB en mémoire, puis fait un UPDATE atomique rapide. Réduit significativement le temps d''exécution même pour les services avec beaucoup de produits.';

-- ============================================================================
-- 2. GARDER L'ANCIENNE FONCTION pour compatibilité (sera remplacée progressivement)
-- ============================================================================
-- La fonction add_product_to_service_jsonb reste disponible pour le fallback

-- ============================================================================
-- 3. INDEX: Optimisation pour les requêtes fréquentes
-- ============================================================================
-- Index pour garantir que les UPDATE sont rapides
CREATE INDEX IF NOT EXISTS idx_services_id_for_updates 
    ON services(id) 
    WHERE is_active = true;

-- Index GIN sur data->'produits'->'valeur' pour accès rapide à la longueur
CREATE INDEX IF NOT EXISTS idx_services_produits_valeur_gin 
    ON services USING GIN ((data->'produits'->'valeur'))
    WHERE data->'produits'->'valeur' IS NOT NULL;

-- ✅ NOUVEAU 2026-01-02: Index partiel pour les services avec beaucoup de produits
-- Cela aide PostgreSQL à choisir un plan d'exécution optimal
CREATE INDEX IF NOT EXISTS idx_services_data_produits_partial
    ON services USING GIN (data)
    WHERE is_active = true 
    AND data->'produits'->'valeur' IS NOT NULL
    AND jsonb_array_length(data->'produits'->'valeur') > 0;

-- ============================================================================
-- 4. VÉRIFICATION
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
    
    RAISE NOTICE '✅ Migration terminée avec succès';
END $$;

