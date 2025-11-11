-- Migration de production pour créer les tables de paiement
-- Date: 2025-09-26
-- Cette migration sera appliquée automatiquement sur Render

-- Vérifier si les tables existent déjà
DO $$
BEGIN
    -- Créer la table payment_transactions si elle n'existe pas
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN
        CREATE TABLE payment_transactions (
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
        
        -- Créer les index pour payment_transactions
        CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
        CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
        CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at);
        
        RAISE NOTICE 'Table payment_transactions créée avec succès';
    ELSE
        RAISE NOTICE 'Table payment_transactions existe déjà';
    END IF;

    -- Créer la table token_transactions si elle n'existe pas
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'token_transactions') THEN
        CREATE TABLE token_transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            transaction_id VARCHAR(255) REFERENCES payment_transactions(transaction_id),
            amount INTEGER NOT NULL DEFAULT 0,
            bonus INTEGER NOT NULL DEFAULT 0,
            total INTEGER NOT NULL DEFAULT 0,
            transaction_type VARCHAR(50) NOT NULL,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Créer les index pour token_transactions
        CREATE INDEX idx_token_transactions_user_id ON token_transactions(user_id);
        CREATE INDEX idx_token_transactions_type ON token_transactions(transaction_type);
        
        RAISE NOTICE 'Table token_transactions créée avec succès';
    ELSE
        RAISE NOTICE 'Table token_transactions existe déjà';
    END IF;
END $$;

-- Créer le trigger pour updated_at si nécessaire
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer le trigger pour payment_transactions si nécessaire
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payment_transactions_updated_at') THEN
        CREATE TRIGGER update_payment_transactions_updated_at 
            BEFORE UPDATE ON payment_transactions 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Trigger update_payment_transactions_updated_at créé';
    ELSE
        RAISE NOTICE 'Trigger update_payment_transactions_updated_at existe déjà';
    END IF;
END $$;
