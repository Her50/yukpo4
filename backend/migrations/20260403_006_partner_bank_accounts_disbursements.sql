-- Migration: Table comptes bancaires partenaires + table disbursement_requests officielle
-- Permet aux partenaires d'enregistrer leurs coordonnées de paiement (Mobile Money, virement bancaire)
-- et de suivre toutes les demandes de retrait avec statut complet.
-- Date: 2026-04-03

-- ============================================================================
-- 1. TABLE partner_bank_accounts
--    Coordonnées de paiement enregistrées par le partenaire (admin du service)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_bank_accounts (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type    VARCHAR(30) NOT NULL,   -- 'pharmacie', 'restaurant', 'supermarche', etc.
    service_id      INTEGER NOT NULL,

    -- Type de paiement
    method          VARCHAR(30) NOT NULL DEFAULT 'mobile_money',
    -- 'mobile_money' | 'bank_transfer' | 'internal_wallet'

    -- Mobile Money
    phone           VARCHAR(20),            -- numéro MTN / Orange / Moov
    provider        VARCHAR(20),            -- 'mtn', 'orange', 'moov'

    -- Virement bancaire
    bank_name       VARCHAR(100),
    account_number  VARCHAR(50),
    account_name    VARCHAR(100),
    iban            VARCHAR(50),

    -- Compte par défaut pour les retraits automatiques
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_verified     BOOLEAN NOT NULL DEFAULT false,

    label           TEXT,                   -- libellé libre ("Mon compte MTN principal")
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_bank_accounts_user_id  ON partner_bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_bank_accounts_service  ON partner_bank_accounts(service_type, service_id);

-- Un seul compte par défaut par partenaire/service
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_bank_accounts_default
    ON partner_bank_accounts(user_id, service_type, service_id)
    WHERE is_default = true;

-- ============================================================================
-- 2. TABLE disbursement_requests
--    Suivi complet des demandes de retrait (créé ici pour la première fois en migration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS disbursement_requests (
    id                  SERIAL PRIMARY KEY,
    recipient_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_account_id     INTEGER REFERENCES partner_bank_accounts(id) ON DELETE SET NULL,

    amount_cents        BIGINT NOT NULL,
    currency            VARCHAR(5) NOT NULL DEFAULT 'XAF',

    -- Coordonnées de paiement (snapshot au moment de la demande)
    recipient_phone     VARCHAR(20),
    recipient_method    VARCHAR(30) NOT NULL DEFAULT 'mobile_money',

    -- Statut du traitement
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

    reason              TEXT,               -- motif (ex: 'pharmacy_withdrawal')
    metadata            JSONB DEFAULT '{}',

    -- Traitement
    processed_at        TIMESTAMPTZ,
    processor_ref       TEXT,               -- référence opérateur (CinetPay txn_id, NotchPay ref, etc.)
    failure_reason      TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disbursement_requests_user_id ON disbursement_requests(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_disbursement_requests_status  ON disbursement_requests(status);
CREATE INDEX IF NOT EXISTS idx_disbursement_requests_created ON disbursement_requests(created_at DESC);

-- ============================================================================
-- 3. Étendre user_wallets si la table existe déjà sans currency
-- ============================================================================
ALTER TABLE user_wallets
    ADD COLUMN IF NOT EXISTS currency VARCHAR(5) NOT NULL DEFAULT 'XAF';

-- Index pour wallets multi-devises
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_user_currency
    ON user_wallets(user_id, currency);
