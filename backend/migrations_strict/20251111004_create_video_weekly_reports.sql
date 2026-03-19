-- Migration: Créer la table video_weekly_reports
-- Date: 2025-11-11

CREATE TABLE IF NOT EXISTS video_weekly_reports (
    id SERIAL PRIMARY KEY,
    week_start TIMESTAMPTZ NOT NULL,
    week_end TIMESTAMPTZ NOT NULL,
    total_videos BIGINT NOT NULL,
    total_views BIGINT NOT NULL,
    average_quality DOUBLE PRECISION NOT NULL,
    top_services JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_weekly_reports_week ON video_weekly_reports(week_start, week_end);

