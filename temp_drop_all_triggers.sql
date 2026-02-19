-- Script pour supprimer tous les triggers existants
DO $$
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON ' || quote_ident(r.event_object_table) || ' CASCADE';
    END LOOP;
END $$;

SELECT 'Tous les triggers ont ete supprimes' AS status;



