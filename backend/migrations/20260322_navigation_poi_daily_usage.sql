-- Quota journalier par utilisateur pour les recherches POI (coût API Google)
-- Répliqué dans backend/src/migrations/auto_migrate.rs::ensure_navigation_poi_daily_usage_table
CREATE TABLE IF NOT EXISTS navigation_poi_daily_usage (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_navigation_poi_daily_usage_date
    ON navigation_poi_daily_usage(usage_date);

COMMENT ON TABLE navigation_poi_daily_usage IS 'Compteur par jour (UTC) des appels /api/navigation/points-of-interest par utilisateur';
