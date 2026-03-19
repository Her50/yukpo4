-- Migration: Ajout support matching intelligent modes de paiement
-- Date: 2025-01-27
-- Description: Phase 5 - Matching intelligent MTN Money / Orange Money

-- 1. Ajouter colonne payment_methods dans users pour stocker les modes de paiement du prestataire
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{}'::jsonb;

-- Exemple de structure:
-- {
--   "mtn_money": {
--     "phone": "+237699123456",
--     "verified": true,
--     "verified_at": "2025-01-27T10:00:00Z"
--   },
--   "orange_money": {
--     "phone": "+237677123456",
--     "verified": false
--   }
-- }

COMMENT ON COLUMN users.payment_methods IS 'Modes de paiement configurés par le prestataire pour recevoir les reversements (MTN Money, Orange Money, etc.)';

-- 2. Ajouter colonnes dans delivery_payment_reservations pour stocker les modes de paiement
ALTER TABLE delivery_payment_reservations
ADD COLUMN IF NOT EXISTS client_payment_method JSONB,
ADD COLUMN IF NOT EXISTS merchant_payment_method JSONB,
ADD COLUMN IF NOT EXISTS payout_method_used VARCHAR(50); -- 'mtn_money', 'orange_money', 'wallet_internal'

COMMENT ON COLUMN delivery_payment_reservations.client_payment_method IS 'Mode de paiement utilisé par le client (ex: {"type": "mtn_money", "phone": "+237699123456"})';
COMMENT ON COLUMN delivery_payment_reservations.merchant_payment_method IS 'Mode de paiement utilisé pour le reversement au prestataire';
COMMENT ON COLUMN delivery_payment_reservations.payout_method_used IS 'Méthode de reversement effectivement utilisée';

-- 3. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_users_payment_methods ON users USING GIN (payment_methods) WHERE payment_methods != '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_payout_method ON delivery_payment_reservations(payout_method_used);

