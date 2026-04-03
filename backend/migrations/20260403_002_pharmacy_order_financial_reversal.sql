-- Migration: Colonnes pour le reversal financier sur pharmacy_orders
-- + entrée commission Yukpo pour pharmacie dans yukpo_commission_config
-- Date: 2026-04-03

-- Colonnes de traçabilité du reversal
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS reversed_at         TIMESTAMPTZ;
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS net_partner_amount  BIGINT DEFAULT 0;   -- centimes nets versés au pharmacien
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS yukpo_commission    BIGINT DEFAULT 0;   -- commission Yukpo en centimes

-- Index pour audit des commandes reversées vs non reversées
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_reversed_at ON pharmacy_orders(reversed_at);

-- Commission Yukpo pour le service pharmacie (2% par défaut)
-- La table yukpo_commission_config est créée par la migration restaurant (00000197_001)
INSERT INTO yukpo_commission_config (service_type, rate)
VALUES ('pharmacie', 0.02)
ON CONFLICT (service_type) DO NOTHING;
