-- Active les extensions PostgreSQL nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ✅ NOUVEAU 2026-01-24: Extension pgvector pour les vecteurs d'embedding (recherche sémantique/IA)
-- Note: Si pgvector n'est pas installé sur le serveur, cette commande échouera silencieusement
-- Installation recommandée:
--   - Ubuntu/Debian: sudo apt-get install postgresql-XX-pgvector
--   - macOS: brew install pgvector
--   - Depuis sources: https://github.com/pgvector/pgvector
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE '✅ Extension pgvector installée avec succès';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '⚠️ Extension pgvector non disponible. Erreur: %', SQLERRM;
        RAISE WARNING '💡 L''application continuera à utiliser TEXT[] pour le matching vectoriel';
        RAISE WARNING '📦 Pour installer: sudo apt-get install postgresql-XX-pgvector ou brew install pgvector';
END $$;

-- ✅ NOTE 2025-12-30: Les index MongoDB sont créés automatiquement via:
-- - backend/src/services/mongo_history_service.rs::ensure_indexes()
-- - backend/src/migrations/auto_migrate.rs::ensure_mongodb_indexes()
-- Les index créés:
-- - idx_service_id: sur service_id (pour get_service_stats et get_reviews)
-- - idx_service_event_interaction: composé sur (service_id, event_type, data.interaction_type)
-- - idx_timestamp: sur timestamp (pour tri et nettoyage)
-- Ils sont appliqués automatiquement au démarrage du backend via main.rs





