-- Migration: Créer table autocomplete_characteristics pour historiser les caractéristiques autocomplete
-- Date: 2025-10-31
-- Description: Table pour historiser les caractéristiques autocomplete créées par l'IA ou les utilisateurs
--              Permet la réutilisation intelligente dans recherche et filtrage
-- Note: Compatible avec SQLx offline mode

-- Vérifier et créer la table autocomplete_characteristics
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'autocomplete_characteristics') THEN
        CREATE TABLE autocomplete_characteristics (
            id SERIAL PRIMARY KEY,
            identifiant_base VARCHAR(255) NOT NULL,
            -- Exemple: "caracteristiques_vehicule", "caracteristiques_chaussure"
            sous_caracteristique VARCHAR(255) NOT NULL,
            -- Exemple: "marque", "modele", "annee", "pointure", "couleur"
            valeur VARCHAR(500) NOT NULL,
            -- Exemple: "Toyota", "RAV4", "2018", "42", "Noir"
            origine_champs VARCHAR(50) NOT NULL DEFAULT 'ia',
            -- 'ia' pour généré par IA, 'utilisateur' pour créé manuellement
            user_id INTEGER,
            -- NULL si créé par IA, sinon ID de l'utilisateur qui l'a créé
            service_id INTEGER,
            -- ID du service où cette caractéristique a été utilisée (optionnel)
            usage_count INTEGER DEFAULT 1,
            -- Nombre de fois que cette valeur a été utilisée
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            -- Contrainte unique : même identifiant_base + sous_caracteristique + valeur = même entrée
            CONSTRAINT unique_autocomplete_characteristic 
                UNIQUE (identifiant_base, sous_caracteristique, valeur)
        );
        
        RAISE NOTICE 'Table autocomplete_characteristics créée avec succès';
    ELSE
        RAISE NOTICE 'Table autocomplete_characteristics existe déjà';
    END IF;
END $$;

-- Index pour recherche rapide par identifiant_base
CREATE INDEX IF NOT EXISTS idx_autocomplete_identifiant_base 
    ON autocomplete_characteristics(identifiant_base);

-- Index pour recherche par sous_caracteristique
CREATE INDEX IF NOT EXISTS idx_autocomplete_sous_caracteristique 
    ON autocomplete_characteristics(sous_caracteristique);

-- Index composite pour recherche combinée
CREATE INDEX IF NOT EXISTS idx_autocomplete_base_sous 
    ON autocomplete_characteristics(identifiant_base, sous_caracteristique);

-- Index pour recherche par valeur (insensible à la casse)
CREATE INDEX IF NOT EXISTS idx_autocomplete_valeur_lower 
    ON autocomplete_characteristics(LOWER(valeur));

-- Index pour recherche par origine_champs
CREATE INDEX IF NOT EXISTS idx_autocomplete_origine 
    ON autocomplete_characteristics(origine_champs);

-- Index pour recherche par user_id (si créé par utilisateur)
CREATE INDEX IF NOT EXISTS idx_autocomplete_user_id 
    ON autocomplete_characteristics(user_id) WHERE user_id IS NOT NULL;

-- Index pour recherche par service_id
CREATE INDEX IF NOT EXISTS idx_autocomplete_service_id 
    ON autocomplete_characteristics(service_id) WHERE service_id IS NOT NULL;

-- Index pour tri par usage_count (valeurs les plus utilisées en premier)
CREATE INDEX IF NOT EXISTS idx_autocomplete_usage_count 
    ON autocomplete_characteristics(identifiant_base, sous_caracteristique, usage_count DESC);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_autocomplete_characteristics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_autocomplete_characteristics_updated_at ON autocomplete_characteristics;
CREATE TRIGGER trigger_autocomplete_characteristics_updated_at
    BEFORE UPDATE ON autocomplete_characteristics
    FOR EACH ROW
    EXECUTE FUNCTION update_autocomplete_characteristics_updated_at();

-- Fonction pour incrémenter usage_count lors de l'insertion d'une valeur existante
CREATE OR REPLACE FUNCTION upsert_autocomplete_characteristic(
    p_identifiant_base VARCHAR(255),
    p_sous_caracteristique VARCHAR(255),
    p_valeur VARCHAR(500),
    p_origine_champs VARCHAR(50) DEFAULT 'ia',
    p_user_id INTEGER DEFAULT NULL,
    p_service_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    -- Essayer d'insérer
    INSERT INTO autocomplete_characteristics (
        identifiant_base,
        sous_caracteristique,
        valeur,
        origine_champs,
        user_id,
        service_id,
        usage_count
    )
    VALUES (
        p_identifiant_base,
        p_sous_caracteristique,
        p_valeur,
        p_origine_champs,
        p_user_id,
        p_service_id,
        1
    )
    ON CONFLICT (identifiant_base, sous_caracteristique, valeur)
    DO UPDATE SET
        usage_count = autocomplete_characteristics.usage_count + 1,
        updated_at = NOW();
    
    -- Récupérer l'ID
    SELECT id INTO v_id
    FROM autocomplete_characteristics
    WHERE identifiant_base = p_identifiant_base
    AND sous_caracteristique = p_sous_caracteristique
    AND valeur = p_valeur;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE autocomplete_characteristics IS 'Historique des caractéristiques autocomplete pour réutilisation intelligente';
COMMENT ON COLUMN autocomplete_characteristics.identifiant_base IS 'Identifiant du type de caractéristique (ex: caracteristiques_vehicule)';
COMMENT ON COLUMN autocomplete_characteristics.sous_caracteristique IS 'Nom de la dimension (ex: marque, modele, annee)';
COMMENT ON COLUMN autocomplete_characteristics.valeur IS 'Valeur de la caractéristique (ex: Toyota, RAV4, 2018)';
COMMENT ON COLUMN autocomplete_characteristics.origine_champs IS 'Origine: ia ou utilisateur';
COMMENT ON COLUMN autocomplete_characteristics.usage_count IS 'Nombre de fois que cette valeur a été utilisée';
COMMENT ON FUNCTION upsert_autocomplete_characteristic IS 'Insère ou met à jour une caractéristique autocomplete avec incrément du compteur d''usage';

