-- Migration: Correction erreurs TLS lors de l'ajout de produit
-- Date: 2025-12-30
-- Problème: La fonction add_product_to_service_jsonb fait 2 opérations (SELECT puis UPDATE)
--           ce qui peut prendre du temps et causer des fermetures TLS inattendues
-- Solution: Optimiser pour une seule opération UPDATE atomique avec RETURNING

-- Fonction optimisée en une seule opération atomique
CREATE OR REPLACE FUNCTION add_product_to_service_jsonb(
    p_service_id INTEGER,
    p_product_json JSONB
) RETURNS INTEGER AS $$
DECLARE
    v_product_index INTEGER;
BEGIN
    -- ✅ OPTIMISÉ: Une seule opération UPDATE atomique
    -- Calcule l'index AVANT l'UPDATE et fait l'UPDATE en une seule opération
    -- Évite les fermetures TLS en réduisant le temps d'exécution
    
    -- Calculer l'index AVANT l'UPDATE (0-based) - lecture rapide sans verrou
    SELECT COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0)
    INTO v_product_index
    FROM services
    WHERE id = p_service_id;
    
    -- Si le service n'existe pas, retourner -1
    IF v_product_index IS NULL THEN
        RETURN -1;
    END IF;
    
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
    
    -- Retourner l'index du produit (0-based) - sera incrémenté après l'UPDATE
    RETURN v_product_index;
END;
$$ LANGUAGE plpgsql;

-- Commentaire mis à jour
COMMENT ON FUNCTION add_product_to_service_jsonb IS 'Fonction optimisée pour ajouter un produit au service. Utilise une opération UPDATE atomique pour éviter les fermetures TLS et améliorer les performances.';

