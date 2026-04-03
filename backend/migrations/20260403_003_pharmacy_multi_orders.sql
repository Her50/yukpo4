-- Migration: commandes multi-pharmacies
-- Permet à un patient de commander des médicaments dans plusieurs pharmacies
-- lorsqu'aucune pharmacie n'a 100% des médicaments de l'ordonnance.
-- Date: 2026-04-03

-- ─── Table parent regroupant les sous-commandes ───────────────────────────────
CREATE TABLE IF NOT EXISTS pharmacy_multi_orders (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_method    VARCHAR(20)  NOT NULL DEFAULT 'pickup',  -- 'pickup' | 'delivery'
    delivery_address   TEXT,
    sub_orders_count   INTEGER      NOT NULL DEFAULT 1,
    total_amount       DECIMAL(10,2),
    -- 'pending' | 'partially_complete' | 'completed' | 'cancelled'
    status             VARCHAR(30)  NOT NULL DEFAULT 'pending',
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_multi_orders_patient ON pharmacy_multi_orders(patient_id);

-- ─── Colonnes ajoutées à pharmacy_orders ─────────────────────────────────────
-- multi_order_id : UUID de la commande multi-pharmacies parente (NULL = commande simple)
-- sub_order_index : position dans la commande multi (1, 2, 3…)
ALTER TABLE pharmacy_orders
    ADD COLUMN IF NOT EXISTS multi_order_id  UUID REFERENCES pharmacy_multi_orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sub_order_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_multi_id ON pharmacy_orders(multi_order_id);

-- ─── Commentaires ─────────────────────────────────────────────────────────────
-- Flux multi-pharmacies :
--   1. Patient scanne ordonnance → IA extrait médicaments
--   2. search_by_medications retourne pharmacies avec medications_availability[]
--   3. Mobile calcule la répartition optimale (greedy par matching_score + proximité)
--   4. POST /api/pharmacies/orders/multi crée : pharmacy_multi_orders + N pharmacy_orders liés
--   5. Wallet débité du total combiné (1 seule transaction)
--   6. Chaque sous-commande a son QR pickup propre (coursier montre à chaque pharmacie)
--   7. QR delivery unique par sous-commande (patient confirme à la livraison)
--   8. Reversal déclenché sous-commande par sous-commande à chaque scan QR
