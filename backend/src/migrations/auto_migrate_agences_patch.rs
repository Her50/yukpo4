// Patch inline 2026-04-01 — migrations agences de voyage
// Ce fichier est inclus via mod dans auto_migrate.rs (non — fonctions ajoutées directement)

use log::info;
use sqlx::PgPool;

/// Fix 1 — Crée platform_config et fixe le user_id Yukpo dynamique
pub async fn ensure_platform_config_and_yukpo_user(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS platform_config (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL,
            description TEXT,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO platform_config (key, value, description) VALUES
            ('yukpo_platform_user_id', '1',
             'user_id du compte plateforme Yukpo recevant les commissions.'),
            ('qr_hmac_secret', 'changeme-replace-with-secure-random-key-in-production',
             'Secret HMAC-SHA256 QR tickets bus. Surcharger via BUS_QR_HMAC_SECRET env var.')
         ON CONFLICT (key) DO NOTHING",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE OR REPLACE FUNCTION get_yukpo_platform_user_id() RETURNS INTEGER
         LANGUAGE sql STABLE AS $$
             SELECT COALESCE(
                 (SELECT value::INTEGER FROM platform_config WHERE key = 'yukpo_platform_user_id'),
                 1
             )
         $$",
    )
    .execute(pool)
    .await?;

    info!("[ensure_platform_config] platform_config + get_yukpo_platform_user_id OK");
    Ok(())
}

/// Fix 2 — Ajoute qr_hmac_signature sur bus_ticket_payments
pub async fn ensure_bus_qr_hmac_signing(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "ALTER TABLE bus_ticket_payments ADD COLUMN IF NOT EXISTS qr_hmac_signature TEXT",
    )
    .execute(pool)
    .await?;

    info!("[ensure_bus_qr_hmac_signing] colonne qr_hmac_signature OK");
    Ok(())
}

/// Fix 5 — Ajoute seat_map comme alias de seats dans get_bus_seat_availability()
pub async fn ensure_seat_map_alias_in_availability(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Utiliser execute_migration_sql_safe pattern : ignorer si la fonction échoue
    let sql = r#"CREATE OR REPLACE FUNCTION get_bus_seat_availability(p_product_id TEXT)
RETURNS JSONB AS $func$
DECLARE
    v_product RECORD;
    v_reserved_seats TEXT[];
    v_blocked_seats TEXT[];
    v_available_seats JSONB;
    v_seat_map JSONB;
BEGIN
    SELECT p.total_seats, p.seat_map, p.bus_configuration
    INTO v_product
    FROM products p
    WHERE p.id::text = p_product_id
      AND p.type = 'ticket_voyage'
      AND p.is_active = TRUE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouve');
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
        'seat_map',        v_seat_map,
        'seats',           v_seat_map
    );
    RETURN jsonb_build_object('success', TRUE, 'availability', v_available_seats);
END;
$func$ LANGUAGE plpgsql"#;

    sqlx::query(sql).execute(pool).await?;
    info!("[ensure_seat_map_alias_in_availability] get_bus_seat_availability avec seat_map OK");
    Ok(())
}

/// Fix 8 — Ajoute cancellation_deadline_hours sur agences_voyage avec rétro-remplissage
pub async fn ensure_agences_voyage_cancellation_deadline(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "ALTER TABLE agences_voyage
             ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INTEGER
                 NOT NULL DEFAULT 24
                 CHECK (cancellation_deadline_hours >= 0 AND cancellation_deadline_hours <= 168)",
    )
    .execute(pool)
    .await?;

    // Rétro-remplissage depuis services.data si présent
    let _ = sqlx::query(
        "UPDATE agences_voyage av
         SET cancellation_deadline_hours = CAST(s.data->>'cancellation_deadline_hours' AS INTEGER)
         FROM services s
         WHERE s.id = av.service_id
           AND s.data ? 'cancellation_deadline_hours'
           AND (s.data->>'cancellation_deadline_hours') ~ '^\\d+$'
           AND CAST(s.data->>'cancellation_deadline_hours' AS INTEGER) BETWEEN 0 AND 168
           AND av.cancellation_deadline_hours = 24",
    )
    .execute(pool)
    .await;

    info!("[ensure_agences_voyage_cancellation_deadline] cancellation_deadline_hours OK");
    Ok(())
}
