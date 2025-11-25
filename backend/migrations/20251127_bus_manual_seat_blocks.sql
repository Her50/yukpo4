-- Migration: Gestion manuelle des places non disponibles
-- Date: 2025-11-27
-- Description: Permet aux agences de bloquer/débloquer manuellement des places
-- Note: Compatible SQLx offline mode

-- 1. Table pour les blocages manuels de places
CREATE TABLE IF NOT EXISTS bus_seat_blocks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    product_id TEXT NOT NULL,
    seat_id VARCHAR(50) NOT NULL,
    seat_number INTEGER NOT NULL,
    
    -- Raison du blocage
    reason VARCHAR(100) NOT NULL DEFAULT 'maintenance' CHECK (reason IN ('maintenance', 'damaged', 'reserved', 'other')),
    reason_details TEXT,
    
    -- Bloqué par
    blocked_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Débloqué
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    unblocked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    unblocked_at TIMESTAMPTZ,
    
    -- Contrainte unique : une place ne peut être bloquée qu'une fois à la fois
    CONSTRAINT unique_active_seat_block UNIQUE (product_id, seat_id) WHERE is_active = TRUE
);

-- 2. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_product ON bus_seat_blocks(product_id);
CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_active ON bus_seat_blocks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bus_seat_blocks_seat ON bus_seat_blocks(seat_id);

-- 3. Fonction pour bloquer une place manuellement
CREATE OR REPLACE FUNCTION block_bus_seat_manually(
    p_product_id TEXT,
    p_seat_id VARCHAR(50),
    p_seat_number INTEGER,
    p_reason VARCHAR(100) DEFAULT 'maintenance',
    p_reason_details TEXT DEFAULT NULL,
    p_blocked_by INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_block_id TEXT;
    v_existing_block RECORD;
BEGIN
    -- Vérifier si la place est déjà bloquée
    SELECT * INTO v_existing_block
    FROM bus_seat_blocks
    WHERE product_id = p_product_id
        AND seat_id = p_seat_id
        AND is_active = TRUE;
    
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Place déjà bloquée'
        );
    END IF;
    
    -- Vérifier si la place est réservée
    IF EXISTS (
        SELECT 1 FROM bus_reservations
        WHERE product_id = p_product_id
            AND seat_id = p_seat_id
            AND status IN ('pending', 'confirmed')
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Place déjà réservée, impossible de bloquer'
        );
    END IF;
    
    -- Créer le blocage
    INSERT INTO bus_seat_blocks (
        product_id,
        seat_id,
        seat_number,
        reason,
        reason_details,
        blocked_by
    )
    VALUES (
        p_product_id,
        p_seat_id,
        p_seat_number,
        p_reason,
        p_reason_details,
        p_blocked_by
    )
    RETURNING id INTO v_block_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'block_id', v_block_id,
        'message', 'Place bloquée avec succès'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION block_bus_seat_manually IS 'Bloque manuellement une place de bus (maintenance, endommagée, etc.)';

-- 4. Fonction pour débloquer une place
CREATE OR REPLACE FUNCTION unblock_bus_seat_manually(
    p_product_id TEXT,
    p_seat_id VARCHAR(50),
    p_unblocked_by INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_block RECORD;
BEGIN
    -- Récupérer le blocage actif
    SELECT * INTO v_block
    FROM bus_seat_blocks
    WHERE product_id = p_product_id
        AND seat_id = p_seat_id
        AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Aucun blocage actif trouvé pour cette place'
        );
    END IF;
    
    -- Désactiver le blocage
    UPDATE bus_seat_blocks
    SET 
        is_active = FALSE,
        unblocked_by = p_unblocked_by,
        unblocked_at = NOW()
    WHERE id = v_block.id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Place débloquée avec succès'
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION unblock_bus_seat_manually IS 'Débloque une place de bus précédemment bloquée';

-- 5. Fonction pour obtenir la disponibilité avec blocages
CREATE OR REPLACE FUNCTION get_bus_seat_availability_with_blocks(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_seat_map JSONB;
    v_reserved_seats TEXT[];
    v_blocked_seats TEXT[];
    v_available_seats JSONB;
BEGIN
    -- Récupérer le produit
    SELECT 
        p.id,
        p.name,
        p.total_seats,
        p.seat_map,
        p.bus_configuration
    INTO v_product
    FROM products p
    WHERE p.id::text = p_product_id
        AND p.type = 'ticket_voyage'
        AND p.is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouvé');
    END IF;
    
    -- Récupérer les places réservées
    SELECT ARRAY_AGG(br.seat_id)
    INTO v_reserved_seats
    FROM bus_reservations br
    WHERE br.product_id = p_product_id
        AND br.status IN ('pending', 'confirmed')
        AND (br.expires_at IS NULL OR br.expires_at > NOW());
    
    -- Récupérer les places bloquées
    SELECT ARRAY_AGG(bsb.seat_id)
    INTO v_blocked_seats
    FROM bus_seat_blocks bsb
    WHERE bsb.product_id = p_product_id
        AND bsb.is_active = TRUE;
    
    -- Construire le seat_map avec statuts
    IF v_product.seat_map IS NULL THEN
        v_seat_map := jsonb_build_array();
    ELSE
        v_seat_map := v_product.seat_map;
    END IF;
    
    -- Mettre à jour les statuts dans le seat_map
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
        'total_seats', v_product.total_seats,
        'reserved_count', COALESCE(array_length(v_reserved_seats, 1), 0),
        'blocked_count', COALESCE(array_length(v_blocked_seats, 1), 0),
        'available_count', GREATEST(0, 
            COALESCE(v_product.total_seats, 0) 
            - COALESCE(array_length(v_reserved_seats, 1), 0)
            - COALESCE(array_length(v_blocked_seats, 1), 0)
        ),
        'reserved_seats', COALESCE(to_jsonb(v_reserved_seats), '[]'::jsonb),
        'blocked_seats', COALESCE(to_jsonb(v_blocked_seats), '[]'::jsonb),
        'seats', v_seat_map
    );
    
    RETURN jsonb_build_object('success', TRUE, 'availability', v_available_seats);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_bus_seat_availability_with_blocks IS 'Retourne la disponibilité des places en incluant les blocages manuels';

-- 6. Vue pour les blocages actifs avec détails
CREATE OR REPLACE VIEW bus_active_seat_blocks AS
SELECT 
    bsb.id,
    bsb.product_id,
    bsb.seat_id,
    bsb.seat_number,
    bsb.reason,
    bsb.reason_details,
    bsb.blocked_by,
    bsb.blocked_at,
    u.nom_complet as blocked_by_name,
    p.name as product_name,
    p.numero_bus
FROM bus_seat_blocks bsb
JOIN users u ON u.id = bsb.blocked_by
JOIN products p ON p.id::text = bsb.product_id
WHERE bsb.is_active = TRUE
ORDER BY bsb.blocked_at DESC;

COMMENT ON VIEW bus_active_seat_blocks IS 'Vue des blocages actifs de places avec informations détaillées';

