-- ✅ NOUVEAU Phase 5: Table pour suivi des jobs de génération de visites virtuelles immersives
-- Migration pour créer la table virtual_tour_generation_jobs

CREATE TABLE IF NOT EXISTS virtual_tour_generation_jobs (
    id SERIAL PRIMARY KEY,
    job_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Paramètres de génération
    style VARCHAR(50) DEFAULT 'professional', -- "professional", "immersive", "quick"
    duration_seconds INTEGER DEFAULT 60,
    
    -- Statut et progression
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- "pending", "processing", "completed", "failed"
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Résultat
    virtual_tour_id INTEGER REFERENCES property_virtual_tours(id) ON DELETE SET NULL,
    result_media_url TEXT,
    error_message TEXT,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_virtual_tour_jobs_job_id ON virtual_tour_generation_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_virtual_tour_jobs_property_id ON virtual_tour_generation_jobs(property_id);
CREATE INDEX IF NOT EXISTS idx_virtual_tour_jobs_user_id ON virtual_tour_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_tour_jobs_status ON virtual_tour_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_virtual_tour_jobs_created_at ON virtual_tour_generation_jobs(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_virtual_tour_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_virtual_tour_jobs_updated_at ON virtual_tour_generation_jobs;

CREATE TRIGGER trg_virtual_tour_jobs_updated_at
    BEFORE UPDATE ON virtual_tour_generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_virtual_tour_jobs_updated_at();

