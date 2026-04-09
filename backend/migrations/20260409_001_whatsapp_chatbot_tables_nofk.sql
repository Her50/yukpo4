-- ✅ Migration 2026-04-09: Tables pour chatbot WhatsApp Yukpo
-- Version sans FK vers users (Cloud SQL import restriction)

-- ── Table sessions WhatsApp ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    phone_number    TEXT PRIMARY KEY,
    user_id         INTEGER,
    user_name       TEXT,
    city            TEXT,
    token_balance   INTEGER NOT NULL DEFAULT 0,
    state_json      TEXT NOT NULL DEFAULT '"New"',
    context_json    TEXT NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON whatsapp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_updated ON whatsapp_sessions(updated_at DESC);

-- ── Table abonnements alertes WhatsApp ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_alert_subscriptions (
    id              SERIAL PRIMARY KEY,
    phone_number    TEXT NOT NULL,
    city            TEXT NOT NULL,
    user_id         INTEGER,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(phone_number, city)
);

CREATE INDEX IF NOT EXISTS idx_wa_alert_subs_city ON whatsapp_alert_subscriptions(city) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_wa_alert_subs_phone ON whatsapp_alert_subscriptions(phone_number);

-- ── Table alertes communautaires ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_alerts (
    id              SERIAL PRIMARY KEY,
    alert_type      TEXT NOT NULL,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    address         TEXT,
    city            TEXT NOT NULL DEFAULT 'Cameroun',
    reported_by     TEXT NOT NULL,
    maps_url        TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    confirmations   INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours'
);

CREATE INDEX IF NOT EXISTS idx_community_alerts_city ON community_alerts(city, status);
CREATE INDEX IF NOT EXISTS idx_community_alerts_expires ON community_alerts(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_community_alerts_type ON community_alerts(alert_type, created_at DESC);
