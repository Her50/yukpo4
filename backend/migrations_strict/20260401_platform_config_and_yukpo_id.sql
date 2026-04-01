-- Migration: Table platform_config + remplacement ID Yukpo hardcodé (user_id = 1)
-- Date: 2026-04-01
-- Problème corrigé: process_bus_ticket_payment_with_commission utilisait user_id = 1 (hardcodé)
--   pour créditer les commissions Yukpo. Si le compte admin n'est pas l'utilisateur 1,
--   les commissions vont au mauvais compte.
-- Solution: Table platform_config + fonction get_yukpo_platform_user_id() dynamique.

-- ============================================================================
-- 1. TABLE platform_config (paramètres globaux de la plateforme)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer la clé yukpo_platform_user_id avec la valeur par défaut 1.
-- IMPORTANT: L'administrateur doit mettre à jour cette valeur avec le vrai ID
-- du compte Yukpo via : UPDATE platform_config SET value = '<id>' WHERE key = 'yukpo_platform_user_id';
INSERT INTO platform_config (key, value, description)
VALUES (
    'yukpo_platform_user_id',
    '1',
    'ID du compte utilisateur de la plateforme Yukpo. Toutes les commissions (5% + booking_fee) sont créditées sur ce compte. DOIT être mis à jour avec le vrai ID admin.'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. FONCTION get_yukpo_platform_user_id()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_yukpo_platform_user_id()
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    SELECT value::INTEGER
    INTO v_id
    FROM platform_config
    WHERE key = 'yukpo_platform_user_id';

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Configuration manquante: yukpo_platform_user_id non défini dans platform_config';
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_yukpo_platform_user_id IS
    'Retourne l''ID du compte plateforme Yukpo depuis platform_config. '
    'Ne jamais hardcoder user_id = 1 directement — utiliser cette fonction.';

-- ============================================================================
-- 3. RÉÉCRIRE process_bus_ticket_payment_with_commission — sans ID hardcodé
-- ============================================================================

CREATE OR REPLACE FUNCTION process_bus_ticket_payment_with_commission(
    p_payment_id TEXT,
    p_ticket_price INTEGER,
    p_number_of_tickets INTEGER,
    p_booking_fee INTEGER DEFAULT 500
)
RETURNS JSONB AS $$
DECLARE
    v_subtotal        INTEGER;
    v_commission      INTEGER;
    v_agency_payout   INTEGER;
    v_total_amount    INTEGER;
    v_agency_user_id  INTEGER;
    v_yukpo_user_id   INTEGER;
    v_payment         RECORD;
BEGIN
    -- Récupérer l'ID Yukpo dynamiquement (jamais hardcodé)
    v_yukpo_user_id := get_yukpo_platform_user_id();

    -- Calculer montants
    v_subtotal      := p_ticket_price * p_number_of_tickets;
    v_commission    := ROUND(v_subtotal * 0.05);   -- 5% commission Yukpo
    v_agency_payout := v_subtotal - v_commission;
    v_total_amount  := v_subtotal + p_booking_fee;

    -- Récupérer l'agency_user_id depuis le paiement
    SELECT agency_user_id INTO v_agency_user_id
    FROM bus_ticket_payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;

    -- Crédit wallet agence (montant net, sans commission)
    PERFORM record_wallet_transaction(
        v_agency_user_id,
        'bus_ticket_payment',
        v_agency_payout,
        'bus_ticket_payment',
        p_payment_id,
        format('Paiement ticket bus - %s tickets à %s XAF', p_number_of_tickets, p_ticket_price),
        jsonb_build_object(
            'ticket_price',      p_ticket_price,
            'number_of_tickets', p_number_of_tickets,
            'subtotal',          v_subtotal,
            'commission',        v_commission,
            'booking_fee',       p_booking_fee
        )
    );

    -- Commission Yukpo (5% du subtotal → compte plateforme)
    PERFORM record_wallet_transaction(
        v_yukpo_user_id,
        'bus_commission_yukpo',
        v_commission,
        'bus_ticket_payment',
        p_payment_id,
        format('Commission Yukpo 5%% - %s tickets', p_number_of_tickets),
        jsonb_build_object(
            'commission_percentage', 5,
            'subtotal',              v_subtotal,
            'commission_amount',     v_commission
        )
    );

    -- Booking fee (frais fixes → compte plateforme, jamais remboursables)
    PERFORM record_wallet_transaction(
        v_yukpo_user_id,
        'bus_booking_fee',
        p_booking_fee,
        'bus_ticket_payment',
        p_payment_id,
        format('Frais réservation bus - %s tickets', p_number_of_tickets),
        jsonb_build_object('booking_fee', p_booking_fee)
    );

    -- Mettre à jour le paiement en mode escrow
    UPDATE bus_ticket_payments
    SET
        subtotal           = v_subtotal,
        yukpo_commission   = v_commission,
        agency_payout      = v_agency_payout,
        total_amount       = v_total_amount,
        booking_fee        = p_booking_fee,
        payout_status      = 'pending',
        escrow_status      = 'held',
        wallet_credited_at = NOW(),
        updated_at         = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;

    RETURN jsonb_build_object(
        'success',          TRUE,
        'payment_id',       p_payment_id,
        'subtotal',         v_subtotal,
        'yukpo_commission', v_commission,
        'agency_payout',    v_agency_payout,
        'total_amount',     v_total_amount,
        'payout_status',    'pending',
        'escrow_status',    'held'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_bus_ticket_payment_with_commission IS
    'Calcule commissions et crédite les wallets. '
    'booking_fee + 5%% commission → compte Yukpo (get_yukpo_platform_user_id()). '
    'Subtotal net (95%%) → wallet agence. Argent réel en escrow jusqu''à embarquement.';
