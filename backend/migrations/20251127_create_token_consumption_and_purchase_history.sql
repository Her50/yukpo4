-- Migration pour créer les tables token_consumption_logs et purchase_history
-- Ces tables sont utilisées pour suivre la consommation de tokens et l'historique des paiements

-- Table token_consumption_logs : Historique des consommations de tokens
CREATE TABLE IF NOT EXISTS token_consumption_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    service_name TEXT,
    amount_consumed BIGINT NOT NULL DEFAULT 0,
    description TEXT,
    metadata JSONB
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_token_consumption_logs_user_id ON token_consumption_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_token_consumption_logs_created_at ON token_consumption_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_consumption_logs_user_created ON token_consumption_logs(user_id, created_at DESC);

-- Table purchase_history : Historique des achats/recharges de tokens
CREATE TABLE IF NOT EXISTS purchase_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount_paid BIGINT NOT NULL DEFAULT 0,
    tokens_received BIGINT NOT NULL DEFAULT 0,
    payment_method TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    transaction_id TEXT,
    metadata JSONB
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_purchase_history_user_id ON purchase_history(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_created_at ON purchase_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_history_user_created ON purchase_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_history_status ON purchase_history(status);
CREATE INDEX IF NOT EXISTS idx_purchase_history_transaction_id ON purchase_history(transaction_id) WHERE transaction_id IS NOT NULL;

-- Commentaires pour documentation
COMMENT ON TABLE token_consumption_logs IS 'Historique des consommations de tokens par utilisateur';
COMMENT ON COLUMN token_consumption_logs.service_name IS 'Nom du service qui a consommé les tokens';
COMMENT ON COLUMN token_consumption_logs.amount_consumed IS 'Nombre de tokens consommés';
COMMENT ON COLUMN token_consumption_logs.metadata IS 'Métadonnées supplémentaires (JSON)';

COMMENT ON TABLE purchase_history IS 'Historique des achats et recharges de tokens';
COMMENT ON COLUMN purchase_history.amount_paid IS 'Montant payé en FCFA';
COMMENT ON COLUMN purchase_history.tokens_received IS 'Nombre de tokens reçus';
COMMENT ON COLUMN purchase_history.payment_method IS 'Méthode de paiement (mobile_money, credit_card, etc.)';
COMMENT ON COLUMN purchase_history.status IS 'Statut de la transaction (pending, completed, failed, cancelled)';
COMMENT ON COLUMN purchase_history.transaction_id IS 'ID de transaction unique';
COMMENT ON COLUMN purchase_history.metadata IS 'Métadonnées supplémentaires (JSON)';

