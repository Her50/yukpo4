-- Création de la table pour gérer les tentatives et historique de paiements

CREATE TABLE IF NOT EXISTS payment_attempts (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_xaf BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
    payment_method VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20),
    transaction_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    CONSTRAINT valid_amount CHECK (amount_xaf > 0),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'expired'))
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_id ON payment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_id ON payment_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at ON payment_attempts(created_at DESC);

-- Commentaires
COMMENT ON TABLE payment_attempts IS 'Historique des tentatives de paiement pour recharge de tokens';
COMMENT ON COLUMN payment_attempts.payment_id IS 'Identifiant unique de la tentative de paiement';
COMMENT ON COLUMN payment_attempts.amount_xaf IS 'Montant en XAF (1 token = 1 XAF)';
COMMENT ON COLUMN payment_attempts.payment_method IS 'Moyen de paiement utilisé (orange_money, mtn_momo, visa, etc.)';
COMMENT ON COLUMN payment_attempts.phone_number IS 'Numéro de téléphone pour mobile money';
COMMENT ON COLUMN payment_attempts.transaction_id IS 'ID de transaction du provider de paiement';
COMMENT ON COLUMN payment_attempts.metadata IS 'Données additionnelles du paiement (JSON)';
