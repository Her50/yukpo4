-- Migration: Amélioration du système de matching pour retours
-- Date: 2025-01-28
-- Description: Fonction améliorée pour matcher les demandes de retour avec les buses créés

-- 1. Fonction améliorée pour matcher une demande de retour avec un produit
CREATE OR REPLACE FUNCTION match_return_trip_request_with_product(
    p_request_id TEXT,
    p_product_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
    v_product RECORD;
    v_matches BOOLEAN := FALSE;
    v_available_seats INTEGER;
BEGIN
    -- Récupérer la demande
    SELECT * INTO v_request
    FROM return_trip_requests
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Demande non trouvée ou déjà traitée');
    END IF;
    
    -- Récupérer le produit
    SELECT 
        p.*,
        (p.metadata->>'departure_city')::text as departure_city,
        (p.metadata->>'arrival_city')::text as arrival_city,
        (p.metadata->>'departure_date')::date as departure_date,
        (p.metadata->>'departure_time')::time as departure_time
    INTO v_product
    FROM products p
    WHERE p.id::text = p_product_id AND p.type = 'ticket_voyage';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouvé');
    END IF;
    
    -- Vérifier le matching
    -- 1. Route inverse (return_from = arrival_city, return_to = departure_city)
    IF v_request.return_from = v_product.arrival_city 
       AND v_request.return_to = v_product.departure_city THEN
        -- 2. Date avec flexibilité
        IF v_product.departure_date BETWEEN 
            (v_request.preferred_return_date::date - INTERVAL '1 day' * v_request.date_flexibility_days)
            AND (v_request.preferred_return_date::date + INTERVAL '1 day' * v_request.date_flexibility_days) THEN
            -- 3. Places disponibles
            SELECT COUNT(*) INTO v_available_seats
            FROM bus_seats
            WHERE product_id = p_product_id AND is_available = TRUE;
            
            IF v_available_seats >= v_request.number_of_seats THEN
                v_matches := TRUE;
                
                -- Mettre à jour la demande
                UPDATE return_trip_requests
                SET 
                    matched_product_id = p_product_id,
                    matched_at = NOW(),
                    status = 'matched',
                    updated_at = NOW()
                WHERE id = p_request_id;
            END IF;
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'matches', v_matches,
        'available_seats', v_available_seats,
        'required_seats', v_request.number_of_seats
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Fonction pour matcher automatiquement toutes les demandes en attente avec un nouveau produit
CREATE OR REPLACE FUNCTION auto_match_return_requests_for_product(p_product_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_product RECORD;
    v_request RECORD;
    v_matched_count INTEGER := 0;
BEGIN
    -- Récupérer les infos du produit
    SELECT 
        (metadata->>'departure_city')::text as departure_city,
        (metadata->>'arrival_city')::text as arrival_city,
        (metadata->>'departure_date')::date as departure_date
    INTO v_product
    FROM products
    WHERE id::text = p_product_id AND type = 'ticket_voyage';
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Parcourir les demandes en attente et essayer de les matcher
    FOR v_request IN 
        SELECT * FROM return_trip_requests
        WHERE status = 'pending'
            AND return_from = v_product.arrival_city
            AND return_to = v_product.departure_city
            AND v_product.departure_date BETWEEN 
                (preferred_return_date::date - INTERVAL '1 day' * date_flexibility_days)
                AND (preferred_return_date::date + INTERVAL '1 day' * date_flexibility_days)
    LOOP
        -- Vérifier les places disponibles
        IF EXISTS (
            SELECT 1 FROM bus_seats
            WHERE product_id = p_product_id 
                AND is_available = TRUE
            HAVING COUNT(*) >= v_request.number_of_seats
        ) THEN
            -- Matcher la demande
            UPDATE return_trip_requests
            SET 
                matched_product_id = p_product_id,
                matched_at = NOW(),
                status = 'matched',
                notification_sent = FALSE, -- Sera envoyée par le système
                updated_at = NOW()
            WHERE id = v_request.id;
            
            v_matched_count := v_matched_count + 1;
            
            -- TODO: Déclencher notification push (fait ailleurs dans le code)
        END IF;
    END LOOP;
    
    RETURN v_matched_count;
END;
$$ LANGUAGE plpgsql;

-- 3. Commentaires
COMMENT ON FUNCTION match_return_trip_request_with_product IS 'Match une demande de retour spécifique avec un produit bus';
COMMENT ON FUNCTION auto_match_return_requests_for_product IS 'Match automatiquement toutes les demandes en attente avec un nouveau produit créé';

