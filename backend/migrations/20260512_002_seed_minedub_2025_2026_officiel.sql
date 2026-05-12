-- ✅ Seed MINEDUB officiel 2025/2026 — Maternelle + Primaire FR & EN
-- Source : PDF officiel MINEDUB signé par le Ministre 10 AVR 2025
-- Insère tous les manuels officiels par classe / matière / éditeur / prix.

DO $$
DECLARE
    v_etab_id INTEGER;
    v_annee TEXT := '2025-2026';
BEGIN
    SELECT id INTO v_etab_id FROM etablissements_scolaires
    WHERE pays = 'CM' AND is_national = true AND is_active = true LIMIT 1;
    IF v_etab_id IS NULL THEN
        RAISE NOTICE 'Pas d''établissement national CM trouvé';
        RETURN;
    END IF;

    -- ───── MATERNELLE (francophone) — 1ère et 2ème année
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         editeur_livre, type_article, prix_officiel, devise, annee_scolaire, est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'francophone', 'Maternelle', classe, matiere, titre,
           editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('Maternelle 1ère année', 'Langage', 'Mon cahier d''activités de langage 1ère année', 'NATHAN', 1000),
        ('Maternelle 1ère année', 'Mathématiques', 'Mon cahier d''activités de Mathématique 1ère année', 'NATHAN', 1000),
        ('Maternelle 1ère année', 'Dessin Peinture Coloriage', 'Je pratique le Dessin et le Coloriage', 'AFRICA Education', 1000),
        ('Maternelle 2ème année', 'Langage', 'Les Majors en activité de Langage, Maternelle 2', 'ASVA', 1000),
        ('Maternelle 2ème année', 'Mathématiques', 'Mon cahier d''activités de Mathématiques, Maternelle 2ème année', 'NATHAN', 1000),
        ('Maternelle 2ème année', 'Dessin Peinture Coloriage', 'Je pratique le Dessin et le Coloriage', 'AFRICA Education', 1000)
    ) AS s(classe, matiere, titre, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.is_active = true
    );

    -- ───── NURSERY (anglophone) — Nursery 1 et 2
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         editeur_livre, type_article, prix_officiel, devise, annee_scolaire, est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Nursery', classe, matiere, titre,
           editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('Nursery 1', 'Language', 'Language Activity Book, Nursery 1', 'ATEMEC', 1000),
        ('Nursery 1', 'Drawing and Coloring', 'Innovative drawing and Coloring', 'DESTINY Prints', 1000),
        ('Nursery 1', 'Mathematics', 'Elementary Mathematics, Activity Book 1', 'DOVE', 1000),
        ('Nursery 2', 'Language', 'Language Activity Book, Nursery 2', 'ATEMEC', 1000),
        ('Nursery 2', 'Drawing and Coloring', 'ANUCAM Drawing and Coloring, Nursery 2', 'ANUCAM', 1000),
        ('Nursery 2', 'Mathematics', 'Elementary Mathematics, Activity Book 2', 'DOVE', 1000)
    ) AS s(classe, matiere, titre, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.is_active = true
    );

    -- ───── PRIMAIRE FRANCOPHONE — SIL → CM2
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         editeur_livre, type_article, prix_officiel, devise, annee_scolaire, est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'francophone', 'Primaire', classe, matiere, titre,
           editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        -- SIL
        ('SIL', 'Écriture', 'Graphisme SIL', 'AFRICA Education', 1200),
        ('SIL', 'Lecture', 'Syllabaire SIL et CP', 'AFRICA Education', 1500),
        ('SIL', 'Français', 'Champions en Français SIL', 'HACHETTE/CLE', 1500),
        ('SIL', 'Français', 'Livret d''activités de Français, SIL', 'HACHETTE/CLE', 1300),
        ('SIL', 'Anglais', 'Inclusive English SIL', 'GLOBAL Industries', 1800),
        ('SIL', 'Anglais', 'Livret d''activités d''Anglais, SIL', 'GLOBAL Industries', 1000),
        ('SIL', 'Mathématiques', 'A vos Maths ! SIL', 'NATHAN', 1500),
        ('SIL', 'Mathématiques', 'Livret d''activités de Mathématiques, SIL', 'NATHAN', 1000),
        ('SIL', 'TIC', 'Les Brillants en TIC. SIL et CP', 'NMI Education', 1500),
        ('SIL', 'Science et Technologie', 'Majors en Science et technologie SIL', 'ASVA Education', 1500),
        ('SIL', 'Education à la citoyenneté', 'Education à la citoyenneté SIL et CP', 'NATHAN', 1500),
        -- CP
        ('CP', 'Écriture', 'Mon Cahier de Graphisme CP', 'COSMOS', 1200),
        ('CP', 'Lecture', 'Syllabaire SIL et CP', 'AFRICA Education', 1500),
        ('CP', 'Français', 'Champions en Français, CP', 'HACHETTE/CLE', 1500),
        ('CP', 'Français', 'Livret d''activités de Français, CP', 'HACHETTE/CLE', 1300),
        ('CP', 'Anglais', 'Les Brillants en Anglais, CP', 'NMI Education', 1800),
        ('CP', 'Anglais', 'Livret d''activités d''Anglais, CP', 'NMI Education', 1200),
        ('CP', 'Mathématiques', 'A vos Maths ! CP', 'NATHAN', 1500),
        ('CP', 'Mathématiques', 'Livret d''activités de Mathématiques, CP', 'NATHAN', 1250),
        ('CP', 'Science et Technologie', 'Majors en Sciences CP', 'ASVA', 1500),
        ('CP', 'Education à la citoyenneté', 'Education à la citoyenneté SIL et CP', 'NATHAN', 1500),
        ('CP', 'TIC', 'Les Brillants en TIC. SIL et CP', 'NMI Education', 1500),
        -- CE1
        ('CE1', 'Lecture', 'Syllabaire CE 1 et CE 2', 'BELLES LETTRES', 1500),
        ('CE1', 'Français', 'Français CE1', 'NATHAN', 1800),
        ('CE1', 'Français', 'Livret d''activités de Français CE1', 'NATHAN', 1150),
        ('CE1', 'Littérature', 'Comment ça va Benjamin ? CE1', 'AFRICA Education', 1000),
        ('CE1', 'Anglais', 'Anglais CE1', 'COSMOS', 1800),
        ('CE1', 'Anglais', 'Livret d''activités d''Anglais CE 1', 'COSMOS', 1100),
        ('CE1', 'Mathématiques', 'Mathématiques CE1', 'AFRICA Education', 1800),
        ('CE1', 'Mathématiques', 'Livret d''activités de Mathématiques, CE1', 'AFRICA Education', 1150),
        ('CE1', 'Science et Technologie', 'Science et Technologie CE1', 'ASVA', 1600),
        ('CE1', 'Sciences Humaines et Sociales', 'Histoire, Géographie et Education à la citoyenneté CE1', 'EDICEF', 1800),
        ('CE1', 'TIC', 'Informatique CE1 et CE2', 'COSMOS', 1600),
        -- CE2
        ('CE2', 'Lecture', 'Syllabaire CE 1 et CE 2', 'BELLES LETTRES', 1500),
        ('CE2', 'Français', 'Champions en Français CE 2', 'EDICEF/CLE', 1800),
        ('CE2', 'Français', 'Livret d''Activités de Français CE2', 'EDICEF/CLE', 1300),
        ('CE2', 'Littérature', 'Mon projet de vie CE2', 'NMI Education', 1000),
        ('CE2', 'Anglais', 'Les Brillants en Anglais CE 2', 'NMI Education', 1800),
        ('CE2', 'Anglais', 'Livret d''Activités d''Anglais CE2', 'NMI Education', 1150),
        ('CE2', 'Mathématiques', 'Mathématiques CE 2', 'NATHAN', 1800),
        ('CE2', 'Mathématiques', 'Livret d''Activités de Mathématiques CE 2', 'NATHAN', 1150),
        ('CE2', 'Science et Technologie', 'Science et Technologie CE 2', 'COSMOS', 1600),
        ('CE2', 'Sciences Humaines et Sociales', 'Histoire, Géographie et Education à la citoyenneté CE2', 'EDICEF', 1800),
        ('CE2', 'TIC', 'Informatique CE1 et CE2', 'COSMOS', 1600),
        -- CM1
        ('CM1', 'Français', 'Champions en Français CM1', 'EDICEF/CLE', 1900),
        ('CM1', 'Français', 'Livret d''activités de Français CM1', 'EDICEF/CLE', 1300),
        ('CM1', 'Littérature', 'La naissance d''une grande nation, CM1', 'ECLOSION', 1000),
        ('CM1', 'Anglais', 'English CM1', 'ASVA', 1900),
        ('CM1', 'Anglais', 'Livret d''activités d''Anglais, CM1', 'ASVA', 1150),
        ('CM1', 'Mathématiques', 'Mathématiques CM1', 'NATHAN', 1900),
        ('CM1', 'Mathématiques', 'Livret d''Activités de Mathématiques, CM1', 'NATHAN', 1300),
        ('CM1', 'Science et Technologie', 'Science et Technologie CM1', 'NMI Education', 1800),
        ('CM1', 'Sciences Humaines et Sociales', 'Sciences Humaines et Sociales CM1', 'EDICEF', 1850),
        ('CM1', 'TIC', 'TIC CM1 et CM2', 'MONDOUX', 1800),
        -- CM2
        ('CM2', 'Français', 'Champions en Français CM2', 'EDICEF/CLE', 1900),
        ('CM2', 'Français', 'Livret d''activités de Français CM2', 'EDICEF/CLE', 1300),
        ('CM2', 'Littérature', 'Une Nation bénie CM2', 'ECLOSION', 1000),
        ('CM2', 'Anglais', 'Anglais, CM2', 'COSMOS', 1900),
        ('CM2', 'Anglais', 'Livret d''activités d''Anglais, CM2', 'COSMOS', 1200),
        ('CM2', 'Mathématiques', 'Mathématiques CM2', 'AFRICA Education', 1900),
        ('CM2', 'Mathématiques', 'Livret d''Activités de Mathématiques, CM2', 'AFRICA Education', 1250),
        ('CM2', 'Science et Technologie', 'Science et Technologie CM2', 'COSMOS', 1800),
        ('CM2', 'TIC', 'TIC CM1 et CM2', 'MONDOUX', 1800),
        ('CM2', 'Sciences Humaines et Sociales', 'Sciences Humaines et Sociales CM2', 'EDICEF', 1850)
    ) AS s(classe, matiere, titre, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.is_active = true
    );

    -- ───── PRIMARY ANGLOPHONE — Class 1 → Class 6
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         editeur_livre, type_article, prix_officiel, devise, annee_scolaire, est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Primary', classe, matiere, titre,
           editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        -- Class 1
        ('Class 1', 'Handwriting', 'Handwriting Workbook, Class 1', 'ATEMEC', 1500),
        ('Class 1', 'Sound and Word Building', 'Sound and Word Building, Classes 1 and 2', 'ATEMEC', 1500),
        ('Class 1', 'English', 'Winners in English, Class 1', 'NMI Education', 1800),
        ('Class 1', 'English', 'Workbook of English, Class 1', 'NMI Education', 1000),
        ('Class 1', 'French', 'Parlons Français. Livre de l''élève 1', 'COSMOS', 1800),
        ('Class 1', 'French', 'Workbook of French, Class 1', 'COSMOS', 1100),
        ('Class 1', 'Mathematics', 'Innovative Mathematics, Class 1', 'DESTINY Prints', 1800),
        ('Class 1', 'Mathematics', 'Workbook of Mathematics, Class 1', 'DESTINY Prints', 1000),
        ('Class 1', 'Science and Technology', 'Standard Science and Technology', 'BECHACAM', 1500),
        ('Class 1', 'Social Studies', 'The Good Citizen. Pupil''s Book Classes 1 and 2', 'COSMOS', 1500),
        ('Class 1', 'ICT', 'Winners in ICT, Classes 1 and 2', 'NMI', 1500),
        -- Class 2
        ('Class 2', 'Handwriting', 'Emergence in Handwriting', 'MONDOUX', 1500),
        ('Class 2', 'Sound and Word Building', 'Sound and Word Building, Classes 1 and 2', 'ATEMEC', 1500),
        ('Class 2', 'English', 'Winners in English, Class 2', 'NMI Education', 1800),
        ('Class 2', 'English', 'Workbook of English, Class 2', 'NMI Education', 1100),
        ('Class 2', 'French', 'J''apprends le Français, 2', 'ANUCAM', 1800),
        ('Class 2', 'French', 'Workbook of French, Class 2', 'ANUCAM', 1100),
        ('Class 2', 'Mathematics', 'Winners in Mathematics', 'NMI Education', 1800),
        ('Class 2', 'Mathematics', 'Workbook of Mathematics, Class 2', 'NMI Education', 1150),
        ('Class 2', 'Science and Technology', 'Standard Science and Technology', 'BECHACAM', 1500),
        ('Class 2', 'Social Studies', 'The Good Citizen. Pupil''s Book Classes 1 and 2', 'COSMOS', 1500),
        ('Class 2', 'ICT', 'Winners Classes 1 and 2', 'NMI Education', 1500),
        -- Class 3
        ('Class 3', 'Sound and Word Building', 'Sound and Word Building, Classes 3 and 4', 'ATEMEC', 1500),
        ('Class 3', 'English Language', 'Winners in English Class 3', 'NMI Education', 1800),
        ('Class 3', 'English Language', 'Workbook of English, Class 3', 'NMI Education', 1150),
        ('Class 3', 'Literature', 'How are You Benjamin? Class 3', 'AFRICA Education', 1000),
        ('Class 3', 'French Language', 'French Class 3', 'AFRICA Education', 1700),
        ('Class 3', 'French Language', 'Workbook of French, Class 3', 'AFRICA Education', 1150),
        ('Class 3', 'Mathematics', 'Mathematics class 3', 'ATEMEC', 1800),
        ('Class 3', 'Mathematics', 'Workbook of Mathematics, Class 3', 'ATEMEC', 1150),
        ('Class 3', 'Science and Technology', 'Science and Technology Class 3', 'ATEMEC', 1600),
        ('Class 3', 'Social Studies', 'Social studies Class 3', 'GLOBAL Industries', 1800),
        ('Class 3', 'ICT', 'ICT Classes 3 and 4', 'ATEMEC', 1600),
        -- Class 4
        ('Class 4', 'English Language', 'Winner in English Class 4', 'NMI Education', 1800),
        ('Class 4', 'English Language', 'Workbook of English, Class 4', 'NMI Education', 1150),
        ('Class 4', 'Literature', 'Benjamin is not a little boy! Class 4', 'AFRICA Education', 1000),
        ('Class 4', 'French Language', 'French Class 4', 'AFRICA Education', 1700),
        ('Class 4', 'French Language', 'Workbook of French, Class 4', 'AFRICA Education', 1150),
        ('Class 4', 'Mathematics', 'Innovative Mathematics Class 4', 'DESTINY Print', 1800),
        ('Class 4', 'Mathematics', 'Workbook of Mathematics, Class 4', 'DESTINY Print', 1100),
        ('Class 4', 'Science and Technology', 'Science and Technology Class 4', 'METROPOLITAIN', 1600),
        ('Class 4', 'Social Studies', 'Winner in Social Studies Class 4', 'NMI Education', 1850),
        ('Class 4', 'ICT', 'ICT Classes 3 and 4', 'ATEMEC', 1600),
        -- Class 5
        ('Class 5', 'English Language', 'English Class 5', 'LONGHORN', 1900),
        ('Class 5', 'English Language', 'Workbook of English, Class 5', 'LONGHORN', 1150),
        ('Class 5', 'Literature', 'Stories and Wonders (Literature Class 5)', 'NMI Education', 1000),
        ('Class 5', 'French Language', 'French Class 5', 'AFRICA Education', 1900),
        ('Class 5', 'French Language', 'Workbook of French, Class 5', 'AFRICA Education', 1150),
        ('Class 5', 'Mathematics', 'Mathematics Class 5', 'BECHACAM', 1900),
        ('Class 5', 'Mathematics', 'Workbook of Mathematics, Class 5', 'BECHACAM', 1100),
        ('Class 5', 'Science and Technology', 'Winners in Science and Technology Class 5', 'NMI Education', 1800),
        ('Class 5', 'ICT', 'Information and Communication Technology', 'BECHACAM', 1800),
        ('Class 5', 'Social Studies', 'Winner in Social Studies Class 5', 'NMI Education', 1800),
        -- Class 6
        ('Class 6', 'English Language', 'English Class 6', 'BECHACAM', 1900),
        ('Class 6', 'English Language', 'Workbook of English, Class 6', 'BECHACAM', 1200),
        ('Class 6', 'Literature', 'Wake Up!', 'COSMOS', 1000),
        ('Class 6', 'French Language', 'French Class 6', 'AFRICA Education', 1900),
        ('Class 6', 'French Language', 'Workbook of French, Class 6', 'AFRICA Education', 1250),
        ('Class 6', 'Mathematics', 'Mathematics Class 6', 'BECHACAM', 1900),
        ('Class 6', 'Mathematics', 'Workbook of Mathematics, Class 6', 'BECHACAM', 1150),
        ('Class 6', 'Science and Technology', 'Science and Technology Class 6', 'LEGEND Publishers', 1800),
        ('Class 6', 'ICT', 'ICT Classes 5 and 6', 'BECHACAM', 1800),
        ('Class 6', 'Social Studies', 'Winner in Social Studies Classes 5 and 6', 'NMI Education', 1850)
    ) AS s(classe, matiere, titre, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.is_active = true
    );

    RAISE NOTICE '✅ Seed MINEDUB officiel 2025/2026 appliqué';
END $$;
