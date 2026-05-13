-- Fusion 'college' + 'lycee' → 'secondaire' dans etablissements_scolaires.cycles_offerts
-- Cause : au Cameroun (et la plupart des pays), un établissement secondaire
-- couvre les deux cycles ; afficher deux boutons distincts dans l'UI prête à
-- confusion. La distinction ne change rien au filtrage des classes.
--
-- Idempotent : peut tourner plusieurs fois.

DO $$
DECLARE
    r RECORD;
    new_cycles TEXT[];
BEGIN
    -- Ne fait rien si la table ou la colonne n'existe pas (sécurité)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'etablissements_scolaires' AND column_name = 'cycles_offerts'
    ) THEN
        RAISE NOTICE 'cycles_offerts column missing — skip normalize';
        RETURN;
    END IF;

    FOR r IN
        SELECT id, cycles_offerts FROM etablissements_scolaires
        WHERE cycles_offerts && ARRAY['college', 'lycee']::TEXT[]
    LOOP
        -- Remplace 'college' et 'lycee' par 'secondaire', dédoublonne, ordre stable.
        SELECT ARRAY(
            SELECT DISTINCT
                CASE WHEN c IN ('college', 'lycee') THEN 'secondaire' ELSE c END
            FROM unnest(r.cycles_offerts) AS c
        ) INTO new_cycles;

        UPDATE etablissements_scolaires
        SET cycles_offerts = new_cycles
        WHERE id = r.id;
    END LOOP;
END $$;
