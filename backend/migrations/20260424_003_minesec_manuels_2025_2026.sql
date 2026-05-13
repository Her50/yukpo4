-- Migration : Programmes nationaux MINESEC 2025-2026 — Cameroun
-- Source    : LISTE OFFICIELLE DES MANUELS SCOLAIRES — Enseignement Secondaire Général
--             N°04/25/MINESEC/CAB, Yaoundé le 12 MAI 2025
-- Stratégie : établissement_id IS NULL → référentiel national (fallback scan IA)
--             ON CONFLICT DO NOTHING sur (pays, classe, matiere, titre_livre, annee_scolaire)

BEGIN;

-- ⚠️ Index unique uniq_programmes_national_cm RETIRÉ le 2026-05-13.
-- Il ne tenait pas compte de type_article → bloquait livre + workbook
-- avec mêmes (pays, classe, matière, titre, année). L'index correct
-- uniq_programmes_national_article (migration 20260510_002) le remplace.
-- La migration 20260513_001 fait un DROP IF EXISTS pour nettoyer les
-- bases déjà déployées.

-- ============================================================================
-- COLLÈGE — 6ème
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Collège','6ème','Langue Française','Français 6ème','Owona, Ben Cohen','NATHAN',4200,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Littérature','Les Chants de la Forêt','Lucien Anya Noa','AFREDIT',1900,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Littérature','Les Bimanes','Séverin Cécil Abega','EDICEF',2000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Littérature','Les Contes de Korotoumou','Amadou Kone','Vallesse',2200,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Anglais','Anglais 6ème','Ombga, Enyegue, Mbeudeu','Africa Education',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Latin','Latinistas 6ème-5ème','Ottou Fouda, Sabikanda','Eclosion',5000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','6ème','Histoire','Planète Cameroun. 6ème-5ème','Botnem, Ekollo Sono, Mvele','Hatier-ERA',4200,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Géographie','Planète Cameroun 6ème','Botnem, Ekollo Sono, Mvele','EDICEF-ERA',4200,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Education à la Citoyenneté','Education à la citoyenneté 6ème/5ème','Kouna Bah, Ayuk Ayuk, Ndolo','MONDOUX',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Mathématiques','Mathématiques 6ème','Pokam, Talla Ndé, Yadaci','MONDOUX',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Sciences','Sciences 6ème','Bayemi, Dchinda, Essimbi','Africa Education',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','6ème','Informatique','Informatique 6ème','Jean Paul Paul, Wida Orpa','Eclosion',3500,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COLLÈGE — 5ème
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Collège','5ème','Langue Française','Français 5ème','Modo, Nti, Ngo Kendeg','Africa Education',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Littérature','L''Arbre Fétiche','Jean Pliya','CLE',2000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Littérature','N''kum-Wam, le huitième notable','David Massoma Pandong','AFREDIT',2000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Littérature','Père inconnu','Pabe Mongo','EDICEF/NEA',2000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Anglais','Anglais 5ème','Ombga, Enyegue, Mbeudeu','Africa Education',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Latin','Latinistas 6ème-5ème','Ottou Fouda, Sabikanda','Eclosion',5000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','5ème','Histoire','Planète Cameroun. 6ème-5ème','Botnem, Ekollo Sono, Mvele','Hatier-ERA',4200,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Géographie','Planète Cameroun 5ème','Botnem, Ekollo Sono, Mvele','EDICEF-ERA',4300,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Education à la Citoyenneté','Education à la citoyenneté 6ème/5ème','Kouna Bah, Ayuk Ayuk, Ndolo','MONDOUX',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Mathématiques','Mathématiques 5ème','Nyanda Nkamwa, Kajoue W.','COSMOS',4200,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Sciences','Sciences 5ème','Pouofo Nguiam, Fogha Z.','CLE',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','5ème','Informatique','Informatique 5ème','Enyegue, Bolda','NMI',4000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COLLÈGE — 4ème
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Collège','4ème','Langue Française','Français 4ème','Ndaitara, Essomba, Lessomo','Africa Education',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Littérature','Trois prétendants, un mari','Guillaume Oyono Mbia','CLE',2500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Littérature','Cœur du Sahel','Djaili Amadou Amal','Proximité',2500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Littérature','L''attachement au sol natal','Ernest Alima','Ifrikiya',1900,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Anglais','L''Eveil en Anglais 4ème','Proboh, Etame, Ngwang','NMI',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Latin','Latinistas 4ème-3ème','Ottou Fouda, Sabikanda','Eclosion',5000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','4ème','Grec','Je découvre la langue grecque 4ème-3ème','Ottou Fouda, Sabikanda','Eclosion',5000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','4ème','Arabe','J''apprends l''Arabe 4ème','S. Abba, M. Bachirou, M. Baba','Wisdom Publ.',3000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','4ème','Histoire','Planète Cameroun. 4ème','Botnem, Ekollo Sono, Mvele','Hatier-ERA',3700,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Géographie','Planète Cameroun 4ème','Botnem, Ekollo Sono, Mvele','EDICEF-ERA',4300,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Education à la Citoyenneté','Education à la citoyenneté 4ème-3ème','Kouna Bah, Ayuk Ayuk, Ndolo','MONDOUX',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Langues Étrangères — Allemand','Erwachen/Allemand 4ème','Mponoh, Ndam, Njeupam','NMI',4500,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','4ème','Langues Étrangères — Espagnol','Nueva Didactica del Español I','Habissou Bidoung, Sepulveda','HABIBI',5500,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','4ème','Langues Étrangères — Italien','Didactica del''Italiano','Mathias H. Bikitik','L''Harmattan',3000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','4ème','Langues Étrangères — Chinois','J''aime le Chinois 4ème','Nama, Tidjon, Gouelekam','Africa Education',5500,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','4ème','Mathématiques','Mathématiques 4ème','Tchoutio, Tchouaffi, Bona','Belles Lettres',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','SVTEEHB','SVTEEHB 4ème','Mondoman, Ntock Beng','MONDOUX',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','PCT','Physique, Chimie, Technologie 4ème','Tagni, Abéga, Ango','NMI',4200,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','4ème','Informatique','Informatique 4ème','Jean Paul Paul, Wida Orpa','Eclosion',4000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COLLÈGE — 3ème
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Collège','3ème','Langue Française','Français 3ème','Ndaitara, Essomba, Lessomo','Africa Education',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Littérature','Ville cruelle','Mongo Beti','Présence Afric.',2500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Littérature','La marmite de Koka Mbala','Guy Menga','CLE',1700,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Littérature','Petites gouttes de chant pour créer l''homme','René Philombe','CLE',2000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Anglais','L''Eveil en Anglais','Proboh, Etame, Ngwang','NMI',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Latin','Latinistas 4ème-3ème','Ottou Fouda, Sabikanda','Eclosion',5000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','3ème','Grec','Je découvre la langue grecque 4ème-3ème','Ottou Fouda, Sabikanda','Eclosion',5000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','3ème','Arabe','J''apprends l''Arabe 3ème','S. Abba, M. Bachirou, M. Baba','Wisdom Publ.',3000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','3ème','Histoire','Planète Cameroun. 3ème','Botnem, Ekollo Sono, Mvele','Hatier-ERA',3700,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Géographie','Planète Cameroun 3ème','Botnem, Ekollo Sono, Mvele','EDICEF-ERA',4300,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Education à la Citoyenneté','Education à la citoyenneté 4ème-3ème','Kouna Bah et autres','MONDOUX',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Langues Étrangères — Allemand','Erwachen/Allemand 3ème','Mponoh, Ndam, Njeupam','NMI',4500,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','3ème','Langues Étrangères — Espagnol','Nueva Didactica Del Español 2','Habissou Bidoung, Sepulveda','HABIBI',5500,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','3ème','Langues Étrangères — Italien','Didactica Del''Italiano','Mathias H. Bikitik','L''Harmattan',3500,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','3ème','Langues Étrangères — Chinois','J''aime le Chinois, 3ème','Nama, Tidjon, Gouelekam','Africa Education',4000,'XAF','2025-2026',false,true),
    ('CM','francophone','Collège','3ème','Mathématiques','Mathématiques 3ème','Djapa Oumbo, Nguele','D and L',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','SVTEEHB','SVTEEHB 3ème','Bayemi, Dchinda','Africa Education',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','PCT','Physique, Chimie, Technologie 3ème','Nsa, Peha, Heumou, Kesso','Wisdom',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Collège','3ème','Informatique','Informatique 3ème','Jean Paul Paul, Wida Orpa','Eclosion',4000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — 2ndes (Matières Communes)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','2nde','Philosophie','L''Excellence en philosophie','Tiako Youadjeu, Miyoupo','NMI',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde','Langue Française','Langue et Méthode au 2nd cycle','Lessomo Edene et alii','Africa Education',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde','Littérature','Les Tribus de Capitoline','P.C. Ombete Bela','CLE',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde','Littérature','Poèmes sauvages éclairés au feu de brousse','Henri Nkoumo','Les Classiques iv.',1700,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde','Littérature','Tartuffe','Molière','Belles Lettres',2000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde','Anglais','Interactions in English','Dorothy Forbin et alii','CAMBRIDGE',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde','Histoire','Le Monde. De la préhistoire au Moyen-Age','Daniel Abwa, S. Mani Noah','CLE',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde','Education à la Citoyenneté','Education à la citoyenneté et à la morale','Kouna Bah Jean Didier et alii','MONDOUX',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde','Langues Étrangères — Allemand','IHR und WIR Plus 3','Moussa Anouma et autres','HUEBER',6000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','2nde','Langues Étrangères — Espagnol','Nueva Didactica del Español III','Habissou Bidoung et autres','HABIBI',4900,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','2nde','Langues Étrangères — Chinois','Bonjour Cameroun 3 (Chinois)','Didier Nama','D&L',3500,'XAF','2025-2026',false,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — 2nde A et SES
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','2nde A','Mathématiques','L''Excellence en Mathématiques','V. Tegninko Valentin et autres','NMI',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde A','Sciences','Sciences','Fogha, Pouofo et autres','CLE',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde A','Informatique','L''Excellence en Informatique','Badane Djonwajar et al.','NMI',3100,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde SES','Mathématiques','L''Excellence en Mathématiques','V. Tegninko Valentin et autres','NMI',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde SES','Sciences','Sciences','Fogha, Pouofo et autres','CLE',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde SES','Informatique','L''Excellence en Informatique','Badane Djonwajar et al.','NMI',3100,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — 2nde C et E
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','2nde C','Mathématiques','L''Excellence en Mathématiques','Tegninko V., Sienlinou D.','NMI',5500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde C','SVTEEHB','SVTEEHB','Fogha, Pouofo et autres','CLE',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde C','Physique-Chimie','L''Excellence en Physique-Chimie','Ango Yves P., Tagni Jérémie','NMI',6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde C','Informatique','L''Excellence en Informatique','Badane Djonwajar et al.','NMI',3100,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde E','Mathématiques','L''Excellence en Mathématiques','Tegninko V., Sienlinou D.','NMI',5500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde E','SVTEEHB','SVTEEHB','Fogha, Pouofo et autres','CLE',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde E','Physique-Chimie','L''Excellence en Physique-Chimie','Ango Yves P., Tagni Jérémie','NMI',6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','2nde E','Informatique','L''Excellence en Informatique','Badane Djonwajar et al.','NMI',3100,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — 2nde AC (Arts Cinématographiques)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','2nde AC','Arts Cinématographiques','Initiation aux Arts cinématographiques','F.N. Bikoï, Basseck Ba Kobhio','Terre Africaine',5000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — 1ères (Matières Communes)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','1ère','Langue Française','Langue et Méthode au 2nd cycle','Lessomo Edene et autres','AFRIC''EDUC',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Littérature','Au Cœur des ténèbres','Joseph Conrad','Eclosion',1900,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Littérature','Balafon','Engelbert Mveng','CLE',1800,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Littérature','Le Lion et la perle','Wole Soyinka','CLE',1700,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Philosophie — littéraires','Philosophie. 1ères littéraires','Foumane Josué D. et autres','MONDOUX',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Philosophie — scientifiques','Philosophie 1ères Scientifiques','Foumane Josué D. et autres','MONDOUX',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Anglais','Interactions in English','Dorothy Forbin and others','CAMBRIDGE',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Histoire','Le Monde. De la fin du XVIè siècle à 1939','Daniel Abwa et S. Mani Noah','CLE',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Education à la Citoyenneté','Education à la citoyenneté 1ères','Kouna Bah Jean et autres','MONDOUX',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère','Langues Étrangères — Allemand','Allemand: Deutsch in Africa','Ebissemie Marthe','ABID',5000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','1ère','Langues Étrangères — Espagnol','Nueva Didactica del Español IV','Habissou Bidoung','HABIBI',5900,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','1ère','Langues Étrangères — Chinois','Bonjour Cameroun 4 (Chinois)','Didier Nama','D&L',3500,'XAF','2025-2026',false,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — 1ère A et SES
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','1ère A','Mathématiques','Majors en Mathématiques','Nkeng Essombo et autres','ASVA',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère A','Sciences','Sciences','Fogha V. J. et autres','CLE',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère A','Informatique','A la conquête de l''Informatique, 1ères','Wambo, Kotto et Temgoua','R. LUSTRAL',3400,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère SES','Mathématiques','Majors en Mathématiques','Nkeng Essombo et autres','ASVA',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère SES','Sciences','Sciences','Fogha V. J. et autres','CLE',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère SES','Informatique','A la conquête de l''Informatique, 1ères','Wambo, Kotto et Temgoua','R. LUSTRAL',3400,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — 1ère C et E
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','1ère C','Mathématiques','L''Excellence en Mathématiques','Victor Tegninko et autres','NMI',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère C','SVTEEHB','L''Excellence en SVTEEHB 1ère C, TI et E','A. Oumarou Bibi, Ebang Eholé','NMI',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère C','Physique','L''Excellence en Physique 1ère C et D','Tagni Jérémie, Ango Yves','NMI',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère E','Mathématiques','L''Excellence en Mathématiques','Victor Tegninko et autres','NMI',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère E','SVTEEHB','L''Excellence en SVTEEHB 1ère C, TI et E','A. Oumarou Bibi, Ebang Eholé','NMI',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère E','Physique','L''Excellence en Physique 1ère C et D','Tagni Jérémie, Ango Yves','NMI',5000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — 1ère D et TI
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','1ère D','Chimie','L''Excellence en Chimie','Ango Yves, Abega F. et autres','NMI',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère D','Informatique','A la conquête de l''Informatique','Wambo, Kotto et Temgoua','R. LUSTRAL',3600,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère D','Mathématiques','Mathématiques 1ère D et TI','Nkeng Essombo et autres','CEPER',5500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère D','SVTEEHB','SVTEEHB','Fogha Zaboue, Mbia Ombolo','CLE',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère TI','Chimie','L''Excellence en Chimie','Ango Yves, Abega F. et autres','NMI',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère TI','Informatique','A la conquête de l''Informatique','Wambo, Kotto et Temgoua','R. LUSTRAL',3600,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère TI','Mathématiques','Mathématiques 1ère D et TI','Nkeng Essombo et autres','CEPER',5500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','1ère TI','SVTEEHB','SVTEEHB','Fogha Zaboue, Mbia Ombolo','CLE',6500,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — Terminales (Matières Communes)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','Terminale','Langue Française','Langue et méthode au 2nd cycle','Lessomo Edene et autres','AFRIC''EDUC',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Littérature','Stances et poèmes suivi de Les Epreuves','Sully Prudhomme','Eclosion',1900,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Littérature','Le Vieux nègre et la médaille','Ferdinand Oyono','EDICEF',2500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Littérature','Ngum a Jemea. La foi inébranlable de...','David Mbanga Eyombwan','CICD',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Anglais','Interaction in English','Dorothy Forbin and others','CAMBRIDGE',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Histoire','Histoire Tle','Kouna Bah, Ayuk Ayuk','MONDOUX',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Education à la Citoyenneté','Education à la citoyenneté et à la morale','Kouna Bah Jean D. et autres','MONDOUX',3900,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Langues Étrangères — Allemand','Allemand: Ihr und Wir Plus 4','Moussa Anouma et autres','HUEBER',5000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','Terminale','Langues Étrangères — Espagnol','Nueva Didactica Del Español V','Habissou Bidoung et Félix S.','HABIBI',6000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','Terminale','Langues Étrangères — Italien','Piacere! Niveau 4/B1 (Italien)','Alexandra R. Martinez','BELIN',6000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','Terminale','Langues Étrangères — Chinois','Bonjour Cameroun 4 (Chinois)','Didier Nama','D&L',3500,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','Terminale','Philosophie — littéraires','Emergeons en Philosophie. Tles littéraires','Eboni, Nguefack et Ambomo','MONDOUX',7800,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Philosophie — SES','Majors en Philosophie. Tles SES','Foumane, Ombede A. et alii','ASVA',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Philosophie — C et D','Emergeons en Philosophie. Tles C et D','Nguekack, Eboni et Ambomo','MONDOUX',5000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale','Philosophie (essai)','De la médiocrité à l''excellence','Ebénézer Njoh Mouelle','CLE',3000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée','Terminale','Philosophie (essai)','Essai sur la problématique philosophique','Marcien Towa','CLE',1800,'XAF','2025-2026',false,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — Terminale A et SES
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','Terminale A','Mathématiques','Majors en Mathématiques','Eland E. R., Fouda S., Nkoule','ASVA',3900,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale A','Informatique','A la conquête de l''Informatique, 7','Wambo, Momnougui et alii','R. LUSTRAL',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale A','Sciences — littéraires','L''Excellence en Sciences','Ebang Eholé et autres','NMI',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale SES','Mathématiques','Majors en Mathématiques','Eland E. R., Fouda S., Nkoule','ASVA',3900,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale SES','Informatique','A la conquête de l''Informatique, 7','Wambo, Momnougui et alii','R. LUSTRAL',3500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale SES','Sciences — littéraires','L''Excellence en Sciences','Ebang Eholé et autres','NMI',4000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — Terminale C et E
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','Terminale C','Mathématiques','Emergeons en Mathématiques','Pokam, Talla Nde et Ndjip N.','MONDOUX',6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale C','Physique','L''Excellence en Physique','Ango Y., Tagni J et autres','NMI',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale C','Chimie','Chimie Terminales C, D et E','Ango Y., Abega F. et autres','NMI',5500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale C','SVTEEHB','SVTEEHB, Tles C et TI','Essimbi Ngono, Mbarga Panda','MONDOUX',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale E','Mathématiques','Emergeons en Mathématiques','Pokam, Talla Nde et Ndjip N.','MONDOUX',6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale E','Physique','L''Excellence en Physique','Ango Y., Tagni J et autres','NMI',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale E','Chimie','Chimie Terminales C, D et E','Ango Y., Abega F. et autres','NMI',5500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale E','SVTEEHB','SVTEEHB, Tles C et TI','Essimbi Ngono, Mbarga Panda','MONDOUX',6500,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- LYCÉE — Terminale D et TI
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée','Terminale D','Mathématiques','Emergeons en Mathématiques','Pokam, Talla Nde et Ndjip','MONDOUX',5500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale D','SVTEEHB','SVTEEHB, Tle D','Njoumbe/Fogha et Pouofo','CLE',8000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale D','Informatique','A la conquête de l''Informatique, 7','Wambo, Momnougui et T.','R. LUSTRAL',3900,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale TI','Mathématiques','Emergeons en Mathématiques','Pokam, Talla Nde et Ndjip','MONDOUX',5500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale TI','SVTEEHB','SVTEEHB, Tles C et TI','Essimbi Ngono, Mbarga Panda','MONDOUX',6500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée','Terminale TI','Informatique','A la conquête de l''Informatique, 7','Wambo, Momnougui et T.','R. LUSTRAL',3900,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

COMMIT;
