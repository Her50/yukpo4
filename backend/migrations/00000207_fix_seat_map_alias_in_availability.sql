-- Fix: add 'seat_map' alias alongside 'seats' in get_bus_seat_availability()
-- Context: mobile fallback was `availability.seat_map || availability.seats`
--   but the function only returned 'seats'. Now both keys are present so the
--   preferred 'seat_map' path is always taken, consistent with
--   search_bus_tickets_with_availability() which already returns 'seat_map'.

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

    BEGIN
        SELECT ARRAY_AGG(bsb.seat_id) INTO v_blocked_seats
        FROM bus_seat_blocks bsb
        WHERE bsb.product_id = p_product_id AND bsb.is_active = TRUE;
    EXCEPTION
        WHEN undefined_table THEN
            v_blocked_seats := CAST(ARRAY[] AS TEXT[]);
    END;

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
        'total_seats',     v_product.total_seats,
        'reserved_count',  COALESCE(array_length(v_reserved_seats, 1), 0),
        'blocked_count',   COALESCE(array_length(v_blocked_seats, 1), 0),
        'available_count', GREATEST(0,
            COALESCE(v_product.total_seats, 0)
            - COALESCE(array_length(v_reserved_seats, 1), 0)
            - COALESCE(array_length(v_blocked_seats, 1), 0)
        ),
        'reserved_seats',  COALESCE(to_jsonb(v_reserved_seats), '[]'::jsonb),
        'blocked_seats',   COALESCE(to_jsonb(v_blocked_seats), '[]'::jsonb),
        'seat_map',        v_seat_map,   -- preferred key (matches search function)
        'seats',           v_seat_map    -- backward-compat alias
    );

    RETURN jsonb_build_object('success', TRUE, 'availability', v_available_seats);
END;
$$ LANGUAGE plpgsql;
