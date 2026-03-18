-- ✅ MIGRATIONS TABLES MANQUANTES - Paiements et tables complémentaires
-- Date: 2026-03-16 (corrigé 2026-03-18: fix schemas, SQL syntax, add missing tables)
-- Description: Tables pour fournisseurs paiement, transactions, demandes remboursement

-- ========================================
-- AJOUT CHAMPS QR CODE PARTAGEABLE
-- ========================================

DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'qr_codes_coursier') THEN
        ALTER TABLE qr_codes_coursier
        ADD COLUMN IF NOT EXISTS delivery_id UUID,
        ADD COLUMN IF NOT EXISTS qr_code_image TEXT,
        ADD COLUMN IF NOT EXISTS partageable BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS genere_par INTEGER REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS valide_jusqua TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS location_scan TEXT,
        ADD COLUMN IF NOT EXISTS scan_par INTEGER REFERENCES users(id);

        CREATE INDEX IF NOT EXISTS idx_qr_codes_coursier_delivery ON qr_codes_coursier(delivery_id);
        CREATE INDEX IF NOT EXISTS idx_qr_codes_coursier_partageable ON qr_codes_coursier(partageable) WHERE partageable = true;
        CREATE INDEX IF NOT EXISTS idx_qr_codes_coursier_valide ON qr_codes_coursier(valide_jusqua);
    END IF;
END $$;

-- ========================================
-- TABLE FOURNISSEURS PAIEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS fournisseurs_paiement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    type_fournisseur VARCHAR(50) NOT NULL,
    pays VARCHAR(100) NOT NULL,
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    commission_fournisseur DECIMAL(5,4) NOT NULL DEFAULT 0.0000 CHECK (commission_fournisseur >= 0 AND commission_fournisseur <= 1),
    configuration JSONB NOT NULL DEFAULT '{}',
    est_actif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fournisseurs_paiement_code ON fournisseurs_paiement(code);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_paiement_type ON fournisseurs_paiement(type_fournisseur);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_paiement_actif ON fournisseurs_paiement(est_actif) WHERE est_actif = true;

-- ========================================
-- TABLE TRANSACTIONS AGRÉGÉES (paiement_agrege_service.rs)
-- ========================================

CREATE TABLE IF NOT EXISTS transactions_agregees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    montant_total DECIMAL(15,2) NOT NULL,
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    methode_paiement VARCHAR(50) NOT NULL,
    statut VARCHAR(30) NOT NULL DEFAULT 'en_attente',
    reference_paiement VARCHAR(255) NOT NULL,
    provider_transaction_id VARCHAR(255),
    commission_app DECIMAL(15,2) NOT NULL DEFAULT 0,
    montant_net DECIMAL(15,2) NOT NULL DEFAULT 0,
    details_repartition JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_agregees_user ON transactions_agregees(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_agregees_statut ON transactions_agregees(statut);
CREATE INDEX IF NOT EXISTS idx_transactions_agregees_reference ON transactions_agregees(reference_paiement);
CREATE INDEX IF NOT EXISTS idx_transactions_agregees_created ON transactions_agregees(created_at DESC);

-- ========================================
-- TABLE PAYMENT_TRANSACTIONS (payment_service.rs)
-- ========================================

CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
    payment_method TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    gateway_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_txn_id ON payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- ========================================
-- TABLE TOKEN_TRANSACTIONS (payment_service.rs)
-- ========================================

CREATE TABLE IF NOT EXISTS token_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    bonus INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    transaction_type VARCHAR(30) NOT NULL DEFAULT 'recharge',
    transaction_id VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_txn ON token_transactions(transaction_id);

-- ========================================
-- NOTE: user_wallets + wallet_transactions sont créées par ensure_wallet_tables()
-- dans auto_migrate.rs avec le schéma canonical: balance_cents BIGINT, currency VARCHAR
-- NE PAS les recréer ici. Ajouter seulement la colonne 'solde' en alias si manquante.
-- ========================================

-- Ajouter colonne solde comme alias pour compatibilité legacy (si table existe déjà)
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_wallets') THEN
        -- Ajouter solde comme generated column si la colonne n'existe pas
        IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_wallets' AND column_name = 'solde') THEN
            ALTER TABLE user_wallets ADD COLUMN solde DECIMAL(15,2) GENERATED ALWAYS AS (balance_cents::decimal / 100.0) STORED;
        END IF;
    END IF;
END $$;

-- ========================================
-- TABLE DEMANDES REMBOURSEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS demandes_remboursement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions_agregees(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    motif TEXT NOT NULL,
    montant DECIMAL(12,2) NOT NULL CHECK (montant > 0),
    montant_rembourse DECIMAL(12,2),
    statut VARCHAR(20) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'rejete')),
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    motif_rejet TEXT,
    date_traitement TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demandes_remboursement_transaction ON demandes_remboursement(transaction_id);
CREATE INDEX IF NOT EXISTS idx_demandes_remboursement_user ON demandes_remboursement(user_id);
CREATE INDEX IF NOT EXISTS idx_demandes_remboursement_statut ON demandes_remboursement(statut);
CREATE INDEX IF NOT EXISTS idx_demandes_remboursement_created ON demandes_remboursement(created_at DESC);

-- ========================================
-- TABLE DELIVERY PACKAGES (pour QR codes)
-- ========================================

DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'chaines_livraison_unifiees') THEN
        CREATE TABLE IF NOT EXISTS delivery_packages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            chaine_id UUID REFERENCES chaines_livraison_unifiees(id) ON DELETE CASCADE,
            reference_paquet VARCHAR(50) NOT NULL UNIQUE,
            type_paquet VARCHAR(20) NOT NULL DEFAULT 'livraison',
            statut VARCHAR(20) NOT NULL DEFAULT 'en_preparation',
            coursier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            gps_actuel VARCHAR(100),
            timestamp_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            timestamp_depart TIMESTAMP WITH TIME ZONE,
            timestamp_arrivee TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_delivery_packages_chaine ON delivery_packages(chaine_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_packages_coursier ON delivery_packages(coursier_id);
        CREATE INDEX IF NOT EXISTS idx_delivery_packages_statut ON delivery_packages(statut);
        CREATE INDEX IF NOT EXISTS idx_delivery_packages_reference ON delivery_packages(reference_paquet);
    END IF;
END $$;

-- ========================================
-- FONCTIONS UTILITAIRES
-- ========================================

CREATE SEQUENCE IF NOT EXISTS paquet_seq START 1;

CREATE OR REPLACE FUNCTION calculer_commission_fournisseur(
    p_montant DECIMAL,
    fournisseur_code VARCHAR
) RETURNS DECIMAL AS $$
DECLARE
    commission_rate DECIMAL;
BEGIN
    SELECT commission_fournisseur INTO commission_rate
    FROM fournisseurs_paiement
    WHERE code = fournisseur_code AND est_actif = true;

    IF commission_rate IS NULL THEN
        RETURN 0.00;
    END IF;

    RETURN p_montant * commission_rate;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- DONNÉES INITIALES
-- ========================================

INSERT INTO fournisseurs_paiement (nom, code, type_fournisseur, pays, devise, configuration) VALUES
('Orange Money', 'orange', 'mobile_money', 'CM', 'XAF', '{"api_key": "sandbox_key", "api_url": "https://api.orange.com/oauth2/v3/token"}'::jsonb),
('MTN Mobile Money', 'mtn', 'mobile_money', 'CM', 'XAF', '{"api_key": "sandbox_key", "api_url": "https://sandbox.mtn.cm/api"}'::jsonb),
('Wave', 'wave', 'mobile_money', 'CM', 'XAF', '{"api_key": "sandbox_key", "api_url": "https://api.wave.com"}'::jsonb),
('YukPo Wallet', 'wallet', 'wallet', 'CM', 'XAF', '{"internal": true}'::jsonb),
('Flutterwave', 'flutterwave', 'mobile_money', 'AFRICA', 'XAF', '{"api_url": "https://api.flutterwave.com/v3"}'::jsonb),
('CinetPay', 'cinetpay', 'mobile_money', 'CEMAC', 'XAF', '{"api_url": "https://api-checkout.cinetpay.com"}'::jsonb),
('NotchPay', 'notchpay', 'mobile_money', 'CM', 'XAF', '{"api_url": "https://api.notchpay.co"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- COMMENTAIRES
-- ========================================

COMMENT ON TABLE fournisseurs_paiement IS 'Fournisseurs de paiement (Mobile Money, Banques, etc.)';
COMMENT ON TABLE transactions_agregees IS 'Transactions de paiement agrégées avec répartition des fonds';
COMMENT ON TABLE payment_transactions IS 'Transactions de paiement unitaires via agrégateur';
COMMENT ON TABLE token_transactions IS 'Historique des crédits/débits de tokens';
COMMENT ON TABLE demandes_remboursement IS 'Demandes de remboursement des transactions';
