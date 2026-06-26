-- =============================================================================
-- Corrections MINESEC 2026-2027 — Littératures, Langues étrangères, Latin/Grec/Arabe
-- =============================================================================
-- Date : 2026-06-26
-- Source : PDF officiels ESGF + ESGA signés 09 JUIN 2026 par MINESEC.
--
-- Cette migration purge les entrées multi-titres optionnelles (clonées
-- depuis 2025-2026) puis insère les titres OFFICIELS 2026-2027 — un par
-- établissement référencé dans la table.
--
-- Pattern par (classe, matière) :
--   1. TEMP capture des etabs ayant déjà une entrée pour cette classe
--      en 2026-2027
--   2. DELETE des entrées 2026-2027 de cette (classe, matière)
--   3. INSERT cross-join etabs × nouveaux titres
--
-- Idempotent : si on relance, DELETE+INSERT reproduisent l'état cible.
-- =============================================================================

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ HELPER — capture pool d'établissements par classe (réutilisé)            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE TEMP TABLE _etab_pool (
    classe TEXT, systeme TEXT, etablissement_id BIGINT,
    type_etablissement TEXT, pays TEXT
) ON COMMIT DROP;

INSERT INTO _etab_pool
SELECT DISTINCT classe, systeme_educatif, etablissement_id, type_etablissement, pays
FROM programmes_scolaires
WHERE annee_scolaire='2026-2027' AND etablissement_id IS NOT NULL;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — LITTÉRATURE 5ème → Tle                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 5ème Littérature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='5ème' AND systeme_educatif='francophone' AND matiere='Littérature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '5ème', '2026-2027', true, e.pays, 'francophone', 'Littérature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('L''Arbre Fétiche', 'P.C. Ombete Bela', 'CLE', 2000),
    ('N''kum-Wam le huitième notable', 'David Massoma Pandong', 'AFREDIT', 2000),
    ('Père inconnu', 'Pabe Mongo', 'EDICEF', 2000)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe='5ème' AND e.systeme='francophone';

-- 4ème Littérature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Littérature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '4ème', '2026-2027', true, e.pays, 'francophone', 'Littérature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Trois prétendants un mari', 'Guillaume Oyono Mbia', 'CLE', 2500),
    ('Cœur du Sahel', 'Djaili Amadou Amal', 'Proximité', 2500),
    ('L''attachement au sol natal', 'Ernest Alima', 'Ifrikiya', 1900)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe='4ème' AND e.systeme='francophone';

-- 3ème Littérature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Littérature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '3ème', '2026-2027', true, e.pays, 'francophone', 'Littérature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Ville cruelle', 'Mongo Beti', 'Présence Africaine', 2500),
    ('La marmite de Koka Mbala', 'Guy Menga', 'CLE', 1700),
    ('Petites gouttes de chant pour créer l''homme', 'René Philombe', 'CLE', 2000)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe='3ème' AND e.systeme='francophone';

-- 2nde Littérature (Matières Communes — toutes séries)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe LIKE '2nde%' AND systeme_educatif='francophone' AND matiere='Littérature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', e.classe, '2026-2027', true, e.pays, 'francophone', 'Littérature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Les Tribus de Capitoline', 'P.C. Ombete Bela', 'CLE', 3000),
    ('Poèmes sauvages éclairés au feu de brousse', 'Henri Nkoumo', 'Les Classiques Iv.', 1700),
    ('Tartuffe', 'Molière', 'Belles Lettres', 2000)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe LIKE '2nde%' AND e.systeme='francophone';

-- 1ère Littérature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe LIKE '1ère%' AND systeme_educatif='francophone' AND matiere='Littérature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', e.classe, '2026-2027', true, e.pays, 'francophone', 'Littérature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Au Cœur des ténèbres', 'Joseph Conrad', 'Eclosion', 1900),
    ('Balafon', 'Engelbert Mveng', 'CLE', 1800),
    ('Le Lion et la perle', 'Wole Soyinka', 'CLE', 1700)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe LIKE '1ère%' AND e.systeme='francophone';

-- Tle Littérature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe LIKE 'Tle%' AND systeme_educatif='francophone' AND matiere='Littérature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', e.classe, '2026-2027', true, e.pays, 'francophone', 'Littérature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Stances et poèmes suivi de Les Epreuves', 'Sully Prudhomme', 'Eclosion', 1900),
    ('Le Vieux nègre et la médaille', 'Ferdinand Oyono', 'EDICEF', 2500),
    ('Ngum a Jemea. La foi inébranlable de...', 'David Mbanga Eyombwan', 'CICD', 3000)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe LIKE 'Tle%' AND e.systeme='francophone';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — LANGUES ÉTRANGÈRES (Allemand, Espagnol, Italien, Chinois)         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 4ème Langues étrangères
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere IN ('Allemand','Espagnol','Italien','Chinois','Langues étrangères');
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '4ème', '2026-2027', true, e.pays, 'francophone', t.matiere, t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Allemand', 'Erwachen 4ème', 'Mponoh', 'NMI', 4500),
    ('Espagnol', 'Nueva Didactica del Español I', 'Habissou Bidoung, Sepulveda', 'HABIBI', 5500),
    ('Italien', 'Didactica del''Italiano', 'Mathias H. Bikitik', 'L''Harmattan', 3000),
    ('Chinois', 'J''aime le Chinois 4ème', 'Nama, Tidjon, Gouelekam', 'Africa Education', 5500)
) AS t(matiere, titre, auteur, editeur, prix)
WHERE e.classe='4ème' AND e.systeme='francophone';

-- 3ème Langues étrangères
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere IN ('Allemand','Espagnol','Italien','Chinois','Langues étrangères');
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '3ème', '2026-2027', true, e.pays, 'francophone', t.matiere, t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Allemand', 'Erwachen 3ème', 'Mponoh', 'NMI', 4500),
    ('Espagnol', 'Nueva Didactica Del Español 2', 'Habissou Bidoung, Sepulveda', 'HABIBI', 5500),
    ('Italien', 'Didactica Del''Italiano', 'Mathias H. Bikitik', 'L''Harmattan', 3500),
    ('Chinois', 'J''aime le Chinois 3ème', 'Nama, Tidjon, Gouelekam', 'Africa Education', 4000)
) AS t(matiere, titre, auteur, editeur, prix)
WHERE e.classe='3ème' AND e.systeme='francophone';

-- 2nde Langues étrangères (Matières Communes — séries littéraires)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe LIKE '2nde%' AND systeme_educatif='francophone' AND matiere IN ('Allemand','Espagnol','Italien','Chinois','Langues étrangères');
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', e.classe, '2026-2027', true, e.pays, 'francophone', t.matiere, t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Allemand', 'IHR und WIR Plus 3', 'Moussa Anouma et autres', 'HUEBER', 6000),
    ('Espagnol', 'Nueva Didactica del Español III', 'Habissou Bidoung et autres', 'HABIBI', 4900),
    ('Chinois', 'Bonjour Cameroun 3', 'Didier Nama', 'D&L', 3500)
) AS t(matiere, titre, auteur, editeur, prix)
WHERE e.classe LIKE '2nde%' AND e.systeme='francophone';

-- 1ère Langues étrangères (Matières Communes — séries littéraires)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe LIKE '1ère%' AND systeme_educatif='francophone' AND matiere IN ('Allemand','Espagnol','Italien','Chinois','Langues étrangères');
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', e.classe, '2026-2027', true, e.pays, 'francophone', t.matiere, t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Allemand', 'Deutsch in Africa', 'Ebissemie Marthe', 'ABID', 5000),
    ('Espagnol', 'Nueva Didactica del Español IV', 'Habissou Bidoung', 'HABIBI', 5900),
    ('Chinois', 'Bonjour Cameroun 4', 'Didier Nama', 'D&L', 3500)
) AS t(matiere, titre, auteur, editeur, prix)
WHERE e.classe LIKE '1ère%' AND e.systeme='francophone';

-- Tle Langues étrangères (Matières Communes — séries littéraires)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe LIKE 'Tle%' AND systeme_educatif='francophone' AND matiere IN ('Allemand','Espagnol','Italien','Chinois','Langues étrangères');
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', e.classe, '2026-2027', true, e.pays, 'francophone', t.matiere, t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Allemand', 'Ihr und Wir Plus 4', 'Moussa Anouma et autres', 'HUEBER', 5000),
    ('Espagnol', 'Nueva Didactica Del Español V', 'Habissou Bidoung, Félix S.', 'HABIBI', 6000),
    ('Italien', 'Piacere ! Niveau 4/B1', 'Alexandra R. Martinez', 'BELIN', 6000),
    ('Chinois', 'Bonjour Cameroun 4', 'Didier Nama', 'D&L', 3500)
) AS t(matiere, titre, auteur, editeur, prix)
WHERE e.classe LIKE 'Tle%' AND e.systeme='francophone';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — LATIN / GREC / ARABE                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 4ème Latin (Latinistas 4ème-3ème — mutualisé)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Latin';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '4ème', '2026-2027', true, e.pays, 'francophone', 'Latin', 'Latinistas 4ème-3ème', 'Ottou Fouda, Sabikanda', 'Eclosion', false, 5000, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e WHERE e.classe='4ème' AND e.systeme='francophone';

-- 4ème Grec
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Grec';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '4ème', '2026-2027', true, e.pays, 'francophone', 'Grec', 'Je découvre la langue grecque 4ème-3ème', 'Ottou Fouda', 'Eclosion', false, 5000, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e WHERE e.classe='4ème' AND e.systeme='francophone';

-- 4ème Arabe
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='4ème' AND systeme_educatif='francophone' AND matiere='Arabe';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '4ème', '2026-2027', true, e.pays, 'francophone', 'Arabe', 'J''apprends l''Arabe 4ème', 'S. Abba, M. Bachirou, M. Baba', 'Wisdom Publ.', false, 3000, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e WHERE e.classe='4ème' AND e.systeme='francophone';

-- 3ème Latin
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Latin';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '3ème', '2026-2027', true, e.pays, 'francophone', 'Latin', 'Latinistas 4ème-3ème', 'Ottou Fouda, Sabikanda', 'Eclosion', false, 5000, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e WHERE e.classe='3ème' AND e.systeme='francophone';

-- 3ème Grec
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Grec';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '3ème', '2026-2027', true, e.pays, 'francophone', 'Grec', 'Je découvre la langue grecque 4ème-3ème', 'Ottou Fouda', 'Eclosion', false, 5000, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e WHERE e.classe='3ème' AND e.systeme='francophone';

-- 3ème Arabe
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='3ème' AND systeme_educatif='francophone' AND matiere='Arabe';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', '3ème', '2026-2027', true, e.pays, 'francophone', 'Arabe', 'J''apprends l''Arabe 3ème', 'S. Abba, M. Bachirou, M. Baba', 'Wisdom Publ.', false, 3000, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e WHERE e.classe='3ème' AND e.systeme='francophone';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGF — Tle Philosophie (essais — manuels recommandés)                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe LIKE 'Tle%' AND systeme_educatif='francophone' AND matiere='Philosophie essais';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondaire général', e.classe, '2026-2027', true, e.pays, 'francophone', 'Philosophie essais', t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('De la médiocrité à l''excellence', 'Ebénézer Njoh Mouelle', 'CLE', 3000),
    ('Essai sur la problématique philosophique en...', 'Marcien Towa', 'CLE', 1800)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe LIKE 'Tle%' AND e.systeme='francophone';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGA — LITERATURE Form 1 → Form 5                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Form 1 Literature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='Form 1' AND systeme_educatif='anglophone' AND matiere='Literature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondary (O Level)', 'Form 1', '2026-2027', true, e.pays, 'anglophone', 'Literature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Fireside Tales', 'Charlie-Bey', 'Peng Edition', 2000),
    ('An Introduction to Poetry, Vol. 1', 'Akem H., Ngwobella M.', 'Shiloh Printers', 1200),
    ('Clean School', 'Arrey Etta M.C. Bessong', 'MONDOUX', 1000)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe='Form 1' AND e.systeme='anglophone';

-- Form 2 Literature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='Form 2' AND systeme_educatif='anglophone' AND matiere='Literature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondary (O Level)', 'Form 2', '2026-2027', true, e.pays, 'anglophone', 'Literature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Going Home', 'Ethel Joffi Molua E.', 'NYAA Publ.', 2000),
    ('An Introduction to Poetry, Vol. 2', 'Akem H., Ngwobella M.', 'Shiloh Printers', 1200),
    ('A Time to Reconcile', 'George Njimele', 'Peacock', 1200)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe='Form 2' AND e.systeme='anglophone';

-- Form 3 Literature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='Form 3' AND systeme_educatif='anglophone' AND matiere='Literature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondary (O Level)', 'Form 3', '2026-2027', true, e.pays, 'anglophone', 'Literature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('A Pen Kills', 'Lucas Ntang Tasi', 'NMI', 2500),
    ('My Cameroon and others Poems', 'Charlie Bey', 'Peng Edition', 1800),
    ('Inclusive Education: The Way to go', 'Douglas Achingale', 'NYAA Pub.', 1800)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe='Form 3' AND e.systeme='anglophone';

-- Form 4 English Literature (Drama/Prose/Poetry)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='Form 4' AND systeme_educatif='anglophone' AND matiere='Literature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondary (O Level)', 'Form 4', '2026-2027', true, e.pays, 'anglophone', 'Literature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Macbeth (Drama)', 'W. Shakespeare', 'New Swan Edit.', 3500),
    ('Lord of the Flies (Prose)', 'William Golding', 'Longman', 3500),
    ('The Crown of Thorns (Prose)', 'L.T. Asong', 'Grace Publisher', 3500),
    ('Modern Anthology of Poetry', 'Hans Bokwe Itoe', 'see in bookshops', 3000)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe='Form 4' AND e.systeme='anglophone';

-- Form 5 English Literature (idem Form 4 — programme reconduit)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe='Form 5' AND systeme_educatif='anglophone' AND matiere='Literature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'Secondary (O Level)', 'Form 5', '2026-2027', true, e.pays, 'anglophone', 'Literature', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Macbeth (Drama)', 'W. Shakespeare', 'New Swan Edit.', 3500),
    ('Lord of the Flies (Prose)', 'William Golding', 'Longman', 3500),
    ('The Crown of Thorns (Prose)', 'L.T. Asong', 'Grace Publisher', 3500),
    ('Modern Anthology of Poetry', 'Hans Bokwe Itoe', 'see in bookshops', 3000)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe='Form 5' AND e.systeme='anglophone';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ ESGA — Lower & Upper Sixth — Literature in English + GCE Texts           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Lower & Upper Sixth Literature in English (GCE A Level)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Literature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'High School (A Level)', e.classe, '2026-2027', true, e.pays, 'anglophone', 'Literature', t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Three Short Plays (The Swamp Dwellers)', 'Wole Soyinka', 'see in bookshops', 3000),
    ('Twilight of a Misty Foliage', 'Ben Jama', 'see in bookshops', 3000),
    ('Unanswered Cries', 'Osman Conteh', 'see in bookshops', 3000),
    ('The Old Man and The Sea', 'E. Hemingway', 'see in bookshops', 3000),
    ('Cosmic Anthology To Poetry', 'Vainer and Kaby', 'see in bookshops', 3500),
    ('A Raisin In The Sun', 'Lorraine Hansberry', 'see in bookshops', 3000),
    ('And Palm-Wine Will Flow', 'Bole Butake', 'see in bookshops', 2500),
    ('Nineteen Eighty Four', 'George Orwell', 'see in bookshops', 3500),
    ('Anthills of the Savannah', 'Chinua Achebe', 'see in bookshops', 3500),
    ('The Lady with the Beard', 'Alobwede d''Epie', 'CLE', 2500),
    ('The General Prologue and The Merchant''s Tale', 'Chaucer', 'see in bookshops', 4000),
    ('Selected Poems', 'John Keats', 'Dominion Publ.', 3000),
    ('Poems of Black Africa', 'Wole Soyinka', 'see in bookshops', 3000),
    ('Coriolanus', 'W. Shakespeare', 'New Swan Edit.', 3500),
    ('A Dance of The Forest', 'Wole Soyinka', 'see in bookshops', 3000),
    ('A Practical Guide to the Understanding and enjoyment of Literature in English', 'H.L. Moody', 'see in bookshops', 4000),
    ('Prose and Poetry Appreciation Handbook', 'E. Cheng and P. Tangyie', 'Presbook', 3500),
    ('A Stylistic Guide to Literary Appreciation', 'J. Nkemngong N.', 'CLE', 3000)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe IN ('Lower Sixth','Upper Sixth') AND e.systeme='anglophone';

-- Lower & Upper Sixth French Literature
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='French Literature';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'High School (A Level)', e.classe, '2026-2027', true, e.pays, 'anglophone', 'French Literature', t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Walaande. L''art de partager un mari', 'Djaili Amadou Amal', 'Proximité', 3000),
    ('Le fils d''Agatha Moudio', 'Francis Bebey', 'CLE', 3200)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe IN ('Lower Sixth','Upper Sixth') AND e.systeme='anglophone';

-- Lower & Upper Sixth Geography (split en 3 manuels distincts d'après PDF)
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere='Geography';
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'High School (A Level)', e.classe, '2026-2027', true, e.pays, 'anglophone', 'Geography', t.titre, t.auteur, t.editeur, true, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Complete Physical Geography and Contemporary Environmental Issues for Advanced Learners /Practical Geography', 'Nchangvi Sebastian Kangang', 'Grassroots Publ.', 11000),
    ('Advanced Integrated Human Geography', 'Neba Martin', 'Greenworld', 11000),
    ('Statistical Techniques and Fieldwork in Geography for Advanced Learners', 'Nchangvi S. Kangang', 'Grassroots Pub.', 4500)
) AS t(titre, auteur, editeur, prix)
WHERE e.classe IN ('Lower Sixth','Upper Sixth') AND e.systeme='anglophone';

-- Lower & Upper Sixth Mechanics + Further Mechanics
DELETE FROM programmes_scolaires WHERE annee_scolaire='2026-2027' AND classe IN ('Lower Sixth','Upper Sixth') AND systeme_educatif='anglophone' AND matiere IN ('Mechanics','Further Mechanics','Statistics');
INSERT INTO programmes_scolaires (etablissement_id, type_etablissement, niveau, classe, annee_scolaire, is_active, pays, systeme_educatif, matiere, titre_livre, auteur_livre, editeur_livre, est_obligatoire, prix_officiel, devise, type_article, quantite_defaut, date_debut_validite, date_fin_validite, periode_academique)
SELECT e.etablissement_id, e.type_etablissement, 'High School (A Level)', e.classe, '2026-2027', true, e.pays, 'anglophone', t.matiere, t.titre, t.auteur, t.editeur, false, t.prix, 'XAF', 'livre', 1, '2026-07-01'::date, '2027-06-30'::date, '2026-2027'
FROM _etab_pool e CROSS JOIN (VALUES
    ('Mechanics', 'Mathematics: Mechanics and Probability', 'L. Bostock, S. Chandler', 'Oxford', 10000),
    ('Further Mechanics', 'An Integrated Core Approach Demystified Further Mechanics', 'Piankeh A.', 'Quality Print', 4000),
    ('Statistics', 'Explaining Advanced Level Statistics', 'Napthalin A. Atanga', 'Naarat Pub.', 10000),
    ('Geology', 'Panorama of Geology A Level. Practical Manual', 'Keneth Yoisimbom', 'Grassroots', 2500)
) AS t(matiere, titre, auteur, editeur, prix)
WHERE e.classe IN ('Lower Sixth','Upper Sixth') AND e.systeme='anglophone';

-- Vérification finale
DO $$
DECLARE
    nb_2026 INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_2026 FROM programmes_scolaires WHERE annee_scolaire = '2026-2027';
    RAISE NOTICE '[fix_litt_langues_2026_2027] Total lignes 2026-2027 : %', nb_2026;
END $$;

COMMIT;
