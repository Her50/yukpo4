-- Tables pour la génération vidéo et audio

CREATE TABLE IF NOT EXISTS video_generation_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    product_index INTEGER,
    status TEXT NOT NULL DEFAULT 'queued',
    progress_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    result_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    result_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_user ON video_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_service ON video_generation_jobs(service_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status ON video_generation_jobs(status);
-- ✅ 2025-12-22: Index optimisés pour GROUP BY status et requêtes avec updated_at
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated_at 
ON video_generation_jobs(status, updated_at)
WHERE status IS NOT NULL;

CREATE TABLE IF NOT EXISTS premium_audio_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_video_job ON premium_audio_jobs(video_job_id);
CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_provider ON premium_audio_jobs(provider);

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

CREATE TABLE IF NOT EXISTS voice_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_name VARCHAR(255) NOT NULL,
    voice_id VARCHAR(255),
    provider VARCHAR(50) NOT NULL, -- 'elevenlabs', 'openai', 'google', etc.
    voice_settings JSONB DEFAULT '{}'::jsonb,
    sample_audio_url TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, profile_name)
);

CREATE INDEX IF NOT EXISTS idx_voice_profiles_user ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_provider ON voice_profiles(provider);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_default ON voice_profiles(is_default) WHERE is_default = TRUE;

CREATE OR REPLACE FUNCTION set_voice_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_voice_profiles_updated_at ON voice_profiles;
CREATE TRIGGER trg_voice_profiles_updated_at
    BEFORE UPDATE ON voice_profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_voice_profiles_updated_at();



