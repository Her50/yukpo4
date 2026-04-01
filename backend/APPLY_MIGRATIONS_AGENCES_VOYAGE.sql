-- ============================================================
-- Script de migration manuelle — Service Agences de Voyage
-- Date: 2026-04-01
-- À exécuter via : Render Dashboard > Database > Query console
--                  OU psql $DATABASE_URL -f ce_fichier.sql
-- Toutes les instructions sont idempotentes (IF NOT EXISTS / DO NOTHING)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1 : platform_config + user_id Yukpo dynamique
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_config (key, value, description) VALUES
    ('yukpo_platform_user_id', '1',
     'user_id du compte plateforme Yukpo recevant les commissions. Mettre à jour si différent de 1.'),
    ('qr_hmac_secret', 'changeme-replace-with-secure-random-key-in-production',
     'Secret HMAC-SHA256 pour signer les QR codes de tickets bus. Surcharger via BUS_QR_HMAC_SECRET.')
ON CONFLICT (key) DO NOTHING;

-- Mettre ici le vrai user_id admin Yukpo si différent de 1 :
-- UPDATE platform_config SET value = '42' WHERE key = 'yukpo_platform_user_id';

-- Mettre ici le vrai secret HMAC (déjà dans le .env en priorité) :
UPDATE platform_config
SET value = '78e0c76fe187a9a671c53272442ee5828f8c1d78ec595db6ab3d18ef0c5fb59f'
WHERE key = 'qr_hmac_secret';

CREATE OR REPLACE FUNCTION get_yukpo_platform_user_id() RETURNS INTEGER
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT value::INTEGER FROM platform_config WHERE key = 'yukpo_platform_user_id'),
        1
    )
$$;

-- ─────────────────────────────────────────────────────────────
-- FIX 2 : Signature HMAC-SHA256 sur bus_ticket_payments
-- ─────────────────────────────────────────────────────────────

ALTER TABLE bus_ticket_payments
    ADD COLUMN IF NOT EXISTS qr_hmac_signature TEXT;

-- ─────────────────────────────────────────────────────────────
-- FIX 5 : Alias seat_map dans get_bus_seat_availability()
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_bus_seat_availability(p_product_id TEXT)
RETURNS JSONB AS $func$
DECLARE
    v_product        RECORD;
    v_reserved_seats TEXT[];
    v_blocked_seats  TEXT[];
    v_available_seats JSONB;
    v_seat_map       JSONB;
BEGIN
    SELECT p.total_seats, p.seat_map, p.bus_configuration
    INTO v_product
    FROM products p
    WHERE p.id::text = p_product_id
      AND p.type = 'ticket_voyage'
      AND p.is_active = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouvé');
    END IF;

    SELECT ARRAY_AGG(br.seat_id) INTO v_reserved_seats
    FROM bus_reservations br
    WHERE br.product_id = p_product_id
      AND br.status IN ('pending', 'confirmed')
      AND (br.expires_at IS NULL OR br.expires_at > NOW());

    v_seat_map := COALESCE(v_product.seat_map, '[]'::jsonb);

    BEGIN
        SELECT ARRAY_AGG(bsb.seat_id) INTO v_blocked_seats
        FROM bus_seat_blocks bsb
        WHERE bsb.product_id = p_product_id AND bsb.is_active = TRUE;
    EXCEPTION WHEN undefined_table THEN
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
        'seat_map',        v_seat_map,   -- clé canonique (préférée par le mobile)
        'seats',           v_seat_map    -- alias rétrocompatible
    );

    RETURN jsonb_build_object('success', TRUE, 'availability', v_available_seats);
END;
$func$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- FIX 8 : cancellation_deadline_hours sur agences_voyage
-- ─────────────────────────────────────────────────────────────

ALTER TABLE agences_voyage
    ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INTEGER
        NOT NULL DEFAULT 24
        CHECK (cancellation_deadline_hours >= 0 AND cancellation_deadline_hours <= 168);

-- Rétro-remplissage depuis services.data si la valeur y était déjà stockée
UPDATE agences_voyage av
SET cancellation_deadline_hours = CAST(s.data->>'cancellation_deadline_hours' AS INTEGER)
FROM services s
WHERE s.id = av.service_id
  AND s.data ? 'cancellation_deadline_hours'
  AND (s.data->>'cancellation_deadline_hours') ~ '^\d+$'
  AND CAST(s.data->>'cancellation_deadline_hours' AS INTEGER) BETWEEN 0 AND 168
  AND av.cancellation_deadline_hours = 24;

-- ─────────────────────────────────────────────────────────────
-- Vérification finale
-- ─────────────────────────────────────────────────────────────

SELECT key, LEFT(value, 20) AS value_preview FROM platform_config ORDER BY key;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'agences_voyage' AND column_name = 'cancellation_deadline_hours';
SELECT column_name FROM information_schema.columns
WHERE table_name = 'bus_ticket_payments' AND column_name = 'qr_hmac_signature';
