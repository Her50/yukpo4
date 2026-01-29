-- Script pour installer pgvector sur Render PostgreSQL
-- À exécuter directement via psql ou l'interface Render

-- ✅ ÉTAPE 1: Tenter d'installer l'extension pgvector
-- Note: Render PostgreSQL peut nécessiter une activation via leur interface
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE '✅ Extension pgvector installée avec succès';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '⚠️ Extension pgvector non disponible. Erreur: %', SQLERRM;
        RAISE WARNING '💡 Pour Render PostgreSQL:';
        RAISE WARNING '   1. Vérifier si pgvector est disponible dans votre plan Render';
        RAISE WARNING '   2. Activer pgvector via le dashboard Render si nécessaire';
        RAISE WARNING '   3. Contacter le support Render pour activer pgvector';
        RAISE WARNING '   4. L''application continuera à utiliser TEXT[] pour le matching vectoriel';
END $$;

-- ✅ ÉTAPE 2: Vérifier l'installation
DO $$
DECLARE
    extension_exists BOOLEAN;
    version_text TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_extension 
        WHERE extname = 'vector'
    ) INTO extension_exists;
    
    IF extension_exists THEN
        SELECT extversion INTO version_text
        FROM pg_extension 
        WHERE extname = 'vector';
        
        RAISE NOTICE '✅ Extension pgvector vérifiée et active (version: %)', version_text;
    ELSE
        RAISE WARNING '⚠️ Extension pgvector non trouvée';
    END IF;
END $$;

-- ✅ ÉTAPE 3: Créer la fonction utilitaire
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

-- ✅ ÉTAPE 4: Afficher le statut final
SELECT 
    CASE 
        WHEN pgvector_available() THEN 
            '✅ pgvector est disponible - Prêt pour les recherches sémantiques'
        ELSE 
            '⚠️ pgvector n''est pas disponible - Utilisation de TEXT[] pour le matching'
    END as status;


