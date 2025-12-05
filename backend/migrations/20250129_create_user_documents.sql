-- ✅ Migration: Table user_documents pour KYC (vérification identité conducteur)
-- Date: 2025-01-29
-- Description: Stockage des documents d'identité pour vérification KYC

CREATE TABLE IF NOT EXISTS user_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('permis', 'cni', 'assurance', 'passeport', 'carte_grise')),
    document_url TEXT NOT NULL,
    document_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    verified_at TIMESTAMPTZ,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    expiry_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Un seul document de chaque type par utilisateur
    UNIQUE(user_id, document_type)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_status ON user_documents(status);
CREATE INDEX IF NOT EXISTS idx_user_documents_type ON user_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_status ON user_documents(user_id, status);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_user_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_documents_updated_at
    BEFORE UPDATE ON user_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_user_documents_updated_at();

-- Commentaires
COMMENT ON TABLE user_documents IS 'Documents d''identité utilisateur pour vérification KYC';
COMMENT ON COLUMN user_documents.document_type IS 'Type de document: permis, cni, assurance, passeport, carte_grise';
COMMENT ON COLUMN user_documents.status IS 'Statut: pending (en attente), approved (approuvé), rejected (rejeté), expired (expiré)';
COMMENT ON COLUMN user_documents.verified_by IS 'ID de l''admin qui a vérifié le document (NULL si vérification automatique)';
COMMENT ON COLUMN user_documents.metadata IS 'Métadonnées additionnelles (ex: données extraites par OCR, scores de confiance KYC)';


