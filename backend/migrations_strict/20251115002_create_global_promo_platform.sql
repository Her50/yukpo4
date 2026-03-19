-- Plateforme centralisée pour les campagnes Black Friday et promos globales
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS global_promo_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,
    theme TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    recurrence_rule TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'scheduled', 'live', 'archived')
    ),
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_global_promo_events_status
    ON global_promo_events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_global_promo_events_theme
    ON global_promo_events(theme);

CREATE TABLE IF NOT EXISTS global_promo_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES global_promo_events(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL,
    submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    discount_percentage NUMERIC(5,2) CHECK (
        discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)
    ),
    promo_price_cfa NUMERIC(14,2) CHECK (promo_price_cfa IS NULL OR promo_price_cfa >= 0),
    stock_cap INTEGER CHECK (stock_cap IS NULL OR stock_cap > 0),
    availability VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (
        availability IN ('online', 'live', 'both')
    ),
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'ended')
    ),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_status
    ON global_promo_entries(event_id, status);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_service
    ON global_promo_entries(service_id);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_live_session
    ON global_promo_entries(live_session_id);

-- ✅ CORRIGÉ 2026-02-15: Vérifier si la table existe avec un schéma différent
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'global_promo_products') THEN
        CREATE TABLE global_promo_products (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            promo_entry_id UUID NOT NULL UNIQUE REFERENCES global_promo_entries(id) ON DELETE CASCADE,
            snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
            availability VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (
                availability IN ('online', 'live', 'both')
            ),
            priority_score INTEGER NOT NULL DEFAULT 0,
            highlighted BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    ELSE
        -- La table existe, ajouter les colonnes manquantes
        ALTER TABLE global_promo_products ADD COLUMN IF NOT EXISTS highlighted BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE global_promo_products ADD COLUMN IF NOT EXISTS priority_score INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_global_promo_products_priority
    ON global_promo_products(highlighted DESC, priority_score DESC);

ALTER TABLE live_flash_sales
    ADD COLUMN IF NOT EXISTS global_promo_entry_id UUID REFERENCES global_promo_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_global_promo
    ON live_flash_sales(global_promo_entry_id);

