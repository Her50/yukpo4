-- =============================================================================
-- Seed : Manuels TRANSVERSAUX pour l'Enseignement Secondaire TECHNIQUE
--        (F1/F2/F3/F4/F5, G1/G2/G3, TI) — année 2026-2027
-- =============================================================================
-- Date : 2026-07-02
-- Source : Liste Officielle MINESEC 2024-2025 Enseignement Secondaire Technique
--          (Industriel et Industrielle) — reconduction en attendant la version
--          officielle 2026-2027.
--
-- Contexte :
--   * Diagnostic prod : les parents dont l'enfant est dans le secondaire
--     technique (Tle F3, 1ère G1, 2nde F2, etc.) ne voyaient AUCUN livre dans
--     l'app car le seed initial ne couvrait que F1 industriel + G2 commerciale
--     + Form 1T-5T anglophone. 24 classes techniques FR étaient à vide.
--
-- Fait pragmatique du MINESEC (confirmé PDF page 2-3) :
--   Les matières TRANSVERSALES (Français, Anglais, Maths générales, Histoire,
--   Géographie, Éducation à la Citoyenneté, Informatique, Physique-Chimie)
--   sont IDENTIQUES pour toutes les spécialités techniques du second cycle.
--
-- Stratégie :
--   Cloner les livres transversaux depuis :
--     * 2nde générale → 2nde F1, F2, F3, F4, F5, G1, G3 (2nde F et 2nde G
--       existent déjà, on ne les touche pas)
--     * 1ère A → 1ère F2, F3, F4, F5, G1, G3, TI (1ère F1, G2 existent)
--     * Tle A → Tle F2, F3, F4, F5, G1, G3, TI (Tle F1, G2 existent)
--
-- Idempotence : NOT EXISTS guard sur (annee_scolaire, classe, matiere, titre).
-- Les manuels de SPÉCIALITÉ (ELME, F3 Machines électriques Tle F3, etc.) sont
-- hors scope de cette migration et seront ajoutés dans une 2e vague à partir
-- des pages 4-36 du PDF MINESEC Technique.
-- =============================================================================

BEGIN;

-- ─── Cible 2nde : clone depuis 2nde vers 2nde F1/F2/F3/F4/F5 et G1/G3 ─────
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
SELECT DISTINCT ON (target.classe, src.matiere, src.titre_livre)
    src.etablissement_id, src.type_etablissement, 'Lycée/Collège technique', target.classe, src.filiere, src.specialite,
    src.titre, src.description,
    '2026-2027' AS annee_scolaire,
    src.fichier_url, src.fichier_nom, src.fichier_taille, src.fichier_type,
    src.is_active,
    src.periode_academique, src.date_debut_validite, src.date_fin_validite,
    src.extraction_status, src.nombre_livres_extraits, src.extraction_result, src.livres_extraits,
    src.pays, src.systeme_educatif, src.matiere, src.titre_livre, src.auteur_livre, src.editeur_livre,
    src.isbn_livre, src.est_obligatoire, src.keywords, src.prix_officiel, src.devise, src.type_article,
    src.quantite_defaut, src.created_by
FROM programmes_scolaires src
CROSS JOIN (VALUES ('2nde F1'), ('2nde F2'), ('2nde F3'), ('2nde F4'), ('2nde F5'), ('2nde G1'), ('2nde G3')) AS target(classe)
WHERE src.annee_scolaire = '2026-2027'
  AND src.systeme_educatif = 'francophone'
  AND src.classe = '2nde'
  AND src.matiere IN ('Français','Anglais','Mathématiques','Histoire','Géographie','ECM','Informatique','Physique','Chimie','SVT')
  AND NOT EXISTS (
    SELECT 1 FROM programmes_scolaires dst
    WHERE dst.annee_scolaire = '2026-2027'
      AND dst.classe = target.classe
      AND dst.systeme_educatif = 'francophone'
      AND dst.matiere = src.matiere
      AND lower(dst.titre_livre) = lower(src.titre_livre)
  );

-- ─── Cible 1ère : clone depuis 1ère A vers 1ère F2/F3/F4/F5, G1/G3, TI ───
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
SELECT DISTINCT ON (target.classe, src.matiere, src.titre_livre)
    src.etablissement_id, src.type_etablissement, 'Lycée/Collège technique', target.classe, src.filiere, src.specialite,
    src.titre, src.description,
    '2026-2027' AS annee_scolaire,
    src.fichier_url, src.fichier_nom, src.fichier_taille, src.fichier_type,
    src.is_active,
    src.periode_academique, src.date_debut_validite, src.date_fin_validite,
    src.extraction_status, src.nombre_livres_extraits, src.extraction_result, src.livres_extraits,
    src.pays, src.systeme_educatif, src.matiere, src.titre_livre, src.auteur_livre, src.editeur_livre,
    src.isbn_livre, src.est_obligatoire, src.keywords, src.prix_officiel, src.devise, src.type_article,
    src.quantite_defaut, src.created_by
FROM programmes_scolaires src
CROSS JOIN (VALUES ('1ère F2'), ('1ère F3'), ('1ère F4'), ('1ère F5'), ('1ère G1'), ('1ère G3'), ('1ère TI')) AS target(classe)
WHERE src.annee_scolaire = '2026-2027'
  AND src.systeme_educatif = 'francophone'
  AND src.classe = '1ère A'
  AND src.matiere IN ('Français','Anglais','Mathématiques','Histoire','Géographie','ECM','Informatique','Physique','Chimie','SVT')
  AND NOT EXISTS (
    SELECT 1 FROM programmes_scolaires dst
    WHERE dst.annee_scolaire = '2026-2027'
      AND dst.classe = target.classe
      AND dst.systeme_educatif = 'francophone'
      AND dst.matiere = src.matiere
      AND lower(dst.titre_livre) = lower(src.titre_livre)
  );

-- ─── Cible Tle : clone depuis Tle A vers Tle F2/F3/F4/F5, G1/G3, TI ─────
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
SELECT DISTINCT ON (target.classe, src.matiere, src.titre_livre)
    src.etablissement_id, src.type_etablissement, 'Lycée/Collège technique', target.classe, src.filiere, src.specialite,
    src.titre, src.description,
    '2026-2027' AS annee_scolaire,
    src.fichier_url, src.fichier_nom, src.fichier_taille, src.fichier_type,
    src.is_active,
    src.periode_academique, src.date_debut_validite, src.date_fin_validite,
    src.extraction_status, src.nombre_livres_extraits, src.extraction_result, src.livres_extraits,
    src.pays, src.systeme_educatif, src.matiere, src.titre_livre, src.auteur_livre, src.editeur_livre,
    src.isbn_livre, src.est_obligatoire, src.keywords, src.prix_officiel, src.devise, src.type_article,
    src.quantite_defaut, src.created_by
FROM programmes_scolaires src
CROSS JOIN (VALUES ('Tle F2'), ('Tle F3'), ('Tle F4'), ('Tle F5'), ('Tle G1'), ('Tle G3'), ('Tle TI')) AS target(classe)
WHERE src.annee_scolaire = '2026-2027'
  AND src.systeme_educatif = 'francophone'
  AND src.classe = 'Tle A'
  AND src.matiere IN ('Français','Anglais','Mathématiques','Histoire','Géographie','ECM','Informatique','Physique','Chimie','SVT')
  AND NOT EXISTS (
    SELECT 1 FROM programmes_scolaires dst
    WHERE dst.annee_scolaire = '2026-2027'
      AND dst.classe = target.classe
      AND dst.systeme_educatif = 'francophone'
      AND dst.matiere = src.matiere
      AND lower(dst.titre_livre) = lower(src.titre_livre)
  );

-- Vérification
DO $$
DECLARE
    nb_new INTEGER;
    nb_technique_2026 INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_technique_2026
    FROM programmes_scolaires
    WHERE annee_scolaire = '2026-2027'
      AND (classe LIKE '%F1' OR classe LIKE '%F2' OR classe LIKE '%F3' OR classe LIKE '%F4' OR classe LIKE '%F5'
        OR classe LIKE '%G1' OR classe LIKE '%G2' OR classe LIKE '%G3' OR classe LIKE '%TI'
        OR classe LIKE '2nde F%' OR classe LIKE '2nde G%');
    RAISE NOTICE '[seed_technique] Total lignes classes techniques 2026-2027 après seed : %', nb_technique_2026;
END $$;

COMMIT;
