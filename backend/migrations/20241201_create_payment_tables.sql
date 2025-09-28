-- Migration pour créer les tables de paiement
-- Date: 2024-12-01

-- Table des transactions de paiement
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
    payment_method JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    gateway_response JSONB,
    reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des transactions de tokens
CREATE TABLE IF NOT EXISTS token_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(255) REFERENCES payment_transactions(transaction_id),
    amount INTEGER NOT NULL DEFAULT 0,
    bonus INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    transaction_type VARCHAR(50) NOT NULL, -- 'recharge', 'usage', 'refund'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des méthodes de paiement sauvegardées
CREATE TABLE IF NOT EXISTS saved_payment_methods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method_type VARCHAR(50) NOT NULL, -- 'orange_money', 'mtn_money', 'visa', 'paypal', 'bank'
    method_data JSONB NOT NULL, -- Données chiffrées de la méthode
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_user_id ON saved_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_type ON saved_payment_methods(method_type);

-- Triggers pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_transactions_updated_at 
    BEFORE UPDATE ON payment_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_payment_methods_updated_at 
    BEFORE UPDATE ON saved_payment_methods 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vues utiles pour les rapports
CREATE OR REPLACE VIEW payment_summary AS
SELECT 
    pt.user_id,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN pt.status = 'completed' THEN pt.amount ELSE 0 END) as total_amount,
    SUM(CASE WHEN pt.status = 'completed' THEN tt.total ELSE 0 END) as total_tokens,
    MAX(pt.created_at) as last_payment_date
FROM payment_transactions pt
LEFT JOIN token_transactions tt ON pt.transaction_id = tt.transaction_id
GROUP BY pt.user_id;

-- Vue pour les statistiques de paiement par méthode
CREATE OR REPLACE VIEW payment_method_stats AS
SELECT 
    payment_method->>'type' as method_type,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as average_amount,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM payment_transactions
GROUP BY payment_method->>'type';

-- Données de test (optionnel - à supprimer en production)
-- INSERT INTO payment_transactions (transaction_id, user_id, amount, currency, payment_method, status) VALUES
-- ('test_txn_1', 1, 5000.00, 'XAF', '{"type": "orange_money", "phone_number": "+237123456789"}', 'completed'),
-- ('test_txn_2', 1, 10000.00, 'XAF', '{"type": "mtn_money", "phone_number": "+237987654321"}', 'completed');

-- INSERT INTO token_transactions (user_id, transaction_id, amount, bonus, total, transaction_type, description) VALUES
-- (1, 'test_txn_1', 5000, 250, 5250, 'recharge', 'Recharge de 5000 XAF'),
-- (1, 'test_txn_2', 10000, 2000, 12000, 'recharge', 'Recharge de 10000 XAF');



