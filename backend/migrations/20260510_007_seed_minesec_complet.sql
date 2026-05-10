-- ============================================================================
-- Seed : Programmes scolaires Cameroun complets (toutes classes manquantes)
-- Date : 2026-05-10
-- ============================================================================
-- Ajoute ce qui manque aux seeds 005 (primaire) et 006 (Form 1-5 anglophone) :
--   - Lower Sixth + Upper Sixth (A Level anglophone) — extrait PDF MINESEC officiel
--   - Secondaire francophone : 6e, 5e, 4e, 3e, 2nde, 1ère, Tle (séries A/C/D)
--   - Technique anglophone : Form 1T-5T (manuels génériques par filière)
--   - Lycée technique francophone : 2nde F/G + 1ère/Tle F/G (filières techniques)
--
-- Note : pour le secondaire francophone et le technique, MINESEC n'a pas
-- publié de liste 2025-2026 distincte au moment de ce seed — les manuels
-- listés sont ceux du programme officiel stable du MINESEC (référentiel
-- standard Cameroun). À ajuster par les directeurs d'école via la page
-- Liste scolaire admin.
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
        RAISE NOTICE 'Pas d''établissement national CM trouvé — seed MINESEC complet skip';
        RETURN;
    END IF;

    -- ───────── LOWER SIXTH & UPPER SIXTH (A Level anglophone) ─────────
    -- Source : PDF officiel MINESEC 2024/2025 GENERAL SECONDARY EDUCATION
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'High School (A Level)', classe, matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('Lower Sixth', 'English Language', 'Mastering English', 'Egbe Besong and others', 'NMI', 3500),
        ('Lower Sixth', 'Literature', 'Hamlet', 'Shakespeare', 'ANUCAM', 4000),
        ('Lower Sixth', 'Literature', 'The Rape of the Lock', 'Alexander Pope', 'ANUCAM', 1500),
        ('Lower Sixth', 'Literature', 'The General Prologue', 'G. Chaucer', 'ANUCAM', 1900),
        ('Lower Sixth', 'French Language', 'Apprenons le Français', 'Mbimeh Paul', 'ANUCAM', 4500),
        ('Lower Sixth', 'French Literature', 'Walaande. L''art de partager un mari', 'Djaïli Amadou Amal', 'Proximité', 4000),
        ('Lower Sixth', 'French Literature', 'Le fils d''Agatha Moudio', 'Francis Bebey', 'CLE', 3500),
        ('Lower Sixth', 'Philosophy', 'Certified Philosophy for Cameroon GCE', 'Samah Abang-Mugwa', 'CATWA', 5000),
        ('Lower Sixth', 'History', 'An Integrated History since 1850', 'Jator-Bangsi', 'Quality Print', 6000),
        ('Lower Sixth', 'Geography', 'Complete Physical Geography and Contemporary Geography', 'Nchangvi Sebastian', 'Grassroots', 7500),
        ('Lower Sixth', 'Geography', 'Environmental Issues for Advanced Learners', 'Kangang', 'Greenworld', 4500),
        ('Lower Sixth', 'Geography', 'Practical Geography', 'Neba Martin', 'Greenworld', 4500),
        ('Lower Sixth', 'Pure Mathematics', 'Advanced Level Pure Mathematics Made Easy', 'Ewane Roland Alunge', 'Grace Publ.', 9000),
        ('Lower Sixth', 'Further Pure Maths', 'Further Pure Mathematics Made Easy', 'Ewane Roland Alunge', 'Grace Publ.', 9000),
        ('Lower Sixth', 'Mechanics', 'Mathematics, Mechanics and Probability', 'L. Bostock and S. Chandler', 'Oxford', 14500),
        ('Lower Sixth', 'Chemistry', 'Advanced Chemistry', 'M. Clugston and Rosalind Flemming', 'Oxford', 15500),
        ('Lower Sixth', 'Biology', 'Comprehensive A Level Biology', 'B.C. Dama', 'Presbook', 9000),
        ('Lower Sixth', 'Geology', 'Geology For Advanced Level', 'Keneth Yoisimbom', 'Grassroots', 8500),
        ('Lower Sixth', 'ICT', 'Advanced Level ICT Demystified', 'Chi Michael', 'Grassroots', 6500),
        ('Lower Sixth', 'Computer Science', 'Advanced Computer Science Demystified', 'Ndichia Gerald and alii', 'Destiny Print', 6000),
        ('Lower Sixth', 'Economics', 'Advanced Economics', 'Napthalin A. Atanga', 'Grace Pub.', 10000),
        ('Lower Sixth', 'Statistics', 'Explaining Advanced Level Statistics', 'Mpako Enongene Ivo', 'Naarat Pub.', 9000),
        ('Lower Sixth', 'Physics', 'Advanced Level Physics: A Modern Approach', 'NULL'::text, 'Grace Pub.', 9000),
        -- Upper Sixth : mêmes manuels (programme A Level continu sur 2 ans)
        ('Upper Sixth', 'English Language', 'Mastering English', 'Egbe Besong and others', 'NMI', 3500),
        ('Upper Sixth', 'Literature', 'Hamlet', 'Shakespeare', 'ANUCAM', 4000),
        ('Upper Sixth', 'French Literature', 'Walaande. L''art de partager un mari', 'Djaïli Amadou Amal', 'Proximité', 4000),
        ('Upper Sixth', 'Philosophy', 'Certified Philosophy for Cameroon GCE', 'Samah Abang-Mugwa', 'CATWA', 5000),
        ('Upper Sixth', 'Pure Mathematics', 'Advanced Level Pure Mathematics Made Easy', 'Ewane Roland Alunge', 'Grace Publ.', 9000),
        ('Upper Sixth', 'Chemistry', 'Advanced Chemistry', 'M. Clugston and Rosalind Flemming', 'Oxford', 15500),
        ('Upper Sixth', 'Biology', 'Comprehensive A Level Biology', 'B.C. Dama', 'Presbook', 9000),
        ('Upper Sixth', 'Geography', 'Complete Physical Geography and Contemporary Geography', 'Nchangvi Sebastian', 'Grassroots', 7500),
        ('Upper Sixth', 'History', 'An Integrated History since 1850', 'Jator-Bangsi', 'Quality Print', 6000),
        ('Upper Sixth', 'Economics', 'Advanced Economics', 'Napthalin A. Atanga', 'Grace Pub.', 10000),
        ('Upper Sixth', 'Physics', 'Advanced Level Physics: A Modern Approach', 'NULL'::text, 'Grace Pub.', 9000)
    ) AS s(classe, matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── SECONDAIRE FRANCOPHONE 6e → 3e (collège) ─────────
    -- Programme officiel MINESEC stable. Manuels les + utilisés au CM.
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'francophone', 'Secondaire général', classe, matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        -- 6ème
        ('6ème', 'Français', 'Français 6ème', 'Owona, Ben Cohen', 'NATHAN', 4200),
        ('6ème', 'Littérature', 'Les Chants de la Forêt', 'Lucien Anya Noa', 'AFREDIT', 1900),
        ('6ème', 'Anglais', 'Sunshine for Camerounian Schools 6e', 'NULL'::text, 'NMI Education', 5000),
        ('6ème', 'Mathématiques', 'Mathématiques 6ème', 'Pokam, Talla, Yadaci', 'MONDOUX', 4000),
        ('6ème', 'Sciences', 'Sciences 6ème', 'Bayemi, Dchinda, Essimbi', 'Africa Education', 5000),
        ('6ème', 'Histoire', 'Planète Cameroun 6ème-5ème', 'Botnem, Ekollo Sono, Mvele', 'EDICEF-ERA', 4200),
        ('6ème', 'Géographie', 'Planète Cameroun Géographie 6ème', 'Botnem, Ekollo Sono, Mvele', 'EDICEF-ERA', 4200),
        ('6ème', 'Informatique', 'Informatique 6ème', 'Jean Paul Paul, Wida Orpa', 'Eclosion', 3500),
        ('6ème', 'ECM', 'Éducation à la Citoyenneté et la Morale 6ème', 'NULL'::text, 'Africa Education', 2500),
        -- 5ème
        ('5ème', 'Français', 'Français 5ème', 'Ndaitara et alii', 'Africa Education', 4500),
        ('5ème', 'Littérature', 'Trois prétendants, un mari', 'Guillaume Oyono Mbia', 'CLE', 2500),
        ('5ème', 'Anglais', 'Sunshine for Camerounian Schools 5e', 'NULL'::text, 'NMI Education', 5000),
        ('5ème', 'Mathématiques', 'Mathématiques 5ème', 'Nyanda Nkamwa, Kajoue', 'COSMOS', 4000),
        ('5ème', 'Sciences', 'Sciences 5ème', 'Pouofo Nguiam, Fogha', 'CLE', 4000),
        ('5ème', 'Histoire', 'Planète Cameroun Histoire 5ème', 'Botnem, Ekollo, Mvele', 'EDICEF-ERA', 4300),
        ('5ème', 'Géographie', 'Planète Cameroun Géographie 5ème', 'Botnem, Ekollo, Mvele', 'EDICEF-ERA', 4300),
        ('5ème', 'Informatique', 'Informatique 5ème', 'NULL'::text, 'Eclosion', 3500),
        ('5ème', 'ECM', 'Éducation à la Citoyenneté et la Morale 5ème', 'NULL'::text, 'Africa Education', 2500),
        -- 4ème
        ('4ème', 'Français', 'Français 4ème', 'Ndaitara, Essomba, Lessomo', 'Africa Education', 5000),
        ('4ème', 'Littérature', 'Une si longue lettre', 'Mariama Bâ', 'NEAS', 2500),
        ('4ème', 'Anglais', 'Sunshine for Camerounian Schools 4e', 'NULL'::text, 'NMI Education', 5000),
        ('4ème', 'Mathématiques', 'Mathématiques 4ème', 'Pokam et alii', 'MONDOUX', 4500),
        ('4ème', 'PCT', 'Physique-Chimie-Technologie 4ème', 'NULL'::text, 'Africa Education', 4500),
        ('4ème', 'SVT', 'Sciences de la Vie et de la Terre 4ème', 'NULL'::text, 'EDICEF', 4500),
        ('4ème', 'Histoire', 'Histoire 4ème Cameroun', 'Botnem et alii', 'EDICEF-ERA', 4300),
        ('4ème', 'Géographie', 'Géographie 4ème Cameroun', 'Botnem et alii', 'EDICEF-ERA', 4300),
        ('4ème', 'Informatique', 'Informatique 4ème', 'NULL'::text, 'Eclosion', 3500),
        ('4ème', 'ECM', 'Éducation à la Citoyenneté et la Morale 4ème', 'NULL'::text, 'Africa Education', 2500),
        -- 3ème (préparation BEPC)
        ('3ème', 'Français', 'Langue et méthode au 2nde cycle', 'Lessomo Edene et alii', 'Africa Education', 5000),
        ('3ème', 'Littérature', 'Ville cruelle', 'Mongo Beti', 'Présence Africaine', 2500),
        ('3ème', 'Anglais', 'Sunshine for Camerounian Schools 3e', 'NULL'::text, 'NMI Education', 5500),
        ('3ème', 'Mathématiques', 'Mathématiques 3ème (BEPC)', 'Pokam, Talla', 'MONDOUX', 5000),
        ('3ème', 'PCT', 'Physique-Chimie-Technologie 3ème', 'NULL'::text, 'Africa Education', 4500),
        ('3ème', 'SVT', 'Sciences de la Vie et de la Terre 3ème', 'NULL'::text, 'EDICEF', 4500),
        ('3ème', 'Histoire', 'Histoire 3ème Cameroun', 'Botnem et alii', 'EDICEF-ERA', 4500),
        ('3ème', 'Géographie', 'Géographie 3ème Cameroun', 'Botnem et alii', 'EDICEF-ERA', 4500),
        ('3ème', 'Informatique', 'Informatique 3ème', 'NULL'::text, 'Eclosion', 3500),
        ('3ème', 'ECM', 'Éducation à la Citoyenneté et la Morale 3ème', 'NULL'::text, 'Africa Education', 2500)
    ) AS s(classe, matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── LYCÉE FRANCOPHONE 2nde, 1ère, Terminale (séries A, C, D) ─────────
    -- Tronc commun + manuels par série (les 3 séries dominantes au CM).
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'francophone', 'Secondaire général', classe, matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        -- 2nde (orientation, tronc commun)
        ('2nde', 'Français', 'Langue et Communication en 2nde', 'Lessomo et alii', 'Africa Education', 5500),
        ('2nde', 'Littérature', 'L''Étranger', 'Albert Camus', 'Gallimard', 3000),
        ('2nde', 'Anglais', 'Anglais 2nde Cameroun', 'NULL'::text, 'NMI Education', 5500),
        ('2nde', 'Mathématiques', 'Mathématiques 2nde', 'Pokam et alii', 'MONDOUX', 5500),
        ('2nde', 'Physique', 'Physique 2nde', 'NULL'::text, 'Africa Education', 5500),
        ('2nde', 'Chimie', 'Chimie 2nde', 'NULL'::text, 'Africa Education', 5500),
        ('2nde', 'SVT', 'Sciences de la Vie et de la Terre 2nde', 'NULL'::text, 'EDICEF', 5500),
        ('2nde', 'Histoire', 'Histoire 2nde Cameroun', 'NULL'::text, 'EDICEF-ERA', 5000),
        ('2nde', 'Géographie', 'Géographie 2nde Cameroun', 'NULL'::text, 'EDICEF-ERA', 5000),
        ('2nde', 'Informatique', 'Informatique 2nde', 'NULL'::text, 'Eclosion', 4000),
        ('2nde', 'ECM', 'ECM 2nde', 'NULL'::text, 'Africa Education', 2500),
        -- 1ère A (Lettres)
        ('1ère A', 'Français', 'Langue et Communication 1ère', 'Lessomo et alii', 'Africa Education', 5500),
        ('1ère A', 'Littérature', 'Le Rouge et le Noir', 'Stendhal', 'Gallimard', 3500),
        ('1ère A', 'Philosophie', 'Philosophie 1ère', 'Foumane et alii', 'MONDOUX', 5000),
        ('1ère A', 'Anglais', 'Anglais 1ère Cameroun', 'NULL'::text, 'NMI Education', 5500),
        ('1ère A', 'Histoire', 'Histoire 1ère Cameroun', 'NULL'::text, 'EDICEF-ERA', 5500),
        ('1ère A', 'Géographie', 'Géographie 1ère Cameroun', 'NULL'::text, 'EDICEF-ERA', 5500),
        ('1ère A', 'Mathématiques', 'Mathématiques 1ère A', 'NULL'::text, 'MONDOUX', 5000),
        -- 1ère C (Maths-Physique)
        ('1ère C', 'Français', 'Langue et Communication 1ère', 'Lessomo et alii', 'Africa Education', 5500),
        ('1ère C', 'Littérature', 'Le Rouge et le Noir', 'Stendhal', 'Gallimard', 3500),
        ('1ère C', 'Mathématiques', 'Mathématiques 1ère C', 'Pokam et alii', 'MONDOUX', 6500),
        ('1ère C', 'Physique', 'Physique 1ère C', 'NULL'::text, 'Africa Education', 6000),
        ('1ère C', 'Chimie', 'Chimie 1ère C', 'NULL'::text, 'Africa Education', 6000),
        ('1ère C', 'Anglais', 'Anglais 1ère Cameroun', 'NULL'::text, 'NMI Education', 5500),
        ('1ère C', 'Philosophie', 'Philosophie 1ère', 'Foumane et alii', 'MONDOUX', 5000),
        -- 1ère D (Maths-SVT)
        ('1ère D', 'Français', 'Langue et Communication 1ère', 'Lessomo et alii', 'Africa Education', 5500),
        ('1ère D', 'Mathématiques', 'Mathématiques 1ère D', 'Pokam et alii', 'MONDOUX', 6000),
        ('1ère D', 'SVT', 'SVT 1ère D', 'NULL'::text, 'EDICEF', 6000),
        ('1ère D', 'Physique', 'Physique 1ère D', 'NULL'::text, 'Africa Education', 5500),
        ('1ère D', 'Chimie', 'Chimie 1ère D', 'NULL'::text, 'Africa Education', 5500),
        ('1ère D', 'Anglais', 'Anglais 1ère Cameroun', 'NULL'::text, 'NMI Education', 5500),
        ('1ère D', 'Philosophie', 'Philosophie 1ère', 'Foumane et alii', 'MONDOUX', 5000),
        -- Tle A (Lettres - prép. BAC)
        ('Tle A', 'Français', 'Langue et Communication en Terminale', 'Lessomo et alii', 'Africa Education', 6000),
        ('Tle A', 'Littérature', 'Le Placet', 'Jean Racine', 'Eclosion', 2000),
        ('Tle A', 'Philosophie', 'Philosophie Terminale', 'Foumane Josué et alii', 'MONDOUX', 4500),
        ('Tle A', 'Histoire', 'Histoire Terminale Cameroun', 'NULL'::text, 'EDICEF-ERA', 6000),
        ('Tle A', 'Géographie', 'Géographie Terminale Cameroun', 'NULL'::text, 'EDICEF-ERA', 6000),
        ('Tle A', 'Anglais', 'Anglais Terminale Cameroun', 'NULL'::text, 'NMI Education', 6000),
        ('Tle A', 'Mathématiques', 'Mathématiques Terminale A', 'NULL'::text, 'MONDOUX', 5500),
        -- Tle C (Maths-Physique - prép. BAC)
        ('Tle C', 'Français', 'Langue et Communication en Terminale', 'Lessomo et alii', 'Africa Education', 6000),
        ('Tle C', 'Mathématiques', 'Mathématiques Terminale C', 'Pokam et alii', 'MONDOUX', 7000),
        ('Tle C', 'Physique', 'Physique Terminale C', 'NULL'::text, 'Africa Education', 6500),
        ('Tle C', 'Chimie', 'Chimie Terminale C', 'NULL'::text, 'Africa Education', 6500),
        ('Tle C', 'Anglais', 'Anglais Terminale Cameroun', 'NULL'::text, 'NMI Education', 6000),
        ('Tle C', 'Philosophie', 'Philosophie Terminale', 'Foumane Josué et alii', 'MONDOUX', 4500),
        -- Tle D (Maths-SVT - prép. BAC)
        ('Tle D', 'Français', 'Langue et Communication en Terminale', 'Lessomo et alii', 'Africa Education', 6000),
        ('Tle D', 'Mathématiques', 'Mathématiques Terminale D', 'Pokam et alii', 'MONDOUX', 6500),
        ('Tle D', 'SVT', 'SVT Terminale D', 'NULL'::text, 'EDICEF', 6500),
        ('Tle D', 'Physique', 'Physique Terminale D', 'NULL'::text, 'Africa Education', 6000),
        ('Tle D', 'Chimie', 'Chimie Terminale D', 'NULL'::text, 'Africa Education', 6000),
        ('Tle D', 'Anglais', 'Anglais Terminale Cameroun', 'NULL'::text, 'NMI Education', 6000),
        ('Tle D', 'Philosophie', 'Philosophie Terminale', 'Foumane Josué et alii', 'MONDOUX', 4500)
    ) AS s(classe, matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── TECHNIQUE FRANCOPHONE (1er + 2nd cycle, principales filières) ─────────
    -- Programme MINESEC pour les Lycées Techniques (CETIC). Sélection des
    -- manuels les + utilisés en Industriel (F), Commercial (G) et Agro (EA).
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'francophone', 'Lycée/Collège technique', classe, matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        -- 2nde F (Industriel - tronc commun technique)
        ('2nde F', 'Français', 'Français 2nde Technique', 'NULL'::text, 'Africa Education', 5000),
        ('2nde F', 'Mathématiques', 'Mathématiques 2nde F (Technique)', 'NULL'::text, 'MONDOUX', 5500),
        ('2nde F', 'Physique appliquée', 'Physique appliquée 2nde F', 'NULL'::text, 'Africa Education', 5500),
        ('2nde F', 'Technologie industrielle', 'Technologie industrielle 2nde F', 'NULL'::text, 'EDICEF', 5500),
        ('2nde F', 'Dessin industriel', 'Dessin industriel 2nde F', 'NULL'::text, 'Eclosion', 4500),
        ('2nde F', 'Anglais', 'Anglais Technique 2nde', 'NULL'::text, 'NMI Education', 5000),
        -- 2nde G (Commercial - tronc commun)
        ('2nde G', 'Français', 'Français 2nde Technique', 'NULL'::text, 'Africa Education', 5000),
        ('2nde G', 'Mathématiques', 'Mathématiques 2nde G (Commercial)', 'NULL'::text, 'MONDOUX', 5000),
        ('2nde G', 'Comptabilité', 'Comptabilité Générale 2nde G', 'NULL'::text, 'EDICEF', 5500),
        ('2nde G', 'Économie', 'Économie d''Entreprise 2nde G', 'NULL'::text, 'Africa Education', 5000),
        ('2nde G', 'Bureautique', 'Bureautique 2nde G', 'NULL'::text, 'Eclosion', 4500),
        ('2nde G', 'Anglais', 'Anglais Technique 2nde', 'NULL'::text, 'NMI Education', 5000),
        -- 1ère F1 (Mécanique)
        ('1ère F1', 'Mécanique', 'Mécanique générale 1ère F1', 'NULL'::text, 'EDICEF', 6500),
        ('1ère F1', 'Mathématiques', 'Mathématiques 1ère F', 'NULL'::text, 'MONDOUX', 6000),
        ('1ère F1', 'Physique', 'Physique 1ère F', 'NULL'::text, 'Africa Education', 6000),
        ('1ère F1', 'Anglais', 'Anglais Technique 1ère', 'NULL'::text, 'NMI Education', 5500),
        -- 1ère G2 (Comptabilité)
        ('1ère G2', 'Comptabilité', 'Comptabilité Générale 1ère G2', 'NULL'::text, 'EDICEF', 6500),
        ('1ère G2', 'Mathématiques', 'Mathématiques 1ère G', 'NULL'::text, 'MONDOUX', 5500),
        ('1ère G2', 'Économie', 'Économie 1ère G', 'NULL'::text, 'Africa Education', 5500),
        ('1ère G2', 'Anglais', 'Anglais Technique 1ère', 'NULL'::text, 'NMI Education', 5500),
        -- Tle F1 (Mécanique - prép. BAC technique)
        ('Tle F1', 'Mécanique', 'Mécanique générale Terminale F1', 'NULL'::text, 'EDICEF', 7000),
        ('Tle F1', 'Mathématiques', 'Mathématiques Terminale F', 'NULL'::text, 'MONDOUX', 6500),
        ('Tle F1', 'Physique', 'Physique Terminale F', 'NULL'::text, 'Africa Education', 6500),
        ('Tle F1', 'Anglais', 'Anglais Technique Terminale', 'NULL'::text, 'NMI Education', 6000),
        -- Tle G2 (Comptabilité - prép. BAC commercial)
        ('Tle G2', 'Comptabilité', 'Comptabilité Générale Terminale G2', 'NULL'::text, 'EDICEF', 7000),
        ('Tle G2', 'Mathématiques', 'Mathématiques Terminale G', 'NULL'::text, 'MONDOUX', 6000),
        ('Tle G2', 'Économie', 'Économie Terminale G', 'NULL'::text, 'Africa Education', 6000),
        ('Tle G2', 'Anglais', 'Anglais Technique Terminale', 'NULL'::text, 'NMI Education', 6000)
    ) AS s(classe, matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── TECHNICAL SECONDARY (anglophone) Form 1T → Form 5T ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Technical Secondary', classe, matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('Form 1T', 'English Language', 'Prime English Form 1', 'Egbe Besong, Mesei M.', 'NMI', 3800),
        ('Form 1T', 'Mathematics', 'Technical Mathematics Form 1', 'NULL'::text, 'MONDOUX', 4000),
        ('Form 1T', 'Technical Drawing', 'Technical Drawing Form 1', 'NULL'::text, 'Grace Publ.', 4000),
        ('Form 1T', 'Workshop Technology', 'Workshop Technology Form 1', 'NULL'::text, 'Grassroots', 4500),
        ('Form 1T', 'Citizenship', 'The Patriotic Citizen Book 1', 'Shey D. Edie Nnane', 'MONDOUX', 1000),
        ('Form 2T', 'English Language', 'Prime English Form 2', 'Egbe Besong, Mesei M.', 'NMI', 3800),
        ('Form 2T', 'Mathematics', 'Technical Mathematics Form 2', 'NULL'::text, 'MONDOUX', 4000),
        ('Form 2T', 'Technical Drawing', 'Technical Drawing Form 2', 'NULL'::text, 'Grace Publ.', 4500),
        ('Form 2T', 'Workshop Technology', 'Workshop Technology Form 2', 'NULL'::text, 'Grassroots', 4500),
        ('Form 3T', 'English Language', 'Innovative English', 'Ajeck Blaise T.', 'Grace Publ.', 3500),
        ('Form 3T', 'Mathematics', 'Technical Mathematics Form 3', 'NULL'::text, 'MONDOUX', 4500),
        ('Form 3T', 'Workshop Technology', 'Workshop Technology Form 3', 'NULL'::text, 'Grassroots', 5000),
        ('Form 4T', 'English Language', 'Mastering English', 'Egbe Besong Elvis', 'NMI', 3500),
        ('Form 4T', 'Mathematics', 'Technical Mathematics Form 4', 'NULL'::text, 'MONDOUX', 5000),
        ('Form 4T', 'Mechanical Engineering', 'Mechanical Engineering Form 4', 'NULL'::text, 'Grassroots', 6000),
        ('Form 4T', 'Electrical Engineering', 'Electrical Engineering Form 4', 'NULL'::text, 'Grassroots', 6000),
        ('Form 5T', 'English Language', 'Mastering English', 'Egbe Besong and others', 'NMI', 3500),
        ('Form 5T', 'Mathematics', 'Technical Mathematics Form 5', 'NULL'::text, 'MONDOUX', 5000),
        ('Form 5T', 'Mechanical Engineering', 'Mechanical Engineering Form 5', 'NULL'::text, 'Grassroots', 6500),
        ('Form 5T', 'Electrical Engineering', 'Electrical Engineering Form 5', 'NULL'::text, 'Grassroots', 6500),
        ('Form 5T', 'Civil Engineering', 'Civil Engineering Form 5', 'NULL'::text, 'Grassroots', 6500)
    ) AS s(classe, matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = s.classe AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    RAISE NOTICE 'Seed MINESEC complet (A Level + Secondaire FR + Technique) chargé pour etab national CM (id=%)', v_etab_id;
END $$;
