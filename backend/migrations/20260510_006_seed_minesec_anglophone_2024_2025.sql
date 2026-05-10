-- ============================================================================
-- Seed : Liste OFFICIELLE MINESEC anglophone 2024-2025 (Form 1-5)
-- Date : 2026-05-10
-- Source : OFFICIAL TEXTBOOK LIST 2024/2025 (signée mars 2024)
-- https://cameroongcerevision.com/wp-content/uploads/2024/08/official-Books-List-MINESEC-GSE2024-2025.pdf
-- ============================================================================
-- Sous-système anglophone Cameroun, secondaire général (1er + 2ème cycle).
-- Couvre Form 1, Form 2, Form 3 (les trois plus utilisés). Form 4-5 et A-Level
-- (Lower/Upper Sixth) à compléter dans une migration ultérieure quand la
-- liste 2025-2026 ou 2026-2027 sera publiée par MINESEC.
--
-- L'année 2024-2025 sert de provisoire — l'admin Yukpo peut dupliquer vers
-- 2025-2026 / 2026-2027 via le préchargement « année précédente » dans la
-- page Liste scolaire.
-- ============================================================================

DO $$
DECLARE
    v_etab_id INTEGER;
    v_annee TEXT := '2024-2025';
BEGIN
    SELECT id INTO v_etab_id
    FROM etablissements_scolaires
    WHERE pays = 'CM' AND is_national = true AND is_active = true
    LIMIT 1;

    IF v_etab_id IS NULL THEN
        RAISE NOTICE 'Pas d''établissement national CM trouvé — seed MINESEC anglophone skip';
        RETURN;
    END IF;

    -- ───────── FORM 1 (anglophone secondary, 1er cycle) ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Secondary (O Level)', 'Form 1', matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('English Language', 'Prime English Form 1', 'Egbe Besong, Mesei M.', 'NMI', 3800),
        ('Literature', 'Fireside Tales', 'Charlie-Bey', 'Peng Edition', 2000),
        ('Literature', 'An Introduction to Poetry, Vol. 1', 'Akem H., Ngwobella M.', 'Peng Edition', 2000),
        ('Literature', 'Clean School', 'NULL'::text, 'Shiloh Printers', 1200),
        ('French Language', 'French Form 1', 'Arrey Etta M.C. Bessong', 'Africa Education', 3000),
        ('History', 'History for Form 1', 'Dady, Sanama, Kuetche', 'Shiloh Printers', 1200),
        ('Geography', 'Geography for Competency Development Book 1', 'Sabum H. Dingbobga', 'Greenworld', 3000),
        ('Citizenship', 'The Patriotic Citizen Book 1', 'Shey D. Edie Nnane', 'MONDOUX', 1000),
        ('Mathematics', 'Integrated Secondary Mathematics Form 1', 'Nanje N., Chop L.', 'MONDOUX', 3600),
        ('Physics', 'Prime Physics Form 1', 'Ajeck K., Siepe R., W.', 'Grassroots', 3200),
        ('Chemistry', 'Elementary Chemistry for Form 1', 'Che Fuh, Munjam C.', 'Greenworld', 3000),
        ('Biology', 'Emerging Biology Book 1', 'Mbuli K., Shitteh G.', 'Greenworld', 4000),
        ('Computer Science', 'Computer Science for Form 1', 'Toulack K., Diang J.', 'Shiloh Printers', 3500),
        ('Home Economics', 'Contextual Home Economics Form 1', 'N.M. Brino', 'Grace Publisher', 4500)
    ) AS s(matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = 'Form 1' AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── FORM 2 ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Secondary (O Level)', 'Form 2', matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('English Language', 'Prime English Form 2', 'Egbe Besong, Mesei M.', 'NMI', 3800),
        ('Literature', 'Going Home', 'Ethel Joffi Molua E.', 'NYAA Publ.', 2000),
        ('Literature', 'An Introduction to Poetry, Vol. 2', 'Akem H., Ngwobella M.', 'Peng Edition', 2000),
        ('Literature', 'A Time to Reconcile', 'NULL'::text, 'Peacock', 1200),
        ('French Language', 'French Form 2', 'George Njimele', 'MONDOUX', 3500),
        ('History', 'Basic Keystones in History Form 2', 'Dady, Sanama, Kuetche', 'Shiloh Printers', 4000),
        ('Geography', 'Geography for Competency Development 2', 'Sabum H. Dingbobga', 'Greenworld', 4000),
        ('Citizenship', 'The Advocate for Citizenship Education Form 2', 'V. Kum Ngwoh', 'Grace Publ.', 1500),
        ('Pure Mathematics', 'Integrated Secondary Mathematics Book 2', 'Shey D. Edie Nnane', 'MONDOUX', 3500),
        ('Physics', 'Physics for Secondary Schools in Cameroon Form 2', 'Ajeck K., Siepe R.', 'Grassroots', 3500),
        ('Chemistry', 'Integrated Secondary Chemistry Form 2', 'Venantius Kum Ngwoh', 'Grace Pub.', 3500),
        ('Biology', 'Emerging Biology Book 2', 'Mbuli K., Shitteh G.', 'Greenworld', 4000),
        ('Home Economics', 'Contextual Home Economics Form 2', 'N.M. Brino', 'Grace Publisher', 4500),
        ('Computer Science', 'Computer for Form 2', 'Clinton Ojong', 'Global Publ.', 3500)
    ) AS s(matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = 'Form 2' AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── FORM 3 ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Secondary (O Level)', 'Form 3', matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('English Language', 'Innovative English', 'Ajeck Blaise T.', 'Grace Publ.', 3500),
        ('Literature', 'A Pen Kills', 'Toulack K., Diang J.', 'Grassroots', 1800),
        ('Literature', 'My Cameroon and other Poems', 'N.M. Brino', 'Grace Publ.', 1800),
        ('Literature', 'Inclusive Education: The Way to Go', 'Forndem F., Tangunu', 'NMI', 2500),
        ('French Language', 'French Form 3', 'Lucas Ntang Tasi', 'MONDOUX', 4000),
        ('Logic', 'The Essential Logic for Ordinary Level', 'Charlie Bey', 'NMI', 2500),
        ('History', 'An Integrated History since 1850 for Forms 3, 4, 5', 'Jator-Bangsi', 'Peng Edition', 4500),
        ('Geography', 'New 21st Century Physical, Human and Cameroon Geography', 'Douglas Achingale', 'NYAA Pub.', 6000),
        ('Geography', 'International Student Atlas (Forms III to V)', 'Patrick Wiegand', 'Oxford', 6000),
        ('Citizenship', 'Citizenship Education, Forms 3, 4 and 5', 'Munang R.C.', 'CATWA', 3000),
        ('Pure Mathematics', 'Prime Mathematics Form 3', 'Tasah, Ngew, Gene', 'NMI', 4200),
        ('Physics', 'Physics Form 3', 'Mpacko E. Ivo', 'CATWA', 4500),
        ('Chemistry', 'Understanding Chemistry, Forms 3, 4 and 5', 'NJIKI N.', 'Shiloh Printers', 6500),
        ('Biology', 'Understanding Biology Form 3', 'Mulu Tapong Sylvestre', 'Greenworld', 6500),
        ('Computer Science', 'Prime ICT Form 3', 'Mulu Tapong Sylvestre', 'TEWA Books', 4000),
        ('Food and Nutrition', 'Contextual Food and Nutrition for Form 3', 'N.M. Brino', 'Grace Publ.', 4500),
        ('Economics', 'Economics for GCE O/A Level and ITVE', 'Jua, Asunkeng, Bushu', 'CATWA', 7000),
        ('Commerce', 'Success in Commerce Forms 3, 4 and 5', 'Tasah, Ngew, Gene', 'NMI', 4500)
    ) AS s(matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = 'Form 3' AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── FORM 4 (sélection compacte — détails partiels en OCR) ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Secondary (O Level)', 'Form 4', matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('English Language', 'Mastering English', 'Egbe Besong Elvis', 'NMI', 3500),
        ('Literature', 'Silas Marner (Prose)', 'G. Eliot', 'OXFORD', 2500),
        ('Literature', 'As You Like It (Drama)', 'Shakespeare', 'Oxford', 6000),
        ('French', 'French Form 4', 'Dady, Sanama, Kuetche', 'ANUCAM', 4000),
        ('Logic', 'The Essential Logic for Ordinary Level', 'Ngwonam Denis', 'MONDOUX', 5000),
        ('History', 'An Integrated History since 1850 for Forms 3, 4, 5', 'Jator-Bangsi', 'Peng Edition', 4500),
        ('Geography', '21st Century Applied Physical Geography and Mapwork for Forms 4 and 5', 'Munang R.C.', 'Quality Print', 7000),
        ('Geology', 'Basic Geology for Colleges, Forms 3, 4 and 5', 'Nchangvi Sebastian', 'Grassroots', 4000),
        ('Citizenship', 'The Advocate for Citizenship Education, F. 4 and 5', 'V. Kum Ngwoh', 'Grace Publ.', 5500),
        ('Economics', 'Economics for GCE O/A Level and ITVE', 'Takwi Henry, T. Gene', 'TEWA Books', 9000),
        ('Commerce', 'New Ordinary Level Commerce for Cameroon', 'Venantius Kum Ngwoh', 'Grace Publ.', 5000),
        ('Pure Mathematics', 'Prime Mathematics Forms 4 and 5', 'Jua, Asunkeng, Bushu', 'CATWA', 6000),
        ('Add. Mathematics', 'Explaining Additional Mathematics', 'Bartholomew Bushu', 'CATWA', 4000),
        ('Physics', 'Standard Physics, Form 4', 'Tasah, Ngew, Gene', 'NMI', 5000),
        ('Chemistry', 'Understanding Chemistry Forms 3, 4 and 5', 'Atanga A.', 'NAARAT', 6000),
        ('Biology', 'Understanding Biology Vol. 1', 'Mulu Tapong Sylvestre', 'Greenworld', 8000),
        ('Food and Nutrition', 'Contextual Food and Nutrition for Forms 4 and 5', 'N.M. Brino', 'Grace Publ.', 4500)
    ) AS s(matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = 'Form 4' AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    -- ───────── FORM 5 (préparation GCE O Level) ─────────
    INSERT INTO programmes_scolaires
        (etablissement_id, pays, systeme_educatif, niveau, classe, matiere, titre_livre,
         auteur_livre, editeur_livre, type_article, prix_officiel, devise, annee_scolaire,
         est_obligatoire, quantite_defaut, is_active)
    SELECT v_etab_id, 'CM', 'anglophone', 'Secondary (O Level)', 'Form 5', matiere, titre,
           auteur, editeur, 'livre', prix, 'XAF', v_annee, true, 1, true
    FROM (VALUES
        ('English Language', 'Mastering English', 'Egbe Besong and others', 'NMI', 3500),
        ('Literature', 'Hard Times', 'Charles Dickens', 'ANUCAM', 4000),
        ('Literature', 'The Way of The World', 'William Congreve', 'ANUCAM', 4000),
        ('Literature', 'Death of a Salesman', 'Arthur Miller', 'ANUCAM', 1500),
        ('French', 'French Form 5', 'Molonta, Mounchikpou', 'Africa Education', 4000),
        ('Logic', 'The Essential Logic for Ordinary Level', 'Ngwonam Denis', 'Grassroots', 4000),
        ('History', 'An Integrated History since 1850 for Forms 3, 4, 5', 'Jator-Bangsi', 'Quality Print', 5300),
        ('Geography', '21st Century Applied Physical Geography and Mapwork for Forms 4 and 5', 'Munang R.C.', 'Quality Print', 9000),
        ('Geology', 'O Level Geology and School Practical Guide', 'Keneth Yoisimbom', 'Grassroots', 5500),
        ('Citizenship', 'The Advocate for Citizenship Education, F. 4 and 5', 'Venantius Kum Ngwoh', 'Grace Publ.', 2800),
        ('Economics', 'Masterpiece Economics', 'Forbeh N. and others', 'Grassroots', 5000),
        ('Commerce', 'New Ordinary Level Commerce for Cameroon', 'Bartholomew Bushu', 'CATWA', 4000),
        ('Pure Mathematics', 'Prime Mathematics Forms 4 and 5', 'Tasah, Ngew, Gene', 'NMI', 6000),
        ('Add. Mathematics', 'Explaining Additional Mathematics', 'Atanga A.', 'NAARAT', 4000),
        ('Physics', 'Prime Physics, Form 5', 'Che Fuh, Munjam C.', 'NMI', 6500),
        ('Chemistry', 'Understanding Chemistry', 'NJIKI N.', 'Shiloh', 6500),
        ('Biology', 'Understanding Biology, Forms 4 and 5 Vol. 2', 'Mulu Tapong Sylvestre', 'Greenworld', 8000)
    ) AS s(matiere, titre, auteur, editeur, prix)
    WHERE NOT EXISTS (
        SELECT 1 FROM programmes_scolaires p
        WHERE p.etablissement_id = v_etab_id AND p.annee_scolaire = v_annee
          AND p.classe = 'Form 5' AND p.matiere = s.matiere
          AND p.titre_livre = s.titre AND p.type_article = 'livre'
          AND p.is_active = true
    );

    RAISE NOTICE 'Seed MINESEC anglophone Form 1-5 (2024-2025) chargé pour etab national CM (id=%)', v_etab_id;
END $$;
