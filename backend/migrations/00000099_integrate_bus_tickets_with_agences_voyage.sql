-- Migration: Intégration tickets bus avec agences de voyage
-- Date: 2025-11-27
-- Description: Lier agences_voyage avec products (tickets bus) et créer fonction de recherche avec disponibilité
-- Note: Compatible avec SQLx offline mode

-- ============================================================================
-- 1. MODIFIER TABLE agences_voyage
-- ============================================================================

-- Ajouter colonne pour stocker la configuration des modèles de bus
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='agences_voyage' AND column_name='bus_products_config') THEN
        ALTER TABLE agences_voyage ADD COLUMN bus_products_config JSONB;
    END IF;
END $$;

-- Format de bus_products_config:
-- {
--   "modeles_bus": [
--     {
--       "product_id": "uuid",
--       "nom_modele": "Luxury VIP",
--       "total_seats": 50,
--       "classe": "VIP",
--       "prix_base": 15000,
--       "equipements": ["WiFi", "Climatisation", "Toilettes"]
--     },
--     ...
--   ]
-- }

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_agences_bus_products_gin ON agences_voyage USING GIN(bus_products_config) WHERE bus_products_config IS NOT NULL;

-- Commentaire
COMMENT ON COLUMN agences_voyage.bus_products_config IS 'Configuration des modèles de bus (products de type ticket_voyage) liés à cette agence';

-- ============================================================================
-- 2. FONCTION DE RECHERCHE TICKETS BUS AVEC DISPONIBILITÉ
-- ============================================================================

-- Supprimer toutes les versions existantes de la fonction
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'search_bus_tickets_with_availability'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION search_bus_tickets_with_availability(
    p_departure_city TEXT DEFAULT NULL,
    p_arrival_city TEXT DEFAULT NULL,
    p_departure_date DATE DEFAULT NULL,
    p_user_lat DOUBLE PRECISION DEFAULT NULL,
    p_user_lng DOUBLE PRECISION DEFAULT NULL,
    p_radius_km DOUBLE PRECISION DEFAULT 50.0,
    p_min_seats INTEGER DEFAULT 1,
    p_agency_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    agency_id INTEGER,
    agency_service_id INTEGER,
    agency_nom VARCHAR,
    agency_adresse TEXT,
    agency_quartier VARCHAR,
    agency_ville VARCHAR,
    agency_gps VARCHAR,
    agency_telephone VARCHAR,
    agency_whatsapp VARCHAR,
    agency_email VARCHAR,
    agency_peut_emettre_tickets BOOLEAN,
    
    -- Informations produit (ticket bus)
    product_id TEXT,
    product_name TEXT,
    product_type TEXT,
    bus_model_name TEXT,
    total_seats INTEGER,
    available_seats INTEGER,
    reserved_seats INTEGER,
    bus_number VARCHAR,
    departure_city TEXT,
    arrival_city TEXT,
    departure_date DATE,
    departure_time TIME,
    ticket_price INTEGER,
    currency VARCHAR,
    bus_configuration JSONB,
    seat_map JSONB,
    
    -- Distance GPS
    distance_km DOUBLE PRECISION,
    
    -- Score de pertinence
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    v_user_point geography;
BEGIN
    -- Créer point GPS utilisateur si fourni
    IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        v_user_point := ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography;
    END IF;

    RETURN QUERY
    WITH agency_data AS (
        SELECT 
            av.id,
            av.service_id,
            av.nom,
            av.adresse,
            av.quartier,
            av.ville,
            av.gps,
            av.telephone,
            av.whatsapp,
            av.email,
            av.peut_emettre_tickets_bus,
            av.bus_products_config,
            CASE 
                WHEN v_user_point IS NOT NULL AND av.gps IS NOT NULL AND av.gps != '' THEN
                    calculate_distance_km(
                        p_user_lat,
                        p_user_lng,
                        SPLIT_PART(av.gps, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(av.gps, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS agency_distance_km
        FROM agences_voyage av
        WHERE av.is_active = TRUE
            AND av.peut_emettre_tickets_bus = TRUE
            AND (
                p_agency_name IS NULL OR
                av.nom ILIKE '%' || p_agency_name || '%'
            )
            AND (
                v_user_point IS NULL OR
                av.gps IS NULL OR
                av.gps = '' OR
                ST_DWithin(
                    ST_SetSRID(ST_MakePoint(
                        SPLIT_PART(av.gps, ',', 2)::DOUBLE PRECISION,
                        SPLIT_PART(av.gps, ',', 1)::DOUBLE PRECISION
                    ), 4326)::geography,
                    v_user_point,
                    p_radius_km * 1000
                )
            )
    ),
    product_data AS (
        SELECT 
            p.id::text AS product_id,
            p.name AS product_name,
            p.type AS product_type,
            p.depart AS departure_city,
            p.destination AS arrival_city,
            p.date_depart::date AS departure_date,
            p.date_depart::time AS departure_time,
            p.price AS ticket_price,
            p.currency,
            p.total_seats,
            p.bus_configuration,
            p.seat_map,
            p.numero_bus AS bus_number,
            p.user_id AS product_user_id,
            -- Extraire nom modèle depuis bus_products_config si disponible
            (av.bus_products_config->'modeles_bus'->0->>'nom_modele')::TEXT AS bus_model_name,
            -- Compter places réservées (confirmées ou pending)
            COALESCE(
                (SELECT COUNT(*)::INTEGER
                 FROM bus_reservations br
                 WHERE br.product_id = p.id::text
                   AND br.status IN ('pending', 'confirmed')
                   AND (br.expires_at IS NULL OR br.expires_at > NOW())),
                0
            ) AS reserved_seats,
            -- Calculer places disponibles
            GREATEST(
                0,
                COALESCE(p.total_seats, 0) - 
                COALESCE(
                    (SELECT COUNT(*)::INTEGER
                     FROM bus_reservations br
                     WHERE br.product_id = p.id::text
                       AND br.status IN ('pending', 'confirmed')
                       AND (br.expires_at IS NULL OR br.expires_at > NOW())),
                    0
                )
            ) AS available_seats
        FROM products p
        JOIN services s ON s.id = p.service_id
        JOIN agency_data av ON av.service_id = s.id
        WHERE p.type = 'ticket_voyage'
            AND p.is_active = TRUE
            AND (
                p_departure_city IS NULL OR
                p.depart ILIKE '%' || p_departure_city || '%'
            )
            AND (
                p_arrival_city IS NULL OR
                p.destination ILIKE '%' || p_arrival_city || '%'
            )
            AND (
                p_departure_date IS NULL OR
                p.date_depart::date = p_departure_date
            )
            -- ✅ CORRIGÉ: Toujours filtrer les voyages passés (programmés uniquement)
            AND p.date_depart::date >= CURRENT_DATE
    )
    SELECT 
        ad.id AS agency_id,
        ad.service_id AS agency_service_id,
        ad.nom AS agency_nom,
        ad.adresse AS agency_adresse,
        ad.quartier AS agency_quartier,
        ad.ville AS agency_ville,
        ad.gps AS agency_gps,
        ad.telephone AS agency_telephone,
        ad.whatsapp AS agency_whatsapp,
        ad.email AS agency_email,
        ad.peut_emettre_tickets_bus AS agency_peut_emettre_tickets,
        
        pd.product_id,
        pd.product_name,
        pd.product_type,
        pd.bus_model_name,
        pd.total_seats,
        pd.available_seats,
        pd.reserved_seats,
        pd.bus_number,
        pd.departure_city,
        pd.arrival_city,
        pd.departure_date,
        pd.departure_time,
        pd.ticket_price,
        pd.currency,
        pd.bus_configuration,
        pd.seat_map,
        
        ad.agency_distance_km AS distance_km,
        
        -- Score de pertinence
        (
            CASE WHEN pd.available_seats >= p_min_seats THEN 10 ELSE 0 END +
            CASE WHEN pd.departure_date = CURRENT_DATE THEN 5 ELSE 0 END +
            CASE WHEN pd.departure_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days' THEN 3 ELSE 0 END +
            CASE WHEN ad.agency_distance_km IS NOT NULL AND ad.agency_distance_km <= 10 THEN 5 ELSE 0 END +
            CASE WHEN ad.agency_distance_km IS NOT NULL AND ad.agency_distance_km <= 25 THEN 3 ELSE 0 END +
            CASE WHEN p_departure_city IS NOT NULL AND pd.departure_city ILIKE '%' || p_departure_city || '%' THEN 8 ELSE 0 END +
            CASE WHEN p_arrival_city IS NOT NULL AND pd.arrival_city ILIKE '%' || p_arrival_city || '%' THEN 8 ELSE 0 END
        )::DOUBLE PRECISION AS relevance_score
    FROM agency_data ad
    JOIN product_data pd ON pd.product_user_id = ad.id
    WHERE pd.available_seats >= p_min_seats
    ORDER BY 
        relevance_score DESC,
        distance_km ASC NULLS LAST,
        pd.departure_date ASC,
        pd.departure_time ASC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Commentaire
COMMENT ON FUNCTION search_bus_tickets_with_availability IS 'Recherche tickets bus avec disponibilité en temps réel (combine agences_voyage + products + bus_reservations)';

-- ============================================================================
-- 3. FONCTION POUR OBTENIR LES PLACES DISPONIBLES D'UN PRODUIT
-- ============================================================================

CREATE OR REPLACE FUNCTION get_bus_seat_availability(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_reserved_seats TEXT[];
    v_available_seats JSONB;
    v_seat_map JSONB;
    v_seat JSONB;
    v_reserved_count INTEGER;
BEGIN
    -- Récupérer le produit
    SELECT 
        p.total_seats,
        p.seat_map,
        p.bus_configuration
    INTO v_product
    FROM products p
    WHERE p.id::text = p_product_id
        AND p.type = 'ticket_voyage'
        AND p.is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Produit non trouvé'
        );
    END IF;
    
    -- Récupérer les places réservées (pending ou confirmed, non expirées)
    SELECT ARRAY_AGG(br.seat_id)
    INTO v_reserved_seats
    FROM bus_reservations br
    WHERE br.product_id = p_product_id
        AND br.status IN ('pending', 'confirmed')
        AND (br.expires_at IS NULL OR br.expires_at > NOW());
    
    -- Si pas de seat_map, créer un plan basique
    IF v_product.seat_map IS NULL THEN
        v_seat_map := jsonb_build_array();
    ELSE
        v_seat_map := v_product.seat_map;
    END IF;
    
    -- Calculer le nombre de places réservées (gérer NULL)
    v_reserved_count := COALESCE(
        CASE WHEN v_reserved_seats IS NULL THEN 0 ELSE array_length(v_reserved_seats, 1) END,
        0
    );
    
    -- Marquer les places comme réservées ou disponibles
    v_available_seats := jsonb_build_object(
        'total_seats', v_product.total_seats,
        'reserved_count', v_reserved_count,
        'available_count', GREATEST(0, COALESCE(v_product.total_seats, 0) - v_reserved_count),
        'reserved_seats', COALESCE(to_jsonb(v_reserved_seats), '[]'::jsonb),
        'seats', v_seat_map
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'availability', v_available_seats
    );
END;
$$ LANGUAGE plpgsql;

-- Commentaire
COMMENT ON FUNCTION get_bus_seat_availability IS 'Retourne la disponibilité des places d''un bus en temps réel';

