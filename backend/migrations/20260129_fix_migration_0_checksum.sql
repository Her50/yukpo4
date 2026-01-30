-- ✅ Migration de correction : Corriger l'entrée de migration 0 dans _sqlx_migrations
-- Date: 2026-01-29
-- Description: Cette migration corrige le problème où la migration 0 a été enregistrée
--              avec la mauvaise description ("add delivery engine pricing" au lieu de "create all tables")
--              et le mauvais checksum, empêchant l'application des migrations suivantes.
--
-- PROBLÈME IDENTIFIÉ:
-- - La migration 0 en base a la description "add delivery engine pricing"
-- - Mais le fichier migrations/0000_create_all_tables.sql devrait être la migration 0
-- - Cela empêche la création des tables de base (users, services, etc.)
--
-- SOLUTION:
-- - Supprimer l'entrée incorrecte de migration 0 si elle existe avec la mauvaise description
-- - Permettre à SQLx de réappliquer la migration 0 correcte au prochain démarrage

DO $$
DECLARE
    migration_0_description TEXT;
    migration_0_version BIGINT := 0;
BEGIN
    -- Vérifier si la table _sqlx_migrations existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '_sqlx_migrations'
    ) THEN
        RAISE NOTICE '✅ Table _sqlx_migrations n''existe pas encore. Aucune correction nécessaire.';
        RETURN;
    END IF;

    -- Récupérer la description actuelle de la migration 0
    SELECT description INTO migration_0_description
    FROM _sqlx_migrations
    WHERE version = migration_0_version
    LIMIT 1;

    -- Si la migration 0 existe avec la mauvaise description, la supprimer
    IF migration_0_description IS NOT NULL AND migration_0_description != 'create all tables' THEN
        RAISE NOTICE '⚠️ Migration 0 incorrecte détectée: description = "%"', migration_0_description;
        RAISE NOTICE '🔧 Suppression de l''entrée incorrecte pour permettre la réapplication de la migration 0 correcte...';
        
        DELETE FROM _sqlx_migrations
        WHERE version = migration_0_version;
        
        RAISE NOTICE '✅ Entrée de migration 0 supprimée. La migration 0 correcte sera réappliquée au prochain démarrage.';
    ELSIF migration_0_description = 'create all tables' THEN
        RAISE NOTICE '✅ Migration 0 a déjà la bonne description ("create all tables"). Aucune correction nécessaire.';
    ELSE
        RAISE NOTICE '✅ Aucune migration 0 trouvée. La migration 0 sera appliquée normalement au prochain démarrage.';
    END IF;
END $$;

-- ✅ Vérification finale: Lister toutes les migrations appliquées pour diagnostic
DO $$
DECLARE
    migration_record RECORD;
    successful_count INTEGER := 0;
    failed_count INTEGER := 0;
BEGIN
    SELECT 
        COUNT(*) FILTER (WHERE success = true) as successful,
        COUNT(*) FILTER (WHERE success = false) as failed
    INTO successful_count, failed_count
    FROM _sqlx_migrations;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 État des migrations après correction:';
    RAISE NOTICE '   - Migrations réussies: %', successful_count;
    RAISE NOTICE '   - Migrations échouées: %', failed_count;
    RAISE NOTICE '';
    
    IF successful_count = 0 THEN
        RAISE WARNING '⚠️ Aucune migration réussie trouvée. Les migrations seront réappliquées au prochain démarrage.';
    END IF;
END $$;

COMMENT ON TABLE _sqlx_migrations IS 'Table de suivi des migrations SQLx. Cette migration corrige les entrées incorrectes pour permettre la réapplication des migrations.';



