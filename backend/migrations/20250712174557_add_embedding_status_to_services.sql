-- Migration pour ajouter le statut d'embedding aux services
-- Date: 2025-07-12

-- Ajouter le champ embedding_status à la table services
ALTER TABLE services 
ADD COLUMN embedding_status VARCHAR(20) DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'success', 'failed', 'retry'));

-- Ajouter un index pour optimiser les requêtes par statut
CREATE INDEX idx_services_embedding_status ON services(embedding_status);

-- Ajouter un champ pour stocker les détails d'erreur d'embedding
ALTER TABLE services 
ADD COLUMN embedding_error TEXT;

-- Ajouter un champ pour le timestamp de la dernière tentative d'embedding
ALTER TABLE services 
ADD COLUMN embedding_last_attempt TIMESTAMP WITH TIME ZONE;

-- Ajouter un champ pour le nombre de tentatives d'embedding
ALTER TABLE services 
ADD COLUMN embedding_attempts INTEGER DEFAULT 0;

-- Mettre à jour les services existants avec le statut 'success' (supposant qu'ils ont déjà des embeddings)
UPDATE services 
SET embedding_status = 'success', 
    embedding_last_attempt = NOW(),
    embedding_attempts = 1
WHERE id IN (SELECT DISTINCT service_id FROM embeddings WHERE service_id IS NOT NULL);

-- Commentaire sur la table
COMMENT ON COLUMN services.embedding_status IS 'Statut du processus d''embedding: pending, processing, success, failed, retry';
COMMENT ON COLUMN services.embedding_error IS 'Message d''erreur détaillé en cas d''échec d''embedding';
COMMENT ON COLUMN services.embedding_last_attempt IS 'Timestamp de la dernière tentative d''embedding';
COMMENT ON COLUMN services.embedding_attempts IS 'Nombre de tentatives d''embedding effectuées';
