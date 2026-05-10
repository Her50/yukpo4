-- ============================================================================
-- Seed : Liste OFFICIELLE des manuels MINEDUB 2025-2026 (Cameroun)
-- Date : 2026-05-10
-- Source : https://www.minedub.cm/wp-content/uploads/2025/04/MANUELS-SCOLAIRE-2025-2026.pdf
--          (signée par le Ministre — N° PS / AVR 2025)
-- ============================================================================
-- Couvre l'enseignement maternel et primaire des sous-systèmes francophone
-- (Maternelle 1/2, SIL, CP, CE1, CE2, CM1, CM2) et anglophone (Nursery 1/2,
-- Class 1 → Class 6). Données extraites par OCR du PDF officiel signé.
--
-- Idempotence : on lookup l'établissement « national » Cameroun
-- (is_national=true, pays='CM') et on insère uniquement si la combinaison
-- (etab_national, annee_scolaire, classe, matière, type_article, titre)
-- n'existe pas déjà.
-- ============================================================================

DO $$
DECLARE
    v_etab_id INTEGER;
    v_annee TEXT := '2025-2026';
BEGIN
    SELECT id INTO v_etab_id
    FROM etablissements_scolaires
    WHERE pays = 'CM' AND is_national = true AND is_active = true
    LIMIT 1;

    IF v_etab_id IS NULL THEN
        RAISE NOTICE 'Pas d''établissement national CM trouvé — seed MINEDUB skip';
        RETURN;
    END IF;

    -- Helper : insère un manuel s'il n'existe pas déjà (idempotent)
    -- Volume : ~80 manuels — INSERT inline pour rester dans une seule transaction.

    -- ───────── MATERNELLE FRANCOPHONE ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre, editeur_livre,
         type_article, prix_officiel, devise, annee_scolaire, est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'francophone', niveau, classe, matiere, titre, editeur,
           'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('Maternelle', 'Maternelle 1', 'Langage', 'Mon cahier d''activités de langage 1ère année', 'NATHAN', 1000),
        ('Maternelle', 'Maternelle 1', 'Mathématiques', 'Mon cahier d''activités de Mathématique 1ère année', 'NATHAN', 1000),
        ('Maternelle', 'Maternelle 1', 'Dessin/Coloriage', 'Je pratique le Dessin et le Coloriage', 'AFRICA Education', 1000),
        ('Maternelle', 'Maternelle 2', 'Langage', 'Les Majors en activité de Langage, Maternelle 2', 'ASVA', 1000),
        ('Maternelle', 'Maternelle 2', 'Mathématiques', 'Mon cahier d''activités de Mathématiques, M. 2ème année', 'NATHAN', 1000),
        ('Maternelle', 'Maternelle 2', 'Dessin/Coloriage', 'Je pratique le Dessin et le Coloriage', 'AFRICA Education', 1000)
    ) AS s(niveau, classe, matiere, titre, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── NURSERY ANGLOPHONE ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre, editeur_livre,
         type_article, prix_officiel, devise, annee_scolaire, est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', niveau, classe, matiere, titre, editeur,
           'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('Nursery', 'Nursery 1', 'Drawing and Coloring', 'Innovative Drawing and Coloring', 'DESTINY Prints', 1000),
        ('Nursery', 'Nursery 1', 'Mathematics', 'Elementary Mathematics, Activity Book 1', 'DOVE', 1000),
        ('Nursery', 'Nursery 1', 'Language', 'Language Activity Book, Nursery 1', 'ATEMEC', 1000),
        ('Nursery', 'Nursery 2', 'Drawing and Coloring', 'ANUCAM Drawing and Coloring, Nursery 2', 'ANUCAM', 1000),
        ('Nursery', 'Nursery 2', 'Mathematics', 'Elementary Mathematics, Activity Book 2', 'DOVE', 1000),
        ('Nursery', 'Nursery 2', 'Language', 'Language Activity Book, Nursery 2', 'ATEMEC', 1000)
    ) AS s(niveau, classe, matiere, titre, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── PRIMAIRE FRANCOPHONE (SIL → CM2) ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre, editeur_livre,
         type_article, prix_officiel, devise, annee_scolaire, est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'francophone', 'Primaire', classe, matiere, titre, editeur,
           'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        -- SIL
        ('SIL', 'Écriture', 'Graphisme SIL', 'AFRICA Education', 1500),
        ('SIL', 'Lecture', 'Syllabaire SIL et CP', 'AFRICA Education', 1500),
        ('SIL', 'Français', 'Champions en Français SIL', 'HACHETTE/CLE', 1500),
        ('SIL', 'Anglais', 'Inclusive English SIL', 'GLOBAL Industries', 1800),
        ('SIL', 'Mathématiques', 'À vos Maths ! SIL', 'NATHAN', 1500),
        ('SIL', 'TIC', 'Les Brillants en TIC, SIL et CP', 'NMI Education', 1500),
        ('SIL', 'Science et Technologie', 'Majors en Science et Technologie SIL', 'ASVA Education', 1500),
        ('SIL', 'Éducation à la citoyenneté', 'Éducation à la citoyenneté SIL et CP', 'NATHAN', 1500),
        -- CP
        ('CP', 'Écriture', 'Mon Cahier de Graphisme CP', 'COSMOS', 1200),
        ('CP', 'Lecture', 'Syllabaire SIL et CP', 'AFRICA Education', 1500),
        ('CP', 'Français', 'Champions en Français, CP', 'HACHETTE/CLE', 1500),
        ('CP', 'Anglais', 'Les Brillants en Anglais, CP', 'NMI Education', 1800),
        ('CP', 'Mathématiques', 'À vos Maths ! CP', 'NATHAN', 1500),
        ('CP', 'Science et Technologie', 'Majors en Sciences CP', 'ASVA', 1500),
        ('CP', 'Éducation à la citoyenneté', 'Éducation à la citoyenneté SIL et CP', 'NATHAN', 1500),
        ('CP', 'TIC', 'Les Brillants SIL et CP', 'NMI Education', 1500),
        -- CE1
        ('CE1', 'Lecture', 'Syllabaire CE1 et CE2', 'BELLES LETTRES', 1500),
        ('CE1', 'Français', 'Français CE1', 'NATHAN', 1800),
        ('CE1', 'Littérature', 'Comment ça va Benjamin ? CE1', 'AFRICA Education', 1000),
        ('CE1', 'Anglais', 'Anglais CE1', 'COSMOS', 1800),
        ('CE1', 'Mathématiques', 'Mathématiques CE1', 'AFRICA Education', 1800),
        ('CE1', 'Science et Technologie', 'Science et Technologie CE1', 'ASVA', 1600),
        ('CE1', 'Sciences Humaines et Sociales', 'Histoire, Géographie et Éducation à la citoyenneté CE1', 'EDICEF', 1800),
        ('CE1', 'TIC', 'Informatique CE1 et CE2', 'COSMOS', 1600),
        -- CE2
        ('CE2', 'Lecture', 'Syllabaire CE1 et CE2', 'BELLES LETTRES', 1500),
        ('CE2', 'Français', 'Champions en Français CE2', 'EDICEF/CLE', 1800),
        ('CE2', 'Littérature', 'Mon projet de vie CE2', 'NMI Education', 1000),
        ('CE2', 'Anglais', 'Les Brillants en Anglais CE2', 'NMI Education', 1800),
        ('CE2', 'Mathématiques', 'Mathématiques CE2', 'NATHAN', 1800),
        ('CE2', 'Science et Technologie', 'Science et Technologie CE2', 'COSMOS', 1600),
        ('CE2', 'Sciences Humaines et Sociales', 'Histoire, Géographie et Éducation à la citoyenneté CE2', 'EDICEF', 1800),
        ('CE2', 'TIC', 'Informatique CE1 et CE2', 'COSMOS', 1600),
        -- CM1
        ('CM1', 'Français', 'Champions en Français CM1', 'EDICEF/CLE', 1900),
        ('CM1', 'Littérature', 'La naissance d''une grande nation, CM1', 'ECLOSION', 1000),
        ('CM1', 'Anglais', 'English CM1', 'ASVA', 1900),
        ('CM1', 'Mathématiques', 'Mathématiques CM1', 'NATHAN', 1900),
        ('CM1', 'Science et Technologie', 'Science et Technologie CM1', 'NMI Education', 1850),
        ('CM1', 'Sciences Humaines et Sociales', 'Sciences Humaines et Sociales CM1', 'EDICEF', 1850),
        ('CM1', 'TIC', 'TIC CM1 et CM2', 'MONDOUX', 1800),
        -- CM2
        ('CM2', 'Français', 'Champions en Français CM2', 'EDICEF/CLE', 1900),
        ('CM2', 'Littérature', 'Une Nation bénie CM2', 'ECLOSION', 1000),
        ('CM2', 'Anglais', 'Anglais, CM2', 'COSMOS', 1900),
        ('CM2', 'Mathématiques', 'Mathématiques CM2', 'AFRICA Education', 1900),
        ('CM2', 'Science et Technologie', 'Science et Technologie CM2', 'COSMOS', 1800),
        ('CM2', 'TIC', 'TIC CM1 et CM2', 'MONDOUX', 1800),
        ('CM2', 'Sciences Humaines et Sociales', 'Sciences Humaines et Sociales CM2', 'EDICEF', 1850)
    ) AS s(classe, matiere, titre, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── PRIMARY ANGLOPHONE (Class 1 → Class 6) ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre, editeur_livre,
         type_article, prix_officiel, devise, annee_scolaire, est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Primary', classe, matiere, titre, editeur,
           'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        -- Class 1
        ('Class 1', 'Handwriting', 'Handwriting Workbook, Class 1', 'ATEMEC', 1500),
        ('Class 1', 'Sound and Word Building', 'Sound and Word Building, Classes 1 and 2', 'ATEMEC', 1500),
        ('Class 1', 'English', 'Winners in English, Class 1', 'NMI Education', 1800),
        ('Class 1', 'French', 'Parlons Français. Livre de l''élève 1', 'COSMOS', 1800),
        ('Class 1', 'Mathematics', 'Innovative Mathematics, Class 1', 'DESTINY Prints', 1800),
        ('Class 1', 'Science and Technology', 'Standard Science and Technology', 'BECHACAM', 1500),
        ('Class 1', 'Social Studies', 'The Good Citizen. Pupil''s Book Classes 1 and 2', 'COSMOS', 1500),
        ('Class 1', 'ICT', 'Winners in ICT, Classes 1 and 2', 'NMI', 1500),
        -- Class 2
        ('Class 2', 'Handwriting', 'Emergence in Handwriting', 'MONDOUX', 1500),
        ('Class 2', 'Sound and Word Building', 'Sound and Word Building, Classes 1 and 2', 'ATEMEC', 1500),
        ('Class 2', 'English', 'Winners in English, Class 2', 'NMI Education', 1800),
        ('Class 2', 'French', 'J''apprends le Français, 2', 'ANUCAM', 1800),
        ('Class 2', 'Mathematics', 'Winners in Mathematics', 'NMI Education', 1800),
        ('Class 2', 'Science and Technology', 'Standard Science and Technology', 'BECHACAM', 1500),
        ('Class 2', 'Social Studies', 'The Good Citizen. Pupil''s Book Classes 1 and 2', 'COSMOS', 1500),
        ('Class 2', 'ICT', 'Winners Classes 1 and 2', 'NMI Education', 1500),
        -- Class 3
        ('Class 3', 'Sound and Word Building', 'Sound and Word Building, Classes 3 and 4', 'ATEMEC', 1500),
        ('Class 3', 'English', 'Winners in English Class 3', 'NMI Education', 1800),
        ('Class 3', 'Literature', 'How are You Benjamin? Class 3', 'AFRICA Education', 1000),
        ('Class 3', 'French', 'French Class 3', 'AFRICA Education', 1800),
        ('Class 3', 'Mathematics', 'Mathematics Class 3', 'ATEMEC', 1800),
        ('Class 3', 'Science and Technology', 'Science and Technology Class 3', 'ATEMEC', 1600),
        ('Class 3', 'Social Studies', 'Social Studies Class 3', 'GLOBAL Industries', 1800),
        ('Class 3', 'ICT', 'ICT Classes 3 and 4', 'ATEMEC', 1600),
        -- Class 4
        ('Class 4', 'English', 'Winner in English Class 4', 'NMI Education', 1800),
        ('Class 4', 'Literature', 'Benjamin is not a little boy! Class 4', 'AFRICA Education', 1000),
        ('Class 4', 'French', 'French Class 4', 'AFRICA Education', 1700),
        ('Class 4', 'Mathematics', 'Innovative Mathematics Class 4', 'DESTINY Print', 1800),
        ('Class 4', 'Science and Technology', 'Science and Technology Class 4', 'METROPOLITAIN', 1600),
        ('Class 4', 'Social Studies', 'Winner in Social Studies Class 4', 'NMI Education', 1850),
        ('Class 4', 'ICT', 'ICT Classes 3 and 4', 'ATEMEC', 1600),
        -- Class 5
        ('Class 5', 'English', 'English Class 5', 'LONGHORN', 1900),
        ('Class 5', 'Literature', 'Stories and Wonders (Literature Class 5)', 'NMI Education', 1000),
        ('Class 5', 'French', 'French Class 5', 'AFRICA Education', 1900),
        ('Class 5', 'Mathematics', 'Mathematics Class 5', 'BECHACAM', 1900),
        ('Class 5', 'Science and Technology', 'Winners in Science and Technology Class 5', 'NMI Education', 1800),
        ('Class 5', 'ICT', 'Information and Communication Technology', 'BECHACAM', 1800),
        ('Class 5', 'Social Studies', 'Winner in Social Studies Class 5', 'NMI Education', 1800),
        -- Class 6
        ('Class 6', 'English', 'English Class 6', 'BECHACAM', 1900),
        ('Class 6', 'Literature', 'Wake Up !', 'COSMOS', 1000),
        ('Class 6', 'French', 'French Class 6', 'AFRICA Education', 1900),
        ('Class 6', 'Mathematics', 'Mathematics Class 6', 'BECHACAM', 1900),
        ('Class 6', 'Science and Technology', 'Science and Technology Class 6', 'LEGEND Publishers', 1900),
        ('Class 6', 'ICT', 'ICT Classes 5 and 6', 'BECHACAM', 1800),
        ('Class 6', 'Social Studies', 'Winner in Social Studies Classes 5 and 6', 'NMI Education', 1800)
    ) AS s(classe, matiere, titre, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    RAISE NOTICE 'Seed MINEDUB primaire/maternelle 2025-2026 chargé pour etab national CM (id=%)', v_etab_id;
END $$;
