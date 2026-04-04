-- Migration: fonctionnalités de croissance — email clients, broadcast WA, abandoned cart
-- Date: 2026-04-04

-- ─── 1. Ajouter email + consentement sur customer_memory ─────────────────────
ALTER TABLE customer_memory
    ADD COLUMN IF NOT EXISTS customer_email       TEXT,
    ADD COLUMN IF NOT EXISTS email_consent        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS unsubscribed_email   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS unsubscribed_wa      BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_customer_memory_email
    ON customer_memory(user_id, service_id)
    WHERE customer_email IS NOT NULL AND email_consent = TRUE AND unsubscribed_email = FALSE;

-- ─── 2. WhatsApp broadcasts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
    id              SERIAL PRIMARY KEY,
    service_id      INTEGER NOT NULL,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    message_text    TEXT NOT NULL,
    target_segment  TEXT NOT NULL DEFAULT 'all',
    status          TEXT NOT NULL DEFAULT 'draft',
      -- draft | sending | sent | failed
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count      INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    failed_count    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_broadcasts_service
    ON whatsapp_broadcasts(service_id, created_at DESC);

-- ─── 3. Abandoned cart jobs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS abandoned_cart_jobs (
    id              SERIAL PRIMARY KEY,
    service_id      INTEGER NOT NULL,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_external_id TEXT NOT NULL,
    platform        TEXT NOT NULL DEFAULT 'whatsapp',
    product_hint    TEXT,          -- dernier produit mentionné
    status          TEXT NOT NULL DEFAULT 'pending',
      -- pending | sent | converted | expired
    recovery_message TEXT,
    scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_pending
    ON abandoned_cart_jobs(service_id, scheduled_at)
    WHERE status = 'pending';

-- ─── 4. Export jobs (tracking exports générés) ───────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_exports (
    id              SERIAL PRIMARY KEY,
    service_id      INTEGER NOT NULL,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    export_type     TEXT NOT NULL DEFAULT 'full',
      -- full | posts | customers | campaigns
    format          TEXT NOT NULL DEFAULT 'csv',
    row_count       INTEGER NOT NULL DEFAULT 0,
    download_token  TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);
