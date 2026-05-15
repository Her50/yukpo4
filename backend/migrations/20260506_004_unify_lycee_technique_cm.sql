-- Migration : unifie les 4 niveaux techniques en "Lycée/Collège technique"
-- Date : 2026-05-06
--
-- Justification : au Cameroun, un Lycée Technique (ou CETIC) intègre toutes
-- les filières (industrielle, commerciale, agro, hôtelière) dans un seul
-- établissement. Avoir 4 niveaux distincts dans schoolSystems.ts ne reflète
-- pas la réalité : un parent à un Lycée Technique peut avoir un enfant en
-- voie F (industrielle) et un autre en voie G (commerciale).
--
-- On distingue donc les voies par le NOM DE LA CLASSE (1ère F vs 1ère G
-- vs 1ère EA vs 1ère HR ; idem Tle), et on regroupe sous un unique niveau
-- "Lycée/Collège technique".

BEGIN;

-- Étape 1 : ajouter le suffixe de voie aux classes 1ère/Tle pour éviter les
-- collisions sur la contrainte UNIQUE (pays, niveau, classe, nom_normalise)
-- lors de l'unification du niveau.

-- Industriel : 1ère/Tle → 1ère F / Tle F
UPDATE accessoires_populaires_par_classe
   SET classe = '1ère F'
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau='Lycée technique — Industriel' AND classe='1ère';
UPDATE accessoires_populaires_par_classe
   SET classe = 'Tle F'
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau='Lycée technique — Industriel' AND classe='Tle';

-- Commercial : 1ère/Tle → 1ère G / Tle G
UPDATE accessoires_populaires_par_classe
   SET classe = '1ère G'
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau='Lycée technique — Commercial' AND classe='1ère';
UPDATE accessoires_populaires_par_classe
   SET classe = 'Tle G'
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau='Lycée technique — Commercial' AND classe='Tle';

-- Agro : 1ère/Tle → 1ère EA / Tle EA
UPDATE accessoires_populaires_par_classe
   SET classe = '1ère EA'
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau='Lycée agro-pastoral' AND classe='1ère';
UPDATE accessoires_populaires_par_classe
   SET classe = 'Tle EA'
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau='Lycée agro-pastoral' AND classe='Tle';

-- Hôtellerie : 1ère/Tle → 1ère HR / Tle HR
UPDATE accessoires_populaires_par_classe
   SET classe = '1ère HR'
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau='Lycée hôtellerie & restauration' AND classe='1ère';
UPDATE accessoires_populaires_par_classe
   SET classe = 'Tle HR'
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau='Lycée hôtellerie & restauration' AND classe='Tle';

-- Étape 2 : unifier les 4 niveaux en un seul "Lycée/Collège technique".
-- Après l'étape 1, les classes sont uniques au sein du nouveau niveau.
UPDATE accessoires_populaires_par_classe
   SET niveau = 'Lycée/Collège technique',
       updated_at = NOW()
 WHERE pays='CM' AND systeme_id='CM-fr'
   AND niveau IN (
       'Lycée technique — Industriel',
       'Lycée technique — Commercial',
       'Lycée agro-pastoral',
       'Lycée hôtellerie & restauration'
   );

-- Cohérence avec programmes_scolaires si la colonne pays existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'programmes_scolaires' AND column_name = 'pays'
    ) THEN
        UPDATE programmes_scolaires
           SET niveau = 'Lycée/Collège technique'
         WHERE pays = 'CM'
           AND niveau IN (
               'Lycée technique — Industriel',
               'Lycée technique — Commercial',
               'Lycée agro-pastoral',
               'Lycée hôtellerie & restauration'
           );
    ELSE
        UPDATE programmes_scolaires
           SET niveau = 'Lycée/Collège technique'
         WHERE niveau IN (
               'Lycée technique — Industriel',
               'Lycée technique — Commercial',
               'Lycée agro-pastoral',
               'Lycée hôtellerie & restauration'
           );
    END IF;
END $$;

COMMIT;
