-- Migration: Signature HMAC-SHA256 pour les QR codes de tickets bus
-- Date: 2026-04-01
-- Problème corrigé: Les QR codes n'étaient pas signés cryptographiquement.
--   Un utilisateur malveillant pouvait créer un JSON forgé avec un vrai reservation_id
--   et passer le contrôle (validate_bus_ticket ne vérifiait que l'existence en BDD).
-- Solution:
--   1. Colonne qr_hmac_signature dans bus_ticket_payments (générée côté Rust avec hmac+sha2)
--   2. La fonction validate_bus_ticket vérifie le champ 'sig' dans le QR JSON
--      via pgcrypto hmac (si pgcrypto disponible) ou en déléguant au contrôleur Rust

-- ============================================================================
-- 1. AJOUTER LA COLONNE qr_hmac_signature
-- ============================================================================

ALTER TABLE bus_ticket_payments
    ADD COLUMN IF NOT EXISTS qr_hmac_signature TEXT;

COMMENT ON COLUMN bus_ticket_payments.qr_hmac_signature IS
    'Signature HMAC-SHA256 du QR code (hex). '
    'Calculée côté Rust : HMAC(payment_id:product_id:user_id, QR_SECRET). '
    'Vérifiée à la validation pour rejeter les QR forgés.';

-- ============================================================================
-- 2. STOCKER LA CLÉ SECRÈTE QR DANS platform_config
-- ============================================================================

INSERT INTO platform_config (key, value, description)
VALUES (
    'qr_hmac_secret',
    'CHANGEME_SET_VIA_ENV_QR_SECRET_MIN_32_CHARS',
    'Clé secrète HMAC pour signer les QR codes de tickets bus. '
    'Changer cette valeur en production via : '
    'UPDATE platform_config SET value = ''<secret_fort>'' WHERE key = ''qr_hmac_secret''; '
    'Également disponible via la variable d''environnement BUS_QR_HMAC_SECRET (prioritaire).'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 3. METTRE À JOUR validate_bus_ticket POUR VÉRIFIER LE CHAMP sig
-- ============================================================================
-- La vérification cryptographique est effectuée CÔTÉ RUST (contrôleur)
-- AVANT l'appel à validate_bus_ticket. Ici on ajoute seulement :
--   - La vérification que le champ 'sig' est présent dans le QR
--   - La récupération de la signature stockée pour comparaison

CREATE OR REPLACE FUNCTION validate_bus_ticket(
    p_qr_code_data     JSONB,
    p_validator_user_id INTEGER,
    p_product_id       TEXT DEFAULT NULL,
    p_signature_valid  BOOLEAN DEFAULT FALSE   -- TRUE si le contrôleur Rust a déjà vérifié la sig
)
RETURNS JSONB AS $$
DECLARE
    v_reservation_id TEXT;
    v_payment_id     TEXT;
    v_product_id     TEXT;
    v_reservation    RECORD;
    v_payment        RECORD;
    v_boarding_status RECORD;
    v_count          INTEGER;
    v_stored_sig     TEXT;
    v_qr_sig         TEXT;
BEGIN
    -- Extraire les données du QR code
    v_reservation_id := p_qr_code_data->>'id';
    v_payment_id     := p_qr_code_data->>'payment_id';
    v_product_id     := COALESCE(p_product_id, p_qr_code_data->>'product_id');
    v_qr_sig         := p_qr_code_data->>'sig';

    IF v_reservation_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'ID réservation manquant dans QR code'
        );
    END IF;

    -- Vérifier que la signature est présente dans le QR
    -- Note: la vérification cryptographique réelle est faite côté Rust avant cet appel.
    -- Ici on refuse les QR sans champ 'sig' (anciens QR non signés).
    IF v_qr_sig IS NULL AND NOT p_signature_valid THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'QR code invalide: signature manquante. Veuillez racheter votre billet.'
        );
    END IF;

    -- Si le contrôleur Rust signale que la signature est invalide, rejeter
    IF NOT p_signature_valid THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'QR code invalide: signature non authentique. Billet potentiellement falsifié.'
        );
    END IF;

    -- Vérifier cohérence: la signature stockée correspond à celle du QR
    IF v_payment_id IS NOT NULL THEN
        SELECT qr_hmac_signature INTO v_stored_sig
        FROM bus_ticket_payments
        WHERE id = v_payment_id;

        IF v_stored_sig IS NOT NULL AND v_qr_sig IS NOT NULL AND v_stored_sig != v_qr_sig THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'QR code invalide: signature ne correspond pas au paiement enregistré.'
            );
        END IF;
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

    -- Vérifier si le ticket est déjà validé
    SELECT * INTO v_boarding_status
    FROM bus_boarding_status
    WHERE reservation_id = v_reservation_id
       OR (payment_id IS NOT NULL AND payment_id = v_payment_id AND is_validated = TRUE);

    IF FOUND AND v_boarding_status.is_validated = TRUE THEN
        RETURN jsonb_build_object(
            'success',               FALSE,
            'error',                 'Ticket déjà utilisé - Ce ticket a déjà été validé et ne peut plus être utilisé',
            'already_boarded',       TRUE,
            'boarded_at',            v_boarding_status.validated_at,
            'validated_by_user_id',  v_boarding_status.validated_by,
            'validation_method',     v_boarding_status.validation_method
        );
    END IF;

    -- Protection doublon via payment_id
    IF v_payment_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM bus_boarding_status
        WHERE payment_id = v_payment_id AND is_validated = TRUE;

        IF v_count > 0 THEN
            RETURN jsonb_build_object(
                'success',         FALSE,
                'error',           'Ticket déjà utilisé - Ce paiement a déjà été validé pour un autre passager',
                'already_boarded', TRUE
            );
        END IF;
    END IF;

    -- Créer ou mettre à jour le statut d'embarquement
    IF FOUND THEN
        UPDATE bus_boarding_status
        SET boarding_status   = 'boarded',
            is_validated      = TRUE,
            validated_at      = NOW(),
            validated_by      = p_validator_user_id,
            validation_method = 'qr_code',
            qr_code_data      = p_qr_code_data,
            updated_at        = NOW()
        WHERE reservation_id = v_reservation_id AND is_validated = FALSE
        RETURNING * INTO v_boarding_status;

        IF NOT FOUND THEN
            SELECT * INTO v_boarding_status FROM bus_boarding_status
            WHERE reservation_id = v_reservation_id;
            IF v_boarding_status.is_validated = TRUE THEN
                RETURN jsonb_build_object(
                    'success',              FALSE,
                    'error',                'Ticket déjà utilisé',
                    'already_boarded',      TRUE,
                    'boarded_at',           v_boarding_status.validated_at,
                    'validated_by_user_id', v_boarding_status.validated_by,
                    'validation_method',    v_boarding_status.validation_method
                );
            END IF;
        END IF;
    ELSE
        BEGIN
            INSERT INTO bus_boarding_status (
                reservation_id, product_id, payment_id, boarding_status,
                is_validated, validated_at, validated_by, validation_method, qr_code_data
            ) VALUES (
                v_reservation_id, v_reservation.product_id, v_payment_id, 'boarded',
                TRUE, NOW(), p_validator_user_id, 'qr_code', p_qr_code_data
            ) RETURNING * INTO v_boarding_status;
        EXCEPTION
            WHEN unique_violation THEN
                SELECT * INTO v_boarding_status FROM bus_boarding_status
                WHERE reservation_id = v_reservation_id;
                IF v_boarding_status.is_validated = TRUE THEN
                    RETURN jsonb_build_object(
                        'success',         FALSE,
                        'error',           'Ticket déjà utilisé',
                        'already_boarded', TRUE,
                        'boarded_at',      v_boarding_status.validated_at
                    );
                END IF;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success',        TRUE,
        'reservation_id', v_reservation_id,
        'passenger_name', v_reservation.passenger_name,
        'seat_id',        v_reservation.seat_id,
        'seat_number',    v_reservation.seat_number,
        'validated_at',   v_boarding_status.validated_at,
        'message',        'Ticket validé avec succès'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_bus_ticket IS
    'Valide un ticket bus via QR code. '
    'Requiert p_signature_valid=TRUE (vérification HMAC faite côté Rust). '
    'Rejette les QR sans champ ''sig'' (protection contre QR forgés).';
