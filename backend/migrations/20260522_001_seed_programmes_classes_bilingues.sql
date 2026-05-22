-- =============================================================================
-- Migration : ajout des 5 classes BILINGUES au référentiel programmes_scolaires
-- =============================================================================
-- Date    : 2026-05-22
-- Source  : 5 PDFs officiels du Complexe Scolaire Bilingue Soft Education
--           (SIL BIL, CP BIL, CE1 BIL, CE2 BIL, CM1 BIL)
--
-- Contexte :
--   Le primaire BILINGUE (francophone + anglophone combinés dans la même
--   classe) n'existait pas dans le référentiel national. Cette migration
--   ajoute :
--     - un nouveau systeme_educatif = 'bilingue'
--     - 5 nouvelles classes : SIL BIL, CP BIL, CE1 BIL, CE2 BIL, CM1 BIL
--     - leurs manuels au programme (mix français + anglais)
--
-- Convention préservée :
--   - pays = 'CM' (comme les 784 existants)
--   - dupliqué sur les 2 établissements existants (id 3 = Collège Bilingue
--     Yukpo, id 4 = Programme national Cameroun) — comme les autres classes
--   - annee_scolaire = '2025-2026'
--   - type_article = 'livre' (défaut)
--
-- Précautions :
--   - Idempotente : ON CONFLICT DO NOTHING sur l'index unique
--     (etablissement_id, classe, matiere, titre_livre, annee_scolaire)
--   - Préserve les 784 livres existants (SIL, CP, CE1, CE2, CM1, CM2,
--     Class 1-6, 6ème, 5ème, etc.) — aucun UPDATE/DELETE.
-- =============================================================================

BEGIN;

-- Insertion via WITH livres_bil(...) → unnest pour chaque (classe, livre),
-- puis CROSS JOIN avec les 2 établissements actifs.
WITH livres_bil(classe, matiere, titre, editeur) AS (
    VALUES
    -- ========== SIL BIL (équivalent CP1 / CL1) ==========
    -- Section francophone
    ('SIL BIL', 'Écriture', 'Graphisme SIL', 'AFRICA EDUCATION'),
    ('SIL BIL', 'Lecture', 'Syllabaire SIL et CP', 'AFRICA EDUCATION'),
    ('SIL BIL', 'Français', 'Champions en Français SIL + Livret', 'HACHETTE / CLE'),
    ('SIL BIL', 'Mathématiques', 'A vos Maths ! SIL + Livret', 'NATHAN'),
    ('SIL BIL', 'TIC', 'Les Brillants en TIC SIL et CP', 'NMI EDUCATION'),
    ('SIL BIL', 'Sciences et Technologie', 'Majors en sciences et technologies SIL', 'ASVA EDUCATION'),
    ('SIL BIL', 'Éducation à la Citoyenneté', 'Éducation à la citoyenneté SIL et CP', 'NATHAN'),
    -- Section anglophone (équivalent Class 1)
    ('SIL BIL', 'Mathematics', 'Innovative mathematics, Class 1', 'DESTINY PRINTS'),
    ('SIL BIL', 'Mathematics', 'Workbook of Mathematics, Class 1', 'DESTINY PRINTS'),
    ('SIL BIL', 'Handwriting', 'Handwriting workbook Class 1', 'ATEMEC'),
    ('SIL BIL', 'Sound and Word Building', 'Sound and Word Building, Classes 1 and 2', 'ATEMEC'),
    ('SIL BIL', 'English', 'Winners in English, Class 1', 'NMI EDUCATION'),
    ('SIL BIL', 'English', 'Workbook of English, Class 1', 'NMI EDUCATION'),
    ('SIL BIL', 'Science and Technology', 'Standard science and technology', 'BECHACAM'),
    ('SIL BIL', 'Social Studies', 'The good citizen pupil''s book Classes 1 and 2', 'COSMOS'),
    ('SIL BIL', 'ICT', 'Winners in ICT, Classes 1 and 2', 'NMI'),

    -- ========== CP BIL (équivalent CP / CL2) ==========
    -- Section francophone
    ('CP BIL', 'Écriture', 'Mon cahier de graphisme CP', 'COSMOS'),
    ('CP BIL', 'Français', 'Champions en Français CP + Livret', 'HACHETTE / CLE'),
    ('CP BIL', 'Mathématiques', 'A vos Maths ! + Livret', 'NATHAN'),
    ('CP BIL', 'TIC', 'Les Brillants (SIL-CP)', 'NMI EDUCATION'),
    ('CP BIL', 'Sciences et Technologie', 'Majors en sciences CP', 'ASVA'),
    ('CP BIL', 'Éducation à la Citoyenneté', 'Éducation à la citoyenneté SIL/CP', 'NATHAN'),
    ('CP BIL', 'Lecture', 'Syllabaire SIL et CP', 'AFRICA EDUCATION'),
    -- Section anglophone (équivalent Class 2)
    ('CP BIL', 'Mathematics', 'Winners in Mathematics', 'NMI EDUCATION'),
    ('CP BIL', 'Mathematics', 'Workbook of Mathematics, Class 2', 'NMI EDUCATION'),
    ('CP BIL', 'Handwriting', 'Emergence in Handwriting', 'MONDOUX'),
    ('CP BIL', 'Sound and Word Building', 'Sound and Word Building, Classes 1 and 2', 'ATEMEC'),
    ('CP BIL', 'English', 'Winners in English, Class 2', 'NMI EDUCATION'),
    ('CP BIL', 'Science and Technology', 'Standard Science and Technology', 'BECHACAM'),
    ('CP BIL', 'Social Studies', 'The Good citizen pupil''s book Classes 1 and 2', 'COSMOS'),
    ('CP BIL', 'ICT', 'Winners Classes 1 and 2', 'NMI EDUCATION'),

    -- ========== CE1 BIL (équivalent CE1 / CL3) ==========
    -- Section francophone
    ('CE1 BIL', 'Français', 'Français CE1', 'NATHAN'),
    ('CE1 BIL', 'Français', 'Livret d''activités de Français CE1', 'NATHAN'),
    ('CE1 BIL', 'Lecture', 'Syllabaire CE1 et CE2', 'BELLES LETTRES'),
    ('CE1 BIL', 'Sciences Humaines et Sociales', 'Histoire, Géographie et Éducation à la citoyenneté CE1', 'EDICEF'),
    ('CE1 BIL', 'Littérature', 'Comment ça va Benjamin ? CE1', 'AFRICA EDUCATION'),
    ('CE1 BIL', 'Anglais', 'Anglais CE1', 'COSMOS'),
    ('CE1 BIL', 'Anglais', 'Livret d''activités d''Anglais, CE1', 'COSMOS'),
    ('CE1 BIL', 'Mathématiques', 'Mathématiques CE1', 'AFRICA EDUCATION'),
    ('CE1 BIL', 'Mathématiques', 'Livret d''activités de Mathématiques, CE1', 'AFRICA EDUCATION'),
    ('CE1 BIL', 'Sciences et Technologie', 'Sciences et Technologie CE1', 'ASVA'),
    ('CE1 BIL', 'TIC', 'Informatique CE1 et CE2', 'COSMOS'),
    -- Section anglophone (équivalent Class 3)
    ('CE1 BIL', 'Mathematics', 'Mathematics class 3', 'ATEMEC'),
    ('CE1 BIL', 'Sound and Word Building', 'Winners Classes 3 and 4', 'ATEMEC'),
    ('CE1 BIL', 'English', 'Winners in English Class 3', 'NMI EDUCATION'),
    ('CE1 BIL', 'English', 'Workbook of English, Class 3', 'NMI EDUCATION'),
    ('CE1 BIL', 'Literature', 'How are you Benjamin? Class 3', 'AFRICA EDUCATION'),
    ('CE1 BIL', 'Science and Technology', 'Science and technology class 3', 'ATEMEC'),
    ('CE1 BIL', 'Social Studies', 'Social studies class 3', 'GLOBAL INDUSTRIES'),
    ('CE1 BIL', 'ICT', 'I.C.T class 3 and 4', 'ATEMEC'),

    -- ========== CE2 BIL (équivalent CE2 / CL4) ==========
    -- Section francophone
    ('CE2 BIL', 'Français', 'Champions en Français CE2', 'EDICEF / CLE'),
    ('CE2 BIL', 'Français', 'Livret d''Activités de Français CE2', 'EDICEF/CLE'),
    ('CE2 BIL', 'Lecture', 'Syllabaire CE1 et CE2', 'BELLES LETTRES'),
    ('CE2 BIL', 'Littérature', 'Mon projet de vie CE2', 'NMI'),
    ('CE2 BIL', 'Mathématiques', 'Mathématiques CE2', 'NATHAN'),
    ('CE2 BIL', 'Mathématiques', 'Livret d''activités de Mathématiques CE2', 'NATHAN'),
    ('CE2 BIL', 'Sciences et Technologie', 'Sciences et Technologie CE2', 'COSMOS'),
    ('CE2 BIL', 'Sciences Humaines et Sociales', 'Histoire, Géographie et Éducation à la citoyenneté CE2', 'EDICEF'),
    ('CE2 BIL', 'TIC', 'Informatique CE1 et CE2', 'COSMOS'),
    -- Section anglophone (équivalent Class 4)
    ('CE2 BIL', 'Mathematics', 'Innovative Mathematics class 4', 'DESTINY PRINT'),
    ('CE2 BIL', 'English Language', 'Winner in English, Class 4', 'NMI EDUCATION'),
    ('CE2 BIL', 'English Language', 'Workbook of English, Class 4', 'NMI EDUCATION'),
    ('CE2 BIL', 'Literature', 'Benjamin is not a little boy! Class 4', 'AFRICA EDUCATION'),
    ('CE2 BIL', 'Science and Technology', 'Science and technology class 4', 'METROPOLITAN'),
    ('CE2 BIL', 'Social Studies', 'Winner in Social Studies Class 4', 'NMI EDUCATION'),
    ('CE2 BIL', 'ICT', 'I.C.T classes 3 and 4', 'ATEMEC'),

    -- ========== CM1 BIL (équivalent CM1 / CL5) ==========
    -- Section francophone
    ('CM1 BIL', 'Français', 'Champions en Français CM1', 'EDICEF/CLE'),
    ('CM1 BIL', 'Français', 'Livret d''activités de Français', 'EDICEF/CLE'),
    ('CM1 BIL', 'Littérature', 'La naissance d''une grande nation CM1', 'ECLOSION'),
    ('CM1 BIL', 'Anglais', 'English CM1', 'ASVA'),
    ('CM1 BIL', 'Anglais', 'Livret d''activités d''Anglais, CM1', 'ASVA'),
    ('CM1 BIL', 'Mathématiques', 'Mathématiques CM1', 'NATHAN'),
    ('CM1 BIL', 'Mathématiques', 'Livret d''activités de Mathématiques, CM1', 'NATHAN'),
    ('CM1 BIL', 'Sciences et Technologie', 'Sciences et Technologies CM1', 'NMI EDUCATION'),
    ('CM1 BIL', 'TIC', 'TIC CM1 et CM2', 'MONDOUX'),
    ('CM1 BIL', 'Sciences Humaines et Sociales', 'Sciences humaines et sociales CM1', 'EDICEF'),
    -- Section anglophone (équivalent Class 5)
    ('CM1 BIL', 'English Language', 'English Class 5', 'LONGHORN'),
    ('CM1 BIL', 'English Language', 'Workbook of English', 'LONGHORN'),
    ('CM1 BIL', 'French Language', 'French Class five', 'AFRICA EDUCATION'),
    ('CM1 BIL', 'French Language', 'Work book of French, class 5', 'AFRICA EDUCATION'),
    ('CM1 BIL', 'Mathematics', 'Mathematics Class 5', 'BECHACAM'),
    ('CM1 BIL', 'Mathematics', 'Work Book of Mathematics, class 5', 'BECHACAM'),
    ('CM1 BIL', 'Science and Technology', 'Winners in Science and Technology, class 5', 'NMI EDUCATION'),
    ('CM1 BIL', 'Literature', 'Stories and Wonders (Literature class 5)', 'NMI EDUCATION'),
    ('CM1 BIL', 'ICT', 'Information and Communication Technology', 'BECHACAM'),
    ('CM1 BIL', 'Social Studies', 'Winner in Social Studies, class 5', 'NMI EDUCATION'),
    ('CM1 BIL', 'Dictionnaire', 'Dictionnaire français', NULL)
)
INSERT INTO programmes_scolaires (
    etablissement_id,
    type_etablissement,
    niveau,
    classe,
    annee_scolaire,
    pays,
    systeme_educatif,
    matiere,
    titre_livre,
    editeur_livre,
    type_article,
    est_obligatoire,
    is_active,
    quantite_defaut
)
SELECT
    e.id AS etablissement_id,
    'primaire' AS type_etablissement,
    'Primaire' AS niveau,
    lb.classe,
    '2025-2026' AS annee_scolaire,
    'CM' AS pays,
    'bilingue' AS systeme_educatif,
    lb.matiere,
    lb.titre AS titre_livre,
    lb.editeur AS editeur_livre,
    'livre' AS type_article,
    true AS est_obligatoire,
    true AS is_active,
    1 AS quantite_defaut
FROM livres_bil lb
CROSS JOIN (
    SELECT id FROM etablissements_scolaires WHERE id IN (3, 4)
) e
ON CONFLICT (etablissement_id, classe, matiere, titre_livre, annee_scolaire)
DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vérification
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    nb_bil INTEGER;
    nb_total INTEGER;
    nb_classes_bil INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_bil FROM programmes_scolaires
    WHERE systeme_educatif = 'bilingue' AND annee_scolaire = '2025-2026';
    SELECT COUNT(*) INTO nb_total FROM programmes_scolaires;
    SELECT COUNT(DISTINCT classe) INTO nb_classes_bil FROM programmes_scolaires
    WHERE systeme_educatif = 'bilingue';
    RAISE NOTICE '[seed-bilingue] Livres bilingue 2025-2026 : %', nb_bil;
    RAISE NOTICE '[seed-bilingue] Classes bilingues distinctes : %', nb_classes_bil;
    RAISE NOTICE '[seed-bilingue] Total programmes_scolaires : %', nb_total;
END $$;

COMMIT;
