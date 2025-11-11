-- Ajout des informations de destinataire pour les livraisons

ALTER TABLE deliveries
    ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recipient_contact_name TEXT,
    ADD COLUMN IF NOT EXISTS recipient_contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS recipient_notes TEXT,
    ADD COLUMN IF NOT EXISTS recipient_tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS recipient_dropoff_override GEOGRAPHY(Point, 4326),
    ADD COLUMN IF NOT EXISTS recipient_dropoff_address TEXT,
    ADD COLUMN IF NOT EXISTS recipient_dropoff_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS recipient_chat_thread_id UUID;

CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_user ON deliveries(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_tracking_token ON deliveries(recipient_tracking_token);

CREATE TABLE IF NOT EXISTS delivery_recipient_updates (
    id BIGSERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    submitted_by INTEGER REFERENCES users(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_recipient_updates_delivery ON delivery_recipient_updates(delivery_id, created_at DESC);

