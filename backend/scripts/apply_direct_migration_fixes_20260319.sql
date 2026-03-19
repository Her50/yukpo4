-- Direct production-safe fixes for failing migrations
-- Date: 2026-03-19

BEGIN;

-- 1) Fix merchant_storage_locations partial schema
ALTER TABLE IF EXISTS merchant_storage_locations
    ADD COLUMN IF NOT EXISTS merchant_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='merchant_storage_locations'
          AND column_name='merchant_id'
    ) THEN
        EXECUTE '
            UPDATE merchant_storage_locations
            SET merchant_user_id = merchant_id
            WHERE merchant_user_id IS NULL
        ';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant
    ON merchant_storage_locations(merchant_user_id, is_active)
    WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_zone
    ON merchant_storage_locations(zone_id)
    WHERE zone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant_location
    ON merchant_storage_locations(merchant_user_id, is_active)
    WHERE is_active = TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- 2) Fix deliveries round-trip columns missing in auto migration
ALTER TABLE IF EXISTS deliveries
    ADD COLUMN IF NOT EXISTS return_trip_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS return_trip_match_id UUID,
    ADD COLUMN IF NOT EXISTS return_trip_compatible_couriers JSONB;

-- 3) Fix enum value missing
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_engine_type')
       AND NOT EXISTS (
           SELECT 1
           FROM pg_type t
           JOIN pg_enum e ON e.enumtypid = t.oid
           WHERE t.typname = 'delivery_engine_type' AND e.enumlabel = 'tricycle'
       ) THEN
        ALTER TYPE delivery_engine_type ADD VALUE 'tricycle';
    END IF;
END $$;

-- 4) Create missing librairie network tables with integer FK compatibility
CREATE TABLE IF NOT EXISTS librairie_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    gps VARCHAR(100),
    ville VARCHAR(100) NOT NULL,
    quartier VARCHAR(100),
    rayon_service_km INTEGER NOT NULL DEFAULT 50,
    statut librairie_statut NOT NULL DEFAULT 'en_validation',
    rating DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    temps_moyen_validation INTEGER NOT NULL DEFAULT 5,
    commission_app DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    horaires_ouverture VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commandes_mixtes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reference_commande VARCHAR(50) NOT NULL UNIQUE,
    budget_total DECIMAL(12,2) NOT NULL,
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    statut commande_statut NOT NULL DEFAULT 'edition',
    mode_livraison VARCHAR(50) NOT NULL DEFAULT 'coursier',
    adresse_livraison TEXT,
    gps_livraison VARCHAR(100),
    notes_client TEXT,
    commission_app DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    montant_net_libraires DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commande_livres_neufs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID NOT NULL REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    programme_scolaire_id INTEGER REFERENCES programmes_scolaires(id),
    titre VARCHAR(500) NOT NULL,
    auteur VARCHAR(255),
    editeur VARCHAR(255),
    isbn VARCHAR(50),
    classe VARCHAR(100) NOT NULL,
    matiere VARCHAR(100) NOT NULL,
    niveau VARCHAR(100),
    prix_officiel DECIMAL(12,2) NOT NULL,
    prix_final DECIMAL(12,2) NOT NULL,
    quantite INTEGER NOT NULL DEFAULT 1,
    est_au_programme BOOLEAN NOT NULL DEFAULT FALSE,
    librairie_validateur_id UUID REFERENCES librairie_partners(id),
    statut_validation livre_validation_statut NOT NULL DEFAULT 'en_attente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commande_livres_occasion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID NOT NULL REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    livre_scolaire_id INTEGER REFERENCES livres_scolaires(id),
    titre VARCHAR(500) NOT NULL,
    auteur VARCHAR(255),
    classe VARCHAR(100) NOT NULL,
    matiere VARCHAR(100) NOT NULL,
    etat_livre VARCHAR(100) NOT NULL,
    prix DECIMAL(12,2) NOT NULL,
    vendeur_id INTEGER NOT NULL REFERENCES users(id),
    quantite INTEGER NOT NULL DEFAULT 1,
    statut livre_occasion_statut NOT NULL DEFAULT 'disponible',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commande_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID NOT NULL REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    librairie_id UUID NOT NULL REFERENCES librairie_partners(id) ON DELETE CASCADE,
    statut validation_statut NOT NULL DEFAULT 'en_cours',
    livres_valides JSONB DEFAULT '[]',
    timestamp_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timestamp_fin TIMESTAMPTZ,
    verrou_exclusif BOOLEAN NOT NULL DEFAULT FALSE,
    notes_validation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prix_officiels_programme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_scolaire_id INTEGER REFERENCES programmes_scolaires(id) ON DELETE CASCADE,
    titre VARCHAR(500) NOT NULL,
    auteur VARCHAR(255),
    editeur VARCHAR(255),
    isbn VARCHAR(50),
    classe VARCHAR(100) NOT NULL,
    matiere VARCHAR(100) NOT NULL,
    niveau VARCHAR(100),
    prix_officiel DECIMAL(12,2) NOT NULL,
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    source prix_source NOT NULL DEFAULT 'ia_extraction',
    confiance_score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    fichier_source TEXT,
    date_extraction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_codes_coursier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paquet_id TEXT NOT NULL,
    coursier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_secret VARCHAR(20) NOT NULL UNIQUE,
    qr_code_data TEXT NOT NULL,
    timestamp_generation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timestamp_scan TIMESTAMPTZ,
    timestamp_validation TIMESTAMPTZ,
    statut qr_code_statut NOT NULL DEFAULT 'genere',
    livres_attendus JSONB NOT NULL DEFAULT '[]',
    destinations JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications_librairie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    librairie_id UUID NOT NULL REFERENCES librairie_partners(id) ON DELETE CASCADE,
    commande_id UUID REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    type_notification type_notification NOT NULL,
    message TEXT NOT NULL,
    donnees_supplementaires JSONB,
    statut notification_statut NOT NULL DEFAULT 'envoyee',
    timestamp_envoi TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timestamp_lecture TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions_agregees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID REFERENCES commandes_mixtes(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    montant_total DECIMAL(12,2) NOT NULL,
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    methode_paiement methode_paiement NOT NULL,
    statut transaction_statut NOT NULL DEFAULT 'en_attente',
    reference_paiement VARCHAR(100) NOT NULL UNIQUE,
    provider_transaction_id VARCHAR(255),
    commission_app DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    montant_net DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    details_repartition JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chaines_livraison_unifiees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID NOT NULL REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    reference_chaine VARCHAR(50) NOT NULL UNIQUE,
    statut chaine_statut NOT NULL DEFAULT 'en_construction',
    coursier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    points_passage JSONB NOT NULL DEFAULT '[]',
    distance_totale_km DECIMAL(8,2) NOT NULL DEFAULT 0.0,
    duree_estimee_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Ensure missing escrow functions exist (safe simplified versions)
CREATE OR REPLACE FUNCTION release_escrow_to_agency(p_payment_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
BEGIN
    SELECT * INTO v_payment FROM bus_ticket_payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;

    UPDATE bus_ticket_payments
    SET payout_status = 'completed',
        payout_at = NOW(),
        escrow_status = 'released',
        escrow_released_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', p_payment_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cancel_bus_ticket(
    p_payment_id TEXT,
    p_user_id INTEGER,
    p_reason TEXT DEFAULT 'user_request'
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
BEGIN
    SELECT * INTO v_payment
    FROM bus_ticket_payments
    WHERE id = p_payment_id
      AND user_id = p_user_id
      AND payment_status IN ('completed', 'escrow');

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé ou déjà annulé');
    END IF;

    UPDATE bus_ticket_payments
    SET payment_status = 'cancelled',
        escrow_status = 'refunded',
        updated_at = NOW()
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', TRUE, 'payment_id', p_payment_id, 'reason', p_reason);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION defer_bus_ticket(
    p_payment_id TEXT,
    p_user_id INTEGER,
    p_penalty_pct NUMERIC(5,2) DEFAULT 10.00,
    p_reason TEXT DEFAULT 'user_request'
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_credit_id TEXT;
    v_penalty INTEGER;
    v_net_credit INTEGER;
BEGIN
    SELECT * INTO v_payment
    FROM bus_ticket_payments
    WHERE id = p_payment_id
      AND user_id = p_user_id
      AND payment_status IN ('completed', 'escrow');

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;

    v_penalty := ROUND(COALESCE(v_payment.subtotal, 0) * p_penalty_pct / 100.0);
    v_net_credit := GREATEST(COALESCE(v_payment.subtotal, 0) - v_penalty, 0);

    INSERT INTO bus_ticket_credits (
        user_id, original_payment_id, original_agency_user_id,
        original_amount, penalty_amount, penalty_percentage, net_credit_amount,
        original_departure_city, original_arrival_city, original_departure_date,
        original_departure_time, original_ticket_price, original_number_of_tickets,
        reason, status
    ) VALUES (
        p_user_id, p_payment_id, v_payment.agency_user_id,
        COALESCE(v_payment.subtotal, 0), v_penalty, p_penalty_pct, v_net_credit,
        COALESCE(v_payment.departure_city, ''), COALESCE(v_payment.arrival_city, ''),
        COALESCE(v_payment.departure_date, ''), COALESCE(v_payment.departure_time, ''),
        COALESCE(v_payment.ticket_price, 0), COALESCE(v_payment.number_of_tickets, 1),
        p_reason, 'active'
    ) RETURNING id INTO v_credit_id;

    UPDATE bus_ticket_payments
    SET payment_status = 'deferred',
        escrow_status = 'credited',
        credit_id = v_credit_id,
        updated_at = NOW()
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', TRUE, 'credit_id', v_credit_id, 'net_credit_amount', v_net_credit);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION apply_ticket_credit(
    p_credit_id TEXT,
    p_user_id INTEGER,
    p_new_payment_id TEXT,
    p_new_ticket_price INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_credit RECORD;
BEGIN
    SELECT * INTO v_credit
    FROM bus_ticket_credits
    WHERE id = p_credit_id
      AND user_id = p_user_id
      AND status = 'active';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Crédit introuvable');
    END IF;

    UPDATE bus_ticket_credits
    SET status = 'used',
        used_for_payment_id = p_new_payment_id,
        used_at = NOW(),
        updated_at = NOW()
    WHERE id = p_credit_id;

    RETURN jsonb_build_object('success', TRUE, 'credit_id', p_credit_id, 'new_payment_id', p_new_payment_id);
END;
$$ LANGUAGE plpgsql;

COMMIT;
