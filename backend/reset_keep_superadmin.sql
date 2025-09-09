-- Script pour reset complet en gardant le super admin
-- reset_keep_superadmin.sql

-- 1. Sauvegarder le super admin
CREATE TEMP TABLE temp_superadmin AS 
SELECT * FROM users WHERE email = 'lelehernandez2007@yahoo.fr';

-- 2. Supprimer toutes les tables sauf users et temp_superadmin
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename NOT IN ('users', 'temp_superadmin')) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- 3. Vider la table users
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- 4. Réinsérer le super admin
INSERT INTO users SELECT * FROM temp_superadmin;

-- 5. Nettoyer
DROP TABLE temp_superadmin; 