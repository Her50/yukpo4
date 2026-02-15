-- Migration: Système de validation de tickets bus avec QR code
-- Date: 2025-11-27
-- Description: Table pour suivi embarquement, validation QR code, statuts
-- Note: Compatible SQLx offline mode

-- 1. Table pour le statut d'embarquement des passagers
CREATE TABLE IF NOT EXISTS bus_boarding_status (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reservation_id TEXT NOT NULL REFERENCES bus_reservations(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    payment_id TEXT REFERENCES bus_ticket_payments(id) ON DELETE SET NULL,
    
    -- Statut embarquement
    boarding_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (boarding_status IN ('pending', 'boarded', 'no_show', 'cancelled')),
    is_validated BOOLEAN NOT NULL DEFAULT FALSE,
    validated_at TIMESTAMPTZ,
    
    -- Validateur (chauffeur ou agent agence)
    validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    validation_method VARCHAR(20) CHECK (validation_method IN ('qr_code', 'manual', 'api')),
    
    -- Données QR code validé
    qr_code_data JSONB,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_reservation_boarding UNIQUE (reservation_id)
);

-- 2. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_bus_boarding_product ON bus_boarding_status(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_reservation ON bus_boarding_status(reservation_id);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_status ON bus_boarding_status(boarding_status);
CREATE INDEX IF NOT EXISTS idx_bus_boarding_validated ON bus_boarding_status(is_validated) WHERE is_validated = TRUE;
CREATE INDEX IF NOT EXISTS idx_bus_boarding_validated_by ON bus_boarding_status(validated_by);

-- 3. Fonction pour valider un ticket via QR code
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
    v_is_valid BOOLEAN := FALSE;
    v_error_message TEXT;
BEGIN
    -- Extraire les données du QR code
    v_reservation_id := p_qr_code_data->>'id';
    v_payment_id := p_qr_code_data->>'payment_id';
    v_product_id := COALESCE(p_product_id, p_qr_code_data->>'product_id');
    
    IF v_reservation_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ID réservation manquant dans QR code'
        );
    END IF;
    
    -- Vérifier que la réservation existe et est confirmée
    SELECT * INTO v_reservation
    FROM bus_reservations
    WHERE id = v_reservation_id
        AND status = 'confirmed';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Réservation non trouvée ou non confirmée'
        );
    END IF;
    
    -- Vérifier que le produit correspond
    IF v_product_id IS NOT NULL AND v_reservation.product_id != v_product_id THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Ticket ne correspond pas à ce bus'
        );
    END IF;
    
    -- Vérifier que le paiement est complété
    IF v_payment_id IS NOT NULL THEN
        SELECT * INTO v_payment
        FROM bus_ticket_payments
        WHERE id = v_payment_id
            AND payment_status = 'completed';
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'Paiement non trouvé ou non complété'
            );
        END IF;
    END IF;
    
    -- Vérifier si le ticket est déjà validé (par reservation_id OU payment_id)
    SELECT * INTO v_boarding_status
    FROM bus_boarding_status
    WHERE reservation_id = v_reservation_id
       OR (payment_id IS NOT NULL AND payment_id = v_payment_id AND is_validated = TRUE);
    
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
    
    -- Vérification supplémentaire : s'assurer qu'aucun autre boarding_status n'existe avec le même payment_id
    IF v_payment_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM bus_boarding_status
        WHERE payment_id = v_payment_id AND is_validated = TRUE;
        
        IF v_count > 0 THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'Ticket déjà utilisé - Ce paiement a déjà été validé pour un autre passager',
                'already_boarded', TRUE
            );
        END IF;
    END IF;
    
    -- ⚠️ PROTECTION RACE CONDITION : Créer ou mettre à jour le statut d'embarquement
    -- La contrainte UNIQUE sur reservation_id empêche les doublons au niveau base de données
    
    IF FOUND THEN
        -- Si un boarding_status existe déjà, vérifier s'il est validé
        IF v_boarding_status.is_validated = TRUE THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
                'already_boarded', TRUE,
                'boarded_at', v_boarding_status.validated_at,
                'validated_by_user_id', v_boarding_status.validated_by,
                'validation_method', v_boarding_status.validation_method
            );
        END IF;
        
        -- Si pas encore validé, mettre à jour (cas rare mais possible)
        UPDATE bus_boarding_status
        SET boarding_status = 'boarded', is_validated = TRUE, validated_at = NOW(),
            validated_by = p_validator_user_id, validation_method = 'qr_code',
            qr_code_data = p_qr_code_data, updated_at = NOW()
        WHERE reservation_id = v_reservation_id AND is_validated = FALSE
        RETURNING * INTO v_boarding_status;
        
        -- Si aucune ligne mise à jour (déjà validé entre temps), erreur
        IF NOT FOUND THEN
            SELECT * INTO v_boarding_status FROM bus_boarding_status 
            WHERE reservation_id = v_reservation_id;
            
            IF v_boarding_status.is_validated = TRUE THEN
                RETURN jsonb_build_object(
                    'success', FALSE,
                    'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
                    'already_boarded', TRUE,
                    'boarded_at', v_boarding_status.validated_at,
                    'validated_by_user_id', v_boarding_status.validated_by,
                    'validation_method', v_boarding_status.validation_method
                );
            END IF;
        END IF;
    ELSE
        -- Créer nouveau boarding_status (avec protection UNIQUE au niveau DB)
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
                -- Si insertion échoue (doublon), récupérer l'enregistrement existant
                SELECT * INTO v_boarding_status FROM bus_boarding_status 
                WHERE reservation_id = v_reservation_id;
                
                IF v_boarding_status.is_validated = TRUE THEN
                    RETURN jsonb_build_object(
                        'success', FALSE,
                        'error', 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
                        'already_boarded', TRUE,
                        'boarded_at', v_boarding_status.validated_at,
                        'validated_by_user_id', v_boarding_status.validated_by,
                        'validation_method', v_boarding_status.validation_method
                    );
                END IF;
        END;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'reservation_id', v_reservation_id,
        'passenger_name', v_reservation.passenger_name,
        'seat_id', v_reservation.seat_id,
        'seat_number', v_reservation.seat_number,
        'validated_at', v_boarding_status.validated_at,
        'message', 'Ticket validé avec succès'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_bus_ticket IS 'Valide un ticket bus via QR code et enregistre l''embarquement';

-- 4. Fonction pour obtenir le résumé d'embarquement d'un bus
CREATE OR REPLACE FUNCTION get_bus_boarding_summary(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_total_reservations INTEGER := 0;
    v_boarded_passengers INTEGER := 0;
    v_pending_passengers INTEGER := 0;
    v_no_show_passengers INTEGER := 0;
BEGIN
    -- Compter total réservations confirmées
    SELECT COUNT(*) INTO v_total_reservations
    FROM bus_reservations
    WHERE product_id = p_product_id
        AND status = 'confirmed';
    
    -- Compter passagers embarqués
    SELECT COUNT(*) INTO v_boarded_passengers
    FROM bus_boarding_status
    WHERE product_id = p_product_id
        AND boarding_status = 'boarded'
        AND is_validated = TRUE;
    
    -- Compter en attente
    SELECT COUNT(*) INTO v_pending_passengers
    FROM bus_reservations br
    WHERE br.product_id = p_product_id
        AND br.status = 'confirmed'
        AND NOT EXISTS (
            SELECT 1 FROM bus_boarding_status bbs
            WHERE bbs.reservation_id = br.id
            AND bbs.is_validated = TRUE
        );
    
    -- Compter no-show (après heure départ + 15 min)
    SELECT COUNT(*) INTO v_no_show_passengers
    FROM bus_reservations br
    JOIN products p ON p.id::text = br.product_id
    WHERE br.product_id = p_product_id
        AND br.status = 'confirmed'
        AND (p.metadata->>'departure_date' || ' ' || p.metadata->>'departure_time')::TIMESTAMP + INTERVAL '15 minutes' < NOW()
        AND NOT EXISTS (
            SELECT 1 FROM bus_boarding_status bbs
            WHERE bbs.reservation_id = br.id
            AND bbs.is_validated = TRUE
        );
    
    RETURN jsonb_build_object(
        'total_reservations', v_total_reservations,
        'boarded_passengers', v_boarded_passengers,
        'pending_passengers', v_pending_passengers,
        'no_show_passengers', v_no_show_passengers,
        'completion_percentage', CASE 
            WHEN v_total_reservations > 0 THEN 
                ROUND((v_boarded_passengers::FLOAT / v_total_reservations::FLOAT) * 100, 2)
            ELSE 0
        END,
        'is_complete', (v_boarded_passengers = v_total_reservations AND v_total_reservations > 0)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_bus_boarding_summary IS 'Retourne le résumé d''embarquement pour un bus (total, embarqués, en attente, no-show)';

-- 5. Vue pour liste des passagers avec statut embarquement
CREATE OR REPLACE VIEW bus_passengers_with_boarding AS
SELECT 
    br.id as reservation_id,
    br.product_id,
    br.user_id,
    br.seat_id,
    br.seat_number,
    br.passenger_name,
    br.status as reservation_status,
    btp.id as payment_id,
    btp.total_amount,
    bbs.id as boarding_status_id,
    bbs.boarding_status,
    bbs.is_validated,
    bbs.validated_at,
    bbs.validated_by,
    bbs.validation_method,
    u.nom_complet as validator_name,
    CASE 
        WHEN bbs.is_validated = TRUE THEN 'boarded'
        WHEN bbs.boarding_status = 'no_show' THEN 'no_show'
        WHEN bbs.boarding_status = 'cancelled' THEN 'cancelled'
        ELSE 'pending'
    END as display_status
FROM bus_reservations br
LEFT JOIN bus_ticket_payments btp ON btp.id = ANY(
    SELECT unnest(btp2.reservation_ids) FROM bus_ticket_payments btp2 
    WHERE br.id = ANY(btp2.reservation_ids)
    LIMIT 1
)
LEFT JOIN bus_boarding_status bbs ON bbs.reservation_id = br.id
LEFT JOIN users u ON u.id = bbs.validated_by
WHERE br.status = 'confirmed';

COMMENT ON VIEW bus_passengers_with_boarding IS 'Vue unifiée des passagers avec leur statut d''embarquement';

