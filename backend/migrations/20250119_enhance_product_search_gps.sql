-- Migration pour améliorer la recherche avec priorité GPS produit et tous champs produits
-- Date: 2025-01-19
-- Description: Étend la recherche pour inclure tous les champs des produits et priorise le GPS du produit

-- Fonction helper pour extraire le meilleur GPS disponible (produit en priorité, sinon service)
CREATE OR REPLACE FUNCTION get_best_gps_for_service(service_data JSONB)
RETURNS TEXT AS $$
DECLARE
    product_gps TEXT;
    service_gps TEXT;
    result_gps TEXT := NULL;
BEGIN
    -- 1. Priorité: GPS des produits immobiliers
    SELECT product->>'gps'
    INTO product_gps
    FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(service_data->'produits') = 'array' 
            THEN service_data->'produits'
            ELSE '[]'::jsonb
        END
    ) AS product
    WHERE product->>'gps' IS NOT NULL 
        AND product->>'gps' != ''
        AND product->>'gps' != '0,0'
        AND (product->>'type' = 'immobilier_batiment' OR product->>'type' = 'immobilier_terrain')
    LIMIT 1;
    
    IF product_gps IS NOT NULL THEN
        RETURN product_gps;
    END IF;
    
    -- 2. Fallback: GPS de n'importe quel produit
    SELECT product->>'gps'
    INTO product_gps
    FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(service_data->'produits') = 'array' 
            THEN service_data->'produits'
            ELSE '[]'::jsonb
        END
    ) AS product
    WHERE product->>'gps' IS NOT NULL 
        AND product->>'gps' != ''
        AND product->>'gps' != '0,0'
    LIMIT 1;
    
    IF product_gps IS NOT NULL THEN
        RETURN product_gps;
    END IF;
    
    -- 3. Fallback: GPS du service (gps_fixe en priorité)
    service_gps := COALESCE(
        service_data->>'gps_fixe',
        service_data->'gps_fixe'->>'valeur'
    );
    
    IF service_gps IS NOT NULL AND service_gps != '' AND service_gps != '0,0' THEN
        RETURN service_gps;
    END IF;
    
    -- 4. Fallback final: GPS temps réel du service
    RETURN NULL; -- Will use service.gps column as final fallback
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour calculer le score de pertinence des produits
CREATE OR REPLACE FUNCTION calculate_product_relevance_score(service_data JSONB, search_query TEXT)
RETURNS FLOAT AS $$
DECLARE
    total_score FLOAT := 0.0;
    product_record JSONB;
BEGIN
    -- Itérer sur tous les produits
    FOR product_record IN 
        SELECT * FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(service_data->'produits') = 'array' 
                THEN service_data->'produits'
                ELSE '[]'::jsonb
            END
        )
    LOOP
        -- Nom du produit (poids élevé)
        IF product_record->>'nom' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 8.0;
        END IF;
        
        -- Description du produit
        IF product_record->>'description' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 5.0;
        END IF;
        
        -- Type de produit
        IF product_record->>'type' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 6.0;
        END IF;
        
        -- Marque
        IF product_record->>'marque' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 5.0;
        END IF;
        
        -- Modèle
        IF product_record->>'modele' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 5.0;
        END IF;
        
        -- Titre (pour immobilier)
        IF product_record->>'titre' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 5.0;
        END IF;
        
        -- Localisation (quartier, ville)
        IF product_record->>'quartier' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 4.0;
        END IF;
        
        IF product_record->>'ville' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 4.0;
        END IF;
        
        -- Catégories spécifiques
        IF product_record->>'categorieQuincaillerie' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 4.0;
        END IF;
        
        IF product_record->>'categorieElectromenager' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 4.0;
        END IF;
        
        -- Matière / Couleur
        IF product_record->>'matiere' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 3.0;
        END IF;
        
        IF product_record->>'couleur' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 3.0;
        END IF;
        
        -- Prix (si recherche numérique)
        IF search_query ~ '^\d+$' AND (product_record->>'prix')::TEXT LIKE '%' || search_query || '%' THEN
            total_score := total_score + 2.0;
        END IF;
    END LOOP;
    
    RETURN total_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction améliorée de recherche GPS avec priorité produits
CREATE OR REPLACE FUNCTION search_services_gps_enhanced(
    search_query TEXT,
    user_gps_zone TEXT,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE(
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DOUBLE PRECISION,
    relevance_score FLOAT,
    gps_source TEXT
) AS $$
DECLARE
    lat DOUBLE PRECISION;
    lng DOUBLE PRECISION;
BEGIN
    -- Extraire les coordonnées GPS de la zone utilisateur
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' THEN
        lat := split_part(user_gps_zone, ',', 1)::DOUBLE PRECISION;
        lng := split_part(user_gps_zone, ',', 2)::DOUBLE PRECISION;
        
        RAISE NOTICE '[search_services_gps_enhanced] Recherche avec GPS: lat=%, lng=%, rayon=%km', lat, lng, search_radius_km;
        
        -- Recherche avec GPS et scoring amélioré
        RETURN QUERY
        WITH service_with_best_gps AS (
            SELECT 
                s.id,
                s.data,
                s.category,
                s.gps as service_gps_realtime,
                COALESCE(
                    get_best_gps_for_service(s.data),
                    s.gps,
                    '0,0'
                ) as best_gps
            FROM services s
            WHERE s.is_active = true
        ),
        scored_services AS (
            SELECT 
                sg.id as service_id,
                COALESCE(sg.data->>'titre_service', sg.data->'titre_service'->>'valeur', 'Service sans titre') as titre_service,
                COALESCE(sg.category, sg.data->>'category', sg.data->'category'->>'valeur') as category,
                sg.best_gps as gps_coords,
                -- Calculer la distance
                CASE 
                    WHEN sg.best_gps IS NOT NULL AND sg.best_gps != '0,0' THEN
                        calculate_distance_km(user_gps_zone, sg.best_gps)
                    ELSE 999999.0
                END as distance_km,
                -- Calculer le score de pertinence
                (
                    -- Score textuel du service (titre, description, catégorie)
                    CASE 
                        WHEN sg.data->>'titre_service' ILIKE '%' || search_query || '%' 
                        OR sg.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%'
                        THEN 10.0
                        ELSE 0.0
                    END +
                    CASE 
                        WHEN sg.data->>'description' ILIKE '%' || search_query || '%'
                        OR sg.data->'description'->>'valeur' ILIKE '%' || search_query || '%'
                        THEN 7.0
                        ELSE 0.0
                    END +
                    CASE 
                        WHEN sg.category ILIKE '%' || search_query || '%'
                        OR sg.data->>'category' ILIKE '%' || search_query || '%'
                        OR sg.data->'category'->>'valeur' ILIKE '%' || search_query || '%'
                        THEN 6.0
                        ELSE 0.0
                    END +
                    -- Score des produits (tous les champs)
                    calculate_product_relevance_score(sg.data, search_query) +
                    -- Bonus pour proximité géographique
                    CASE 
                        WHEN calculate_distance_km(user_gps_zone, sg.best_gps) <= 5 THEN 5.0
                        WHEN calculate_distance_km(user_gps_zone, sg.best_gps) <= 10 THEN 3.0
                        WHEN calculate_distance_km(user_gps_zone, sg.best_gps) <= 20 THEN 1.0
                        ELSE 0.0
                    END +
                    -- Bonus pour récence
                    CASE 
                        WHEN (SELECT created_at FROM services WHERE id = sg.id) > NOW() - INTERVAL '7 days' THEN 3.0
                        WHEN (SELECT created_at FROM services WHERE id = sg.id) > NOW() - INTERVAL '30 days' THEN 2.0
                        ELSE 0.0
                    END
                )::FLOAT as relevance_score,
                -- Identifier la source du GPS
                CASE 
                    WHEN sg.best_gps = get_best_gps_for_service(sg.data) 
                        AND EXISTS (
                            SELECT 1 FROM jsonb_array_elements(
                                CASE 
                                    WHEN jsonb_typeof(sg.data->'produits') = 'array' 
                                    THEN sg.data->'produits'
                                    ELSE '[]'::jsonb
                                END
                            ) AS product
                            WHERE product->>'gps' = sg.best_gps
                        ) 
                    THEN 'produit_gps'
                    WHEN sg.best_gps = COALESCE(sg.data->>'gps_fixe', sg.data->'gps_fixe'->>'valeur')
                    THEN 'service_gps_fixe'
                    ELSE 'service_gps_realtime'
                END as gps_source
            FROM service_with_best_gps sg
            WHERE 
                -- Filtrage par distance
                CASE 
                    WHEN sg.best_gps IS NOT NULL AND sg.best_gps != '0,0' THEN
                        calculate_distance_km(user_gps_zone, sg.best_gps) <= search_radius_km
                    ELSE FALSE
                END
                -- Filtrage par pertinence textuelle (au moins une correspondance)
                AND (
                    search_query IS NULL 
                    OR search_query = ''
                    OR sg.data::TEXT ILIKE '%' || search_query || '%'
                )
        )
        SELECT 
            ss.service_id,
            ss.titre_service,
            ss.category,
            ss.gps_coords,
            ss.distance_km,
            ss.relevance_score,
            ss.gps_source
        FROM scored_services ss
        WHERE ss.relevance_score > 0  -- Seulement les résultats pertinents
        ORDER BY 
            ss.relevance_score DESC,  -- D'abord par pertinence
            ss.distance_km ASC        -- Puis par proximité
        LIMIT max_results;
    ELSE
        -- Recherche sans GPS (fallback textuel pur)
        RAISE NOTICE '[search_services_gps_enhanced] Recherche sans GPS (fallback textuel)';
        
        RETURN QUERY
        SELECT 
            s.id as service_id,
            COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', 'Service sans titre') as titre_service,
            COALESCE(s.category, s.data->>'category', s.data->'category'->>'valeur') as category,
            COALESCE(
                get_best_gps_for_service(s.data),
                s.gps,
                '0,0'
            ) as gps_coords,
            0.0 as distance_km,
            (
                CASE 
                    WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' 
                    OR s.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%'
                    THEN 10.0
                    ELSE 0.0
                END +
                CASE 
                    WHEN s.data->>'description' ILIKE '%' || search_query || '%'
                    OR s.data->'description'->>'valeur' ILIKE '%' || search_query || '%'
                    THEN 7.0
                    ELSE 0.0
                END +
                calculate_product_relevance_score(s.data, search_query)
            )::FLOAT as relevance_score,
            'no_gps_search' as gps_source
        FROM services s
        WHERE s.is_active = true
            AND s.data::TEXT ILIKE '%' || search_query || '%'
        ORDER BY relevance_score DESC
        LIMIT max_results;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Index pour améliorer les performances de recherche dans les produits
CREATE INDEX IF NOT EXISTS idx_services_products_gin ON services USING GIN ((data->'produits'));
CREATE INDEX IF NOT EXISTS idx_services_products_type ON services ((data->'produits'));

-- Commentaires
COMMENT ON FUNCTION get_best_gps_for_service IS 'Extrait le meilleur GPS disponible: produit immobilier > autre produit > service gps_fixe > service gps temps réel';
COMMENT ON FUNCTION calculate_product_relevance_score IS 'Calcule le score de pertinence en recherchant dans tous les champs des produits';
COMMENT ON FUNCTION search_services_gps_enhanced IS 'Recherche améliorée avec priorité GPS produit et scoring complet des champs produits';

