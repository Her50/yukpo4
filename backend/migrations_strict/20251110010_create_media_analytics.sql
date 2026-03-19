-- Migration: Créer les tables media_engagement et media_distribution
-- Date: 2025-11-10

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'media_engagement'
    ) THEN
        CREATE TABLE media_engagement (
            id SERIAL PRIMARY KEY,
            media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            channel TEXT,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            session_id TEXT,
            metadata JSONB,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_media_engagement_media ON media_engagement(media_id);
        CREATE INDEX idx_media_engagement_event ON media_engagement(event_type);
        CREATE INDEX idx_media_engagement_service ON media_engagement(service_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'media_distribution'
    ) THEN
        CREATE TABLE media_distribution (
            id SERIAL PRIMARY KEY,
            media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            target TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'scheduled',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB
        );

        CREATE INDEX idx_media_distribution_media ON media_distribution(media_id);
        CREATE INDEX idx_media_distribution_target ON media_distribution(target);
    END IF;
END $$;



