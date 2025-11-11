-- Migration: Création des enums du service de livraison
-- Date: 2025-11-10
DO $$
BEGIN
    CREATE TYPE delivery_status AS ENUM (
        'requested',
        'awaiting_courier_confirmation',
        'accepted',
        'en_route_pickup',
        'arrival_pickup',
        'picked_up',
        'shopping_in_progress',
        'shopping_completed',
        'en_route_delivery',
        'arrival_destination',
        'delivered',
        'completed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_cancel_reason AS ENUM (
        'client_cancelled',
        'courier_cancelled',
        'no_courier_available',
        'parcel_issue',
        'system_failure'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_engine_type AS ENUM (
        'moto',
        'scooter',
        'voiture',
        'camionnette',
        'velo_cargo',
        'pieton',
        'camion_leger',
        'autre'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_courier_status AS ENUM (
        'pending_review',
        'approved',
        'rejected',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_terrain_difficulty AS ENUM (
        'smooth',
        'moderate',
        'rough',
        'blocked'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE delivery_application_status AS ENUM (
        'draft',
        'submitted',
        'under_review',
        'approved',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_status AS ENUM (
        'pending',
        'awaiting_purchase',
        'shopping_in_progress',
        'shopping_completed',
        'checkout_submitted',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
    CREATE TYPE shopping_item_status AS ENUM (
        'pending',
        'purchased',
        'missing',
        'replaced'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

