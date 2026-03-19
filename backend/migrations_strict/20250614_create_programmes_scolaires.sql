-- Migration : création de la table programmes_scolaires pour la gestion des programmes officiels
-- ✅ CORRIGÉ 2026-02-15: Vérifier si la table existe avec un schéma différent et la gérer
DO $$
BEGIN
    -- Si la table existe mais n'a pas la colonne "etablissement" (a "etablissement_id" à la place)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'programmes_scolaires')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'programmes_scolaires' AND column_name = 'etablissement') THEN
        -- La table existe avec un schéma différent, on ne fait rien (elle est déjà créée dans une autre migration)
        RAISE NOTICE 'Table programmes_scolaires existe déjà avec un schéma différent, ignorée';
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'programmes_scolaires') THEN
        -- Créer la table seulement si elle n'existe pas
        CREATE TABLE programmes_scolaires (
            id SERIAL PRIMARY KEY,
            etablissement TEXT NOT NULL,
            classe TEXT NOT NULL,
            annee TEXT,
            programme JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (etablissement, classe, annee)
        );
        
        -- Index pour recherche rapide
        CREATE INDEX IF NOT EXISTS idx_programmes_scolaires_etablissement ON programmes_scolaires(etablissement);
        CREATE INDEX IF NOT EXISTS idx_programmes_scolaires_classe ON programmes_scolaires(classe);
    END IF;
END $$;
