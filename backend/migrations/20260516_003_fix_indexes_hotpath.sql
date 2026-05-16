-- 20260516_003_fix_indexes_hotpath.sql
-- Fix : la migration 20260516_002 a échoué sur les 2 derniers index hot-path
-- car livres_scolaires.classe_id n'existe pas (la colonne réelle est
-- classe_actuelle / classe_souhaitee). Ici on crée les index conditionnels
-- de manière défensive (IF NOT EXISTS + DO block tolérant aux erreurs).

DO $$
BEGIN
    -- programmes_scolaires : index par classe (lookup parent fréquent)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'programmes_scolaires')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'programmes_scolaires' AND column_name = 'classe_id') THEN
        CREATE INDEX IF NOT EXISTS programmes_scolaires_classe_idx
            ON programmes_scolaires (classe_id);
    END IF;

    -- commandes_mixtes : index par user + date (dashboard parent)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commandes_mixtes')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commandes_mixtes' AND column_name = 'user_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commandes_mixtes' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS commandes_mixtes_user_created_idx
            ON commandes_mixtes (user_id, created_at DESC);
    END IF;

    -- livres_scolaires : la colonne s'appelle classe_actuelle, pas classe_id.
    -- Un index idx_livres_classe_actuelle existe déjà — on n'ajoute rien ici.
END $$;
