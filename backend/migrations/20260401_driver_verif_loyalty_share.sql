-- ============================================================
-- Migration: Vérification conducteur (KYC) + Fidélité + Partage trajet
-- Date: 2026-04-01 — Idempotentes (IF NOT EXISTS)
-- ============================================================

-- ── 1. Vérification conducteur (KYC) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_verifications (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type        TEXT NOT NULL CHECK (service_type IN ('taxi', 'covoiturage')),
    cni_front_url       TEXT,
    cni_back_url        TEXT,
    selfie_url          TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
    rejection_reason    TEXT,
    reviewed_by         INTEGER REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, service_type)
);

CREATE INDEX IF NOT EXISTS idx_driver_verif_status
    ON driver_verifications (status, service_type);

-- ── 2. Programme fidélité ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_points (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points          INTEGER NOT NULL,
    action          TEXT NOT NULL,   -- 'trip_completed','rating_given','referral','redemption'
    reference_id    INTEGER,         -- reservation_id ou autre
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user
    ON loyalty_points (user_id, created_at DESC);

-- Vue solde points par utilisateur
CREATE OR REPLACE VIEW loyalty_balances AS
SELECT user_id, SUM(points) AS balance
FROM loyalty_points
GROUP BY user_id;

-- Catalogue récompenses
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT,
    points_cost     INTEGER NOT NULL CHECK (points_cost > 0),
    reward_type     TEXT NOT NULL CHECK (reward_type IN ('discount_pct', 'free_trip', 'free_insurance')),
    reward_value    DECIMAL(10,2) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Récompenses par défaut
INSERT INTO loyalty_rewards (title, description, points_cost, reward_type, reward_value)
VALUES
    ('Réduction 10%',     '10% sur votre prochain trajet',          100, 'discount_pct',   10),
    ('Réduction 20%',     '20% sur votre prochain trajet',          200, 'discount_pct',   20),
    ('Trajet offert',     'Un trajet gratuit jusqu''à 5 000 XAF',   500, 'free_trip',     5000),
    ('Assurance offerte', 'Assurance de base offerte',              300, 'free_insurance',  500)
ON CONFLICT DO NOTHING;

-- Historique des rachats de récompenses
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id       INTEGER NOT NULL REFERENCES loyalty_rewards(id),
    points_spent    INTEGER NOT NULL,
    coupon_code     TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
    used_at         TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Partage de trajet en temps réel ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_shares (
    id              BIGSERIAL PRIMARY KEY,
    token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    reservation_id  INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_shares_token ON trip_shares (token);
CREATE INDEX IF NOT EXISTS idx_trip_shares_reservation ON trip_shares (reservation_id);
