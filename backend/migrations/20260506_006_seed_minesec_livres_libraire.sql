-- Migration : seed du catalogue MINESEC officiel 2025-2026 dans livres_scolaires
-- Date : 2026-05-06
--
-- Ce seed crée des entrées dans livres_scolaires (mode_listing='vente') pour
-- TOUS les manuels de la liste officielle MINESEC, attribués au compte
-- super@yukpolibrairie.app (user_id=45 = Yukpo Librairie système).
--
-- Permet au matching IA (POST /api/bourse-livre/v2/match-programmes-by-title)
-- de retrouver les titres scannés et d'afficher le prix réel marché.
--
-- Idempotent : DELETE puis INSERT pour ce user_id.

BEGIN;

-- 0. Nettoyage de l'éventuel seed précédent (idempotence)
DELETE FROM livres_scolaires
 WHERE user_id = 45
   AND mode_listing = 'vente'
   AND description_etat = 'MINESEC catalog officiel 2025-2026';

-- ============================================================================
-- 1. Helper : INSERT typé pour réduire la verbosité
-- Utilise INSERT...SELECT FROM (VALUES ...) pour batch.
-- ============================================================================

-- ─── 6ème (FR) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Français 6ème',            'Owona, Ben Cohen',           'NATHAN',          '6ème','Français','Secondaire général',4200),
  ('Les Chants de la Forêt',   'Lucien Anya Noa',            'AFREDIT',         '6ème','Littérature','Secondaire général',1900),
  ('Les Bimanes',              'Séverin Cécil Abega',        'EDICEF',          '6ème','Littérature','Secondaire général',2000),
  ('Les Contes de Korotoumou', 'Amadou Kone',                'Vallesse',        '6ème','Littérature','Secondaire général',2200),
  ('Anglais 6ème',             'Ombga, Enyegue, Mbeudeu',    'Africa Education','6ème','Anglais','Secondaire général',5000),
  ('Latinistas 6ème-5ème',     'Ottou Fouda, Sabikanda',     'Eclosion',        '6ème','Latin','Secondaire général',5000),
  ('Planète Cameroun 6ème-5ème','Botnem, Ekollo Sono, Mvele','Hatier-ERA',      '6ème','Histoire','Secondaire général',4200),
  ('Planète Cameroun 6ème',    'Botnem, Ekollo Sono, Mvele', 'EDICEF-ERA',      '6ème','Géographie','Secondaire général',4200),
  ('Education à la citoyenneté 6ème/5ème','Kouna Bah, Ayuk Ayuk, Ndolo','MONDOUX','6ème','Education à la citoyenneté','Secondaire général',3500),
  ('Mathématiques 6ème',       'Pokam, Talla Ndé, Yadaci',   'MONDOUX',         '6ème','Mathématiques','Secondaire général',4000),
  ('Sciences 6ème',            'Bayemi, Dchinda, Essimbi',   'Africa Education','6ème','Sciences','Secondaire général',5000),
  ('Informatique 6ème',        'Jean Paul Paul, Wida Orpa',  'Eclosion',        '6ème','Informatique','Secondaire général',3500)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── 5ème (FR) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Français 5ème',            'Modo, Nti, Ngo Kendeg',      'Africa Education','5ème','Français','Secondaire général',4500),
  ('L''Arbre Fétiche',         'Jean Pliya',                 'CLE',             '5ème','Littérature','Secondaire général',2000),
  ('N''kum-Wam, le huitième notable','David Massoma Pandong','AFREDIT',         '5ème','Littérature','Secondaire général',2000),
  ('Père inconnu',             'Pabe Mongo',                 'EDICEF/NEA',      '5ème','Littérature','Secondaire général',2000),
  ('Anglais 5ème',             'Ombga, Enyegue, Mbeudeu',    'Africa Education','5ème','Anglais','Secondaire général',4500),
  ('Latinistas 6ème-5ème',     'Ottou Fouda, Sabikanda',     'Eclosion',        '5ème','Latin','Secondaire général',5000),
  ('Planète Cameroun 6ème-5ème','Botnem, Ekollo Sono, Mvele','Hatier-ERA',      '5ème','Histoire','Secondaire général',4200),
  ('Planète Cameroun 5ème',    'Botnem, Ekollo Sono, Mvele', 'EDICEF-ERA',      '5ème','Géographie','Secondaire général',4300),
  ('Education à la citoyenneté 6ème/5ème','Kouna Bah, Ayuk Ayuk, Ndolo','MONDOUX','5ème','Education à la citoyenneté','Secondaire général',3500),
  ('Mathématiques 5ème',       'Nyanda Nkamwa, Kajoue W.',   'COSMOS',          '5ème','Mathématiques','Secondaire général',4200),
  ('Sciences 5ème',            'Pouofo Nguiam, Fogha Z.',    'CLE',             '5ème','Sciences','Secondaire général',4000),
  ('Informatique 5ème',        'Enyegue, Bolda',             'NMI',             '5ème','Informatique','Secondaire général',4000)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── 4ème (FR) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Français 4ème',            'Ndaitara, Essomba, Lessomo', 'Africa Education','4ème','Français','Secondaire général',5000),
  ('Trois prétendants, un mari','Guillaume Oyono Mbia',      'CLE',             '4ème','Littérature','Secondaire général',2500),
  ('Cœur du Sahel',            'Djaili Amadou Amal',         'Proximité',       '4ème','Littérature','Secondaire général',2500),
  ('L''attachement au sol natal','Ernest Alima',             'Ifrikiya',        '4ème','Littérature','Secondaire général',1900),
  ('L''Eveil en Anglais 4ème', 'Proboh, Etame, Ngwang',      'NMI',             '4ème','Anglais','Secondaire général',4000),
  ('Latinistas 4ème-3ème',     'Ottou Fouda, Sabikanda',     'Eclosion',        '4ème','Latin','Secondaire général',5000),
  ('Je découvre la langue grecque 4ème-3ème','Ottou Fouda, Sabikanda','Eclosion','4ème','Grec','Secondaire général',5000),
  ('J''apprends l''Arabe 4ème','S. Abba, M. Bachirou, M. Baba','Wisdom Publ.', '4ème','Arabe','Secondaire général',3000),
  ('Planète Cameroun 4ème (Histoire)','Botnem, Ekollo Sono, Mvele','Hatier-ERA','4ème','Histoire','Secondaire général',3700),
  ('Planète Cameroun 4ème (Géographie)','Botnem, Ekollo Sono, Mvele','EDICEF-ERA','4ème','Géographie','Secondaire général',4300),
  ('Education à la citoyenneté 4ème-3ème','Kouna Bah, Ayuk Ayuk, Ndolo','MONDOUX','4ème','Education à la citoyenneté','Secondaire général',3500),
  ('Erwachen/Allemand 4ème',   'Mponoh, Ndam, Njeupam',      'NMI',             '4ème','Allemand','Secondaire général',4500),
  ('Nueva Didactica del Español I','Habissou Bidoung, Sepulveda','HABIBI',     '4ème','Espagnol','Secondaire général',5500),
  ('Didactica dell''Italiano', 'Mathias H. Bikitik',          'L''Harmattan',   '4ème','Italien','Secondaire général',3000),
  ('J''aime le Chinois 4ème',  'Nama, Tidjon, Gouelekam',    'Africa Education','4ème','Chinois','Secondaire général',5500),
  ('Mathématiques 4ème',       'Tchoutio, Tchouaffi, Bona',  'Belles Lettres',  '4ème','Mathématiques','Secondaire général',4500),
  ('SVTEEHB 4ème',             'Mondoman, Ntock Beng',       'MONDOUX',         '4ème','SVTEEHB','Secondaire général',4000),
  ('Physique, Chimie, Technologie 4ème','Tagni, Abéga, Ango','NMI',             '4ème','PCT','Secondaire général',4200),
  ('Informatique 4ème',        'Jean Paul Paul, Wida Orpa',  'Eclosion',        '4ème','Informatique','Secondaire général',4000)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── 3ème (FR) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Français 3ème',            'Ndaitara, Essomba, Lessomo', 'Africa Education','3ème','Français','Secondaire général',5000),
  ('Ville cruelle',            'Mongo Beti',                 'Présence Africaine','3ème','Littérature','Secondaire général',2500),
  ('La marmite de Koka Mbala', 'Guy Menga',                  'CLE',             '3ème','Littérature','Secondaire général',1700),
  ('Petites gouttes de chant pour créer l''homme','René Philombe','CLE',        '3ème','Littérature','Secondaire général',2000),
  ('L''Eveil en Anglais',      'Proboh, Etame, Ngwang',      'NMI',             '3ème','Anglais','Secondaire général',4500),
  ('Latinistas 4ème-3ème',     'Ottou Fouda, Sabikanda',     'Eclosion',        '3ème','Latin','Secondaire général',5000),
  ('Je découvre la langue grecque 4ème-3ème','Ottou Fouda, Sabikanda','Eclosion','3ème','Grec','Secondaire général',5000),
  ('J''apprends l''Arabe 3ème','S. Abba, M. Bachirou, M. Baba','Wisdom Publ.', '3ème','Arabe','Secondaire général',3000),
  ('Planète Cameroun 3ème (Histoire)','Botnem, Ekollo Sono, Mvele','Hatier-ERA','3ème','Histoire','Secondaire général',3700),
  ('Planète Cameroun 3ème (Géographie)','Botnem, Ekollo Sono, Mvele','EDICEF-ERA','3ème','Géographie','Secondaire général',4300),
  ('Education à la citoyenneté 4ème-3ème','Kouna Bah et autres','MONDOUX',     '3ème','Education à la citoyenneté','Secondaire général',3500),
  ('Erwachen/Allemand 3ème',   'Mponoh, Ndam, Njeupam',      'NMI',             '3ème','Allemand','Secondaire général',4500),
  ('Nueva Didactica Del Español 2','Habissou Bidoung, Sepulveda','HABIBI',     '3ème','Espagnol','Secondaire général',5500),
  ('Didactica Dell''Italiano', 'Mathias H. Bikitik',         'L''Harmattan',    '3ème','Italien','Secondaire général',3500),
  ('J''aime le Chinois 3ème',  'Nama, Tidjon, Gouelekam',    'Africa Education','3ème','Chinois','Secondaire général',4000),
  ('Mathématiques 3ème',       'Djapa Oumbo, Nguele',        'D and L',         '3ème','Mathématiques','Secondaire général',4500),
  ('SVTEEHB 3ème',             'Bayemi, Dchinda',            'Africa Education','3ème','SVTEEHB','Secondaire général',5000),
  ('Physique, Chimie, Technologie 3ème','Nsa, Peha, Heumou, Kesso','Wisdom',   '3ème','PCT','Secondaire général',4500),
  ('Informatique 3ème',        'Jean Paul Paul, Wida Orpa',  'Eclosion',        '3ème','Informatique','Secondaire général',4000)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── 2nde (FR) — matières communes ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('L''Excellence en philosophie','Tiako Youadjeu, Miyoupo','NMI',             '2nde','Philosophie','Secondaire général',4000),
  ('Langue et Méthode au 2nde cycle','Lessomo Edene et alii','Africa Education','2nde','Français','Secondaire général',5000),
  ('Les Tribus de Capitoline','P.C. Ombete Bela',            'CLE',             '2nde','Littérature','Secondaire général',3000),
  ('Poèmes sauvages éclairés au feu de brousse','Henri Nkoumo','Les Classiques iv.','2nde','Littérature','Secondaire général',1700),
  ('Tartuffe',                 'Molière',                    'Belles Lettres',  '2nde','Littérature','Secondaire général',2000),
  ('Interactions in English',  'Dorothy Forbin et alii',     'CAMBRIDGE',       '2nde','Anglais','Secondaire général',5000),
  ('Le Monde. De la préhistoire au Moyen-Age','Daniel Abwa, S. Mani Noah','CLE','2nde','Histoire','Secondaire général',4000),
  ('Education à la citoyenneté et à la morale','Kouna Bah Jean Didier et alii','MONDOUX','2nde','Education à la citoyenneté','Secondaire général',3000),
  ('IHR und WIR Plus 3 (Allemand)','Moussa Anouma et autres','HUEBER',         '2nde','Allemand','Secondaire général',6000),
  ('Nueva Didactica del Español III','Habissou Bidoung et autres','HABIBI',    '2nde','Espagnol','Secondaire général',4900),
  ('Bonjour Cameroun 3 (Chinois)','Didier Nama',              'D&L',            '2nde','Chinois','Secondaire général',3500),
  ('L''Excellence en Mathématiques','V. Tegninko Valentin et autres','NMI',    '2nde A','Mathématiques','Secondaire général',4500),
  ('Sciences (2nde A et SES)', 'Fogha, Pouofo et autres',    'CLE',             '2nde A','Sciences','Secondaire général',3500),
  ('L''Excellence en Informatique','Badane Djonwajar et al.','NMI',             '2nde A','Informatique','Secondaire général',3100),
  ('L''Excellence en Mathématiques','Tegninko V., Sienlinou D.','NMI',         '2nde C','Mathématiques','Secondaire général',5500),
  ('SVTEEHB (2nde C et E)',    'Fogha, Pouofo et autres',    'CLE',             '2nde C','SVTEEHB','Secondaire général',5000),
  ('L''Excellence en Physique-Chimie','Ango Yves P., Tagni Jérémie','NMI',     '2nde C','Physique-Chimie','Secondaire général',6000),
  ('L''Excellence en Informatique','Badane Djonwajar et al.','NMI',             '2nde C','Informatique','Secondaire général',3100),
  ('Initiation aux Arts cinématographiques','F.N. Bikoï, Basseck Ba Kobhio','Terre Africaine','2nde AC','Arts cinématographiques','Secondaire général',5000)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── 1ère (FR) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Langue et Méthode au 2nde cycle','Lessomo Edene et autres','AFRIC''EDUC',  '1ère','Français','Secondaire général',5000),
  ('Au Cœur des ténèbres',     'Joseph Conrad',              'Eclosion',        '1ère','Littérature','Secondaire général',1900),
  ('Balafon',                  'Engelbert Mveng',            'CLE',             '1ère','Littérature','Secondaire général',1800),
  ('Le Lion et la perle',      'Wole Soyinka',               'CLE',             '1ère','Littérature','Secondaire général',1700),
  ('Philosophie 1ères littéraires','Foumane Josué D. et autres','MONDOUX',     '1ère A','Philosophie','Secondaire général',4500),
  ('Philosophie 1ères Scientifiques','Foumane Josué D. et autres','MONDOUX',  '1ère C','Philosophie','Secondaire général',3000),
  ('Interactions in English',  'Dorothy Forbin and others',  'CAMBRIDGE',       '1ère','Anglais','Secondaire général',4500),
  ('Le Monde. De la fin du XVIè siècle à 1939','Daniel Abwa et S. Mani Noah','CLE','1ère','Histoire','Secondaire général',4500),
  ('Education à la citoyenneté 1ères','Kouna Bah Jean et autres','MONDOUX',    '1ère','Education à la citoyenneté','Secondaire général',3000),
  ('Allemand : Deutsch in Africa','Ebissemie Marthe',         'ABID',           '1ère','Allemand','Secondaire général',5000),
  ('Nueva Didactica del Español IV','Habissou Bidoung',       'HABIBI',         '1ère','Espagnol','Secondaire général',5900),
  ('Bonjour Cameroun 4 (Chinois)','Didier Nama',              'D&L',            '1ère','Chinois','Secondaire général',3500),
  ('Majors en Mathématiques',  'Nkeng Essombo et autres',    'ASVA',            '1ère A','Mathématiques','Secondaire général',3500),
  ('SCIENCES (1ère A et SES)', 'Fogha V. J. et autres',      'CLE',             '1ère A','Sciences','Secondaire général',5000),
  ('A la conquête de l''Informatique 1ères','Wambo, Kotto et Temgoua','R. LUSTRAL','1ère','Informatique','Secondaire général',3400),
  ('L''Excellence en Mathématiques','Victor Tegninko et autres','NMI',         '1ère C','Mathématiques','Secondaire général',6500),
  ('L''Excellence en SVTEEHB 1ère C, TI et E','A. Oumarou, Bibi, Ebang Ebole','NMI','1ère C','SVTEEHB','Secondaire général',6500),
  ('L''Excellence en Physique 1ère C et D','Tagni Jérémie, Ango Yves','NMI',  '1ère C','Physique','Secondaire général',5000),
  ('L''Excellence en Chimie',  'Ango Yves, Abega F. et autres','NMI',          '1ère C','Chimie','Secondaire général',4500),
  ('A la conquête de l''Informatique','Wambo, Kotto et Temgoua','R. LUSTRAL', '1ère C','Informatique','Secondaire général',3600),
  ('Mathématiques 1ère D et TI','Nkeng Essombo et autres',   'CEPER',           '1ère D','Mathématiques','Secondaire général',5500),
  ('SVTEEHB 1ère D et TI',     'Fogha Zaboue, Mbia Ombolo',  'CLE',             '1ère D','SVTEEHB','Secondaire général',6500)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── Tle (FR) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Langue et méthode au 2nde cycle','Lessomo Edene et autres','AFRIC''EDUC',  'Tle','Français','Secondaire général',5000),
  ('Stances et poèmes suivi de Les Epreuves','Sully Prudhomme','Eclosion',     'Tle','Littérature','Secondaire général',1900),
  ('Le Vieux nègre et la médaille','Ferdinand Oyono',         'EDICEF',        'Tle','Littérature','Secondaire général',2500),
  ('Ngum a Jemea. La foi inébranlable de…','David Mbanga Eyombwan','CICD',     'Tle','Littérature','Secondaire général',3000),
  ('Interaction in English',   'Dorothy Forbin and others',  'CAMBRIDGE',       'Tle','Anglais','Secondaire général',5000),
  ('Histoire Tle',             'Kouna Bah, Ayuk Ayuk',       'MONDOUX',         'Tle','Histoire','Secondaire général',5000),
  ('Education à la citoyenneté et à la morale (Tle)','Kouna Bah Jean D. et autres','MONDOUX','Tle','Education à la citoyenneté','Secondaire général',3900),
  ('Allemand : Ihr und Wir Plus 4','Moussa Anouma et autres','HUEBER',         'Tle','Allemand','Secondaire général',5000),
  ('Nueva Didactica Del Español V','Habissou Bidoung et Félix S.','HABIBI',    'Tle','Espagnol','Secondaire général',6000),
  ('Piacere ! Niveau 4/B1 (Italien)','Alexandra R. Martinez', 'BELIN',          'Tle','Italien','Secondaire général',6000),
  ('Bonjour Cameroun 4 (Chinois)','Didier Nama',              'D&L',            'Tle','Chinois','Secondaire général',3500),
  ('Emergeons en Philosophie, Tles littéraires','Eboni, Nguefack et Ambomo','MONDOUX','Tle A','Philosophie','Secondaire général',7800),
  ('Majors en Philosophie. Tles SES','Foumane, Ombede A. et alii','ASVA',     'Tle A','Philosophie','Secondaire général',5000),
  ('Emergeons en Philosophie. Tles C et D','Nguekack, Ebonl et Ambomo','MONDOUX','Tle C','Philosophie','Secondaire général',5000),
  ('De la médiocrité à l''excellence','Ebénézer Njoh Mouelle','CLE',           'Tle','Philosophie','Secondaire général',3000),
  ('Essai sur la problématique philosophique en…','Marcien Towa','CLE',         'Tle','Philosophie','Secondaire général',1800),
  ('L''Excellence en Sciences','Ebang Ehole et autres',      'NMI',             'Tle A','Sciences','Secondaire général',4000),
  ('Majors en Mathématiques (Tle A et SES)','Elandi E. R., Fouda S., Nkoule','ASVA','Tle A','Mathématiques','Secondaire général',3900),
  ('A la conquête de l''Informatique 7 (Tle A et SES)','Wambo, Momnougui et alii','R. LUSTRAL','Tle A','Informatique','Secondaire général',3500),
  ('Emergeons en Mathématiques (Tle C et E)','Pokam, Talla Nde et Ndjip N.','MONDOUX','Tle C','Mathématiques','Secondaire général',6000),
  ('L''Excellence en Physique (Tles C, D, E et TI)','Ango Y., Tagni J et autres','NMI','Tle C','Physique','Secondaire général',6500),
  ('Chimie Terminales C, D et E','Ango Y., Abega F. et autres','NMI',          'Tle C','Chimie','Secondaire général',5500),
  ('SVTEEHB, Tles C et TI',    'Essimbi Ngono, Mbarga Panda','MONDOUX',         'Tle C','SVTEEHB','Secondaire général',6500),
  ('Emergeons en Mathématiques (Tle D)','Pokam, Talla Nde et Ndjip','MONDOUX', 'Tle D','Mathématiques','Secondaire général',5500),
  ('SVTEEHB, Tle D',           'Njoumbe, Fogha et Pouofo',   'CLE',             'Tle D','SVTEEHB','Secondaire général',8000),
  ('A la conquête de l''Informatique 7 (C, D, E, TI)','Wambo, Momnougui et T.','R. LUSTRAL','Tle D','Informatique','Secondaire général',3900)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── Form 1 (EN) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Prime English Form 1',     'Egbe Besong, Mesei M.',      'NMI',             'Form 1','English Language','Secondary (O Level)',3800),
  ('Fireside Tales',           'Charlie-Bey',                'Peng Edition',    'Form 1','Literature','Secondary (O Level)',2000),
  ('An Introduction to Poetry, Vol. 1','Akem H., Ngwobella M.','Shiloh Printers','Form 1','Literature','Secondary (O Level)',1200),
  ('Clean School',             'Arrey Etta M.C. Bessong',    'MONDOUX',         'Form 1','Literature','Secondary (O Level)',1000),
  ('French Form 1',            'Dady, Sanama, Kuetche',      'MONDOUX',         'Form 1','French','Secondary (O Level)',3600),
  ('History for Form 1',       'Sabum H. Dingbobga',         'Grassroots',      'Form 1','History','Secondary (O Level)',3200),
  ('Geography for Competency Development Book 1','Shey D. Edie Nnane','Greenworld','Form 1','Geography','Secondary (O Level)',3000),
  ('The Patriotic Citizen Book 1','Nanje N., Chop L., She',  'Greenworld',      'Form 1','Citizenship','Secondary (O Level)',4000),
  ('Integrated Secondary Mathematic Form 1','Ajeck K., Siepe R., W.','Shiloh Printers','Form 1','Mathematics','Secondary (O Level)',3500),
  ('Prime Physics Form 1',     'Che Fuh, Munjam C.',         'NMI',             'Form 1','Physics','Secondary (O Level)',3200),
  ('Elementary Chemistry for Form 1','Mbuli k., Shitteh G.', 'TEWA Books',      'Form 1','Chemistry','Secondary (O Level)',3000),
  ('Emerging Biology Book 1',  'Toulack K., Diang J.',       'Global Publisher','Form 1','Biology','Secondary (O Level)',3500),
  ('Computer Science for Form 1','Forndem F., Tangunu',      'Grassroots',      'Form 1','Computer Science','Secondary (O Level)',3500),
  ('Contextual Home Economics Form 1','N.M. Brino',          'Grace Publisher', 'Form 1','Home Economics','Secondary (O Level)',4500)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── Form 2 (EN) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Prime English Form 2',     'Egbe Besong, Mesei M.',      'NMI',             'Form 2','English Language','Secondary (O Level)',3800),
  ('Going Home',               'Ethel Joffi Molua E.',       'NYAA Publ.',      'Form 2','Literature','Secondary (O Level)',2000),
  ('An Introduction to Poetry, Vol.2','Akem H., Ngwobella M.','Shiloh Printers','Form 2','Literature','Secondary (O Level)',1200),
  ('A Time to Reconcile',      'George Njimele',             'Peacock',         'Form 2','Literature','Secondary (O Level)',1200),
  ('French Form 2',            'Dady, Sanama, Kuetche',      'MONDOUX',         'Form 2','French','Secondary (O Level)',3500),
  ('Basic Keystones in History Form 2','V. Kum Ngwoh',       'Grace Publ.',     'Form 2','History','Secondary (O Level)',4000),
  ('Geography for Competency Development 2','Shey d. Edie Nnane','Greenworld', 'Form 2','Geography','Secondary (O Level)',4000),
  ('The Advocate for Citizenship Education Form 2','Venantius Kum Ngwoh','Grace Pub.','Form 2','Citizenship','Secondary (O Level)',3500),
  ('Integrated Secondary Mathematics Book 2','Ajeck K., Siepe R., W.','Shiloh Printers','Form 2','Mathematics','Secondary (O Level)',3500),
  ('Physics for Secondary Schools in Cameroon Form 2','Clinton Ojong','Longhorn','Form 2','Physics','Secondary (O Level)',3500),
  ('Integrated Secondary Chemistry Form 2','Ajeck Blaise T.', 'Dominion',       'Form 2','Chemistry','Secondary (O Level)',3000),
  ('Emerging Biology Book 2',  'Toulack K., Diang J.',       'Global Publ.',    'Form 2','Biology','Secondary (O Level)',3000),
  ('Contextual Home Economics Form 2','N.M. Brino',          'Grace Publ.',     'Form 2','Home Economics','Secondary (O Level)',4500),
  ('Computer Science for Form 2','Forndem F., Tangunu',      'Grassroots',      'Form 2','Computer Science','Secondary (O Level)',3500)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── Form 3 (EN) ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Innovative English',       'Jator-Bangsi',               'MONDOUX',         'Form 3','English Language','Secondary (O Level)',3600),
  ('A Pen Kills',              'Lucas Ntang Tasi',           'NMI',             'Form 3','Literature','Secondary (O Level)',2500),
  ('My Cameroon and others Poems','Charlie Bey',             'Peng Edition',    'Form 3','Literature','Secondary (O Level)',1800),
  ('Inclusive Education: The Way to go','Douglas Achingale', 'NYAA Pub.',       'Form 3','Literature','Secondary (O Level)',1800),
  ('French Form 3',            'Molonta, Mounchikpou',       'Africa Education','Form 3','French','Secondary (O Level)',3900),
  ('The Essential Logic for Ordinary Level','Ngwonam Denis', 'Grassroots',      'Form 3','Logic','Secondary (O Level)',2500),
  ('An Integrated History since 1850 for Forms 3, 4, 5','Munang R.C.','Quality Print','Form 3','History','Secondary (O Level)',6000),
  ('New 21st Century Physical, Human and Cameroon Geography','Nchangwi S., Che B., Nchangwi P.','Grassroots','Form 3','Geography','Secondary (O Level)',8000),
  ('International Students'' Atlas (Forms III to V)','Patrick Wiegand','Oxford','Form 3','Geography','Secondary (O Level)',6000),
  ('Citizenship Education Form 3','Fandjio M., Afoni E.',    'CATWA',           'Form 3','Citizenship','Secondary (O Level)',3000),
  ('Contextual Food and Nutrition for Form 3','N.M. Brino',  'Grace Publ.',     'Form 3','Food and Nutrition','Secondary (O Level)',4500),
  ('Economics for GCE O Level and ITVE F. 3, 4 and 5','Jua, Asunkeng, Bushu','CATWA','Form 3','Economics','Secondary (O Level)',7000),
  ('Success in Commerce Forms 3,4 and 5','Ajeh Mesumbe',     'Grace Publ.',     'Form 3','Commerce','Secondary (O Level)',7000),
  ('Prime Mathematics Form 3', 'Tasah, Ngew, Gene',          'NMI',             'Form 3','Mathematics','Secondary (O Level)',4200),
  ('Physics Form 3',           'Mpacko E. Ivo',              'Grace Publ.',     'Form 3','Physics','Secondary (O Level)',4500),
  ('Understanding Chemistry, Forms 3, 4 and 5','Njike N., Funjong B.','TEWA books','Form 3','Chemistry','Secondary (O Level)',6500),
  ('Understanding Biology Form 3','Tapong Sylvester',         'Greenworld',     'Form 3','Biology','Secondary (O Level)',6500),
  ('Prime ICT Form 3',         'Agwe, Ngwa, Arrey N.',       'NMI',             'Form 3','Computer Science','Secondary (O Level)',4000)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── Form 4 & 5 (EN) — entrées principales ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Prime English, Form 4',    'Egbe Besong Elvis',          'NMI',             'Form 4','English Language','Secondary (O Level)',4200),
  ('French Form 4',            'Dady, Sanama, Kuetche',      'MONDOUX',         'Form 4','French','Secondary (O Level)',3600),
  ('The Essential Logic for Ordinary Level','Ngwonam Denis', 'Grassroots',      'Form 4','Logic','Secondary (O Level)',2500),
  ('Basic Geology for Colleges, Forms 4 and 5','Takwi Henry','TEWA Books',      'Form 4','Geology','Secondary (O Level)',5000),
  ('The Advocate for Citizenship Education, F. 4 and 5','Venantius Kum Ngwoh','Grace Publ.','Form 4','Citizenship','Secondary (O Level)',4000),
  ('Prime Mathematics Forms 4 and 5','Tasah, Ngew, Gene',    'NMI',             'Form 4','Mathematics','Secondary (O Level)',5500),
  ('Explaining Additional Mathematics','Atanga A.',          'NAARAT',          'Form 4','Add. Mathematics','Secondary (O Level)',9000),
  ('Standard Physics, Form 4', 'Tam P., Awandja',            'Dominion',        'Form 4','Physics','Secondary (O Level)',5000),
  ('Understanding Biology Vol. 1 Forms 4 and 5','Tapong Sylvester','Greenworld','Form 4','Biology','Secondary (O Level)',8000),
  ('Computer Science Form 4',  'Nfor Ngala n. Fuh Che H.',   'Africa Edu',      'Form 4','Computer Science','Secondary (O Level)',4500),
  ('Prime English, Form 5',    'Egbe Besong Elvis',          'NMI',             'Form 5','English Language','Secondary (O Level)',4500),
  ('French Form 5',            'Molonta, Mounchikpou',       'Africa Education','Form 5','French','Secondary (O Level)',4000),
  ('Prime Mathematics Forms 4 and 5','Tasah, Ngew, Gene',    'NMI',             'Form 5','Mathematics','Secondary (O Level)',5300),
  ('Prime Physics, Form 5',    'Che Fuh, Munjam C.',         'NMI',             'Form 5','Physics','Secondary (O Level)',5000),
  ('Computer Science Form 5',  'Montchio T., Tolefac A.',    'Africa Edu',      'Form 5','Computer Science','Secondary (O Level)',5000)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

-- ─── Lower & Upper Sixth (A Level) — sélection ───
INSERT INTO livres_scolaires
  (user_id, titre, auteur, editeur, classe_actuelle, classe_souhaitee, matiere, niveau, etat_livre,
   description_etat, prix_detecte, mode_listing, situation_troc, is_available, is_active)
SELECT 45, t.titre, t.auteur, t.editeur, t.classe, t.classe, t.matiere, t.niveau, 'Neuf',
       'MINESEC catalog officiel 2025-2026', t.prix, 'vente', 'offre', true, true
FROM (VALUES
  ('Mastering English',        'Egbe Besong and others',     'NMI',             'Lower Sixth','English Language','High School (A Level)',4500),
  ('Apprenons le Français',    'Mbimeh Paul and others',     'ANUCAM',          'Lower Sixth','French Language','High School (A Level)',4000),
  ('Walaande. L''art de partager un mari','Djaili Amadou Amal','Proximité',     'Lower Sixth','French Litterature','High School (A Level)',3000),
  ('Le fils d''Agatha Moudio', 'Francis Bebey',              'CLE',             'Lower Sixth','French Litterature','High School (A Level)',3200),
  ('Certified Philosophy for Cameroon GCE','Samah Abang-Mugwa','Catwa',         'Lower Sixth','Philosophy','High School (A Level)',7500),
  ('Comprehensive Advanced Level History','Venantius Kum Ngwoh','Grace Publisher','Lower Sixth','History','High School (A Level)',9500),
  ('Advanced Integrated Human Geography','Neba Martin',      'Greenworld',      'Lower Sixth','Geography','High School (A Level)',11000),
  ('Advanced Level Pure Mathematics Made Easy','Ewane Roland Alunge','Grace Publ.','Lower Sixth','Pure Mathematics','High School (A Level)',8000),
  ('Further Pure Mathematics Made Easy','Ewane Roland Alunge','Grace Publ.',   'Lower Sixth','Further Pure Maths','High School (A Level)',9000),
  ('Mathematics: Mechanics and Probability','L.Bostock, S. Chandler','Oxford', 'Lower Sixth','Mechanics','High School (A Level)',10000),
  ('Advanced Chemistry',       'Clugston, R. Flemming',      'Oxford',          'Lower Sixth','Chemistry','High School (A Level)',15500),
  ('Comprehensive A Level Biology','B.C. Dama',              'Presbook',        'Lower Sixth','Biology','High School (A Level)',9000),
  ('Advanced Level ICT Demystified','CHI Michael',            'Grassroots',     'Lower Sixth','ICT','High School (A Level)',6500),
  ('Advanced Computer Science Demystified','Chi Michael',    'Grassroots',      'Lower Sixth','Computer Science','High School (A Level)',6500),
  ('Advanced Economics',       'Ndichia Gerald and alii',    'Destiny Print',   'Lower Sixth','Economics','High School (A Level)',6000),
  ('Advanced Level Physics: A modern Approach','Mpako Enongene','Grace Pub.',  'Lower Sixth','Physics','High School (A Level)',9000)
) AS t(titre, auteur, editeur, classe, matiere, niveau, prix);

COMMIT;
