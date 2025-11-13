-- Premium audio mastering jobs (Dolby.io / AudioShake)

CREATE TABLE IF NOT EXISTS premium_audio_jobs (
    job_id UUID PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_job_id TEXT,
    source_path TEXT NOT NULL,
    output_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    video_job_id UUID REFERENCES video_generation_jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_status ON premium_audio_jobs(status);
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_updated_at ON premium_audio_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_provider ON premium_audio_jobs(provider);
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_provider_job
    ON premium_audio_jobs(provider, provider_job_id);

CREATE OR REPLACE FUNCTION set_premium_audio_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_premium_audio_jobs_updated_at ON premium_audio_jobs;
CREATE TRIGGER trg_premium_audio_jobs_updated_at
    BEFORE UPDATE ON premium_audio_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_premium_audio_jobs_updated_at();

ALTER TABLE video_generation_jobs
    ADD COLUMN IF NOT EXISTS audio_job_id UUID,
    ADD COLUMN IF NOT EXISTS audio_status TEXT NOT NULL DEFAULT 'not_requested',
    ADD COLUMN IF NOT EXISTS audio_metadata JSONB;

ALTER TABLE video_generation_jobs
    ADD CONSTRAINT fk_video_generation_jobs_audio_job
    FOREIGN KEY (audio_job_id) REFERENCES premium_audio_jobs(job_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_audio_status
    ON video_generation_jobs(audio_status);

