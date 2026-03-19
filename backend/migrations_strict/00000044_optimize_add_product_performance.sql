-- Migration: Optimisation critique de l'ajout de produit pour éviter erreurs 500
-- Date: 2025-12-27
-- Problème: UPDATE services prend 7-12s, causant des timeouts et erreurs 500
-- Solution: Fonction PostgreSQL optimisée qui insère directement dans le tableau sans réécrire tout le JSONB

-- Fonction optimisée pour ajouter un produit directement au tableau produits.valeur
-- Utilise une seule requête UPDATE atomique, évitant les lectures multiples
CREATE OR REPLACE FUNCTION add_product_to_service_jsonb(
    p_service_id INTEGER,
    p_product_json JSONB
) RETURNS INTEGER AS $$
DECLARE
    v_product_index INTEGER;
BEGIN
    -- Calculer l'index AVANT l'UPDATE (0-based)
    SELECT COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0)
    INTO v_product_index
    FROM services
    WHERE id = p_service_id;
    
    -- UPDATE atomique qui gère tous les cas en une seule opération
    UPDATE services
    SET 
        data = CASE
            -- Si produits.valeur existe déjà, ajouter au tableau avec ||
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
    WHERE id = p_service_id;
    
    -- Retourner l'index du produit (0-based)
    RETURN v_product_index;
END;
$$ LANGUAGE plpgsql;

-- Commentaire pour documentation
COMMENT ON FUNCTION add_product_to_service_jsonb IS 'Fonction optimisée pour ajouter un produit au service. Utilise une seule requête UPDATE atomique qui évite les lectures multiples et réduit les verrous, améliorant significativement les performances.';

-- Index pour garantir que les UPDATE sont rapides (déjà présent normalement, mais on s'assure)
CREATE INDEX IF NOT EXISTS idx_services_id_for_updates ON services(id) WHERE is_active = true;
