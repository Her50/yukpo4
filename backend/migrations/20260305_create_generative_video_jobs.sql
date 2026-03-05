-- ✅ 2026-03-05: Table pour les jobs de génération vidéo IA (Runway/Sora/Pika)
-- Utilisée par generative_video_service.rs pour tracker le pipeline de génération

CREATE TABLE IF NOT EXISTS generative_video_jobs (
    job_id TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    error_message TEXT,
    result_payload JSONB,
    request_payload JSONB,
    provider TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generative_video_jobs_user_id 
    ON generative_video_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_generative_video_jobs_status 
    ON generative_video_jobs(status, created_at DESC);

-- Trigger pour auto-update updated_at
CREATE OR REPLACE FUNCTION set_generative_video_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generative_video_jobs_updated_at ON generative_video_jobs;
CREATE TRIGGER trigger_generative_video_jobs_updated_at
    BEFORE UPDATE ON generative_video_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_generative_video_jobs_updated_at();
