-- Migration pour ajouter les index nécessaires aux tables de paiement
-- Date: 2024-12-26

-- Index pour optimiser les requêtes de webhooks
CREATE INDEX IF NOT EXISTS idx_payment_attempts_transaction_id ON payment_attempts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_reference ON payment_attempts(payment_id);

-- Index pour optimiser les requêtes de validation de numéros
CREATE INDEX IF NOT EXISTS idx_payment_attempts_phone_number ON payment_attempts(phone_number);

-- Index pour optimiser les requêtes de statistiques
CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_method ON payment_attempts(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_amount_xaf ON payment_attempts(amount_xaf);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_status ON payment_attempts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status_created ON payment_attempts(status, created_at);

-- Index pour les requêtes de recherche par période
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at_status ON payment_attempts(created_at DESC, status);

-- Index pour les requêtes de montant par utilisateur
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_amount ON payment_attempts(user_id, amount_xaf);

-- Commentaires
COMMENT ON INDEX idx_payment_attempts_transaction_id IS 'Index pour les webhooks par transaction_id';
COMMENT ON INDEX idx_payment_attempts_reference IS 'Index pour les webhooks par payment_id';
COMMENT ON INDEX idx_payment_attempts_phone_number IS 'Index pour la validation des numéros de téléphone';
COMMENT ON INDEX idx_payment_attempts_payment_method IS 'Index pour les statistiques par méthode de paiement';
COMMENT ON INDEX idx_payment_attempts_amount_xaf IS 'Index pour les requêtes par montant';
COMMENT ON INDEX idx_payment_attempts_user_status IS 'Index composite pour les requêtes utilisateur/statut';
COMMENT ON INDEX idx_payment_attempts_status_created IS 'Index composite pour les requêtes statut/création';
COMMENT ON INDEX idx_payment_attempts_created_at_status IS 'Index pour les requêtes par période et statut';
COMMENT ON INDEX idx_payment_attempts_user_amount IS 'Index pour les requêtes utilisateur/montant';



