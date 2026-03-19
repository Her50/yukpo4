-- Migration pour créer la table des modalités personnalisées
-- Permet aux utilisateurs d'ajouter de nouvelles modalités partagées

-- Créer la table des modalités personnalisées
CREATE TABLE IF NOT EXISTS custom_modalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    modality VARCHAR(255) NOT NULL,
    added_by VARCHAR(100),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT chk_modality_not_empty CHECK (LENGTH(TRIM(modality)) > 0),
    CONSTRAINT chk_usage_count_positive CHECK (usage_count >= 0),
    CONSTRAINT chk_product_type_not_empty CHECK (LENGTH(TRIM(product_type)) > 0),
    CONSTRAINT chk_field_name_not_empty CHECK (LENGTH(TRIM(field_name)) > 0)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_custom_modalities_product_field 
ON custom_modalities(product_type, field_name);

CREATE INDEX IF NOT EXISTS idx_custom_modalities_usage 
ON custom_modalities(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_custom_modalities_added_at 
ON custom_modalities(added_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_modalities_added_by 
ON custom_modalities(added_by);

-- Index unique pour éviter les doublons (même modalité pour même champ)
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_modalities_unique 
ON custom_modalities(product_type, field_name, LOWER(TRIM(modality)));

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_custom_modalities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_custom_modalities_updated_at
    BEFORE UPDATE ON custom_modalities
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_modalities_updated_at();

-- Commentaires sur la table et les colonnes
COMMENT ON TABLE custom_modalities IS 'Table des modalités personnalisées ajoutées par les utilisateurs';
COMMENT ON COLUMN custom_modalities.id IS 'Identifiant unique de la modalité';
COMMENT ON COLUMN custom_modalities.product_type IS 'Type de produit (automobile, vetement, etc.)';
COMMENT ON COLUMN custom_modalities.field_name IS 'Nom du champ (marques, couleurs, tailles, etc.)';
COMMENT ON COLUMN custom_modalities.modality IS 'Valeur de la modalité ajoutée par l''utilisateur';
COMMENT ON COLUMN custom_modalities.added_by IS 'Identifiant de l''utilisateur qui a ajouté la modalité';
COMMENT ON COLUMN custom_modalities.added_at IS 'Date d''ajout de la modalité';
COMMENT ON COLUMN custom_modalities.usage_count IS 'Nombre de fois que cette modalité a été utilisée';
COMMENT ON COLUMN custom_modalities.created_at IS 'Date de création de l''enregistrement';
COMMENT ON COLUMN custom_modalities.updated_at IS 'Date de dernière modification';

-- Insérer quelques modalités d'exemple pour les tests
INSERT INTO custom_modalities (product_type, field_name, modality, added_by, usage_count) VALUES
('automobile', 'marques', 'Tesla Model Y', 'user_example', 5),
('vetement', 'couleurs', 'Bordeaux', 'user_example', 3),
('chaussure', 'pointures', '47', 'user_example', 2),
('electromenager', 'couleurs', 'Inox brossé', 'user_example', 4)
ON CONFLICT (product_type, field_name, LOWER(TRIM(modality))) DO NOTHING;
















