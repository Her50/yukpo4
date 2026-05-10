-- ============================================================================
-- Migration : Fix de l'unique-index erroné sur programmes_scolaires
-- Date : 2026-05-10
-- ============================================================================
-- Bug : la migration 20260424_001 avait créé
--   CREATE UNIQUE INDEX uniq_programmes_etab_classe_annee
--     ON programmes_scolaires(etablissement_id, classe, annee_scolaire)
--     WHERE is_active = true AND classe IS NOT NULL
--
-- Or chaque classe a typiquement 5 à 15 manuels (un par matière). Un UNIQUE
-- sur (etab, classe, année) interdit donc qu'une classe ait plusieurs livres,
-- ce qui rend le système inutilisable pour son but principal.
--
-- Correction : on supprime cet index et on le remplace par un index unique
-- partiel sur la clé fonctionnelle réelle d'un article :
--   (etablissement_id, annee_scolaire, classe, matiere, type_article, titre_livre)
-- pour empêcher les vrais doublons (même livre saisi 2x) sans bloquer la
-- saisie multi-livres.
-- ============================================================================

BEGIN;

-- 1. Supprime l'ancien index erroné (ne fait rien s'il a déjà disparu)
DROP INDEX IF EXISTS uniq_programmes_etab_classe_annee;

-- 2. Index unique fonctionnel : un article = (etab, année, classe, matière, type, titre)
--    COALESCE évite les NULL qui défont l'unicité.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_programmes_article
    ON programmes_scolaires(
        etablissement_id,
        annee_scolaire,
        classe,
        COALESCE(matiere, ''),
        COALESCE(type_article, 'livre'),
        titre_livre
    )
    WHERE is_active = true
      AND etablissement_id IS NOT NULL
      AND classe IS NOT NULL
      AND titre_livre IS NOT NULL;

-- 3. Index pour le programme national (etablissement_id NULL ou is_national)
--    Même clé sans etablissement_id (puisque NULL ne participe pas à l'unicité).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_programmes_national_article
    ON programmes_scolaires(
        pays,
        annee_scolaire,
        classe,
        COALESCE(matiere, ''),
        COALESCE(type_article, 'livre'),
        titre_livre
    )
    WHERE is_active = true
      AND etablissement_id IS NULL
      AND classe IS NOT NULL
      AND titre_livre IS NOT NULL;

COMMIT;
