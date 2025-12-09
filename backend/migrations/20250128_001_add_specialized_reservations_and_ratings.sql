-- ✅ NOUVEAU: Migration pour réservations et avis services spécialisés

-- Table des réservations
CREATE TABLE IF NOT EXISTS specialized_reservations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    service_type VARCHAR(50) NOT NULL, -- "pharmacie", "hopital", "laboratoire", "covoiturage", "taxi", "agence_voyage"
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    reservation_type VARCHAR(50) NOT NULL, -- "rdv", "place", "course", "ticket"
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- "pending", "confirmed", "completed", "cancelled"
    
    requested_date TIMESTAMP WITH TIME ZONE,
    confirmed_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    details JSONB NOT NULL DEFAULT '{}',
    
    -- Paiement
    amount NUMERIC(10, 2),
    currency VARCHAR(10),
    payment_status VARCHAR(20), -- "pending", "paid", "refunded"
    payment_method VARCHAR(50), -- "mobile_money", "card", "cash"
    
    notes TEXT,
    prestataire_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_id ON specialized_reservations(service_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_user_id ON specialized_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_prestataire_id ON specialized_reservations(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_status ON specialized_reservations(status);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_type ON specialized_reservations(service_type);

-- Table des avis et ratings
CREATE TABLE IF NOT EXISTS specialized_ratings (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Ratings détaillés (optionnels)
    quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
    punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
    price_rating INTEGER CHECK (price_rating >= 1 AND price_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    
    reservation_id INTEGER REFERENCES specialized_reservations(id) ON DELETE SET NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false, -- Client a utilisé le service
    helpful_count INTEGER NOT NULL DEFAULT 0, -- Nombre de "utile"
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Un utilisateur ne peut laisser qu'un seul avis par service
    UNIQUE(service_id, user_id)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_service_id ON specialized_ratings(service_id);
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_user_id ON specialized_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_prestataire_id ON specialized_ratings(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_rating ON specialized_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_specialized_ratings_helpful_count ON specialized_ratings(helpful_count DESC);

-- Table pour votes "utile" sur les avis
CREATE TABLE IF NOT EXISTS rating_helpful_votes (
    id SERIAL PRIMARY KEY,
    rating_id INTEGER NOT NULL REFERENCES specialized_ratings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Un utilisateur ne peut voter qu'une fois par avis
    UNIQUE(rating_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rating_helpful_votes_rating_id ON rating_helpful_votes(rating_id);
CREATE INDEX IF NOT EXISTS idx_rating_helpful_votes_user_id ON rating_helpful_votes(user_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_specialized_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_specialized_reservations_updated_at
    BEFORE UPDATE ON specialized_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_reservations_updated_at();

CREATE OR REPLACE FUNCTION update_specialized_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_specialized_ratings_updated_at
    BEFORE UPDATE ON specialized_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_ratings_updated_at();

