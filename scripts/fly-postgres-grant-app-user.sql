-- Donne tous les droits sur les objets restaurés au user d'application
-- (yukpo_fly_backend), créé automatiquement par `flyctl postgres attach`.
--
-- À exécuter en tant que postgres superuser après le restore du dump GCP.
--
-- Usage :
--   PGPASSWORD=$OPERATOR_PASSWORD psql -h 127.0.0.1 -p 5433 -U postgres \
--     -d yukpo_db -f scripts/fly-postgres-grant-app-user.sql

\set app_user 'yukpo_fly_backend'

-- 1. Ownership des tables / sequences / functions / vues
DO $$
DECLARE
  obj record;
BEGIN
  -- tables
  FOR obj IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO yukpo_fly_backend', obj.schemaname, obj.tablename);
  END LOOP;
  -- sequences
  FOR obj IN SELECT sequence_schema as schemaname, sequence_name as seqname FROM information_schema.sequences WHERE sequence_schema='public'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO yukpo_fly_backend', obj.schemaname, obj.seqname);
  END LOOP;
  -- vues
  FOR obj IN SELECT schemaname, viewname FROM pg_views WHERE schemaname='public'
  LOOP
    EXECUTE format('ALTER VIEW %I.%I OWNER TO yukpo_fly_backend', obj.schemaname, obj.viewname);
  END LOOP;
END $$;

-- 2. Privilèges (au cas où l'ownership ne suffirait pas)
GRANT USAGE ON SCHEMA public TO yukpo_fly_backend;
GRANT ALL ON ALL TABLES IN SCHEMA public TO yukpo_fly_backend;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO yukpo_fly_backend;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO yukpo_fly_backend;

-- 3. Defaults pour les futurs objets créés par les migrations sqlx
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO yukpo_fly_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO yukpo_fly_backend;

-- 4. Vérification
SELECT 'tables' as kind, count(*) FROM pg_tables WHERE schemaname='public'
UNION ALL
SELECT 'sequences', count(*) FROM information_schema.sequences WHERE sequence_schema='public'
UNION ALL
SELECT 'views', count(*) FROM pg_views WHERE schemaname='public'
UNION ALL
SELECT 'users', count(*) FROM public.users;
