-- Migration pour créer les tables manquantes
-- Table ia_feedback
CREATE TABLE IF NOT EXISTS ia_feedback (
    id SERIAL PRIMARY KEY,
    interaction_id VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour ia_feedback
CREATE INDEX IF NOT EXISTS idx_ia_feedback_user_id ON ia_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ia_feedback_interaction_id ON ia_feedback(interaction_id);
CREATE INDEX IF NOT EXISTS idx_ia_feedback_created_at ON ia_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_ia_feedback_model_used ON ia_feedback(model_used);
CREATE INDEX IF NOT EXISTS idx_ia_feedback_rating ON ia_feedback(rating);

-- Trigger pour ia_feedback
CREATE OR REPLACE FUNCTION update_ia_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ia_feedback_updated_at
    BEFORE UPDATE ON ia_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_ia_feedback_updated_at();

-- Table service_reviews
CREATE TABLE IF NOT EXISTS service_reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour service_reviews
CREATE INDEX IF NOT EXISTS idx_service_reviews_user_id ON service_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id ON service_reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_service_reviews_rating ON service_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_service_reviews_created_at ON service_reviews(created_at);

-- Trigger pour service_reviews
CREATE OR REPLACE FUNCTION update_service_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_service_reviews_updated_at
    BEFORE UPDATE ON service_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_service_reviews_updated_at();

-- Ajouter les colonnes manquantes à la table echanges si elles n'existent pas
DO $$ 
BEGIN
    -- Ajouter quantite_offerte si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'echanges' AND column_name = 'quantite_offerte') THEN
        ALTER TABLE echanges ADD COLUMN quantite_offerte DECIMAL(10,2);
    END IF;
    
    -- Ajouter quantite_requise si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'echanges' AND column_name = 'quantite_requise') THEN
        ALTER TABLE echanges ADD COLUMN quantite_requise DECIMAL(10,2);
    END IF;
END $$; 