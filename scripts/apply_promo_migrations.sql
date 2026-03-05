-- Migration: Flash Sales, Live, Global Promo system fixes
-- Date: 2026-03-05

-- 1. Ensure live_flash_sales table exists
CREATE TABLE IF NOT EXISTS live_flash_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    service_id INTEGER NOT NULL,
    promo_price_cfa BIGINT NOT NULL,
    stock_target INTEGER NOT NULL DEFAULT 10,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ensure live_flash_sale_reservations table exists
CREATE TABLE IF NOT EXISTS live_flash_sale_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ensure live_flash_sale_commentaries table exists
CREATE TABLE IF NOT EXISTS live_flash_sale_commentaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
    created_by VARCHAR(20) NOT NULL CHECK (created_by IN ('host', 'ai_voice')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session ON live_flash_sales(session_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status ON live_flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_flash ON live_flash_sale_reservations(flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_user ON live_flash_sale_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_live_flash_sale_commentaries_flash ON live_flash_sale_commentaries(flash_sale_id);

-- 5. SEC-3: Add reservation_status column for re-reservation support
ALTER TABLE live_flash_sale_reservations ADD COLUMN IF NOT EXISTS reservation_status VARCHAR(20) NOT NULL DEFAULT 'confirmed';
ALTER TABLE live_flash_sale_reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 6. SEC-3: Drop old strict UNIQUE constraint, replace with partial unique index
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'live_flash_sale_reservations_flash_sale_id_user_id_key'
    ) THEN
        ALTER TABLE live_flash_sale_reservations
        DROP CONSTRAINT live_flash_sale_reservations_flash_sale_id_user_id_key;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flash_reservations_active_unique 
ON live_flash_sale_reservations(flash_sale_id, user_id) 
WHERE reservation_status != 'cancelled';

-- 7. Ensure missing columns on live_flash_sales
ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS product_indexes JSONB DEFAULT '[]'::JSONB;
ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'fixed';
ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS discount_value NUMERIC;

-- Done
SELECT 'Promo migrations applied successfully' AS result;
