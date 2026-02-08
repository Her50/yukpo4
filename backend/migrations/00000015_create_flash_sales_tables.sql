-- Tables pour les flash sales en direct

CREATE TABLE IF NOT EXISTS live_flash_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    original_price NUMERIC(12,2) NOT NULL,
    flash_price NUMERIC(12,2) NOT NULL,
    discount_percentage INTEGER NOT NULL,
    stock_available INTEGER NOT NULL,
    stock_reserved INTEGER DEFAULT 0,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_flash_price_lower CHECK (flash_price < original_price),
    CONSTRAINT check_stock_positive CHECK (stock_available >= 0),
    CONSTRAINT check_discount_valid CHECK (discount_percentage > 0 AND discount_percentage <= 100)
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session ON live_flash_sales(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_service ON live_flash_sales(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status ON live_flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_time ON live_flash_sales(start_at, end_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS live_flash_sale_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    reservation_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(flash_sale_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_sale ON live_flash_sale_reservations(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_user ON live_flash_sale_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_status ON live_flash_sale_reservations(reservation_status);
CREATE INDEX IF NOT EXISTS idx_flash_sale_reservations_expires ON live_flash_sale_reservations(expires_at) WHERE reservation_status = 'pending';

CREATE TABLE IF NOT EXISTS live_flash_sale_commentaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_commentaries_sale ON live_flash_sale_commentaries(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_commentaries_user ON live_flash_sale_commentaries(user_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_commentaries_created_at ON live_flash_sale_commentaries(created_at DESC);





