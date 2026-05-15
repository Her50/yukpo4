-- Migration : fusionne "Collège" et "Lycée général" en "Secondaire général" pour CM-fr
-- Date : 2026-05-06
--
-- Justification : au Cameroun, les "collèges" et "lycées" sont des appellations
-- interchangeables. Un même établissement (privé "Collège X" ou public "Lycée Y")
-- couvre toujours le cycle complet du secondaire général (6ème → Terminale).
-- La séparation en deux niveaux distincts dans schoolSystems.ts crée une UX
-- artificielle. On regroupe sous "Secondaire général".
--
-- Les lycées techniques (Industriel, Commercial, Agro, Hôtellerie) restent
-- séparés car ils ont des spécificités matérielles réelles.

BEGIN;

-- accessoires_populaires_par_classe : renommer le niveau
UPDATE accessoires_populaires_par_classe
   SET niveau = 'Secondaire général',
       updated_at = NOW()
 WHERE pays = 'CM'
   AND systeme_id = 'CM-fr'
   AND niveau IN ('Collège', 'Lycée général');

-- programmes_scolaires : renommer aussi pour cohérence (si la colonne pays existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'programmes_scolaires' AND column_name = 'pays'
    ) THEN
        UPDATE programmes_scolaires
           SET niveau = 'Secondaire général'
         WHERE pays = 'CM'
           AND niveau IN ('Collège', 'Lycée général');
    ELSE
        -- Schéma legacy sans colonne pays : on filtre uniquement par niveau
        UPDATE programmes_scolaires
           SET niveau = 'Secondaire général'
         WHERE niveau IN ('Collège', 'Lycée général');
    END IF;
END $$;

COMMIT;
