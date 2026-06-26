-- =============================================================================
-- Corrections MINESEC ESGF — classe 6ème, année 2026-2027
-- =============================================================================
-- Date : 2026-06-26
-- Source : PDF officiel "liste manuels scolaires 2026-2027 ESGF" — signé
--          09 JUIN 2026 par MINESEC/CAB
--
-- Différences identifiées entre 2025-2026 et 2026-2027 sur la 6ème :
--   1. ANGLAIS : titre/éditeur changés (Sunshine NMI → Anglais 6ème
--      Africa Education).
--   2. HISTOIRE : éditeur changé (EDICEF-ERA → Hatier-ERA).
--   3. EDUCATION CITOYENNETE : titre/éditeur/prix changés
--      (Africa Education 2500 → MONDOUX 3500).
--   4. NOUVEAU : LATIN (Latinistas 6ème-5ème, Eclosion, 5000).
--   5. NOUVEAUX livres LITTERATURE : Les Bimanes (EDICEF, 2000),
--      Les Contes de Korotoumou (Vallesse, 2200).
--
-- Le clone 2025-2026→2026-2027 (migration précédente 20260626_001) a
-- conservé les anciennes valeurs. On les corrige ici, en UPDATE ciblé +
-- INSERT pour les nouveautés.
-- =============================================================================

BEGIN;

-- ─── UPDATE ANGLAIS 6ème (changement titre + éditeur) ─────────────────────
UPDATE programmes_scolaires
   SET titre_livre   = 'Anglais 6ème',
       editeur_livre = 'Africa Education',
       auteur_livre  = 'Ombga, Enyegue, Mbeudeu'
 WHERE annee_scolaire = '2026-2027'
   AND classe = '6ème'
   AND systeme_educatif = 'francophone'
   AND matiere = 'Anglais';

-- ─── UPDATE HISTOIRE 6ème (changement éditeur) ────────────────────────────
UPDATE programmes_scolaires
   SET editeur_livre = 'Hatier-ERA'
 WHERE annee_scolaire = '2026-2027'
   AND classe = '6ème'
   AND systeme_educatif = 'francophone'
   AND matiere = 'Histoire';

-- ─── UPDATE EDUC. CITOYENNETE 6ème (titre + éditeur + prix) ───────────────
UPDATE programmes_scolaires
   SET titre_livre   = 'Education à la citoyenneté 6ème/5ème',
       editeur_livre = 'MONDOUX',
       auteur_livre  = 'Kouna Bah, Ayuk Ayuk, Ndolo',
       prix_officiel = 3500
 WHERE annee_scolaire = '2026-2027'
   AND classe = '6ème'
   AND systeme_educatif = 'francophone'
   AND matiere IN ('ECM', 'Education à la citoyenneté');

-- ─── INSERT LATIN 6ème (nouveau manuel — idempotent via NOT EXISTS) ──────
INSERT INTO programmes_scolaires (
    etablissement_id, type_etablissement, niveau, classe,
    annee_scolaire, is_active, pays, systeme_educatif,
    matiere, titre_livre, auteur_livre, editeur_livre,
    est_obligatoire, prix_officiel, devise, type_article,
    quantite_defaut, date_debut_validite, date_fin_validite,
    periode_academique
)
SELECT DISTINCT
    src.etablissement_id, src.type_etablissement, 'Secondaire général', '6ème',
    '2026-2027', true, src.pays, 'francophone',
    'Latin', 'Latinistas 6ème-5ème', 'Ottou Fouda, Sabikanda', 'Eclosion',
    false, 5000, 'XAF', 'livre',
    1, '2026-07-01'::date, '2027-06-30'::date,
    '2026-2027'
FROM programmes_scolaires src
WHERE src.annee_scolaire = '2026-2027'
  AND src.classe = '6ème'
  AND src.systeme_educatif = 'francophone'
  AND src.etablissement_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM programmes_scolaires dst
    WHERE dst.annee_scolaire = '2026-2027'
      AND dst.classe = '6ème'
      AND dst.systeme_educatif = 'francophone'
      AND dst.matiere = 'Latin'
      AND dst.titre_livre = 'Latinistas 6ème-5ème'
      AND COALESCE(dst.etablissement_id, -1) = COALESCE(src.etablissement_id, -1)
  );

-- ─── INSERT Les Bimanes (Littérature 6ème, idempotent via NOT EXISTS) ────
INSERT INTO programmes_scolaires (
    etablissement_id, type_etablissement, niveau, classe,
    annee_scolaire, is_active, pays, systeme_educatif,
    matiere, titre_livre, auteur_livre, editeur_livre,
    est_obligatoire, prix_officiel, devise, type_article,
    quantite_defaut, date_debut_validite, date_fin_validite,
    periode_academique
)
SELECT DISTINCT
    src.etablissement_id, src.type_etablissement, 'Secondaire général', '6ème',
    '2026-2027', true, src.pays, 'francophone',
    'Littérature', 'Les Bimanes', 'Séverin Cécil Abega', 'EDICEF',
    true, 2000, 'XAF', 'livre',
    1, '2026-07-01'::date, '2027-06-30'::date,
    '2026-2027'
FROM programmes_scolaires src
WHERE src.annee_scolaire = '2026-2027'
  AND src.classe = '6ème'
  AND src.systeme_educatif = 'francophone'
  AND src.etablissement_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM programmes_scolaires dst
    WHERE dst.annee_scolaire = '2026-2027'
      AND dst.classe = '6ème'
      AND dst.systeme_educatif = 'francophone'
      AND dst.matiere = 'Littérature'
      AND dst.titre_livre = 'Les Bimanes'
      AND COALESCE(dst.etablissement_id, -1) = COALESCE(src.etablissement_id, -1)
  );

-- ─── INSERT Les Contes de Korotoumou (idempotent via NOT EXISTS) ──────────
INSERT INTO programmes_scolaires (
    etablissement_id, type_etablissement, niveau, classe,
    annee_scolaire, is_active, pays, systeme_educatif,
    matiere, titre_livre, auteur_livre, editeur_livre,
    est_obligatoire, prix_officiel, devise, type_article,
    quantite_defaut, date_debut_validite, date_fin_validite,
    periode_academique
)
SELECT DISTINCT
    src.etablissement_id, src.type_etablissement, 'Secondaire général', '6ème',
    '2026-2027', true, src.pays, 'francophone',
    'Littérature', 'Les Contes de Korotoumou', 'Amadou Kone', 'Vallesse',
    true, 2200, 'XAF', 'livre',
    1, '2026-07-01'::date, '2027-06-30'::date,
    '2026-2027'
FROM programmes_scolaires src
WHERE src.annee_scolaire = '2026-2027'
  AND src.classe = '6ème'
  AND src.systeme_educatif = 'francophone'
  AND src.etablissement_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM programmes_scolaires dst
    WHERE dst.annee_scolaire = '2026-2027'
      AND dst.classe = '6ème'
      AND dst.systeme_educatif = 'francophone'
      AND dst.matiere = 'Littérature'
      AND dst.titre_livre = 'Les Contes de Korotoumou'
      AND COALESCE(dst.etablissement_id, -1) = COALESCE(src.etablissement_id, -1)
  );

-- Vérification
DO $$
DECLARE
    nb INTEGER;
BEGIN
    SELECT COUNT(DISTINCT titre_livre) INTO nb
    FROM programmes_scolaires
    WHERE annee_scolaire = '2026-2027'
      AND classe = '6ème'
      AND systeme_educatif = 'francophone';
    RAISE NOTICE '[fix_6eme_2026_2027] 6ème ESGF : % titres distincts apres correction', nb;
END $$;

COMMIT;
