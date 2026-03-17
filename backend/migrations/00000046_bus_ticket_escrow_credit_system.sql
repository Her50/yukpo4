-- Migration: Système d'escrow, commission app, annulation, crédits tickets bus
-- Date: 2026-03-16
-- Description:
--   RÈGLES MÉTIER FONDAMENTALES:
--   ╔══════════════════════════════════════════════════════════════════════╗
--   ║ booking_fee = COMMISSION APPLICATION (Yukpo)                       ║
--   ║   → S'applique sur le tarif communiqué par l'agence               ║
--   ║   → Reversée automatiquement à Yukpo (jamais à l'agence)          ║
--   ║   → JAMAIS remboursée à l'utilisateur (même en cas d'annulation)  ║
--   ║                                                                    ║
--   ║ subtotal = tarif agence (prix_ticket × nb_tickets)                ║
--   ║   → Wallet agence crédité IMMÉDIATEMENT (trésorerie)              ║
--   ║   → ESCROW bancaire jusqu'à validation du ticket                  ║
--   ║   → Compte bancaire reversé UNIQUEMENT après embarquement validé   ║
--   ║                                                                    ║
--   ║ ANNULATION (volontaire, avant le voyage):                          ║
--   ║   → Remboursement 100% du subtotal (tarif agence)                 ║
--   ║   → Déduction wallet agence si déjà crédité                        ║
--   ║   → Commission app (booking_fee) RETENUE par Yukpo                ║
--   ║   → Valide uniquement dans le délai configuré par l'agence        ║
--   ║   → cancellation_deadline_hours dans services.data                 ║
--   ║   → Pas de pénalité                                               ║
--   ║                                                                    ║
--   ║ NON-VALIDATION (no-show / report):                                 ║
--   ║   → Ticket mis en attente (crédit)                                 ║
--   ║   → Déduction wallet agence si déjà crédité                        ║
--   ║   → Pénalité 10% du subtotal → reversée à l'agence                ║
--   ║   → Commission app (booking_fee) RETENUE par Yukpo                ║
--   ║   → Montant net conservé en crédit pour futur voyage               ║
--   ╚══════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- 1. NOUVELLES COLONNES SUR bus_ticket_payments POUR ESCROW
-- ============================================================================

DO $$
BEGIN
    -- Statut escrow (séquestre)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='escrow_status') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN escrow_status VARCHAR(30) DEFAULT 'released'
            CHECK (escrow_status IN ('held', 'released', 'credited', 'refunded'));
    END IF;

    -- Date de libération de l'escrow
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='escrow_released_at') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN escrow_released_at TIMESTAMPTZ;
    END IF;

    -- Référence crédit si le ticket a été reporté
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='credit_id') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN credit_id TEXT;
    END IF;
    
    -- Date de crédit du wallet agence (immédiat au paiement)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='wallet_credited_at') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN wallet_credited_at TIMESTAMPTZ;
    END IF;
END $$;

-- Ajouter 'deferred' au CHECK constraint de payment_status si pas déjà présent
-- On doit recréer la constraint
DO $$
BEGIN
    -- Supprimer l'ancienne constraint si elle existe
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
               WHERE table_name='bus_ticket_payments' AND column_name='payment_status') THEN
        ALTER TABLE bus_ticket_payments DROP CONSTRAINT IF EXISTS bus_ticket_payments_payment_status_check;
    END IF;
    
    -- Recréer avec les nouveaux statuts
    ALTER TABLE bus_ticket_payments ADD CONSTRAINT bus_ticket_payments_payment_status_check
        CHECK (payment_status IN ('completed', 'refunded', 'partial_refund', 'deferred', 'escrow'));
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignorer si la constraint existe déjà avec les bons statuts
END $$;

-- ============================================================================
-- 2. TABLE WALLET_TRANSACTIONS (traçabilité complète des mouvements wallet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Type de transaction
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'bus_ticket_payment',      -- Paiement ticket (crédit agence)
        'bus_ticket_refund',       -- Remboursement annulation (débit agence)
        'bus_ticket_penalty',      -- Pénalité report (crédit agence)
        'bus_ticket_credit',       -- Crédit report (débit agence)
        'bus_commission_yukpo',    -- Commission Yukpo (crédit Yukpo)
        'bus_booking_fee',         -- Frais réservation (crédit Yukpo)
        'escrow_release',          -- Libération escrow (compte bancaire)
        'wallet_adjustment'        -- Ajustement manuel
    )),
    
    -- Montant et devise
    amount INTEGER NOT NULL, -- Positif = crédit, Négatif = débit
    currency TEXT DEFAULT 'XAF',
    
    -- Référence à l'opération source
    reference_type TEXT, -- 'bus_ticket_payment', 'bus_ticket_credit', etc.
    reference_id TEXT,   -- ID de l'opération source
    
    -- Description lisible
    description TEXT NOT NULL,
    
    -- Solde avant et après la transaction
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

COMMENT ON TABLE wallet_transactions IS 'Traçabilité complète de tous les mouvements wallet. Chaque crédit/débit doit avoir une transaction correspondante.';

-- ============================================================================
-- 3. TABLE BUS_TICKET_CREDITS (crédits de tickets reportés)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bus_ticket_credits (
    id TEXT PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS TEXT),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Lien avec le paiement original
    original_payment_id TEXT NOT NULL REFERENCES bus_ticket_payments(id) ON DELETE CASCADE,
    original_agency_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Montants
    original_amount INTEGER NOT NULL,        -- Montant total payé par l'utilisateur
    penalty_amount INTEGER NOT NULL,         -- Pénalité déduite (ex: 10% du subtotal)
    penalty_percentage NUMERIC(5,2) NOT NULL DEFAULT 10.00, -- % de pénalité appliqué
    net_credit_amount INTEGER NOT NULL,      -- Montant net conservé (original - pénalité)
    
    -- Trajet original (pour référence)
    original_departure_city TEXT NOT NULL,
    original_arrival_city TEXT NOT NULL,
    original_departure_date VARCHAR(20) NOT NULL,
    original_departure_time VARCHAR(10) NOT NULL,
    original_ticket_price INTEGER NOT NULL,
    original_number_of_tickets INTEGER NOT NULL DEFAULT 1,
    
    -- Utilisation du crédit
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
    used_for_payment_id TEXT REFERENCES bus_ticket_payments(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 months'),
    
    -- Supplément ou remboursement lors de l'utilisation
    supplement_amount INTEGER DEFAULT 0,     -- Supplément payé si nouveau ticket plus cher
    refund_amount INTEGER DEFAULT 0,         -- Restituté si nouveau ticket moins cher
    
    -- Métadonnées
    reason TEXT DEFAULT 'no_show',           -- 'no_show', 'user_request', 'cancelled_trip'
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_bus_ticket_credits_user ON bus_ticket_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_bus_ticket_credits_status ON bus_ticket_credits(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bus_ticket_credits_expires ON bus_ticket_credits(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bus_ticket_credits_original_payment ON bus_ticket_credits(original_payment_id);

COMMENT ON TABLE bus_ticket_credits IS 'Crédits de tickets bus non-validés. booking_fee (commission app) n''est JAMAIS incluse dans le crédit. Seul le subtotal net après pénalité est conservé.';

-- ============================================================================
-- 3. FONCTION UTILITAIRE: Enregistrer transaction wallet avec traçabilité
-- ============================================================================

CREATE OR REPLACE FUNCTION record_wallet_transaction(
    p_user_id INTEGER,
    p_transaction_type TEXT,
    p_amount INTEGER,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TEXT AS $$
DECLARE
    v_balance_before INTEGER;
    v_balance_after INTEGER;
    v_transaction_id TEXT;
BEGIN
    -- Récupérer le solde avant
    SELECT tokens_balance INTO v_balance_before
    FROM users
    WHERE id = p_user_id
    FOR UPDATE; -- Verrou pour éviter les conflits
    
    -- Calculer le nouveau solde
    v_balance_after := v_balance_before + p_amount;
    
    -- Mettre à jour le solde de l'utilisateur
    UPDATE users
    SET tokens_balance = v_balance_after
    WHERE id = p_user_id;
    
    -- Générer description si non fournie
    IF p_description IS NULL THEN
        p_description := CASE p_transaction_type
            WHEN 'bus_ticket_payment' THEN 'Paiement ticket bus (crédit agence)'
            WHEN 'bus_ticket_refund' THEN 'Remboursement annulation ticket (débit agence)'
            WHEN 'bus_ticket_penalty' THEN 'Pénalité report ticket (crédit agence)'
            WHEN 'bus_ticket_credit' THEN 'Crédit report ticket (débit agence)'
            WHEN 'bus_commission_yukpo' THEN 'Commission Yukpo (crédit Yukpo)'
            WHEN 'bus_booking_fee' THEN 'Frais réservation (crédit Yukpo)'
            WHEN 'escrow_release' THEN 'Libération escrow (compte bancaire)'
            ELSE 'Transaction wallet'
        END;
    END IF;
    
    -- Enregistrer la transaction
    INSERT INTO wallet_transactions (
        user_id, transaction_type, amount, reference_type, reference_id,
        description, balance_before, balance_after, metadata
    ) VALUES (
        p_user_id, p_transaction_type, p_amount, p_reference_type, p_reference_id,
        p_description, v_balance_before, v_balance_after, p_metadata
    ) RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_wallet_transaction IS 
    'Enregistre une transaction wallet avec traçabilité complète. Met à jour le solde utilisateur et crée une transaction détaillée.';

-- ============================================================================
-- 4. MODIFIER process_bus_ticket_payment_with_commission — MODE ESCROW
-- ============================================================================
-- booking_fee = commission Yukpo (encaissée immédiatement, jamais remboursable)
-- subtotal = tarif agence → en séquestre → reversé UNIQUEMENT après validation

CREATE OR REPLACE FUNCTION process_bus_ticket_payment_with_commission(
    p_payment_id TEXT,
    p_ticket_price INTEGER,
    p_number_of_tickets INTEGER,
    p_booking_fee INTEGER DEFAULT 500
)
RETURNS JSONB AS $$
DECLARE
    v_subtotal INTEGER;
    v_commission INTEGER;
    v_agency_payout INTEGER;
    v_total_amount INTEGER;
    v_payment RECORD;
    v_agency_user_id INTEGER;
BEGIN
    -- Calculer montants
    v_subtotal := p_ticket_price * p_number_of_tickets;
    v_commission := ROUND(v_subtotal * 0.05); -- 5% commission Yukpo
    v_agency_payout := v_subtotal - v_commission;
    v_total_amount := v_subtotal + p_booking_fee;
    
    -- Récupérer le payment pour obtenir agency_user_id
    SELECT agency_user_id INTO v_agency_user_id
    FROM bus_ticket_payments
    WHERE id = p_payment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;
    
    -- ✅ CRÉDIT IMMÉDIAT du wallet de l'agence (pour trésorerie)
    -- Même si l'argent réel est en escrow, le wallet de l'agence est crédité tout de suite
    -- Transaction tracée pour cohérence caisse physique
    PERFORM record_wallet_transaction(
        v_agency_user_id,
        'bus_ticket_payment',
        v_agency_payout,
        'bus_ticket_payment',
        p_payment_id,
        format('Paiement ticket bus - %s tickets à %s XAF', p_number_of_tickets, p_ticket_price),
        jsonb_build_object(
            'ticket_price', p_ticket_price,
            'number_of_tickets', p_number_of_tickets,
            'subtotal', v_subtotal,
            'commission', v_commission,
            'booking_fee', p_booking_fee
        )
    );
    
    -- ✅ Commission Yukpo (crédit Yukpo)
    PERFORM record_wallet_transaction(
        1, -- ID de Yukpo (supposé être 1)
        'bus_commission_yukpo',
        v_commission,
        'bus_ticket_payment',
        p_payment_id,
        format('Commission Yukpo - %s tickets', p_number_of_tickets),
        jsonb_build_object(
            'commission_percentage', 5,
            'subtotal', v_subtotal,
            'commission_amount', v_commission
        )
    );
    
    -- ✅ Booking fee (crédit Yukpo)
    PERFORM record_wallet_transaction(
        1, -- ID de Yukpo
        'bus_booking_fee',
        p_booking_fee,
        'bus_ticket_payment',
        p_payment_id,
        format('Frais réservation - %s tickets', p_number_of_tickets),
        jsonb_build_object(
            'booking_fee', p_booking_fee
        )
    );
    
    -- Mettre à jour le paiement — ESCROW pour l'argent réel, mais wallet déjà crédité
    UPDATE bus_ticket_payments
    SET 
        subtotal = v_subtotal,
        yukpo_commission = v_commission,
        agency_payout = v_agency_payout,
        total_amount = v_total_amount,
        booking_fee = p_booking_fee,
        payout_status = 'pending',      -- En attente de validation (argent réel)
        escrow_status = 'held',          -- Argent en séquestre (compte bancaire)
        wallet_credited_at = NOW(),     -- ✅ Wallet app crédité immédiatement
        updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'subtotal', v_subtotal,
        'yukpo_commission', v_commission,
        'agency_payout', v_agency_payout,
        'total_amount', v_total_amount,
        'payout_status', 'pending',
        'escrow_status', 'held'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_bus_ticket_payment_with_commission IS 
    'Calcule: booking_fee (commission Yukpo, encaissée immédiatement, jamais remboursable) + subtotal en ESCROW (reversé à l''agence uniquement après validation)';

-- ============================================================================
-- 4. FONCTION: Annulation de ticket (remboursement selon délai agence)
-- ============================================================================
-- Annulation volontaire → remboursement 100% du subtotal (tarif agence)
-- booking_fee (commission app) JAMAIS remboursée → reste avec Yukpo
-- Valide uniquement si dans le délai configuré par l'agence

CREATE OR REPLACE FUNCTION cancel_bus_ticket(
    p_payment_id TEXT,
    p_user_id INTEGER,
    p_reason TEXT DEFAULT 'user_request'
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_service_data JSONB;
    v_cancellation_deadline_hours INTEGER DEFAULT 24; -- Défaut: 24h
    v_hours_until_departure INTEGER;
    v_refund_amount INTEGER := 0;
    v_refund_percentage NUMERIC(5,2) := 0.0;
    v_departure_time TIMESTAMPTZ;
BEGIN
    -- Récupérer le paiement avec détails
    SELECT 
        btp.*,
        p.departure_time
    INTO v_payment, v_departure_time
    FROM bus_ticket_payments btp
    JOIN products p ON p.id::text = btp.product_id
    WHERE btp.id = p_payment_id
        AND btp.user_id = p_user_id
        AND btp.payment_status IN ('completed', 'escrow');
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé ou déjà annulé');
    END IF;
    
    -- Vérifier que le ticket n'a pas été validé
    IF EXISTS (
        SELECT 1 FROM bus_boarding_status bbs
        JOIN bus_reservations br ON br.id = bbs.reservation_id
        WHERE br.id = ANY(v_payment.reservation_ids)
            AND bbs.is_validated = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket déjà validé (embarqué), impossible d''annuler');
    END IF;
    
    -- Récupérer le délai d'annulation configuré par l'agence
    SELECT s.data INTO v_service_data
    FROM services s
    WHERE s.user_id = v_payment.agency_user_id
        AND s.specialized_type = 'agence_voyage'
        AND s.is_active = TRUE
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    IF v_service_data IS NOT NULL THEN
        v_cancellation_deadline_hours := COALESCE(
            (v_service_data->>'cancellation_deadline_hours')::INTEGER,
            24
        );
    END IF;
    
    -- Calculer le temps restant avant le départ
    v_hours_until_departure := EXTRACT(EPOCH FROM (v_departure_time - NOW())) / 3600;
    
    -- Déterminer si l'annulation est autorisée et le pourcentage de remboursement
    IF v_hours_until_departure > v_cancellation_deadline_hours THEN
        -- Annulation autorisée → remboursement 100% du subtotal (tarif agence)
        v_refund_percentage := 100.0;
        v_refund_amount := v_payment.subtotal; -- TARIF AGENCE uniquement
    ELSE
        -- Hors délai → pas de remboursement du tarif agence
        v_refund_percentage := 0.0;
        v_refund_amount := 0;
    END IF;
    
    -- NOTE: booking_fee (commission app) n'est JAMAIS remboursée
    
    -- Mettre à jour le paiement
    UPDATE bus_ticket_payments
    SET 
        payment_status = 'cancelled',
        escrow_status = 'refunded',
        updated_at = NOW()
    WHERE id = p_payment_id;
    
    -- Annuler les réservations
    UPDATE bus_reservations
    SET 
        status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(v_payment.reservation_ids)
        AND status IN ('pending', 'confirmed');
    
    -- Rembourser si applicable (uniquement le tarif agence, pas la commission app)
    IF v_refund_amount > 0 THEN
        -- Transaction tracée pour remboursement client
        PERFORM record_wallet_transaction(
            p_user_id,
            'bus_ticket_refund',
            v_refund_amount,
            'bus_ticket_payment',
            p_payment_id,
            format('Remboursement annulation - %s%% du tarif agence', v_refund_percentage),
            jsonb_build_object(
                'refund_percentage', v_refund_percentage,
                'original_amount', v_payment.subtotal,
                'refund_amount', v_refund_amount,
                'cancellation_deadline_hours', v_cancellation_deadline_hours,
                'hours_until_departure', v_hours_until_departure
            )
        );
    END IF;
    
    -- ✅ DÉDUIRE du wallet de l'agence si déjà crédité
    -- L'agence a déjà reçu le wallet crédit au paiement, il faut le déduire en cas d'annulation
    IF v_payment.wallet_credited_at IS NOT NULL THEN
        -- Transaction tracée pour débit agence
        PERFORM record_wallet_transaction(
            v_payment.agency_user_id,
            'bus_ticket_refund',
            -v_payment.agency_payout, -- Négatif = débit
            'bus_ticket_payment',
            p_payment_id,
            format('Débit agence - annulation ticket (%s%% remboursement)', v_refund_percentage),
            jsonb_build_object(
                'refund_percentage', v_refund_percentage,
                'original_agency_payout', v_payment.agency_payout,
                'deducted_amount', v_payment.agency_payout,
                'wallet_credited_at', v_payment.wallet_credited_at
            )
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'cancellation_deadline_hours', v_cancellation_deadline_hours,
        'hours_until_departure', ROUND(v_hours_until_departure, 2),
        'refund_percentage', v_refund_percentage,
        'refund_amount', v_refund_amount,
        'booking_fee_retained', v_payment.booking_fee,
        'message', CASE 
            WHEN v_refund_amount > 0 THEN 
                format('Annulation acceptée. Remboursement de %s XAF (%.0f%% du tarif agence). Booking_fee (%s XAF) conservée par Yukpo.', 
                       v_refund_amount, v_refund_percentage, v_payment.booking_fee)
            ELSE 
                format('Annulation hors délai (< %s heures avant départ). Aucun remboursement. Booking_fee (%s XAF) conservée par Yukpo.', 
                       v_cancellation_deadline_hours, v_payment.booking_fee)
        END
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancel_bus_ticket IS 
    'Annule un ticket: rembourse 100% du tarif agence si dans délai configuré par l''agence. booking_fee (commission app) JAMAIS remboursée.';

-- ============================================================================
-- 5. FONCTION: Reverser à l'agence après validation (post-embarquement)
-- ============================================================================

CREATE OR REPLACE FUNCTION release_escrow_to_agency(p_payment_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
BEGIN
    -- Récupérer le paiement
    SELECT * INTO v_payment
    FROM bus_ticket_payments
    WHERE id = p_payment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;
    
    -- Vérifier que l'escrow est bien en attente
    IF v_payment.escrow_status != 'held' THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'error', 'Escrow déjà libéré ou annulé',
            'current_status', v_payment.escrow_status
        );
    END IF;
    
    -- ✅ NE PAS créditer le wallet (déjà fait au paiement)
    -- Le wallet de l'agence a déjà été crédité immédiatement lors du paiement client
    -- Ici on libère seulement l'escrow de l'argent réel (compte bancaire)
    
    -- Marquer le paiement comme complété (argent réel libéré)
    UPDATE bus_ticket_payments
    SET 
        payout_status = 'completed',
        payout_at = NOW(),
        escrow_status = 'released',
        escrow_released_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payment_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'agency_user_id', v_payment.agency_user_id,
        'agency_payout', v_payment.agency_payout,
        'message', 'Escrow libéré — montant reversé à l''agence'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION release_escrow_to_agency IS 
    'Libère l''escrow et reverse le montant net (après commission 5%) à l''agence après validation du ticket';

-- ============================================================================
-- 5. MODIFIER validate_bus_ticket POUR DÉCLENCHER LE REVERSEMENT AUTO
-- ============================================================================
-- On ajoute l'appel à release_escrow_to_agency après validation réussie

CREATE OR REPLACE FUNCTION validate_bus_ticket(
    p_qr_code_data JSONB,
    p_validator_user_id INTEGER,
    p_product_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_reservation_id TEXT;
    v_payment_id TEXT;
    v_product_id TEXT;
    v_reservation RECORD;
    v_payment RECORD;
    v_boarding_status RECORD;
    v_count INTEGER;
    v_escrow_result JSONB;
BEGIN
    v_reservation_id := p_qr_code_data->>'id';
    v_payment_id := p_qr_code_data->>'payment_id';
    v_product_id := COALESCE(p_product_id, p_qr_code_data->>'product_id');
    
    IF v_reservation_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'ID réservation manquant dans QR code');
    END IF;
    
    SELECT * INTO v_reservation FROM bus_reservations
    WHERE id = v_reservation_id AND status = 'confirmed';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Réservation non trouvée ou non confirmée');
    END IF;
    
    IF v_product_id IS NOT NULL AND v_reservation.product_id != v_product_id THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket ne correspond pas à ce bus');
    END IF;
    
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO v_payment FROM bus_ticket_payments
        WHERE id = v_payment_id AND payment_status IN ('completed', 'escrow');
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé ou non complété');
        END IF;
    END IF;
    
    -- Vérifier si le ticket est déjà validé
    SELECT * INTO v_boarding_status FROM bus_boarding_status 
    WHERE reservation_id = v_reservation_id;
    
    IF FOUND AND v_boarding_status.is_validated = TRUE THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
            'already_boarded', TRUE,
            'boarded_at', v_boarding_status.validated_at,
            'validated_by_user_id', v_boarding_status.validated_by,
            'validation_method', v_boarding_status.validation_method
        );
    END IF;
    
    -- Vérification par payment_id
    IF v_payment_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM bus_boarding_status 
        WHERE payment_id = v_payment_id AND is_validated = TRUE;
        
        IF v_count > 0 THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'Ticket déjà utilisé - Ce paiement a déjà été validé',
                'already_boarded', TRUE
            );
        END IF;
    END IF;
    
    -- Créer ou mettre à jour boarding_status
    IF FOUND THEN
        UPDATE bus_boarding_status
        SET boarding_status = 'boarded', is_validated = TRUE, validated_at = NOW(),
            validated_by = p_validator_user_id, validation_method = 'qr_code',
            qr_code_data = p_qr_code_data, updated_at = NOW()
        WHERE reservation_id = v_reservation_id AND is_validated = FALSE
        RETURNING * INTO v_boarding_status;
        
        IF NOT FOUND THEN
            SELECT * INTO v_boarding_status FROM bus_boarding_status 
            WHERE reservation_id = v_reservation_id;
            
            IF v_boarding_status.is_validated = TRUE THEN
                RETURN jsonb_build_object(
                    'success', FALSE,
                    'error', 'Ticket déjà utilisé',
                    'already_boarded', TRUE,
                    'boarded_at', v_boarding_status.validated_at
                );
            END IF;
        END IF;
    ELSE
        BEGIN
            INSERT INTO bus_boarding_status (
                reservation_id, product_id, payment_id, boarding_status, is_validated,
                validated_at, validated_by, validation_method, qr_code_data
            ) VALUES (
                v_reservation_id, v_reservation.product_id, v_payment_id, 'boarded', TRUE,
                NOW(), p_validator_user_id, 'qr_code', p_qr_code_data
            ) RETURNING * INTO v_boarding_status;
        EXCEPTION
            WHEN unique_violation THEN
                SELECT * INTO v_boarding_status FROM bus_boarding_status 
                WHERE reservation_id = v_reservation_id;
                
                IF v_boarding_status.is_validated = TRUE THEN
                    RETURN jsonb_build_object(
                        'success', FALSE,
                        'error', 'Ticket déjà utilisé',
                        'already_boarded', TRUE,
                        'boarded_at', v_boarding_status.validated_at
                    );
                END IF;
        END;
    END IF;
    
    -- ✅ NOUVEAU: Libérer l'escrow et reverser à l'agence après validation réussie
    IF v_payment_id IS NOT NULL THEN
        v_escrow_result := release_escrow_to_agency(v_payment_id);
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'reservation_id', v_reservation_id,
        'passenger_name', v_reservation.passenger_name,
        'seat_id', v_reservation.seat_id,
        'seat_number', v_reservation.seat_number,
        'validated_at', v_boarding_status.validated_at,
        'escrow_released', COALESCE(v_escrow_result->>'success', 'false'),
        'message', 'Ticket validé avec succès — paiement reversé à l''agence'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_bus_ticket IS 
    'Valide un ticket bus via QR code, enregistre l''embarquement et libère l''escrow pour reverser à l''agence';

-- ============================================================================
-- 6. FONCTION: Reporter un ticket (defer) — crée un crédit avec pénalité
-- ============================================================================

CREATE OR REPLACE FUNCTION defer_bus_ticket(
    p_payment_id TEXT,
    p_user_id INTEGER,
    p_penalty_pct NUMERIC(5,2) DEFAULT 10.00,  -- 10% de pénalité par défaut
    p_reason TEXT DEFAULT 'user_request'
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_credit_id TEXT;
    v_penalty INTEGER;
    v_net_credit INTEGER;
    v_agency_penalty_share INTEGER;
BEGIN
    -- Récupérer le paiement
    SELECT * INTO v_payment
    FROM bus_ticket_payments
    WHERE id = p_payment_id
        AND user_id = p_user_id
        AND payment_status = 'completed';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé ou ne vous appartient pas');
    END IF;
    
    -- Vérifier que le ticket n'a PAS été validé (embarqué)
    IF EXISTS (
        SELECT 1 FROM bus_boarding_status bbs
        JOIN bus_reservations br ON br.id = bbs.reservation_id
        WHERE br.id = ANY(v_payment.reservation_ids)
            AND bbs.is_validated = TRUE
    ) THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket déjà validé (embarqué), impossible de reporter');
    END IF;
    
    -- Vérifier que l'escrow n'a pas déjà été libéré
    IF v_payment.escrow_status = 'released' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement déjà reversé à l''agence, report impossible');
    END IF;
    
    -- Vérifier que le ticket n'a pas déjà été reporté
    IF v_payment.escrow_status = 'credited' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket déjà reporté');
    END IF;
    
    -- Calculer la pénalité sur le subtotal (montant hors frais de réservation)
    v_penalty := ROUND(COALESCE(v_payment.subtotal, 0) * p_penalty_pct / 100.0);
    v_net_credit := COALESCE(v_payment.subtotal, 0) - v_penalty;
    
    -- La pénalité est reversée à l'agence de voyage
    v_agency_penalty_share := v_penalty;
    
    IF v_net_credit <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Montant net après pénalité est nul ou négatif');
    END IF;
    
    -- Créer le crédit
    INSERT INTO bus_ticket_credits (
        user_id, original_payment_id, original_agency_user_id,
        original_amount, penalty_amount, penalty_percentage, net_credit_amount,
        original_departure_city, original_arrival_city,
        original_departure_date, original_departure_time,
        original_ticket_price, original_number_of_tickets,
        reason, status
    ) VALUES (
        p_user_id, p_payment_id, v_payment.agency_user_id,
        v_payment.subtotal, v_penalty, p_penalty_pct, v_net_credit,
        v_payment.departure_city, v_payment.arrival_city,
        v_payment.departure_date, v_payment.departure_time,
        v_payment.ticket_price, v_payment.number_of_tickets,
        p_reason, 'active'
    ) RETURNING id INTO v_credit_id;
    
    -- Marquer le paiement comme reporté (deferred)
    UPDATE bus_ticket_payments
    SET payment_status = 'deferred',
        escrow_status = 'credited',
        credit_id = v_credit_id,
        updated_at = NOW()
    WHERE id = p_payment_id;
    
    -- Annuler les réservations associées (libérer les sièges)
    UPDATE bus_reservations
    SET status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(v_payment.reservation_ids)
        AND status IN ('pending', 'confirmed');
    
    -- ✅ DÉDUIRE du wallet de l'agence si déjà crédité (déjà reçu au paiement)
    -- L'agence a déjà reçu le wallet crédit au paiement, il faut le déduire
    IF v_payment.wallet_credited_at IS NOT NULL THEN
        -- Transaction tracée pour débit agence (montant complet)
        PERFORM record_wallet_transaction(
            v_payment.agency_user_id,
            'bus_ticket_credit',
            -v_payment.agency_payout, -- Négatif = débit
            'bus_ticket_payment',
            p_payment_id,
            format('Débit agence - report ticket (pénalité %s%%)', p_penalty_pct),
            jsonb_build_object(
                'original_agency_payout', v_payment.agency_payout,
                'deducted_amount', v_payment.agency_payout,
                'penalty_percentage', p_penalty_pct,
                'wallet_credited_at', v_payment.wallet_credited_at,
                'credit_id', v_credit_id
            )
        );
    END IF;
    
    -- ✅ Reverser la pénalité à l'agence de voyage (seulement la pénalité, pas le montant complet)
    -- Transaction tracée pour crédit pénalité
    PERFORM record_wallet_transaction(
        v_payment.agency_user_id,
        'bus_ticket_penalty',
        v_agency_penalty_share,
        'bus_ticket_credit',
        v_credit_id,
        format('Pénalité report ticket - %s%% du tarif', p_penalty_pct),
        jsonb_build_object(
            'penalty_percentage', p_penalty_pct,
            'original_amount', v_payment.subtotal,
            'penalty_amount', v_penalty,
            'credit_id', v_credit_id,
            'original_payment_id', p_payment_id
        )
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'credit_id', v_credit_id,
        'original_amount', v_payment.subtotal,
        'penalty_amount', v_penalty,
        'penalty_percentage', p_penalty_pct,
        'net_credit_amount', v_net_credit,
        'agency_penalty_received', v_agency_penalty_share,
        'expires_at', (NOW() + INTERVAL '6 months'),
        'message', format('Ticket reporté. Crédit de %s XAF créé (pénalité %s%% = %s XAF reversée à l''agence)', 
                         v_net_credit, p_penalty_pct, v_penalty)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION defer_bus_ticket IS 
    'Reporte un ticket non-validé: déduit du wallet agence si déjà crédité, applique pénalité 10% reversée à l''agence, crée crédit net pour utilisateur.';

-- ============================================================================
-- 7. FONCTION: Consulter l'historique des transactions wallet
-- ============================================================================

CREATE OR REPLACE FUNCTION get_wallet_transactions(
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_transaction_type TEXT DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id TEXT,
    transaction_type TEXT,
    amount INTEGER,
    currency TEXT,
    reference_type TEXT,
    reference_id TEXT,
    description TEXT,
    balance_before INTEGER,
    balance_after INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wt.id,
        wt.transaction_type,
        wt.amount,
        wt.currency,
        wt.reference_type,
        wt.reference_id,
        wt.description,
        wt.balance_before,
        wt.balance_after,
        wt.metadata,
        wt.created_at,
        wt.processed_at
    FROM wallet_transactions wt
    WHERE wt.user_id = p_user_id
        AND (p_transaction_type IS NULL OR wt.transaction_type = p_transaction_type)
        AND (p_date_from IS NULL OR wt.created_at >= p_date_from)
        AND (p_date_to IS NULL OR wt.created_at <= p_date_to)
    ORDER BY wt.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Vue pour résumé des transactions par type
CREATE OR REPLACE VIEW wallet_transaction_summary AS
SELECT 
    user_id,
    transaction_type,
    COUNT(*) as transaction_count,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits,
    SUM(amount) as net_amount,
    MAX(created_at) as last_transaction_at
FROM wallet_transactions
GROUP BY user_id, transaction_type;

COMMENT ON VIEW wallet_transaction_summary IS 'Résumé des transactions wallet par utilisateur et type.';

COMMENT ON FUNCTION get_wallet_transactions IS 
    'Retourne l''historique détaillé des transactions wallet d''un utilisateur avec filtres optionnels.';

-- ============================================================================
-- 8. FONCTION: Utiliser un crédit pour un nouveau voyage
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_ticket_credit(
    p_credit_id TEXT,
    p_user_id INTEGER,
    p_new_payment_id TEXT,      -- ID du nouveau paiement
    p_new_ticket_price INTEGER  -- Prix du nouveau ticket
)
RETURNS JSONB AS $$
DECLARE
    v_credit RECORD;
    v_difference INTEGER;
    v_user_balance BIGINT;
    v_supplement INTEGER := 0;
    v_refund INTEGER := 0;
BEGIN
    -- Récupérer le crédit
    SELECT * INTO v_credit
    FROM bus_ticket_credits
    WHERE id = p_credit_id
        AND user_id = p_user_id
        AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Crédit non trouvé, expiré ou déjà utilisé');
    END IF;
    
    -- Vérifier expiration
    IF v_credit.expires_at < NOW() THEN
        UPDATE bus_ticket_credits SET status = 'expired', updated_at = NOW() WHERE id = p_credit_id;
        RETURN jsonb_build_object('success', FALSE, 'error', 'Crédit expiré');
    END IF;
    
    -- Calculer la différence entre le crédit net et le nouveau prix
    v_difference := v_credit.net_credit_amount - p_new_ticket_price;
    
    IF v_difference >= 0 THEN
        -- Le crédit couvre le nouveau ticket → restituer l'excédent
        v_refund := v_difference;
        
        -- Restituer l'excédent au solde tokens de l'utilisateur
        IF v_refund > 0 THEN
            -- Transaction tracée pour remboursement excédent
            PERFORM record_wallet_transaction(
                p_user_id,
                'bus_ticket_credit',
                v_refund,
                'bus_ticket_credit',
                p_credit_id,
                format('Excédent crédit ticket - %s XAF remboursés', v_refund),
                jsonb_build_object(
                    'credit_id', p_credit_id,
                    'new_ticket_price', p_new_ticket_price,
                    'credit_amount', v_credit.net_credit_amount,
                    'refund_amount', v_refund
                )
            );
        END IF;
    ELSE
        -- Le nouveau ticket est plus cher → l'utilisateur doit payer le supplément
        v_supplement := ABS(v_difference);
        
        -- Vérifier le solde de l'utilisateur
        SELECT tokens_balance INTO v_user_balance FROM users WHERE id = p_user_id;
        
        IF v_user_balance < v_supplement THEN
            RETURN jsonb_build_object(
                'success', FALSE, 
                'error', 'Solde insuffisant pour le supplément',
                'supplement_required', v_supplement,
                'current_balance', v_user_balance,
                'shortfall', v_supplement - v_user_balance,
                'needs_recharge', TRUE
            );
        END IF;
        
        -- Débiter le supplément du solde de l'utilisateur
        -- Transaction tracée pour débit supplément
        PERFORM record_wallet_transaction(
            p_user_id,
            'bus_ticket_credit',
            -v_supplement, -- Négatif = débit
            'bus_ticket_credit',
            p_credit_id,
            format('Supplément crédit ticket - %s XAF débités', v_supplement),
            jsonb_build_object(
                'credit_id', p_credit_id,
                'new_ticket_price', p_new_ticket_price,
                'credit_amount', v_credit.net_credit_amount,
                'supplement_amount', v_supplement,
                'new_payment_id', p_new_payment_id
            )
        );
    END IF;
    
    -- Marquer le crédit comme utilisé
    UPDATE bus_ticket_credits
    SET status = 'used',
        used_for_payment_id = p_new_payment_id,
        used_at = NOW(),
        supplement_amount = v_supplement,
        refund_amount = v_refund,
        updated_at = NOW()
    WHERE id = p_credit_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'credit_id', p_credit_id,
        'credit_amount', v_credit.net_credit_amount,
        'new_ticket_price', p_new_ticket_price,
        'supplement_paid', v_supplement,
        'refund_amount', v_refund,
        'message', CASE 
            WHEN v_refund > 0 THEN format('Crédit appliqué. Excédent de %s XAF restitué.', v_refund)
            WHEN v_supplement > 0 THEN format('Crédit appliqué. Supplément de %s XAF débité.', v_supplement)
            ELSE 'Crédit appliqué. Montant exact couvert.'
        END
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_ticket_credit IS 
    'Utilise un crédit de ticket reporté pour un nouveau voyage. Restitue l''excédent ou débite le supplément automatiquement.';

-- ============================================================================
-- 8. VUE: Crédits actifs avec détails
-- ============================================================================

CREATE OR REPLACE VIEW bus_active_ticket_credits AS
SELECT 
    btc.id as credit_id,
    btc.user_id,
    u.nom_complet as user_name,
    btc.original_payment_id,
    btc.net_credit_amount,
    btc.penalty_amount,
    btc.penalty_percentage,
    btc.original_amount,
    btc.original_departure_city,
    btc.original_arrival_city,
    btc.original_departure_date,
    btc.original_departure_time,
    btc.original_ticket_price,
    btc.original_number_of_tickets,
    btc.status,
    btc.reason,
    btc.expires_at,
    btc.created_at,
    EXTRACT(DAY FROM btc.expires_at - NOW()) as days_until_expiry,
    au.nom_complet as agency_name
FROM bus_ticket_credits btc
JOIN users u ON u.id = btc.user_id
JOIN users au ON au.id = btc.original_agency_user_id
WHERE btc.status = 'active'
ORDER BY btc.created_at DESC;

COMMENT ON VIEW bus_active_ticket_credits IS 'Vue des crédits de tickets bus actifs avec détails utilisateur et agence';
