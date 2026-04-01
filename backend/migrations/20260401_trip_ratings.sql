-- ============================================================
-- Migration: Tables notation post-trajet + paiements Mobile Money
-- Date: 2026-04-01
-- Idempotentes (IF NOT EXISTS)
-- ============================================================

-- Notations post-trajet (taxi & covoiturage)
CREATE TABLE IF NOT EXISTS trip_ratings (
    id                  BIGSERIAL PRIMARY KEY,
    reservation_id      INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
    rater_user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rated_user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating              DECIMAL(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment             TEXT,
    service_type        TEXT NOT NULL CHECK (service_type IN ('taxi', 'covoiturage')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reservation_id, rater_user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_ratings_rated_user
    ON trip_ratings (rated_user_id, service_type);

CREATE INDEX IF NOT EXISTS idx_trip_ratings_reservation
    ON trip_ratings (reservation_id);

-- Paiements Mobile Money (MTN / Orange Cameroun)
CREATE TABLE IF NOT EXISTS mobile_money_payments (
    id                  BIGSERIAL PRIMARY KEY,
    reservation_id      INTEGER REFERENCES specialized_reservations(id) ON DELETE SET NULL,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount              DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency            TEXT NOT NULL DEFAULT 'XAF',
    phone_number        TEXT NOT NULL,
    provider            TEXT NOT NULL CHECK (provider IN ('mtn', 'orange')),
    transaction_ref     TEXT UNIQUE,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    initiated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_mm_payments_reservation
    ON mobile_money_payments (reservation_id);

CREATE INDEX IF NOT EXISTS idx_mm_payments_user_status
    ON mobile_money_payments (user_id, status);
