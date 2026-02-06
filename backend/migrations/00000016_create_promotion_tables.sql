-- Tables pour les promotions globales

CREATE TABLE IF NOT EXISTS global_promo_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'black_friday', 'christmas', 'new_year', 'custom'
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    banner_image_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_promo_events_active ON global_promo_events(is_active);
CREATE INDEX IF NOT EXISTS idx_global_promo_events_dates ON global_promo_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_global_promo_events_type ON global_promo_events(event_type);

CREATE TABLE IF NOT EXISTS global_promo_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promo_event_id UUID NOT NULL REFERENCES global_promo_events(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed'
    discount_value NUMERIC(10,2) NOT NULL,
    original_price NUMERIC(12,2) NOT NULL,
    promo_price NUMERIC(12,2) NOT NULL,
    stock_limit INTEGER,
    stock_reserved INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(promo_event_id, service_id, product_index)
);

CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event ON global_promo_entries(promo_event_id);
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



