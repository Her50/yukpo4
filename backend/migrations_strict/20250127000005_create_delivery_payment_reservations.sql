-- Migration: Table delivery_payment_reservations
-- Date: 2025-01-27
-- Description: Réservations de paiement pour livraisons (Phase 5)

-- ✅ CORRIGÉ 2026-01-29: Créer la table sans contrainte FK d'abord, puis l'ajouter conditionnellement
CREATE TABLE IF NOT EXISTS delivery_payment_reservations (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Montants
    product_price_cents BIGINT NOT NULL,  -- Prix produit en centimes
    delivery_cost_cents BIGINT NOT NULL,  -- Coût livraison en centimes
    total_amount_cents BIGINT NOT NULL,   -- Total = product + delivery
    
    -- Mode de facturation
    billing_mode VARCHAR(50) DEFAULT 'standard',  -- 'standard' ou 'merchant_inclusive'
    merchant_pays_delivery BOOLEAN DEFAULT FALSE,  -- Si prestataire paie la livraison
    
    -- Statut de la réservation
    reservation_status VARCHAR(50) DEFAULT 'reserved',  -- 'reserved', 'debited', 'released', 'refunded'
    
    -- Informations de débit
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    debited_at TIMESTAMPTZ,  -- Quand le débit définitif a été effectué
    released_at TIMESTAMPTZ,  -- Quand la réservation a été libérée (coursier refuse)
    refunded_at TIMESTAMPTZ,  -- Quand un remboursement a été effectué
    
    -- Informations de reversement prestataire
    merchant_payout_cents BIGINT,  -- Montant reversé au prestataire (après commission)
    commission_cents BIGINT,  -- Commission Yukpo
    commission_rate DECIMAL(5,4) DEFAULT 0.05,  -- Taux commission (5% par défaut)
    merchant_paid_at TIMESTAMPTZ,  -- Quand le prestataire a été payé
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_delivery ON delivery_payment_reservations(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_user ON delivery_payment_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_status ON delivery_payment_reservations(reservation_status);

-- ✅ CORRIGÉ 2026-01-29: Ajouter la contrainte de clé étrangère seulement si deliveries existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'delivery_payment_reservations' 
            AND constraint_name = 'delivery_payment_reservations_delivery_id_fkey'
        ) THEN
            ALTER TABLE delivery_payment_reservations
                ADD CONSTRAINT delivery_payment_reservations_delivery_id_fkey
                FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

