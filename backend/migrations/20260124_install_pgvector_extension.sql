-- Migration: Installation de l'extension pgvector
-- Date: 2026-01-24
-- Description: Installe l'extension pgvector pour le support des vecteurs d'embedding
--              Nécessaire pour les recherches sémantiques et l'IA

-- ✅ ÉTAPE 1: Vérifier si pgvector est disponible
-- Note: Sur certaines installations PostgreSQL, pgvector doit être compilé depuis les sources
-- Installation recommandée:
--   - Ubuntu/Debian: sudo apt-get install postgresql-XX-pgvector
--   - macOS: brew install pgvector
--   - Depuis sources: https://github.com/pgvector/pgvector

-- ✅ ÉTAPE 2: Créer l'extension pgvector
-- Cette commande échouera si pgvector n'est pas installé sur le serveur PostgreSQL
DO $$
BEGIN
    -- Tenter de créer l'extension
    CREATE EXTENSION IF NOT EXISTS vector;
    
    RAISE NOTICE '✅ Extension pgvector installée avec succès';
EXCEPTION
    WHEN OTHERS THEN
        -- Si l'extension n'est pas disponible, afficher un message d'erreur explicite
        RAISE WARNING '⚠️ Extension pgvector non disponible. Erreur: %', SQLERRM;
        RAISE WARNING '📦 Pour installer pgvector:';
        RAISE WARNING '   - Ubuntu/Debian: sudo apt-get install postgresql-XX-pgvector';
        RAISE WARNING '   - macOS: brew install pgvector';
        RAISE WARNING '   - Depuis sources: https://github.com/pgvector/pgvector';
        RAISE WARNING '   - Puis redémarrer PostgreSQL';
        -- Ne pas faire échouer la migration si pgvector n'est pas disponible
        -- L'application peut continuer à utiliser TEXT[] pour le matching vectoriel
END $$;

-- ✅ ÉTAPE 3: Vérifier que l'extension est bien installée
DO $$
DECLARE
    extension_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_extension 
        WHERE extname = 'vector'
    ) INTO extension_exists;
    
    IF extension_exists THEN
        RAISE NOTICE '✅ Extension pgvector vérifiée et active';
        RAISE NOTICE '📊 Version: %', (
            SELECT extversion 
            FROM pg_extension 
            WHERE extname = 'vector'
        );
    ELSE
        RAISE WARNING '⚠️ Extension pgvector non trouvée dans pg_extension';
        RAISE WARNING '💡 L''application continuera à utiliser TEXT[] pour le matching vectoriel';
    END IF;
END $$;

-- ✅ ÉTAPE 4: Créer une fonction utilitaire pour vérifier la disponibilité de pgvector
CREATE OR REPLACE FUNCTION pgvector_available() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM pg_extension 
        WHERE extname = 'vector'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION pgvector_available() IS 
'Vérifie si l''extension pgvector est disponible dans la base de données. 
Retourne TRUE si pgvector est installé, FALSE sinon.';

-- ✅ ÉTAPE 5: Exemple de table avec colonne vector (si pgvector est disponible)
-- Cette table peut être utilisée pour stocker des embeddings d'IA
-- Note: Cette table est optionnelle et ne sera créée que si nécessaire
/*
CREATE TABLE IF NOT EXISTS embeddings (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES service_products(id) ON DELETE CASCADE,
    embedding_type TEXT NOT NULL, -- 'text', 'image', 'audio', etc.
    embedding vector(1536), -- Dimension typique pour OpenAI embeddings
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index HNSW pour recherche rapide par similarité (si pgvector disponible)
DO $$
BEGIN
    IF pgvector_available() THEN
        CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw 
        ON embeddings 
        USING hnsw (embedding vector_cosine_ops);
        
        RAISE NOTICE '✅ Index HNSW créé pour embeddings';
    ELSE
        RAISE WARNING '⚠️ Index HNSW non créé (pgvector non disponible)';
    END IF;
END $$;
*/

-- ✅ FINALISATION
DO $$
BEGIN
    IF pgvector_available() THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅✅✅ pgvector est maintenant disponible dans cette base de données ✅✅✅';
        RAISE NOTICE '';
        RAISE NOTICE '📚 Utilisation recommandée:';
        RAISE NOTICE '   - Colonnes de type vector(N) pour stocker les embeddings';
        RAISE NOTICE '   - Opérateurs: <-> (distance), <#> (produit scalaire négatif), <=> (cosine distance)';
        RAISE NOTICE '   - Index HNSW pour recherche rapide par similarité';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️⚠️⚠️ pgvector n''est PAS disponible ⚠️⚠️⚠️';
        RAISE NOTICE '';
        RAISE NOTICE '💡 L''application continuera à utiliser:';
        RAISE NOTICE '   - TEXT[] pour le matching vectoriel textuel';
        RAISE NOTICE '   - to_tsvector() pour la recherche full-text';
        RAISE NOTICE '   - similarity() (pg_trgm) pour la recherche floue';
        RAISE NOTICE '';
        RAISE NOTICE '📦 Pour activer pgvector:';
        RAISE NOTICE '   1. Installer pgvector sur le serveur PostgreSQL';
        RAISE NOTICE '   2. Redémarrer PostgreSQL';
        RAISE NOTICE '   3. Relancer cette migration';
        RAISE NOTICE '';
    END IF;
END $$;








