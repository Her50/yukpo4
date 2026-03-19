-- Fonctions bus et tables agences de voyage

-- Ajouter colonne bus_products_config à agences_voyage
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='agences_voyage' AND column_name='bus_products_config') THEN
        ALTER TABLE agences_voyage ADD COLUMN bus_products_config JSONB;
    END IF;
END $$;

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_agences_bus_products_gin ON agences_voyage USING GIN(bus_products_config) WHERE bus_products_config IS NOT NULL;

-- Commentaire
COMMENT ON COLUMN agences_voyage.bus_products_config IS 'Configuration des modèles de bus (products de type ticket_voyage) liés à cette agence';

-- Fonction de recherche tickets bus avec disponibilité
CREATE OR REPLACE FUNCTION search_bus_tickets_with_availability(
    p_departure_city TEXT DEFAULT NULL,
    p_arrival_city TEXT DEFAULT NULL,
    p_departure_date DATE DEFAULT NULL,
    p_user_lat DOUBLE PRECISION DEFAULT NULL,
    p_user_lng DOUBLE PRECISION DEFAULT NULL,
    p_max_distance_km DOUBLE PRECISION DEFAULT 50.0,
    p_min_seats INTEGER DEFAULT 1
)
RETURNS TABLE(
    agency_id INTEGER,
    agency_service_id INTEGER,
    agency_nom TEXT,
    agency_adresse TEXT,
    agency_quartier TEXT,
    agency_ville TEXT,
    agency_gps TEXT,
    agency_telephone TEXT,
    agency_whatsapp TEXT,
    agency_email TEXT,
    agency_peut_emettre_tickets BOOLEAN,
    product_id TEXT,
    product_name TEXT,
    product_type TEXT,
    bus_model_name TEXT,
    total_seats INTEGER,
    available_seats INTEGER,
    reserved_seats INTEGER,
    bus_number TEXT,
    departure_city TEXT,
    arrival_city TEXT,
    departure_date VARCHAR(20),
    departure_time VARCHAR(10),
    ticket_price INTEGER,
    currency VARCHAR(10),
    bus_configuration JSONB,
    seat_map JSONB,
    distance_km DOUBLE PRECISION,
    relevance_score INTEGER
) AS $$
BEGIN
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
            CASE 
                WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND av.gps IS NOT NULL AND av.gps LIKE '%,%' THEN
                    6371.0 * acos(
                        LEAST(1.0,
                            sin(radians(p_user_lat)) * sin(radians(CAST(SPLIT_PART(av.gps, ',', 1) AS DOUBLE PRECISION))) +
                            cos(radians(p_user_lat)) * cos(radians(CAST(SPLIT_PART(av.gps, ',', 1) AS DOUBLE PRECISION))) *
                            cos(radians(p_user_lng - CAST(SPLIT_PART(av.gps, ',', 2) AS DOUBLE PRECISION)))
                        )
                    )
                ELSE NULL
            END as agency_distance_km
        FROM agences_voyage av
        WHERE av.is_active = TRUE
            AND av.peut_emettre_tickets_bus = TRUE
    ),
    product_data AS (
        SELECT 
            CAST(p.id AS TEXT) as product_id,
            p.name as product_name,
            p.type as product_type,
            p.metadata->>'bus_model_name' as bus_model_name,
            CAST((p.metadata->>'total_seats') AS INTEGER) as total_seats,
            CAST((p.metadata->>'total_seats') AS INTEGER) - COALESCE(COUNT(br.id), 0) as available_seats,
            COALESCE(COUNT(br.id), 0) as reserved_seats,
            p.metadata->>'bus_number' as bus_number,
            p.metadata->>'departure_city' as departure_city,
            p.metadata->>'arrival_city' as arrival_city,
            p.metadata->>'departure_date' as departure_date,
            p.metadata->>'departure_time' as departure_time,
            CAST((p.metadata->'ticket_price'->>'montant') AS INTEGER) as ticket_price,
            COALESCE(p.metadata->'ticket_price'->>'devise', 'XAF') as currency,
            p.metadata->'bus_configuration' as bus_configuration,
            p.metadata->'seat_map' as seat_map,
            CAST((p.metadata->>'user_id') AS INTEGER) as product_user_id
        FROM products p
        LEFT JOIN bus_reservations br ON br.product_id = CAST(p.id AS TEXT) 
            AND br.status IN ('pending', 'confirmed')
            AND (br.expires_at IS NULL OR br.expires_at > NOW())
        WHERE p.type = 'ticket_voyage'
            AND p.is_active = TRUE
            AND (p_departure_date IS NULL OR p.metadata->>'departure_date' = p_departure_date::TEXT)
            AND (p_departure_city IS NULL OR p.metadata->>'departure_city' ILIKE '%' || p_departure_city || '%')
            AND (p_arrival_city IS NULL OR p.metadata->>'arrival_city' ILIKE '%' || p_arrival_city || '%')
        GROUP BY p.id, p.name, p.type, p.metadata
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
        (
            CASE WHEN pd.available_seats >= p_min_seats THEN 10 ELSE 0 END +
            CASE WHEN pd.departure_date = CURRENT_DATE::TEXT THEN 5 ELSE 0 END +
            CASE WHEN pd.departure_date BETWEEN CURRENT_DATE::TEXT AND (CURRENT_DATE + INTERVAL '3 days')::TEXT THEN 3 ELSE 0 END +
            CASE WHEN ad.agency_distance_km IS NOT NULL AND ad.agency_distance_km <= 10 THEN 5 ELSE 0 END +
            CASE WHEN ad.agency_distance_km IS NOT NULL AND ad.agency_distance_km <= 25 THEN 3 ELSE 0 END +
            CASE WHEN p_departure_city IS NOT NULL AND pd.departure_city ILIKE '%' || p_departure_city || '%' THEN 8 ELSE 0 END +
            CASE WHEN p_arrival_city IS NOT NULL AND pd.arrival_city ILIKE '%' || p_arrival_city || '%' THEN 8 ELSE 0 END
        ) AS relevance_score
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

-- Fonction pour obtenir les places disponibles d'un produit
CREATE OR REPLACE FUNCTION get_bus_seat_availability(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_reserved_seats TEXT[];
    v_blocked_seats TEXT[];
    v_available_seats JSONB;
    v_seat_map JSONB;
BEGIN
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
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouvé');
    END IF;
    
    SELECT ARRAY_AGG(br.seat_id)
    INTO v_reserved_seats
    FROM bus_reservations br
    WHERE br.product_id = p_product_id
        AND br.status IN ('pending', 'confirmed')
        AND (br.expires_at IS NULL OR br.expires_at > NOW());
    
    IF v_product.seat_map IS NULL THEN
        v_seat_map := jsonb_build_array();
    ELSE
        v_seat_map := v_product.seat_map;
    END IF;
    
    -- Récupérer les places bloquées (si table existe)
    BEGIN
        SELECT ARRAY_AGG(bsb.seat_id) INTO v_blocked_seats
        FROM bus_seat_blocks bsb
        WHERE bsb.product_id = p_product_id AND bsb.is_active = TRUE;
    EXCEPTION
        WHEN undefined_table THEN
            v_blocked_seats := CAST(ARRAY[] AS TEXT[]);
    END;
    
    -- Mettre à jour le seat_map avec statuts (incluant blocages)
    v_seat_map := (
        SELECT jsonb_agg(
            CASE 
                WHEN seat->>'seat_id' = ANY(v_blocked_seats) THEN
                    seat || jsonb_build_object('available', FALSE, 'status', 'blocked', 'blocked_reason', 'maintenance')
                WHEN seat->>'seat_id' = ANY(v_reserved_seats) THEN
                    seat || jsonb_build_object('available', FALSE, 'status', 'reserved')
                ELSE
                    seat || jsonb_build_object('available', TRUE, 'status', 'available')
            END
        )
        FROM jsonb_array_elements(v_seat_map) AS seat
    );
    
    v_available_seats := jsonb_build_object(
        'total_seats', v_product.total_seats,
        'reserved_count', COALESCE(array_length(v_reserved_seats, 1), 0),
        'blocked_count', COALESCE(array_length(v_blocked_seats, 1), 0),
        'available_count', GREATEST(0, 
            COALESCE(v_product.total_seats, 0) 
            - COALESCE(array_length(v_reserved_seats, 1), 0)
            - COALESCE(array_length(v_blocked_seats, 1), 0)
        ),
        'reserved_seats', COALESCE(to_jsonb(v_reserved_seats), '[]'::jsonb),
        'blocked_seats', COALESCE(to_jsonb(v_blocked_seats), '[]'::jsonb),
        'seats', v_seat_map
    );
    
    RETURN jsonb_build_object('success', TRUE, 'availability', v_available_seats);
END;
$$ LANGUAGE plpgsql;





