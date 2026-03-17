-- ✅ MIGRATIONS TABLES MANQUANTES - Réseau librairies et paiements
-- Date: 2026-03-16
-- Description: Tables pour fournisseurs paiement, wallets, demandes remboursement

-- ========================================
-- AJOUT CHAMPS QR CODE PARTAGEABLE
// ========================================

-- Ajouter les champs manquants à la table qr_codes_coursier
ALTER TABLE qr_codes_coursier 
ADD COLUMN IF NOT EXISTS delivery_id UUID,
ADD COLUMN IF NOT EXISTS qr_code_image TEXT,
ADD COLUMN IF NOT EXISTS partageable BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS genere_par INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS valide_jusqua TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS location_scan TEXT,
ADD COLUMN IF NOT EXISTS scan_par INTEGER REFERENCES users(id);

-- Index pour les nouveaux champs
CREATE INDEX IF NOT EXISTS idx_qr_codes_coursier_delivery ON qr_codes_coursier(delivery_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_coursier_partageable ON qr_codes_coursier(partageable) WHERE partageable = true;
CREATE INDEX IF NOT EXISTS idx_qr_codes_coursier_valide ON qr_codes_coursier(valide_jusqua);

-- ========================================
-- TABLE FOURNISSEURS PAIEMENT
// ========================================

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

-- Index
CREATE INDEX IF NOT EXISTS idx_fournisseurs_paiement_code ON fournisseurs_paiement(code);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_paiement_type ON fournisseurs_paiement(type_fournisseur);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_paiement_actif ON fournisseurs_paiement(est_actif) WHERE est_actif = true;

-- ========================================
-- TABLE USER WALLETS
// ========================================

CREATE TABLE IF NOT EXISTS user_wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    solde DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (solde >= 0),
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_user_wallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_wallets_updated_at 
    BEFORE UPDATE ON user_wallets 
    FOR EACH ROW EXECUTE FUNCTION update_user_wallets_updated_at();

-- ========================================
-- TABLE WALLET TRANSACTIONS
// ========================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    montant DECIMAL(15,2) NOT NULL,
    type_transaction VARCHAR(20) NOT NULL CHECK (type_transaction IN ('credit', 'debit')),
    motif TEXT NOT NULL,
    reference_paiement VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type_transaction);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_paiement);

-- ========================================
-- TABLE DEMANDES REMBOURSEMENT
// ========================================

CREATE TABLE IF NOT EXISTS demandes_remboursement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions_agregees(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    motif TEXT NOT NULL,
    montant DECIMAL(12,2) NOT NULL CHECK (montant > 0),
    montant_rembourse DECIMAL(12,2),
    statut VARCHAR(20) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'rejete')),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    motif_rejet TEXT,
    date_traitement TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_demandes_remboursement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_demandes_remboursement_updated_at 
    BEFORE UPDATE ON demandes_remboursement 
    FOR EACH ROW EXECUTE FUNCTION update_demandes_remboursement_updated_at();

-- Index
CREATE INDEX IF NOT EXISTS idx_demandes_remboursement_transaction ON demandes_remboursement(transaction_id);
CREATE INDEX IF NOT EXISTS idx_demandes_remboursement_user ON demandes_remboursement(user_id);
CREATE INDEX IF NOT EXISTS idx_demandes_remboursement_statut ON demandes_remboursement(statut);
CREATE INDEX IF NOT EXISTS idx_demandes_remboursement_created ON demandes_remboursement(created_at DESC);

-- ========================================
-- TABLE DELIVERY PACKAGES (pour QR codes)
// ========================================

CREATE TABLE IF NOT EXISTS delivery_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chaine_id UUID REFERENCES chaines_livraison_unifiees(id) ON DELETE CASCADE,
    reference_paquet VARCHAR(50) NOT NULL UNIQUE,
    type_paquet VARCHAR(20) NOT NULL DEFAULT 'livraison' CHECK (type_paquet IN ('livraison', 'retrait', 'depot')),
    statut VARCHAR(20) NOT NULL DEFAULT 'en_preparation' CHECK (statut IN ('en_preparation', 'pret', 'en_cours', 'livre', 'annule')),
    coursier_id UUID REFERENCES users(id) ON DELETE SET NULL,
    gps_actuel VARCHAR(100),
    timestamp_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    timestamp_depart TIMESTAMP WITH TIME ZONE,
    timestamp_arrivee TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_delivery_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_delivery_packages_updated_at 
    BEFORE UPDATE ON delivery_packages 
    FOR EACH ROW EXECUTE FUNCTION update_delivery_packages_updated_at();

-- Index
CREATE INDEX IF NOT EXISTS idx_delivery_packages_chaine ON delivery_packages(chaine_id);
CREATE INDEX IF NOT EXISTS idx_delivery_packages_coursier ON delivery_packages(coursier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_packages_statut ON delivery_packages(statut);
CREATE INDEX IF NOT EXISTS idx_delivery_packages_reference ON delivery_packages(reference_paquet);

-- ========================================
-- FONCTIONS UTILITAIRES SUPPLÉMENTAIRES
// ========================================

-- Génération référence paquet
CREATE OR REPLACE FUNCTION generer_reference_paquet()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reference_paquet IS NULL OR NEW.reference_paquet = '' THEN
        NEW.reference_paquet := 'PKG-' || to_char(NOW(), 'YYYY') || '-' || 
                               LPAD(nextval('paquet_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Séquence pour paquets
CREATE SEQUENCE IF NOT EXISTS paquet_seq START 1;

-- Trigger sur delivery_packages
CREATE TRIGGER set_reference_paquet
    BEFORE INSERT ON delivery_packages
    FOR EACH ROW EXECUTE FUNCTION generer_reference_paquet();

-- Fonction pour calculer la commission d'un fournisseur
CREATE OR REPLACE FUNCTION calculer_commission_fournisseur(
    montant DECIMAL, 
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
    
    RETURN montant * commission_rate;
END;
$$ LANGUAGE plpgsql;

-- Vue pour les statistiques des wallets
CREATE OR REPLACE VIEW v_wallet_stats AS
SELECT 
    u.id as user_id,
    u.nom,
    u.prenom,
    u.email,
    COALESCE(uw.solde, 0) as solde_actuel,
    COALESCE(wt_stats.total_credits, 0) as total_credits,
    COALESCE(wt_stats.total_debits, 0) as total_debits,
    COALESCE(wt_stats.nb_transactions, 0) as nb_transactions
FROM users u
LEFT JOIN user_wallets uw ON u.id = uw.user_id
LEFT JOIN (
    SELECT 
        user_id,
        SUM(CASE WHEN type_transaction = 'credit' THEN montant ELSE 0 END) as total_credits,
        SUM(CASE WHEN type_transaction = 'debit' THEN montant ELSE 0 END) as total_debits,
        COUNT(*) as nb_transactions
    FROM wallet_transactions
    GROUP BY user_id
) wt_stats ON u.id = wt_stats.user_id;

-- Vue pour les transactions avec détails
CREATE OR REPLACE VIEW v_transactions_detaillees AS
SELECT 
    ta.*,
    u.nom as user_nom,
    u.prenom as user_prenom,
    u.email as user_email,
    cm.reference_commande,
    fp.nom as fournisseur_nom,
    fp.type_fournisseur
FROM transactions_agregees ta
LEFT JOIN users u ON ta.user_id = u.id
LEFT JOIN commandes_mixtes cm ON ta.commande_id = cm.id
LEFT JOIN fournisseurs_paiement fp ON ta.provider_transaction_id LIKE fp.code || '%';

-- ========================================
-- DONNÉES INITIALES
// ========================================

-- Insérer fournisseurs de paiement par défaut
INSERT INTO fournisseurs_paiement (nom, code, type_fournisseur, pays, devise, configuration) VALUES
('Orange Money', 'orange', 'mobile_money', 'CM', 'XAF', '{
    "api_key": "sandbox_key",
    "api_secret": "sandbox_secret",
    "api_url": "https://api.orange.com/oauth2/v3/token",
    "payment_url": "https://api.orange.com/orange-money-webpay/cm/v1/webpayment"
}'::jsonb),
('MTN Mobile Money', 'mtn', 'mobile_money', 'CM', 'XAF', '{
    "api_key": "sandbox_key",
    "api_secret": "sandbox_secret", 
    "api_url": "https://sandbox.mtn.cm/api",
    "payment_url": "https://sandbox.mtn.cm/api/collection"
}'::jsonb),
('Wave', 'wave', 'mobile_money', 'CM', 'XAF', '{
    "api_key": "sandbox_key",
    "business_id": "sandbox_business",
    "api_url": "https://api.wave.com",
    "payment_url": "https://api.wave.com/v1/checkout"
}'::jsonb),
('YukPo Wallet', 'wallet', 'wallet', 'CM', 'XAF', '{
    "internal": true,
    "no_external_api": true
}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- COMMENTAIRES
// ========================================

COMMENT ON TABLE fournisseurs_paiement IS 'Fournisseurs de paiement (Mobile Money, Banques, etc.)';
COMMENT ON TABLE user_wallets IS 'Portefeuilles virtuels des utilisateurs';
COMMENT ON TABLE wallet_transactions IS 'Historique des transactions wallet';
COMMENT ON TABLE demandes_remboursement IS 'Demandes de remboursement des transactions';
COMMENT ON TABLE delivery_packages IS 'Paquets de livraison pour QR codes coursier';
