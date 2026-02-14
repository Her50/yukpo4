-- Tables pour les flash sales en direct

CREATE TABLE IF NOT EXISTS live_flash_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    promo_price_cfa NUMERIC(14,2) NOT NULL CHECK (promo_price_cfa >= 0),
    stock_target INTEGER NOT NULL CHECK (stock_target > 0),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'live', 'ended', 'cancelled')
    ),
    commentary_mode VARCHAR(20) NOT NULL DEFAULT 'host' CHECK (
        commentary_mode IN ('host', 'ai_voice')
    ),
    commentary_interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (commentary_interval_seconds >= 15),
    ai_voice_profile TEXT,
    scheduled_notification_sent_at TIMESTAMPTZ,
    live_notification_sent_at TIMESTAMPTZ,
    ending_notification_sent_at TIMESTAMPTZ,
    last_commentary_sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session ON live_flash_sales(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status ON live_flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_timing ON live_flash_sales(start_at, end_at);

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





