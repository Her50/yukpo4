-- Migration: Création des tables de support (trafic, terrain)
-- Date: 2025-11-10
\c yukpo_db;

CREATE TABLE IF NOT EXISTS traffic_snapshots (
    id BIGSERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL,
    source TEXT,
    bounding_box GEOGRAPHY(Polygon, 4326),
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_captured_at ON traffic_snapshots (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_source ON traffic_snapshots (source);

CREATE TABLE IF NOT EXISTS terrain_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment GEOGRAPHY(LineString, 4326) NOT NULL,
    difficulty delivery_terrain_difficulty NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terrain_segments_difficulty ON terrain_segments (difficulty);
CREATE INDEX IF NOT EXISTS idx_terrain_segments_segment ON terrain_segments USING GIST (segment);

