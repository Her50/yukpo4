-- Migration: Ajout système de commission et reversement pour tickets bus
-- Date: 2025-11-27
-- Description: Commission Yukpo 5%, reversement automatique à l'agence, génération PDF
-- Note: Compatible SQLx offline mode

-- 1. Ajouter colonnes commission et reversement à bus_ticket_payments
DO $$ 
BEGIN
    -- Commission Yukpo (5% du montant ticket)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='yukpo_commission') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN yukpo_commission INTEGER;
    END IF;
    
    -- Montant reversé à l'agence (subtotal - commission)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='agency_payout') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN agency_payout INTEGER;
    END IF;
    
    -- Statut reversement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='payout_status') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN payout_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    -- Date reversement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='payout_at') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN payout_at TIMESTAMPTZ;
    END IF;
    
    -- URL ticket PDF généré
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='ticket_pdf_url') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN ticket_pdf_url TEXT;
    END IF;
END $$;

-- 2. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_bus_payments_payout_status ON bus_ticket_payments(payout_status) WHERE payout_status = 'pending';

-- 3. Fonction pour calculer commission et reverser automatiquement
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
    v_commission := ROUND(v_subtotal * 0.05); -- 5% commission
    v_agency_payout := v_subtotal - v_commission;
    v_total_amount := v_subtotal + p_booking_fee;
    
    -- Récupérer le payment pour obtenir agency_user_id
    SELECT agency_user_id INTO v_agency_user_id
    FROM bus_ticket_payments
    WHERE id = p_payment_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;
    
    -- Mettre à jour le paiement
    UPDATE bus_ticket_payments
    SET 
        subtotal = v_subtotal,
        yukpo_commission = v_commission,
        agency_payout = v_agency_payout,
        total_amount = v_total_amount,
        booking_fee = p_booking_fee,
        payout_status = 'pending',
        updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;
    
    -- Reverser automatiquement à l'agence
    UPDATE users
    SET tokens_balance = tokens_balance + v_agency_payout
    WHERE id = v_agency_user_id;
    
    -- Marquer reversement comme complété
    UPDATE bus_ticket_payments
    SET 
        payout_status = 'completed',
        payout_at = NOW()
    WHERE id = p_payment_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'subtotal', v_subtotal,
        'yukpo_commission', v_commission,
        'agency_payout', v_agency_payout,
        'total_amount', v_total_amount,
        'payout_status', 'completed'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_bus_ticket_payment_with_commission IS 'Calcule la commission Yukpo (5%) et reverse automatiquement le montant à l''agence';

