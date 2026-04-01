-- Module restaurant (gestion salle, plan, codes partenaires)
-- Ne pas confondre avec le menu hebdomadaire familial (/api/menus/*).

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    zone TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_restaurant_tables_service_label UNIQUE (service_id, label)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_service_id ON restaurant_tables(service_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_active ON restaurant_tables(service_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS restaurant_floor_layouts (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'default',
    layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_restaurant_floor_layouts UNIQUE (service_id, name)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_floor_layouts_service ON restaurant_floor_layouts(service_id);

CREATE TABLE IF NOT EXISTS restaurant_settings (
    service_id INTEGER PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
    accepts_delivery BOOLEAN NOT NULL DEFAULT TRUE,
    accepts_dine_in BOOLEAN NOT NULL DEFAULT TRUE,
    default_prep_minutes INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_partner_codes (
    code VARCHAR(32) PRIMARY KEY,
    issuer_service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    label TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_partner_codes_issuer ON restaurant_partner_codes(issuer_service_id);
