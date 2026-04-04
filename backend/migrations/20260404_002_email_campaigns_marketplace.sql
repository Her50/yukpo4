-- Migration: campagnes email + marketplace cross-partenaires
-- Date: 2026-04-04

-- ─── 1. Campagnes email marketing ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaigns (
    id              SERIAL PRIMARY KEY,
    service_id      INTEGER NOT NULL,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    subject         TEXT NOT NULL,
    content_text    TEXT NOT NULL,
    content_html    TEXT,
    status          TEXT NOT NULL DEFAULT 'draft',
      -- draft | scheduled | sending | sent | failed
    target_segment  TEXT NOT NULL DEFAULT 'all',
      -- all | active_7d | active_30d | high_value | vip
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count      INTEGER NOT NULL DEFAULT 0,
    open_count      INTEGER NOT NULL DEFAULT 0,
    click_count     INTEGER NOT NULL DEFAULT 0,
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_service
    ON email_campaigns(service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status
    ON email_campaigns(status)
    WHERE status IN ('draft', 'scheduled', 'sending');

-- ─── 2. Marketplace cross-partenaires ─────────────────────────────────────────
-- Table pour que les partenaires exposent leurs produits à la marketplace inter-boutiques
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id              SERIAL PRIMARY KEY,
    service_id      INTEGER NOT NULL,
    product_id      INTEGER,          -- référence service_products si existant
    title           TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(12,0) NOT NULL,
    sale_price      NUMERIC(12,0),
    category        TEXT,
    image_url       TEXT,
    stock           INTEGER DEFAULT 0,
    region          TEXT NOT NULL DEFAULT 'CM',   -- CM, SN, CI, NG, ALL
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    views           INTEGER NOT NULL DEFAULT 0,
    orders          INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_region_cat
    ON marketplace_listings(region, category, is_active, orders DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_service
    ON marketplace_listings(service_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_fts
    ON marketplace_listings
    USING gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ─── 3. Colonnes d'enrichissement IA sur service_products ────────────────────
ALTER TABLE service_products
    ADD COLUMN IF NOT EXISTS ai_description   TEXT,
    ADD COLUMN IF NOT EXISTS ai_tags          TEXT[],
    ADD COLUMN IF NOT EXISTS ai_enriched_at   TIMESTAMPTZ;

-- ─── 4. Index whatsapp_payment_links (liens de paiement générés par chatbot) ──
CREATE TABLE IF NOT EXISTS whatsapp_payment_links (
    id              SERIAL PRIMARY KEY,
    service_id      INTEGER NOT NULL,
    thread_id       INTEGER REFERENCES social_chatbot_threads(id) ON DELETE SET NULL,
    customer_phone  TEXT NOT NULL,
    amount_fcfa     BIGINT NOT NULL,
    description     TEXT,
    token           TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
      -- pending | paid | expired | cancelled
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wp_payment_links_service
    ON whatsapp_payment_links(service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wp_payment_links_token
    ON whatsapp_payment_links(token);
