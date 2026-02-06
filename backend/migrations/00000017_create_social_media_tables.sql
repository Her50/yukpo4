-- Tables pour l'intégration social media

CREATE TABLE IF NOT EXISTS social_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'facebook', 'instagram', 'twitter', 'tiktok', 'youtube'
    account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS social_publications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    platform_post_id VARCHAR(255),
    publication_type VARCHAR(50) NOT NULL, -- 'post', 'story', 'reel', 'video'
    content TEXT,
    media_urls TEXT[],
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    engagement_stats JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_publications_user ON social_publications(user_id);
CREATE INDEX IF NOT EXISTS idx_social_publications_service ON social_publications(service_id);
CREATE INDEX IF NOT EXISTS idx_social_publications_platform ON social_publications(platform);
CREATE INDEX IF NOT EXISTS idx_social_publications_status ON social_publications(status);
CREATE INDEX IF NOT EXISTS idx_social_publications_scheduled ON social_publications(scheduled_for) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS social_publication_jobs (
    id SERIAL PRIMARY KEY,
    publication_id INTEGER NOT NULL REFERENCES social_publications(id) ON DELETE CASCADE,
    job_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_for TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_publication ON social_publication_jobs(publication_id);
CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_status ON social_publication_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_scheduled ON social_publication_jobs(scheduled_for) WHERE job_status IN ('pending', 'processing');



