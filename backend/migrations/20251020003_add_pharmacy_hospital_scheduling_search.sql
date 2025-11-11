-- Migration pour la recherche avancée des planifications pharmacie/hôpital
-- Date: 2025-10-20
-- Description: Améliore la recherche pour prendre en compte les planifications et disponibilités

-- 1. Fonction pour vérifier si une pharmacie est de garde à un moment donné
CREATE OR REPLACE FUNCTION is_pharmacy_on_duty(
    pharmacy_data JSONB,
    search_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    jours_garde TEXT;
    heures_ouverture TEXT;
    heures_fermeture TEXT;
    current_day TEXT;
    v_current_time TIME;
    is_garde_day BOOLEAN := FALSE;
    is_garde_hour BOOLEAN := FALSE;
BEGIN
    -- Extraire les données de planification
    jours_garde := pharmacy_data->>'joursGarde';
    heures_ouverture := pharmacy_data->>'heuresOuverture';
    heures_fermeture := pharmacy_data->>'heuresFermeture';
    
    -- Si pas de données de garde, retourner false
    IF jours_garde IS NULL OR jours_garde = '' THEN
        RETURN FALSE;
    END IF;
    
    -- Déterminer le jour actuel (en français)
    current_day := CASE EXTRACT(DOW FROM search_time)
        WHEN 0 THEN 'Dimanche'
        WHEN 1 THEN 'Lundi'
        WHEN 2 THEN 'Mardi'
        WHEN 3 THEN 'Mercredi'
        WHEN 4 THEN 'Jeudi'
        WHEN 5 THEN 'Vendredi'
        WHEN 6 THEN 'Samedi'
    END;
    
    v_current_time := search_time::TIME;
    
    -- Vérifier si c'est un jour de garde
    is_garde_day := (
        jours_garde ILIKE '%' || current_day || '%' OR
        jours_garde ILIKE '%Lundi-Dimanche%' OR
        jours_garde ILIKE '%24h%' OR
        jours_garde ILIKE '%permanent%'
    );
    
    -- Si pas de jour de garde, retourner false
    IF NOT is_garde_day THEN
        RETURN FALSE;
    END IF;
    
    -- Vérifier les heures (si spécifiées)
    IF heures_ouverture IS NOT NULL AND heures_fermeture IS NOT NULL THEN
        -- Si c'est 24h/24, toujours disponible
        IF heures_ouverture = '00:00' AND heures_fermeture = '23:59' THEN
            is_garde_hour := TRUE;
        ELSE
            -- Vérifier si l'heure actuelle est dans la plage
            is_garde_hour := (
                v_current_time >= heures_ouverture::TIME AND 
                v_current_time <= heures_fermeture::TIME
            );
        END IF;
    ELSE
        -- Si pas d'heures spécifiées, considérer comme disponible toute la journée
        is_garde_hour := TRUE;
    END IF;
    
    RETURN is_garde_day AND is_garde_hour;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Fonction pour vérifier si un service médical est disponible à un moment donné
CREATE OR REPLACE FUNCTION is_medical_service_available(
    hospital_data JSONB,
    search_time TIMESTAMPTZ DEFAULT NOW(),
    requested_service TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    planning_hebdomadaire JSONB;
    prestations_medicales JSONB;
    current_day TEXT;
    v_current_time TIME;
    day_planning JSONB;
    service_available BOOLEAN := FALSE;
    time_available BOOLEAN := FALSE;
BEGIN
    -- Extraire les données de planification
    planning_hebdomadaire := hospital_data->'planningHebdomadaire';
    prestations_medicales := hospital_data->'prestationsMedicales';
    
    -- Si pas de planning, retourner false
    IF planning_hebdomadaire IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Déterminer le jour actuel (en français)
    current_day := CASE EXTRACT(DOW FROM search_time)
        WHEN 0 THEN 'dimanche'
        WHEN 1 THEN 'lundi'
        WHEN 2 THEN 'mardi'
        WHEN 3 THEN 'mercredi'
        WHEN 4 THEN 'jeudi'
        WHEN 5 THEN 'vendredi'
        WHEN 6 THEN 'samedi'
    END;
    
    v_current_time := search_time::TIME;
    
    -- Récupérer le planning du jour
    day_planning := planning_hebdomadaire->current_day;
    
    -- Si pas de planning pour ce jour, retourner false
    IF day_planning IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Vérifier si le service demandé est disponible
    IF requested_service IS NOT NULL AND prestations_medicales IS NOT NULL THEN
        service_available := (
            prestations_medicales ? requested_service OR
            prestations_medicales::TEXT ILIKE '%' || requested_service || '%'
        );
    ELSE
        service_available := TRUE; -- Si pas de service spécifique demandé
    END IF;
    
    -- Vérifier les heures de disponibilité
    IF day_planning->>'permanent' = 'true' THEN
        time_available := TRUE;
    ELSE
        -- Vérifier si l'heure actuelle est dans la plage
        time_available := (
            v_current_time >= (day_planning->>'debut')::TIME AND 
            v_current_time <= (day_planning->>'fin')::TIME
        );
    END IF;
    
    RETURN service_available AND time_available;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Fonction de recherche avancée avec planifications
CREATE OR REPLACE FUNCTION search_products_with_scheduling(
    search_query TEXT,
    search_time TIMESTAMPTZ DEFAULT NOW(),
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    max_distance_km FLOAT DEFAULT 50.0
)
RETURNS TABLE (
    service_id INTEGER,
    product_data JSONB,
    relevance_score FLOAT,
    distance_km FLOAT,
    is_available_now BOOLEAN,
    availability_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH product_search AS (
        SELECT 
            s.id as service_id,
            product,
            -- Score de pertinence basé sur le texte
            ts_rank(
                to_tsvector('french', extract_all_product_text(product)),
                plainto_tsquery('french', search_query)
            ) as text_score,
            -- Distance géographique (si coordonnées fournies)
            CASE 
                WHEN user_lat IS NOT NULL 
                     AND user_lng IS NOT NULL 
                     AND s.gps IS NOT NULL 
                     AND s.gps ~ '^-?\\d+\\.?\\d*,\\s*-?\\d+\\.?\\d*$'
                THEN ST_Distance(
                    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
                    ST_SetSRID(
                        ST_MakePoint(
                            TRIM(split_part(s.gps, ',', 2))::DOUBLE PRECISION,
                            TRIM(split_part(s.gps, ',', 1))::DOUBLE PRECISION
                        ),
                        4326
                    )::geography
                ) / 1000.0
                ELSE NULL
            END as distance_km,
            -- Vérifier la disponibilité selon le type
            CASE 
                WHEN product->>'type' = 'pharmacie' THEN
                    is_pharmacy_on_duty(product, search_time)
                WHEN product->>'type' = 'hopital_clinique' THEN
                    is_medical_service_available(product, search_time, search_query)
                ELSE TRUE
            END as is_available_now,
            -- Informations de disponibilité
            CASE 
                WHEN product->>'type' = 'pharmacie' AND is_pharmacy_on_duty(product, search_time) THEN
                    'Pharmacie de garde disponible maintenant'
                WHEN product->>'type' = 'hopital_clinique' AND is_medical_service_available(product, search_time, search_query) THEN
                    'Service médical disponible maintenant'
                WHEN product->>'type' = 'pharmacie' THEN
                    'Pharmacie fermée - Garde: ' || COALESCE(product->>'joursGarde', 'Non spécifié')
                WHEN product->>'type' = 'hopital_clinique' THEN
                    'Service médical fermé - Planning: ' || COALESCE(product->>'planningHebdomadaire', 'Non spécifié')
                ELSE 'Disponible'
            END as availability_info
        FROM services s,
        LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE s.is_active = true
    )
    SELECT 
        ps.service_id,
        ps.product,
        -- Score final combinant pertinence, distance et disponibilité
        (
            ps.text_score * 3.0 + -- Score de pertinence textuelle
            CASE WHEN ps.is_available_now THEN 5.0 ELSE 0.0 END + -- Bonus disponibilité
            CASE WHEN ps.distance_km <= max_distance_km THEN (max_distance_km - ps.distance_km) / max_distance_km * 2.0 ELSE 0.0 END -- Bonus proximité
        ) as relevance_score,
        ps.distance_km,
        ps.is_available_now,
        ps.availability_info
    FROM product_search ps
    WHERE 
        -- Filtre par distance si coordonnées fournies
        (user_lat IS NULL OR user_lng IS NULL OR ps.distance_km <= max_distance_km)
        -- Filtre par pertinence minimale
        AND ps.text_score > 0.1
    ORDER BY 
        ps.is_available_now DESC, -- Disponibles en premier
        relevance_score DESC,     -- Puis par pertinence
        ps.distance_km ASC;       -- Puis par distance
END;
$$ LANGUAGE plpgsql;

-- 4. Index pour optimiser les recherches de planification
CREATE INDEX IF NOT EXISTS idx_services_pharmacy_scheduling 
ON services USING GIN (
    (data->'produits') jsonb_path_ops
) WHERE data->'produits' @> '[{"type": "pharmacie"}]';

CREATE INDEX IF NOT EXISTS idx_services_hospital_scheduling 
ON services USING GIN (
    (data->'produits') jsonb_path_ops
) WHERE data->'produits' @> '[{"type": "hopital_clinique"}]';

-- 5. Vue matérialisée pour les pharmacies de garde (mise à jour toutes les heures)
CREATE MATERIALIZED VIEW IF NOT EXISTS pharmacies_on_duty AS
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as service_title,
    CASE 
        WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\\d+\\.?\\d*,\\s*-?\\d+\\.?\\d*$'
        THEN TRIM(split_part(s.gps, ',', 1))::DOUBLE PRECISION
        ELSE NULL
    END AS latitude,
    CASE 
        WHEN s.gps IS NOT NULL AND s.gps ~ '^-?\\d+\\.?\\d*,\\s*-?\\d+\\.?\\d*$'
        THEN TRIM(split_part(s.gps, ',', 2))::DOUBLE PRECISION
        ELSE NULL
    END AS longitude,
    product,
    is_pharmacy_on_duty(product, NOW()) as is_on_duty,
    product->>'joursGarde' as garde_days,
    product->>'heuresOuverture' as opening_hours,
    product->>'heuresFermeture' as closing_hours,
    product->>'telephoneUrgence' as emergency_phone
FROM services s,
LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN s.data->'produits'
        ELSE '[]'::jsonb
    END
) AS product
WHERE 
    s.is_active = true 
    AND product->>'type' = 'pharmacie'
    AND product->>'joursGarde' IS NOT NULL
    AND product->>'joursGarde' != '';

-- Index sur la vue matérialisée
CREATE INDEX IF NOT EXISTS idx_pharmacies_on_duty_location 
ON pharmacies_on_duty (is_on_duty) WHERE is_on_duty = true;

-- 6. Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION refresh_pharmacies_on_duty()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY pharmacies_on_duty;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger pour rafraîchir automatiquement la vue (optionnel)
-- CREATE OR REPLACE FUNCTION trigger_refresh_pharmacies()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     PERFORM refresh_pharmacies_on_duty();
--     RETURN NULL;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER refresh_pharmacies_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON services
--     FOR EACH STATEMENT
--     EXECUTE FUNCTION trigger_refresh_pharmacies();

-- 8. Commentaires pour documentation
COMMENT ON FUNCTION is_pharmacy_on_duty(JSONB, TIMESTAMPTZ) IS 
'Vérifie si une pharmacie est de garde à un moment donné en analysant ses jours de garde et heures d''ouverture';

COMMENT ON FUNCTION is_medical_service_available(JSONB, TIMESTAMPTZ, TEXT) IS 
'Vérifie si un service médical est disponible à un moment donné selon son planning hebdomadaire';

COMMENT ON FUNCTION search_products_with_scheduling(TEXT, TIMESTAMPTZ, FLOAT, FLOAT, FLOAT) IS 
'Recherche avancée de produits en tenant compte des planifications et disponibilités en temps réel';

COMMENT ON MATERIALIZED VIEW pharmacies_on_duty IS 
'Vue matérialisée des pharmacies de garde, mise à jour périodiquement pour optimiser les recherches';
