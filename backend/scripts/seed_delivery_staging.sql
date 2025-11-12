-- Seed de données staging pour les tests E2E (client + coursier + livraison)
-- Usage : psql "$DATABASE_URL" -f backend/scripts/seed_delivery_staging.sql

DO $$
DECLARE
    v_client_id           INTEGER;
    v_courier_user_id     INTEGER;
    v_courier_id          UUID;
    v_parcel_id           UUID;
    v_delivery_id         UUID;
BEGIN
    INSERT INTO users (
        email,
        password_hash,
        role,
        is_provider,
        tokens_balance,
        gps_consent,
        created_at,
        updated_at,
        nom,
        prenom,
        nom_complet,
        preferred_lang,
        token_price_user,
        token_price_provider,
        commission_pct
    )
    VALUES (
        'staging-client@yukpo.com',
        '$argon2id$v=19$m=65536,t=3,p=1$c3RhZ2luZw$E7o9p3hoDnN/S8/kVlzUcw',
        'user',
        FALSE,
        250000,
        TRUE,
        NOW(),
        NOW(),
        'Mbarga',
        'Aline',
        'Aline Mbarga',
        'fr',
        1.0,
        1.0,
        0.0
    )
    ON CONFLICT (email) DO UPDATE
        SET
            tokens_balance = EXCLUDED.tokens_balance,
            updated_at     = NOW()
    RETURNING id
    INTO v_client_id;

    IF v_client_id IS NULL THEN
        SELECT id
        INTO v_client_id
        FROM users
        WHERE email = 'staging-client@yukpo.com';
    END IF;

    INSERT INTO users (
        email,
        password_hash,
        role,
        is_provider,
        tokens_balance,
        gps_consent,
        created_at,
        updated_at,
        nom,
        prenom,
        nom_complet,
        preferred_lang,
        token_price_user,
        token_price_provider,
        commission_pct
    )
    VALUES (
        'staging-courier@yukpo.com',
        '$argon2id$v=19$m=65536,t=3,p=1$c3RhZ2luZw$E7o9p3hoDnN/S8/kVlzUcw',
        'user',
        TRUE,
        0,
        TRUE,
        NOW(),
        NOW(),
        'Biyong',
        'Yvan',
        'Yvan Biyong',
        'fr',
        1.0,
        1.0,
        0.0
    )
    ON CONFLICT (email) DO UPDATE
        SET updated_at = NOW()
    RETURNING id
    INTO v_courier_user_id;

    IF v_courier_user_id IS NULL THEN
        SELECT id
        INTO v_courier_user_id
        FROM users
        WHERE email = 'staging-courier@yukpo.com';
    END IF;

    INSERT INTO couriers (
        user_id,
        application_id,
        status,
        rating_average,
        rating_count,
        bio,
        hired_at
    )
    VALUES (
        v_courier_user_id,
        NULL,
        'approved',
        0,
        0,
        'Coursier staging – moto',
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
        SET
            status    = 'approved',
            bio       = EXCLUDED.bio,
            updated_at = NOW()
    RETURNING id
    INTO v_courier_id;

    IF v_courier_id IS NULL THEN
        SELECT id
        INTO v_courier_id
        FROM couriers
        WHERE user_id = v_courier_user_id;
    END IF;

    INSERT INTO courier_assets (
        courier_id,
        engine_type,
        is_primary,
        max_weight_kg,
        max_volume_cm3,
        equipments,
        available,
        availability_schedule,
        documents
    )
    VALUES (
        v_courier_id,
        'moto',
        TRUE,
        NULL,
        NULL,
        jsonb_build_object('helmet', true),
        TRUE,
        NULL,
        NULL
    )
    ON CONFLICT (courier_id) WHERE is_primary = TRUE
    DO UPDATE
        SET
            engine_type = EXCLUDED.engine_type,
            equipments  = EXCLUDED.equipments,
            available   = EXCLUDED.available,
            updated_at  = NOW();

    INSERT INTO delivery_parcels (
        type_id,
        weight_kg,
        volume_cm3,
        declared_value,
        notes,
        photos,
        constraints,
        created_at
    )
    VALUES (
        NULL,
        NULL,
        NULL,
        NULL,
        'Panier de courses (staging)',
        '[]'::jsonb,
        '{}'::jsonb,
        NOW()
    )
    RETURNING id
    INTO v_parcel_id;

    INSERT INTO deliveries (
        creator_id,
        courier_id,
        parcel_id,
        status,
        pickup_location,
        dropoff_location,
        pickup_address,
        dropoff_address,
        recipient_user_id,
        recipient_contact_name,
        recipient_contact_phone,
        recipient_notes,
        recipient_chat_thread_id,
        recipient_dropoff_override,
        recipient_dropoff_address,
        recipient_dropoff_updated_at,
        distance_meters,
        estimated_duration_seconds,
        metadata
    )
    VALUES (
        v_client_id,
        v_courier_id,
        v_parcel_id,
        'accepted',
        ST_SetSRID(ST_MakePoint(11.50120, 3.89810), 4326)::geography,
        ST_SetSRID(ST_MakePoint(11.50210, 3.90330), 4326)::geography,
        'Supermarché Bonapriso, Douala',
        'Client Bonapriso, Douala',
        v_client_id,
        'Aline Mbarga',
        '+237650000001',
        'Commande staging auto',
        NULL,
        NULL,
        'Client Bonapriso, Douala',
        NOW(),
        3500,
        780,
        jsonb_build_object(
            'seed', 'staging_delivery',
            'notes', 'Livraison E2E staging'
        )
    )
    ON CONFLICT (creator_id, parcel_id) DO NOTHING
    RETURNING id
    INTO v_delivery_id;

    IF v_delivery_id IS NULL THEN
        SELECT id
        INTO v_delivery_id
        FROM deliveries
        WHERE creator_id = v_client_id
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    INSERT INTO delivery_status_events (
        delivery_id,
        status,
        payload,
        recorded_by
    )
    VALUES (
        v_delivery_id,
        'accepted',
        jsonb_build_object('source', 'staging_seed'),
        v_client_id
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Staging seed ok -> client %, courier %, delivery %', v_client_id, v_courier_id, v_delivery_id;
END;
$$;



