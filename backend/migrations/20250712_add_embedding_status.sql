-- Migration pour ajouter les colonnes d'embedding status
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS embedding_error TEXT;

-- Index pour optimiser les requêtes sur embedding_status
CREATE INDEX IF NOT EXISTS idx_services_embedding_status ON services(embedding_status); 