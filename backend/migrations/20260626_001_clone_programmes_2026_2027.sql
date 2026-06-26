-- =============================================================================
-- Seed : Liste OFFICIELLE des manuels MINEDUB / MINESEC 2026-2027 (Cameroun)
-- Date : 2026-06-26
-- =============================================================================
-- Source : PDF officiel MINEDUB signé par le Ministre — 21 MAI 2026.
--          Le MINEDUB a reconduit la même liste qu'en 2025-2026 (vérifié
--          manuellement sur Maternelle/Nursery/CP/CE1/CM2/Class I/IV — strict
--          match titre/éditeur/prix).
--
-- Stratégie :
--   Au lieu de tout ré-inscrire, on CLONE les entrées 2025-2026 existantes
--   (DISTINCT pour éviter les doublons hérités d'anciens seeds) avec
--   annee_scolaire='2026-2027'. Idempotent : NOT EXISTS guard.
--
-- Pourquoi c'est CRITIQUE :
--   Le mois de juin 2026 fait basculer `compute_session_academique('CM')`
--   vers "2026-2027" (cf. backend/src/utils/session_academique.rs). Si la
--   table ne contient aucune ligne 2026-2027, l'app affichera 0 manuel aux
--   parents pendant toute la rentrée juillet-septembre 2026.
--
-- Sera ré-affiné si le MINEDUB publie des corrections en cours d'année,
-- via UPDATE ciblé (titre_livre, prix_officiel) sans toucher au clone de
-- base.
-- =============================================================================

BEGIN;

INSERT INTO programmes_scolaires (
    etablissement_id, type_etablissement, niveau, classe, filiere, specialite,
    titre, description,
    annee_scolaire,
    fichier_url, fichier_nom, fichier_taille, fichier_type,
    is_active,
    periode_academique, date_debut_validite, date_fin_validite,
    extraction_status, nombre_livres_extraits, extraction_result, livres_extraits,
    pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre,
    isbn_livre, est_obligatoire, keywords, prix_officiel, devise, type_article,
    quantite_defaut, created_by
)
SELECT DISTINCT ON (
    COALESCE(etablissement_id, -1),
    COALESCE(classe, ''),
    COALESCE(matiere, ''),
    COALESCE(titre_livre, ''),
    COALESCE(type_etablissement, ''),
    COALESCE(systeme_educatif, ''),
    COALESCE(type_article, ''),
    COALESCE(pays, '')
)
    etablissement_id, type_etablissement, niveau, classe, filiere, specialite,
    titre, description,
    '2026-2027' AS annee_scolaire,   -- ← ré-année
    fichier_url, fichier_nom, fichier_taille, fichier_type,
    is_active,
    -- Décale les bornes de validité d'un an si présentes
    CASE WHEN periode_academique IS NOT NULL THEN '2026-2027' ELSE NULL END AS periode_academique,
    CASE WHEN date_debut_validite IS NOT NULL THEN date_debut_validite + INTERVAL '1 year' ELSE DATE '2026-07-01' END::date AS date_debut_validite,
    CASE WHEN date_fin_validite IS NOT NULL THEN date_fin_validite + INTERVAL '1 year' ELSE DATE '2027-06-30' END::date AS date_fin_validite,
    extraction_status, nombre_livres_extraits, extraction_result, livres_extraits,
    pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre,
    isbn_livre, est_obligatoire, keywords, prix_officiel, devise, type_article,
    quantite_defaut, created_by
FROM programmes_scolaires src
WHERE src.annee_scolaire = '2025-2026'
  AND NOT EXISTS (
    SELECT 1 FROM programmes_scolaires dst
    WHERE dst.annee_scolaire = '2026-2027'
      AND COALESCE(dst.etablissement_id, -1) = COALESCE(src.etablissement_id, -1)
      AND COALESCE(dst.classe, '')             = COALESCE(src.classe, '')
      AND COALESCE(dst.matiere, '')            = COALESCE(src.matiere, '')
      AND COALESCE(dst.titre_livre, '')        = COALESCE(src.titre_livre, '')
      AND COALESCE(dst.type_etablissement, '') = COALESCE(src.type_etablissement, '')
      AND COALESCE(dst.systeme_educatif, '')   = COALESCE(src.systeme_educatif, '')
      AND COALESCE(dst.type_article, '')       = COALESCE(src.type_article, '')
      AND COALESCE(dst.pays, '')               = COALESCE(src.pays, '')
  );

-- Vérification
DO $$
DECLARE
    nb_2025 INTEGER;
    nb_2026 INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_2025 FROM programmes_scolaires WHERE annee_scolaire = '2025-2026';
    SELECT COUNT(*) INTO nb_2026 FROM programmes_scolaires WHERE annee_scolaire = '2026-2027';
    RAISE NOTICE '[clone_2026_2027] 2025-2026: % lignes, 2026-2027: % lignes', nb_2025, nb_2026;
END $$;

COMMIT;
