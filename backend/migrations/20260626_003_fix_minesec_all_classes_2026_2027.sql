-- =============================================================================
-- Corrections MINESEC ESGF + ESGA — toutes classes secondaires, année 2026-2027
-- =============================================================================
-- Date : 2026-06-26
-- Sources :
--   * PDF "liste manuels scolaires 2026-2027 ESGF" — signé 09 JUIN 2026
--     par MINESEC (Pr. Nalova Lyonga) — couvre 5ème → Tle francophone
--   * PDF "liste manuels scolaires 2026-2027 ESGA" — signé 09 JUIN 2026
--     N°04/26/MINESEC/CAB — couvre Form 1 → Upper Sixth anglophone
--
-- Le clone 2025-2026→2026-2027 (migration 20260626_001) a recopié les
-- valeurs de l'an dernier. Le PDF officiel 2026-2027 introduit pour
-- certaines disciplines de nouveaux titres / éditeurs / prix. On aligne.
--
-- Stratégie :
--   - UPDATE ciblé par (classe, matière) sur l'année 2026-2027 uniquement
--   - On laisse les choix "littérature multi-livres" et "langues étrangères"
--     intacts (souvent multi-titres optionnels difficiles à matcher 1:1).
--     Les corrections portent sur le manuel obligatoire principal de
--     chaque discipline.
-- =============================================================================

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — 5ème                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='Anglais 5ème', editeur_livre='Africa Education', auteur_livre='Ombga, Enyegue, Mbeudeu', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='5ème' AND systeme_educatif='francophone' AND matiere='Anglais';
UPDATE programmes_scolaires SET titre_livre='Education à la citoyenneté 6ème/5ème', editeur_livre='MONDOUX', auteur_livre='Kouna Bah, Ayuk Ayuk, Ndolo', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='5ème' AND systeme_educatif='francophone' AND matiere IN ('ECM','Education à la citoyenneté');
UPDATE programmes_scolaires SET titre_livre='Planète Cameroun 6ème-5ème', editeur_livre='Hatier-ERA', auteur_livre='Botnem, Ekollo Sono, Mvele', prix_officiel=4200
 WHERE annee_scolaire='2026-2027' AND classe='5ème' AND systeme_educatif='francophone' AND matiere='Histoire';
UPDATE programmes_scolaires SET prix_officiel=4200
 WHERE annee_scolaire='2026-2027' AND classe='5ème' AND systeme_educatif='francophone' AND matiere='Mathématiques';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — 4ème                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='L''Eveil en Anglais 4ème', editeur_livre='NMI', auteur_livre='Proboh, Etame, Ngwang', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Anglais';
UPDATE programmes_scolaires SET titre_livre='Education à la citoyenneté 4ème-3ème', editeur_livre='MONDOUX', auteur_livre='Kouna Bah, Ayuk Ayuk, Ndolo', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere IN ('ECM','Education à la citoyenneté');
UPDATE programmes_scolaires SET titre_livre='Planète Cameroun 4ème', editeur_livre='Hatier-ERA', auteur_livre='Botnem, Ekollo Sono, Mvele', prix_officiel=3700
 WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Histoire';
UPDATE programmes_scolaires SET titre_livre='Planète Cameroun 4ème', editeur_livre='EDICEF-ERA', auteur_livre='Botnem, Ekollo Sono, Mvele', prix_officiel=4300
 WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Géographie';
UPDATE programmes_scolaires SET titre_livre='Mathématiques 4ème', editeur_livre='Belles Lettres', auteur_livre='Tchoutio, Tchouaffi, Bona', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Mathématiques';
UPDATE programmes_scolaires SET titre_livre='SVTEEHB 4ème', editeur_livre='MONDOUX', auteur_livre='Mondoman, Ntock Beng', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere IN ('SVT','SVTEEHB');
UPDATE programmes_scolaires SET titre_livre='Physique, Chimie, Technologie 4ème', editeur_livre='NMI', auteur_livre='Tagni, Abéga, Ango', prix_officiel=4200
 WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='PCT';
UPDATE programmes_scolaires SET prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Informatique';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — 3ème                                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='L''Eveil en Anglais', editeur_livre='NMI', auteur_livre='Proboh, Etame, Ngwang', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Anglais';
UPDATE programmes_scolaires SET titre_livre='Education à la citoyenneté 4ème-3ème', editeur_livre='MONDOUX', auteur_livre='Kouna Bah, Ayuk Ayuk, Ndolo', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere IN ('ECM','Education à la citoyenneté');
UPDATE programmes_scolaires SET titre_livre='Planète Cameroun 3ème', editeur_livre='Hatier-ERA', auteur_livre='Botnem, Ekollo Sono, Mvele', prix_officiel=3700
 WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Histoire';
UPDATE programmes_scolaires SET titre_livre='Planète Cameroun 3ème', editeur_livre='EDICEF-ERA', auteur_livre='Botnem, Ekollo Sono, Mvele', prix_officiel=4300
 WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Géographie';
UPDATE programmes_scolaires SET titre_livre='Mathématiques 3ème', editeur_livre='D and L', auteur_livre='Djapa Oumbo, Nguele', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Mathématiques';
UPDATE programmes_scolaires SET titre_livre='SVTEEHB 3ème', editeur_livre='Africa Education', auteur_livre='Bayemi, Dchinda', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere IN ('SVT','SVTEEHB');
UPDATE programmes_scolaires SET titre_livre='Physique, Chimie, Technologie 3ème', editeur_livre='Wisdom', auteur_livre='Nsa, Peha, Heumou, Kesso', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='PCT';
UPDATE programmes_scolaires SET prix_officiel=4000, auteur_livre='Jean Paul Paul, Wida Orpa', editeur_livre='Eclosion'
 WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Informatique';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — 2nde Matières Communes (toutes séries)                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='L''Excellence en philosophie', editeur_livre='NMI', auteur_livre='Tiako Youadjeu, Miyoupo', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe LIKE '2nde%' AND systeme_educatif='francophone' AND matiere='Philosophie';
UPDATE programmes_scolaires SET titre_livre='Langue et Méthode au 2nde cycle', editeur_livre='Africa Education', auteur_livre='Lessomo Edene et alii', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe LIKE '2nde%' AND systeme_educatif='francophone' AND matiere='Français';
UPDATE programmes_scolaires SET titre_livre='Interactions in English', editeur_livre='CAMBRIDGE', auteur_livre='Dorothy Forbin et alii', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe LIKE '2nde%' AND systeme_educatif='francophone' AND matiere='Anglais';
UPDATE programmes_scolaires SET titre_livre='Le Monde. De la préhistoire au Moyen-Age', editeur_livre='CLE', auteur_livre='Daniel Abwa, S. Mani Noah', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe LIKE '2nde%' AND systeme_educatif='francophone' AND matiere='Histoire';
UPDATE programmes_scolaires SET titre_livre='Education à la citoyenneté et à la morale', editeur_livre='MONDOUX', auteur_livre='Kouna Bah Jean Didier et alii', prix_officiel=3000
 WHERE annee_scolaire='2026-2027' AND classe LIKE '2nde%' AND systeme_educatif='francophone' AND matiere IN ('ECM','Education à la citoyenneté');

-- 2nde A et SES
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Mathématiques', editeur_livre='NMI', auteur_livre='V. Tegninko Valentin et autres', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='2nde A' AND systeme_educatif='francophone' AND matiere='Mathématiques';
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Informatique', editeur_livre='NMI', auteur_livre='Badane Djonwajar et al.', prix_officiel=3100
 WHERE annee_scolaire='2026-2027' AND classe='2nde A' AND systeme_educatif='francophone' AND matiere='Informatique';

-- 2nde C et E
UPDATE programmes_scolaires SET titre_livre='SVTEEHB', editeur_livre='CLE', auteur_livre='Fogha, Pouofo et autres', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='2nde C' AND systeme_educatif='francophone' AND matiere IN ('SVT','SVTEEHB');
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Physique-Chimie', editeur_livre='NMI', auteur_livre='Ango Yves P., Tagni Jérémie', prix_officiel=6000
 WHERE annee_scolaire='2026-2027' AND classe='2nde C' AND systeme_educatif='francophone' AND matiere IN ('Physique','Chimie','Physique-Chimie');
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Informatique', editeur_livre='NMI', auteur_livre='Badane Djonwajar et al.', prix_officiel=3100
 WHERE annee_scolaire='2026-2027' AND classe='2nde C' AND systeme_educatif='francophone' AND matiere='Informatique';

-- 2nde — Mathématiques générique (clone n'a peut-être pas créé les séries)
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Mathématiques', editeur_livre='NMI', auteur_livre='Tegninko V., Sienlinou D', prix_officiel=5500
 WHERE annee_scolaire='2026-2027' AND classe='2nde' AND systeme_educatif='francophone' AND matiere='Mathématiques';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — 1ères Matières Communes                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='Langue et Méthode au 2nde cycle', editeur_livre='AFRIC''EDUC', auteur_livre='Lessomo Edene et autres', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe LIKE '1ère%' AND systeme_educatif='francophone' AND matiere='Français';
UPDATE programmes_scolaires SET titre_livre='Interactions in English', editeur_livre='CAMBRIDGE', auteur_livre='Dorothy Forbin and others', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe LIKE '1ère%' AND systeme_educatif='francophone' AND matiere='Anglais';
UPDATE programmes_scolaires SET titre_livre='Le Monde. De la fin du XVIè siècle à 1939', editeur_livre='CLE', auteur_livre='Daniel Abwa, S. Mani Noah', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe LIKE '1ère%' AND systeme_educatif='francophone' AND matiere='Histoire';
UPDATE programmes_scolaires SET titre_livre='Education à la citoyenneté 1ères', editeur_livre='MONDOUX', auteur_livre='Kouna Bah Jean et autres', prix_officiel=3000
 WHERE annee_scolaire='2026-2027' AND classe LIKE '1ère%' AND systeme_educatif='francophone' AND matiere IN ('ECM','Education à la citoyenneté');

-- 1ère A et SES
UPDATE programmes_scolaires SET titre_livre='Philosophie. 1ères littéraires', editeur_livre='MONDOUX', auteur_livre='Foumane Josué D. et autres', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='1ère A' AND systeme_educatif='francophone' AND matiere='Philosophie';
UPDATE programmes_scolaires SET titre_livre='Majors en Mathématiques', editeur_livre='ASVA', auteur_livre='Nkeng Essombo et autres', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='1ère A' AND systeme_educatif='francophone' AND matiere='Mathématiques';

-- 1ère C et E
UPDATE programmes_scolaires SET titre_livre='Philosophie 1ères Scientifiques', editeur_livre='MONDOUX', auteur_livre='Foumane Josué D. et autres', prix_officiel=3000
 WHERE annee_scolaire='2026-2027' AND classe='1ère C' AND systeme_educatif='francophone' AND matiere='Philosophie';
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Mathématiques', editeur_livre='NMI', auteur_livre='Victor Tegninko et autres', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe='1ère C' AND systeme_educatif='francophone' AND matiere='Mathématiques';
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Physique 1ère C et D', editeur_livre='NMI', auteur_livre='Tagni Jérémie, Ango Yves', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='1ère C' AND systeme_educatif='francophone' AND matiere='Physique';
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Chimie', editeur_livre='NMI', auteur_livre='Ango Yves, Abega F. et autres', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='1ère C' AND systeme_educatif='francophone' AND matiere='Chimie';

-- 1ère D et TI
UPDATE programmes_scolaires SET titre_livre='Philosophie 1ères Scientifiques', editeur_livre='MONDOUX', auteur_livre='Foumane Josué D. et autres', prix_officiel=3000
 WHERE annee_scolaire='2026-2027' AND classe='1ère D' AND systeme_educatif='francophone' AND matiere='Philosophie';
UPDATE programmes_scolaires SET titre_livre='Mathématiques 1ère D et TI', editeur_livre='CEPER', auteur_livre='Nkeng Essombo et autres', prix_officiel=5500
 WHERE annee_scolaire='2026-2027' AND classe='1ère D' AND systeme_educatif='francophone' AND matiere='Mathématiques';
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Chimie', editeur_livre='NMI', auteur_livre='Ango Yves P., Abega F. et alii', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='1ère D' AND systeme_educatif='francophone' AND matiere='Chimie';
UPDATE programmes_scolaires SET titre_livre='SVTEEHB', editeur_livre='CLE', auteur_livre='Fogha Zaboue, Mbia Ombolo', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe='1ère D' AND systeme_educatif='francophone' AND matiere IN ('SVT','SVTEEHB');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — Terminales (Tle Matières Communes)                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='Langue et méthode au 2nd cycle', editeur_livre='AFRIC''EDUC', auteur_livre='Lessomo Edene et autres', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe LIKE 'Tle%' AND systeme_educatif='francophone' AND matiere='Français';
UPDATE programmes_scolaires SET titre_livre='Interaction in English', editeur_livre='CAMBRIDGE', auteur_livre='Dorothy Forbin and others', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe LIKE 'Tle%' AND systeme_educatif='francophone' AND matiere='Anglais';
UPDATE programmes_scolaires SET titre_livre='Histoire Tle', editeur_livre='MONDOUX', auteur_livre='Kouna Bah, Ayuk Ayuk', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe LIKE 'Tle%' AND systeme_educatif='francophone' AND matiere='Histoire';
UPDATE programmes_scolaires SET titre_livre='Education à la citoyenneté et à la morale', editeur_livre='MONDOUX', auteur_livre='Kouna Bah Jean D. et autres', prix_officiel=3900
 WHERE annee_scolaire='2026-2027' AND classe LIKE 'Tle%' AND systeme_educatif='francophone' AND matiere IN ('ECM','Education à la citoyenneté');

-- Tle A et SES
UPDATE programmes_scolaires SET titre_livre='Emergeons en Philosophie. Tles littéraires', editeur_livre='MONDOUX', auteur_livre='Eboni, Nguefack et Ambombo', prix_officiel=7800
 WHERE annee_scolaire='2026-2027' AND classe='Tle A' AND systeme_educatif='francophone' AND matiere='Philosophie';
UPDATE programmes_scolaires SET titre_livre='Majors en Mathématiques', editeur_livre='ASVA', auteur_livre='Elandi E. R., Fouda S., Nkoule', prix_officiel=3900
 WHERE annee_scolaire='2026-2027' AND classe='Tle A' AND systeme_educatif='francophone' AND matiere='Mathématiques';

-- Tle C et E
UPDATE programmes_scolaires SET titre_livre='Emergeons en Philosophie. Tles C et D', editeur_livre='MONDOUX', auteur_livre='Nguekack, Eboni et Ambombo', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='Tle C' AND systeme_educatif='francophone' AND matiere='Philosophie';
UPDATE programmes_scolaires SET titre_livre='Emergeons en Mathématiques', editeur_livre='MONDOUX', auteur_livre='Pokam, Talla Nde et Ndjip N.', prix_officiel=6000
 WHERE annee_scolaire='2026-2027' AND classe='Tle C' AND systeme_educatif='francophone' AND matiere='Mathématiques';
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Physique', editeur_livre='NMI', auteur_livre='Ango Y., Tagni J. et autres', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe='Tle C' AND systeme_educatif='francophone' AND matiere='Physique';
UPDATE programmes_scolaires SET titre_livre='Chimie Terminales C, D et E', editeur_livre='NMI', auteur_livre='Ango Y., Abega F. et autres', prix_officiel=5500
 WHERE annee_scolaire='2026-2027' AND classe='Tle C' AND systeme_educatif='francophone' AND matiere='Chimie';

-- Tle D et TI
UPDATE programmes_scolaires SET titre_livre='Emergeons en Philosophie. Tles C et D', editeur_livre='MONDOUX', auteur_livre='Nguekack, Eboni et Ambombo', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='Tle D' AND systeme_educatif='francophone' AND matiere='Philosophie';
UPDATE programmes_scolaires SET titre_livre='Emergeons en Mathématiques', editeur_livre='MONDOUX', auteur_livre='Pokam, Talla Nde et Ndjip', prix_officiel=5500
 WHERE annee_scolaire='2026-2027' AND classe='Tle D' AND systeme_educatif='francophone' AND matiere='Mathématiques';
UPDATE programmes_scolaires SET titre_livre='L''Excellence en Physique', editeur_livre='NMI', auteur_livre='Ango Y., Tagni J. et autres', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe='Tle D' AND systeme_educatif='francophone' AND matiere='Physique';
UPDATE programmes_scolaires SET titre_livre='Chimie Terminales C, D et E', editeur_livre='NMI', auteur_livre='Ango Y., Abega F. et autres', prix_officiel=5500
 WHERE annee_scolaire='2026-2027' AND classe='Tle D' AND systeme_educatif='francophone' AND matiere='Chimie';
UPDATE programmes_scolaires SET titre_livre='SVTEEHB, Tle D', editeur_livre='CLE', auteur_livre='Njoumbe/Fogha, Pouofo', prix_officiel=8000
 WHERE annee_scolaire='2026-2027' AND classe='Tle D' AND systeme_educatif='francophone' AND matiere IN ('SVT','SVTEEHB');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGA — Form 1                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Form 1 : peu de changement, juste éditeurs/auteurs sur 4-5 disciplines
UPDATE programmes_scolaires SET editeur_livre='Shiloh Printers', auteur_livre='Mbuli k., Shitteh G., TEWA Books'
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='Chemistry';
UPDATE programmes_scolaires SET editeur_livre='TEWA Books', auteur_livre='Mbuli k., Shitteh G.', prix_officiel=3000
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='Chemistry';
UPDATE programmes_scolaires SET titre_livre='French Form 1', editeur_livre='MONDOUX', auteur_livre='Dady, Sanama, Kuetche', prix_officiel=3600
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='French Language';
UPDATE programmes_scolaires SET editeur_livre='Grassroots', auteur_livre='Sabum H. Dingbogba', prix_officiel=3200
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='History';
UPDATE programmes_scolaires SET editeur_livre='Greenworld', auteur_livre='Nanje N., Chop L., She', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='Citizenship';
UPDATE programmes_scolaires SET editeur_livre='Shiloh Printers', auteur_livre='Ajeck K., Siepe R., W.', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='Mathematics';
UPDATE programmes_scolaires SET editeur_livre='NMI', auteur_livre='Che Fuh, Munjam C.', prix_officiel=3200
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='Physics';
UPDATE programmes_scolaires SET editeur_livre='Global Publisher', auteur_livre='Toulack K., Diang J.', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='Biology';
UPDATE programmes_scolaires SET editeur_livre='Grassroots', auteur_livre='Forndem F., Tangunu', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='Computer Science';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGA — Form 2                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET editeur_livre='Grace Publ.', auteur_livre='V. Kum Ngwoh', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe='Form 2' AND systeme_educatif='anglophone' AND matiere='History';
UPDATE programmes_scolaires SET editeur_livre='Grace Pub.', auteur_livre='Venantius Kum Ngwoh', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='Form 2' AND systeme_educatif='anglophone' AND matiere='Citizenship';
UPDATE programmes_scolaires SET editeur_livre='Longhorn', auteur_livre='Clinton Ojong', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='Form 2' AND systeme_educatif='anglophone' AND matiere='Physics';
UPDATE programmes_scolaires SET titre_livre='Integrated Secondary Chemistry Form 2', editeur_livre='Dominion', auteur_livre='Ajeck Blaise T.', prix_officiel=3000
 WHERE annee_scolaire='2026-2027' AND classe='Form 2' AND systeme_educatif='anglophone' AND matiere='Chemistry';
UPDATE programmes_scolaires SET editeur_livre='Global Publ.', auteur_livre='Toulack K., Diang J.', prix_officiel=3000
 WHERE annee_scolaire='2026-2027' AND classe='Form 2' AND systeme_educatif='anglophone' AND matiere='Biology';
UPDATE programmes_scolaires SET titre_livre='Computer Science for Form 2', editeur_livre='Grassroots', auteur_livre='Forndem F., Tangunu', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='Form 2' AND systeme_educatif='anglophone' AND matiere='Computer Science';
UPDATE programmes_scolaires SET editeur_livre='Shiloh Printers', auteur_livre='Ajeck K., Siepe R., W.', prix_officiel=3500
 WHERE annee_scolaire='2026-2027' AND classe='Form 2' AND systeme_educatif='anglophone' AND matiere IN ('Mathematics','Pure Mathematics');

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGA — Form 3                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='Innovative English', editeur_livre='MONDOUX', auteur_livre='Jator-Bangsi', prix_officiel=3600
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='English Language';
UPDATE programmes_scolaires SET titre_livre='French Form 3', editeur_livre='Africa Education', auteur_livre='Molonta, Mounchikpou', prix_officiel=3900
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='French Language';
UPDATE programmes_scolaires SET editeur_livre='Quality Print', auteur_livre='Munang R.C.', prix_officiel=6000
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='History';
UPDATE programmes_scolaires SET editeur_livre='Grassroots', auteur_livre='Nchangwi S., Che B., Nchangwi P.', prix_officiel=8000
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Geography';
UPDATE programmes_scolaires SET titre_livre='Citizenship Education Form 3', editeur_livre='CATWA', auteur_livre='Fandjio M., Afoni E.', prix_officiel=3000
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Citizenship';
UPDATE programmes_scolaires SET titre_livre='Economics for GCE O Level and ITVE F. 3, 4 and 5', editeur_livre='CATWA', auteur_livre='Jua, Asunkeng, Bushu', prix_officiel=7000
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Economics';
UPDATE programmes_scolaires SET titre_livre='Success in Commerce Forms 3,4 and 5', editeur_livre='Grace Publ.', auteur_livre='Ajeh Mesumbe', prix_officiel=7000
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Commerce';
UPDATE programmes_scolaires SET editeur_livre='Grace Publ.', auteur_livre='Mpacko E. Ivo', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Physics';
UPDATE programmes_scolaires SET titre_livre='Understanding Chemistry, Forms 3, 4 and 5', editeur_livre='TEWA books', auteur_livre='Njike N., Funjong B.', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Chemistry';
UPDATE programmes_scolaires SET titre_livre='Understanding Biology Form 3', editeur_livre='Greenworld', auteur_livre='Tapong Sylvester', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Biology';
UPDATE programmes_scolaires SET titre_livre='Prime ICT Form 3', editeur_livre='NMI', auteur_livre='Agwe, Ngwa, Arrey N.', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Computer Science';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGA — Form 4                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='Prime English, Form 4', editeur_livre='NMI', auteur_livre='Egbe Besong Elvis', prix_officiel=4200
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='English Language';
UPDATE programmes_scolaires SET titre_livre='French Form 4', editeur_livre='MONDOUX', auteur_livre='Dady, Sanama, Kuetche', prix_officiel=3600
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere IN ('French','French Language');
UPDATE programmes_scolaires SET editeur_livre='Quality Print', auteur_livre='Munang R.C.', prix_officiel=6000
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='History';
UPDATE programmes_scolaires SET titre_livre='New 21st Century Physical, Human and Cameroon Geography for Forms 3,4 and 5', editeur_livre='Grassroots', auteur_livre='Nchangvi Sebastian', prix_officiel=8000
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Geography';
UPDATE programmes_scolaires SET titre_livre='Basic Geology for Colleges, Forms, 4 and 5', editeur_livre='TEWA Books', auteur_livre='Takwi Henry', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Geology';
UPDATE programmes_scolaires SET titre_livre='The Advocate for Citizenship Education, F. 4 and 5', editeur_livre='Grace Publ.', auteur_livre='Venantius Kum Ngwoh', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Citizenship';
UPDATE programmes_scolaires SET titre_livre='Prime Mathematics Forms 4 and 5', editeur_livre='NMI', auteur_livre='Tasah, Ngew, Gene', prix_officiel=5500
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere IN ('Mathematics','Pure Mathematics');
UPDATE programmes_scolaires SET titre_livre='Explaining Additional Mathematics', editeur_livre='NAARAT', auteur_livre='Atanga A.', prix_officiel=9000
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Add. Mathematics';
UPDATE programmes_scolaires SET titre_livre='Standard Physics, Form 4', editeur_livre='Dominion', auteur_livre='Tam P., Awandja', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Physics';
UPDATE programmes_scolaires SET titre_livre='Understanding Chemistry Forms 3, 4 and 5', editeur_livre='TEWA Books', auteur_livre='Njike Nchopah, Funjung', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Chemistry';
UPDATE programmes_scolaires SET titre_livre='Understanding Biology Vol. 1 Forms 4 and 5', editeur_livre='Greenworld', auteur_livre='Tapong Sylvester', prix_officiel=8000
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Biology';
UPDATE programmes_scolaires SET titre_livre='Computer Science Form 4', editeur_livre='Africa Edu', auteur_livre='Nfor Ngala n. Fuh Che H.', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Computer Science';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGA — Form 5                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='Prime English, Form 5', editeur_livre='NMI', auteur_livre='Egbe Besong Elvis', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='English Language';
UPDATE programmes_scolaires SET titre_livre='French Form 5', editeur_livre='Africa Education', auteur_livre='Molonta, Mounchikpou', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere IN ('French','French Language');
UPDATE programmes_scolaires SET editeur_livre='Quality Print', auteur_livre='Munang R.C.', prix_officiel=6000
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='History';
UPDATE programmes_scolaires SET titre_livre='New 21st Century Physical, Human and Cameroon Geography for Forms 3,4 and 5', editeur_livre='Grassroots', auteur_livre='Nchangvi Sebastian', prix_officiel=8000
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='Geography';
UPDATE programmes_scolaires SET titre_livre='Basic Geology for Colleges, Forms, 4 and 5', editeur_livre='TEWA Books', auteur_livre='Takwi Henry', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='Geology';
UPDATE programmes_scolaires SET titre_livre='Prime Mathematics Forms 4 and 5', editeur_livre='NMI', auteur_livre='Tasah, Ngew, Gene', prix_officiel=5300
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere IN ('Mathematics','Pure Mathematics');
UPDATE programmes_scolaires SET titre_livre='Explaining Additional Mathematics', editeur_livre='NAARAT', auteur_livre='Atanga A.', prix_officiel=9000
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='Add. Mathematics';
UPDATE programmes_scolaires SET titre_livre='Prime Physics, Form 5', editeur_livre='NMI', auteur_livre='Che Fuh, Munjam C.', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='Physics';
UPDATE programmes_scolaires SET titre_livre='Understanding Chemistry, Forms 3,4 and 5', editeur_livre='TEWA Books', auteur_livre='NJIKE N.', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='Chemistry';
UPDATE programmes_scolaires SET titre_livre='Computer Science Form 5', editeur_livre='Africa Edu', auteur_livre='Montchio T., Tolefac A.', prix_officiel=5000
 WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='Computer Science';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGA — Lower & Upper Sixth                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
UPDATE programmes_scolaires SET titre_livre='Mastering English', editeur_livre='NMI', auteur_livre='Egbe Besong and others', prix_officiel=4500
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='English Language';
UPDATE programmes_scolaires SET titre_livre='Apprenons le Français', editeur_livre='ANUCAM', auteur_livre='Mbimeh Paul and others', prix_officiel=4000
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='French Language';
UPDATE programmes_scolaires SET titre_livre='Certified Philosophy for Cameroon GCE', editeur_livre='Catwa', auteur_livre='Samah Abang-Mugwa', prix_officiel=7500
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Philosophy';
UPDATE programmes_scolaires SET titre_livre='Comprehensive Advanced Level History', editeur_livre='Grace Publisher', auteur_livre='Venantius Kum Ngwoh', prix_officiel=9500
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='History';
UPDATE programmes_scolaires SET titre_livre='Advanced Level Pure Mathematics Made Easy', editeur_livre='Grace Publ.', auteur_livre='Ewane Roland Alunge', prix_officiel=8000
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Pure Mathematics';
UPDATE programmes_scolaires SET titre_livre='Further Pure Mathematics Made Easy', editeur_livre='Grace Publ.', auteur_livre='Ewane Roland Alunge', prix_officiel=9000
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Further Pure Maths';
UPDATE programmes_scolaires SET titre_livre='Advanced Chemistry', editeur_livre='Oxford', auteur_livre='Clugston, R. Flemming', prix_officiel=15500
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Chemistry';
UPDATE programmes_scolaires SET titre_livre='Comprehensive A Level Biology: Concepts and App.', editeur_livre='Presbook', auteur_livre='B.C. Dama', prix_officiel=9000
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Biology';
UPDATE programmes_scolaires SET titre_livre='Geology For Advanced Level (Main textbook)', editeur_livre='Grassroots', auteur_livre='Keneth Yoisimbom', prix_officiel=8500
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Geology';
UPDATE programmes_scolaires SET titre_livre='Advanced Level ICT Demystified', editeur_livre='Grassroots', auteur_livre='CHI Michael', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='ICT';
UPDATE programmes_scolaires SET titre_livre='Advanced Computer Science Demystified', editeur_livre='Grassroots', auteur_livre='Chi Michael', prix_officiel=6500
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Computer Science';
UPDATE programmes_scolaires SET titre_livre='Advanced Economics', editeur_livre='Destiny Print', auteur_livre='Ndichia Gerald and alii', prix_officiel=6000
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Economics';
UPDATE programmes_scolaires SET titre_livre='Advanced Level Physics: A modern Approach', editeur_livre='Grace Pub.', auteur_livre='Mpako Enongene Ivo', prix_officiel=9000
 WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Physics';

-- Vérification finale
DO $$
DECLARE
    nb_2026 INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_2026 FROM programmes_scolaires WHERE annee_scolaire = '2026-2027';
    RAISE NOTICE '[fix_all_classes_2026_2027] Total lignes 2026-2027 : %', nb_2026;
END $$;

COMMIT;
