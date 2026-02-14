-- Tables pour les promotions globales

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

CREATE INDEX IF NOT EXISTS idx_global_promo_events_status ON global_promo_events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_global_promo_events_theme ON global_promo_events(theme);

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

CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_status ON global_promo_entries(event_id, status);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_service ON global_promo_entries(service_id);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_live_session ON global_promo_entries(live_session_id);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_service ON global_promo_entries(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_featured ON global_promo_entries(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_global_promo_entries_priority ON global_promo_entries(priority DESC);

CREATE TABLE IF NOT EXISTS global_promo_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promo_entry_id UUID NOT NULL REFERENCES global_promo_entries(id) ON DELETE CASCADE,
    product_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_promo_products_entry ON global_promo_products(promo_entry_id);
CREATE INDEX IF NOT EXISTS idx_global_promo_products_data_gin ON global_promo_products USING GIN(product_data);





