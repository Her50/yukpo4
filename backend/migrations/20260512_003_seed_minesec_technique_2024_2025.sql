-- ============================================================================
-- Seed : Programmes nationaux MINESEC Technique 2024-2025 — Cameroun
-- Source : LISTE OFFICIELLE DES MANUELS SCOLAIRES — Enseignement Secondaire
--          Technique Industriel / Technique Industrielle (Premier et Second
--          Cycles), MINESEC, Yaoundé le 26 juin 2024.
--
-- Stratégie : etablissement_id IS NULL → référentiel national (fallback scan IA
--             et liste scolaire admin). annee_scolaire = '2025-2026' pour que
--             la détection auto côté parent (current_session_for_country)
--             trouve ces manuels — la liste 2024-2025 est encore en vigueur
--             pour le technique (pas de nouvelle liste MINESEC technique
--             publiée à ce jour).
--
-- Convention classe :
--   - Premier cycle : "1ère année <SPEC>", "2ème année <SPEC>",
--                     "3ème année <SPEC>", "4ème année <SPEC>"
--   - Second cycle  : "2nde <CODE>", "1ère <CODE>", "Tle <CODE>"
--     où <CODE> est le code officiel (F2, F3, F5, F6, F7, F8, MA, MEM,
--     COOM, MF, CM, CH-TI, GT, IB, TGF, TAG/AQ, TCPA, BIJO, etc.)
-- ============================================================================

BEGIN;

-- Index unique idempotent (référentiel national)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_programmes_national_cm
    ON programmes_scolaires(pays, classe, matiere, titre_livre, annee_scolaire)
    WHERE is_active = true AND etablissement_id IS NULL AND annee_scolaire IS NOT NULL;

-- ============================================================================
-- TRONC COMMUN TECHNIQUE — Premier Cycle (toutes spécialités)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','Tronc commun 1er cycle','Hygiène-Sécurité-Environnement','Vie sociale et professionnelle','N et S.BUJOC','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tronc commun 1er cycle','Technologie des équipements électriques','Technologie d''électrotechnique','Henry Ney','NATHAN',17500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tronc commun 1er cycle','Mesures électriques','Mesures et Essais d''électricité','B. Dupart, A LeGall, R Prêt et J. Floc''h','DUNOD',24500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tronc commun 1er cycle','Machines électriques','Machines électriques, Tle F3','Henry Ney','NATHAN',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tronc commun 1er cycle','Dessin Technique','Dessin Technique et Technologie Industrielle','Groupe d''enseignants','NEEA',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ÉLECTROMÉCANIQUE (ELME) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année ELME','Dessin technique','Premières Notions de Dessin Technique','André RICORDEAU','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ELME','Dessin technique','Premières Notions de Dessin Technique','André RICORDEAU','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ELME','Fabrication mécanique','Matériaux métalliques','Michel Colombé','Dunod',9855,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année ELME','Fabrication mécanique','Matériaux métalliques','Michel Colombé','Dunod',9855,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ELME','Electrotechnique','Electrotechnique','Théodore Wildi, Gilbert Sybille','PUL (Presses Université Laval)',43020,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année ELME','Electrotechnique','Electrotechnique','Théodore Wildi, Gilbert Sybille','PUL (Presses Université Laval)',43020,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année ELME','Electrotechnique','Electrotechnique','Théodore Wildi, Gilbert Sybille','PUL (Presses Université Laval)',43020,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ELME','Electronique','Electronic Devices and Circuit Theory','Robert L. Boylestad, Louis Nashelsky','Pearson',47000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année ELME','Electronique','Electronic Devices and Circuit Theory','Robert L. Boylestad, Louis Nashelsky','Pearson',47000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ELME','Froid et climatisation','Formulaire du froid','Pierre Rapin, Patrick Jacquard, Serge Sandre','Dunod',23870,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année ELME','Froid et climatisation','Formulaire du froid','Pierre Rapin, Patrick Jacquard, Serge Sandre','Dunod',23870,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ÉLECTRICITÉ D'ÉQUIPEMENT (ELEQ) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année ELEQ','Dessin technique','Premières Notions de Dessin Technique','André RICORDEAU','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ELEQ','Dessin technique','Premières Notions de Dessin Technique','André RICORDEAU','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ELEQ','Installations électriques domestiques','Schémas d''électrotechnique','Henri Ney','Nathan',18500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ELEQ','Installations électriques domestiques','Schémas d''électrotechnique','Henri Ney','Nathan',18500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année ELEQ','Installations électriques domestiques','Schémas d''électrotechnique','Henri Ney','Nathan',18500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année ELEQ','Installations électriques domestiques','Schémas d''électrotechnique','Henri Ney','Nathan',18500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ELEQ','Installations photovoltaïques','Le manuel du technicien photovoltaïque','Mansour Assani Dahouenon','Publication PERACOD',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ELEQ','Production, Transport et Distribution','Technologie d''Electrotechnique Bac Pro, Tomes 1 et 2','Henry Ney','HACHETTE',21500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ELEQ','Schémas électriques','Schémas d''électrotechnique','Henri Ney','Nathan',19500,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ÉLECTRONIQUE (ELNI) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année ELNI','Dessin technique','Premières Notions de Dessin Technique','André RICORDEAU','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ELNI','Dessin technique','Premières Notions de Dessin Technique','André RICORDEAU','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ELNI','Technologie','Guide du Technicien en Electronique','C. Cimelli et R. Bourgeron','HACHETTE',21500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ELNI','Energie Solaire','Energie solaire photovoltaïque','Anne Labouret, Michel Villoz','DUNOD',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ELNI','Circuits Electroniques','Electronique numérique','R. MERAT, L. ALLAY, J. P. DUBOS, J. LAFARGE, R. LEGOFF','NATHAN',17500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ELNI','Mesures Electroniques','Essais et mesures','Pierre GAROT','CASTEILLA',20000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année ELNI','Dessin Technique','Méthode active de dessin technique','André RICORDEAU, Pierre COPAIN MEFRAY','ANDRE CASTILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année ELNI','Dessin Technique','Méthode active de dessin technique','André RICORDEAU, Pierre COPAIN MEFRAY','ANDRE CASTILLA',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FROID ET CLIMATISATION (FRCL) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année FRCL','Schéma électrique','Nouveaux Schémas Électriques : Applications Frigorifiques','Jean Estrem','PYC Edition',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année FRCL','Sciences appliquées','Installations Frigorifiques, Tome 1 (Physiques Appliquées)','Pierre Rapin, Patrick Jacquard','PYC Edition',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année FRCL','Technologie','Formulaire de Froid','Pierre Rapin et Patrick Jacquard, Serge Sandre','RPF DUNOD',23000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année FRCL','Travaux pratiques','La pratique du froid','Patrick Jacquard','RPF DUNOD',40000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MENUISERIE (MENU) et CHARPENTE (CHARP) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2ème année MENU','Dessin','Aide-mémoire de dessin. Le bois','Jacques HEURTEMATTE','DELAGRAVE',16000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année CHARP','Dessin','Aide-mémoire de dessin. Le bois','Jacques HEURTEMATTE','DELAGRAVE',16000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MENU','Technologie','Technologie de menuiserie de bâtiment (Agencement-Mobilier) T. 2','J.HEURTEMATTE; J. MERCIER','DELAGRAVE',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MENU','Technologie','Technologie de menuiserie de bâtiment (Agencement-Mobilier) T. 2','J.HEURTEMATTE; J. MERCIER','DELAGRAVE',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MENU','Etude de Fabrication','Les assemblages en bois','Terric NOLL','EYROLLES',16000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MENU','Travaux Pratiques','Les assemblages choisir et mettre en œuvre','COLLECTIF LE BOUVET','EYROLLES',9170,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MENU','Travaux Pratiques','Les assemblages choisir et mettre en œuvre','COLLECTIF LE BOUVET','EYROLLES',9170,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MENU','Dessin technique','Technologie des métiers du bois tome 1','Olivier HAMON, Vincent ROULLAT','DUNOD',19650,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année CHARP','Dessin technique','Technologie des métiers du bois tome 1','Olivier HAMON, Vincent ROULLAT','DUNOD',19650,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année CHARP','Dessin','Dessin de menuiserie de bâtiment tome 1','J. HEURTEMATTE M. ORUS','DELAGRAVE',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année CHARP','Etude de Fabrication','Guide des métiers du bâtiment le menuisier','Bernard LEHEMBRE','NATHAN',9000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année CHARP','Dessin','Dessin de menuiserie de bâtiment tome 2','J. HEURTEMATTE M. ORUS','DELAGRAVE',22000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année CHARP','Etude de Fabrication','Le travail du bois','ERNEST SCOTT','Fernand Nathan',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année CHARP','Travaux Pratiques','Guide du bois de la menuiserie et de l''ébénisterie','Albert Jackson, David Day','Maison Rustique',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année CHARP','Technologie','Technologie des métiers du bois tome 1','Olivier HAMON, Vincent ROULLAT','DUNOD',19650,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année CHARP','Dessin','Aide-mémoire de dessin. Le bois','Jacques HEURTEMATTE','DELAGRAVE',16000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année CHARP','Technologie','Manuels des traits de charpente','Manfred EUCHNER','EYROLLES',32000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année CHARP','Etude de Fabrication','Traité théorique et pratique de charpente','Louis MAZEROLLE','H. VIAL DOURDAN',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année CHARP','Travaux Pratiques','Les assemblages des ossatures et charpente en bois (construction-entretien-restauration)','Manfred Gerner','EYROLLES',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année CHARP','Dessin','TRAITE DE CHARPENTE EN BOIS','MARCEL CONTET','GARNIER FRERES',49000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année CHARP','Etude de Fabrication','Charpente en bois fabrication et mise en œuvre','Collectif FFB, Collectif CAPEB - Collection Calepins de chantier','EYROLLES',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année CHARP','Travaux Pratiques','Traité de couverture','Paul Demandrille','Massin',40000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MÉTAUX EN FEUILLES (MEFE) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','3ème année MEFE','Traçage','Cours de traçage de chaudronnerie. Tome 2','CH. LOBJOIS','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MEFE','Traçage','Cours de traçage de chaudronnerie. Tome 2','CH. LOBJOIS','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MEFE','Dessin Technique','Dessin Technique et Technologie Industrielle','Groupe d''enseignants','NEEA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MEFE','Dessin Technique','Dessin Technique et Technologie Industrielle','Groupe d''enseignants','NEEA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MEFE','Technologie','Technologie professionnelle pour le chaudronnier. Tome 3','CH. LOBJOIS','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MEFE','Technologie','Technologie professionnelle pour le chaudronnier. Tome 3','CH. LOBJOIS','FOUCHER',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CARROSSERIE PEINTURE (CAPA) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2ème année CAPA','Dessin et technologie construction','Méthode active de dessin technique','ANDRE RICORDEAU, PIERRE COPAIN MEFRAY','ANDRE CASTILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année CAPA','Dessin et Technologie de Construction','Méthode active de dessin technique','ANDRE RICORDEAU; PIERRE COPAIN MEFRAY','ANDRE CASTELLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année CAPA','Dessin et Technologie de Construction','Méthode active de dessin technique','ANDRE RICORDEAU; PIERRE COPAIN MEFRAY','ANDRE CASTELLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année CAPA','Technologie','Technologie de la réparation des carrosseries (3ème édition)','YVAN VILLEGER','FOURNIE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année CAPA','Travaux pratiques','Méthode active de dessin technique','ANDRE RICORDEAU, PIERRE COPAIN MEFRAY','ANDRE CASTELLA',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONSTRUCTION OUVRAGES METALLIQUES (COOM) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2ème année COOM','Dessin technique','Initiation au dessin technique','DANIEL BIGOT','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COOM','Dessin technique','Initiation au dessin technique','DANIEL BIGOT','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année COOM','Dessin industriel','Dessin de construction en ouvrages et structures métalliques','DANIEL BIGOT','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COOM','Dessin industriel','Dessin de construction en ouvrages et structures métalliques','DANIEL BIGOT','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année COOM','Traçage','Cours de traçage, de tôlerie Chaudronnerie. Tome 2','CH. LOBJOIS','FOUCHIER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COOM','Traçage','Cours de traçage, de tôlerie Chaudronnerie. Tome 2','CH. LOBJOIS','FOUCHIER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année COOM','Traçage','Cours de traçage, de tôlerie Chaudronnerie. Tome 2','CH. LOBJOIS','FOUCHIER',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MAINTENANCE ELECTRO-MECANIQUE (MEM) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2ème année MEM','Dessin technique','Premières Notions de Dessin Technique','André RICORDEAU','ASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MEM','Dessin technique','Premières Notions de Dessin Technique','André RICORDEAU','ASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MEM','Dessin industriel','Memo Tech structure métallique','Collectif','CASTILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MEM','Mécanique Appliquée','Guide du calcul en mécanique','D. SPENLE et R. GOURHANT','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MEM','Dessin & Technologie de Construction Mécanique','Manuel de Technologie Mécanique','Guill. SABATIER ; François RAGUSA ; Hubert ANTZ','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MEM','Dessin & Technologie de Construction Mécanique','Manuel de Technologie Mécanique','Guill. SABATIER ; François RAGUSA ; Hubert ANTZ','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MEM','Dessin et technologie de construction','Méthode active de dessin technique','André RICORDEAU, Pierre COPAIN MEFRAY','ANDRE CASTILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MEM','Dessin et technologie de construction','Méthode active de dessin technique','André RICORDEAU, Pierre COPAIN MEFRAY','ANDRE CASTILLA',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MAINTENANCE AUTO (MA) / MARE / MECANIQUE AUTO RÉPARATION — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2ème année MARE','Connaissance de l''automobile','Technologie fonctionnelle de l''automobile et transmission (train roulant et équipement électrique)','Hubert MINEBEAU','DUNOD',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MARE','Connaissance de l''automobile','Technologie fonctionnelle de l''automobile et transmission (train roulant et équipement électrique)','Hubert MINEBEAU','DUNOD',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MARE','Connaissance de l''automobile','Technologie fonctionnelle de l''automobile et transmission (train roulant et équipement électrique)','Hubert MINEBEAU','DUNOD',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MARE','Moteurs à combustion interne','La technique de la réparation automobile',NULL,'Foucher',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MARE','Moteurs à combustion interne','La technique de la réparation automobile',NULL,'Foucher',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MARE','Technologie Electrique et électronique','Automobile : Electricité et Electronique','J-M LEFEBVRE ; R. TORRI et F. TOUACHE','ETAI',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MARE','Technologie Electrique et électronique','Automobile : Electricité et Electronique','J-M LEFEBVRE ; R. TORRI et F. TOUACHE','ETAI',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MARE','Schéma','Mécanique Automobile : technologies des systèmes d''allumage et d''injection essence à commandes informatisées','Guy sylvain KOUAM TCHUNEKOUO','AFREDIT',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MARE','Travaux pratiques','Guide pratique d''électricité appliquée à l''automobile pour l''enseignement technique','Célestin Bernard WABO TENGWA','HARMATHAN',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MARE','Technologie Mécanique','de l''automobile et transmission (train roulant et équipement électrique)','Hubert MINEBEAU','DUNOD',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MARE','Maintenance','Maintenance des véhicules automobiles Tome 1','Jean Claude MORIN et al','FOUCHER',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GÉNIE CIVIL — MAÇONNERIE (MACO) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année MACO','Dessin','Cours de dessin bâtiment gros-œuvre','Pierre Juste','André Castellla',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MACO','Dessin','Cours de dessin bâtiment gros-œuvre','Pierre Juste','André Castellla',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MACO','Dessin','Cours de dessin bâtiment gros-œuvre','Pierre Juste','André Castellla',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MACO','Dessin','Cours de dessin bâtiment gros-œuvre','Pierre Juste','André Castellla',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année MACO','Matériaux, matériels et procédés de réalisation','Technique de construction de bâtiment tome 1 premier cycle F4','Jean Marie Alain MBAH','St Augustin',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année MACO','Matériaux, matériels et procédés de réalisation','Technique de construction de bâtiment tome 1 premier cycle F4','Jean Marie Alain MBAH','St Augustin',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MACO','Dessin','Guide du constructeur en bâtiment — Pour maîtriser l''ingénierie civile','A. Adrait, D. Sommier','Hachette',2500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MACO','Technologie','Guide de la plomberie','MM. ADDO et CORDIER','FINE MEDIA',4500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année MACO','Analyse situation professionnelle','Installation sanitaire dans l''habitat','Stéphane Longo','Foucher',15000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSTALLATION SANITAIRE (INSA) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','3ème année INSA','Dessin','Guide du constructeur en bâtiment — Pour maîtriser l''ingénierie civile','A. Adrait, D. Sommier','Hachette',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année INSA','Technologie','La plomberie : J''installe, je pose, je change, je répare','Robert longechal','Dunod',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année INSA','Analyse situation professionnelle','Installation sanitaire dans l''habitat','Stéphane longo','Foucher',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année INSA','Dessin','Guide du constructeur en bâtiment — Pour maîtriser l''ingénierie civile','A. Adrait, D. Sommier','Hachette technique',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année INSA','Technologie','La plomberie : J''installe, je pose, je change, je répare','Robert longechal','Dunod',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année INSA','Analyse situation professionnelle','Installation sanitaire dans l''habitat','Stéphane Longo','Foucher',15000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COUTURE SUR MESURE (COME) — Premier cycle (Art et Modes)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année COME','Technologie Textile','All about Fabrics','Stephanie K. Holland','OXFORD',10000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année COME','Couture et travaux pratiques','Introduction to Needlework','Winifred M. BULL','New metric edition',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année COME','Coupe','Patrons de vêtements d''enfants (1)','JEANNE WEENS','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année COME','Dessin de mode','Initiation au Dessin de mode','STEF VENUTI/ALEXIA TERRUEL','MONDEUROP',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année COME','Dessin technique','Dessin HFI','R.BLANC, TAILLEUR/J.GUERARDI','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année COME','Couture','Modes & Travaux : je serai couturière','DMC','EDOUARD BOUCHERIT',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année COME','Technologie Textile','All about Fabrics','Stephanie K. Holland','OXFORD',10000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année COME','Couture et travaux pratiques','Introduction to Needlework','Winifred M. BULL','New metric edition',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année COME','Dessin technique','Dessin HFI','R.BLANC, TAILLEUR/J.GUERARDI','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année COME','Dessin de mode','Initiation au Dessin de mode','STEF VENUTI/ALEXIA TERRUEL','MONDEUROP',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année COME','Coupe','Patrons de vêtements d''enfants (1)','JEANNE WEENS','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année COME','Couture','Modes & Travaux : je serai couturière','DMC','EDOUARD BOUCHERIT',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COME','Hygiène-Sécurité-Environnement','Vie sociale et professionnelle','N et S.BUJOC','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COME','Technologie Textile','All about Fabrics','Stephanie K. Holland','OXFORD',10000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COME','Couture et travaux pratiques','Introduction to Needlework','Winifred M. BULL','New metric edition',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COME','Dessin technique','Dessin HFI','R.BLANC, TAILLEUR/J.GHERARDI','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COME','Dessin de Mode','Initiation au Dessin de Mode','STEF VENUTI/ALEXIA TERRUEL','MONDEUROP',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COME','Coupe','Patrons de vêtements féminins (1)','JEANNE WEENS','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année COME','Couture','Modes & Travaux','DMC','EDOUARD BOUCHERIT',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année COME','Hygiène-Sécurité-Environnement','Vie sociale et professionnelle','N et S.BUJOC','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année COME','Technologie Textile','All about Fabrics','Stephanie K. Holland','OXFORD',10000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année COME','Couture et travaux pratiques','Introduction to Needlework','Winifred M. BULL','New metric edition',3000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année COME','Dessin technique','Dessin HFI','R.BLANC, TAILLEUR/J.GHERARDI','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année COME','Dessin de Mode','Initiation au Dessin de Mode','STEF VENUTI/ALEXIA TERRUEL','MONDEUROP',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année COME','Coupe','Patrons de vêtements féminins (1)','JEANNE WEENS','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','4ème année COME','Couture','Modes & Travaux','KAMGUEM PAULINE','Edition Plage',2000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ESTHÉTIQUE COIFFURE (ESCO) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année ESCO','Coiffure Féminine','Beauté par le Naturel','KAMGUEM PAULINE','Edition Plage',2000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ESCO','Technologie des appareils et des équipements','Technologie de la coiffure Tome 3','Jean Claude AUBRY et E. BEAULIEU','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ESCO','Soins Esthétiques','Esthétique Tome 3','Sophie LEDET Véronique MONTEL','MALOINE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ESCO','Cosmétologie','Précis d''esthétique cosmétique','M. HERMANDEZ MERCIER et FRENEL','VIGOT',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ESCO','Technologie des appareils de coiffure et des équipements','Technologie de la coiffure CAP-BP, Tome 1','J. C. AUBRY E. Beaulieu','LICET',8500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ESCO','Dessin d''arts appliqués','Guide Marabout du Dessin','Jose Premont','Loisir',7000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ESCO','Biologie Appliquée','Collection Planète Vivante','HATIER Internationale','Equipe d''enseignant',6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année ESCO','Sécurité électrique','Guide des Métiers Electricien','Jacques Digout','NATHAN',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année ESCO','Biologie Appliquée','Collection Planète Vivante','HATIER Internationale','Equipe d''enseignant',6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année ESCO','Esthétique','Beauté par le Naturel','KAMGUEM PAULINE','Edition Plage',2000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','3ème année ESCO','Maquillage','Tout Savoir Pour le Maquillage Permanent','ELEONORA HABNIT','FAVRE',8000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TECHNIQUES AGRICOLES — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1er cycle TAG/PPO','Technique d''élevage des porcs','Pig management and production: a practical guide for farmers and students','Dereck H. Goodwin','The anchor press Ltd',23000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1er cycle TAG/PVO','Technique d''élevage des poulets','The tropical agriculturalist : Poultry','Anthony J. Smith','Maisonneuve Larose',12500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1er cycle TAG/PCE','Technique culturale','Agricultural sciences for WASSCE and SSCE','A. M. Daramola','University Press PLC',12500,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INDUSTRIE DU BOIS — Affûtage Sciage (AF-SC) — Premier cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année AF-SC','Dessin','Dessin Industriel menuiserie Vol 1 cours','Edouard Bahr','Eyrolles',NULL,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','1ère année AF-SC','Technologie','Technologie générale Vol 1','H. TRILLAT','DUNOD',NULL,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','2ème année AF-SC','Technologie des matériaux','Manuel de Dendrologie','SOUANE THIRAKUL, B.Sc.F., M.F.','Groupe poulin, THERIAULT QUEBEC',15000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','2ème année AF-SC','Technologie professionnelle','Le Sciage du Bois','J. Heurtematte, R. Keller','Delagrave',10000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','2ème année AF-SC','Le sciage','Le Sciage du Bois','J. Heurtematte, R. Keller','Delagrave',10000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','3ème année AF-SC','La maintenance des lames de scie','Entretien et Affûtage des Outils de Coupe','Frédéric Anquetil, Henri Boyer, Jacques Juan','Centre Technique du Bois et de l''Ameublement',15000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','3ème année AF-SC','L''affûtage des autres outils de coupe du bois','Entretien et Affûtage des Outils de Coupe','Frédéric Anquetil, Henri Boyer, Jacques Juan','Centre Technique du Bois et de l''Ameublement',15000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','3ème année AF-SC','L''exécution d''un cahier de charge en sciage et affûtage','Utilisation et Transformation des Bois','Hervé Deschênes','Modulo Editeur',8000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','3ème année AF-SC','Technologie professionnelle','Organisation Industrielle Production Entretien Manutention','Chevalier et J. Rollet','Imprimerie HERISSEY, Evreux',9000,'XAF','2025-2026',false,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INDUSTRIE DU BOIS (IB) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde IB','Connaissance du matériau','Manuel de Dendrologie','SOUANE THIRAKUL, B.Sc.F., M.F.','Groupe Poulin, QUEBEC',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IB','Procédés de Transformation','Utilisation et Transformation des Bois','Hervé Deschênes','Modulo Editeur',8000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IB','Mesure','Sciages Avivés Tropicaux Africains Règles de Classement','CTFT','CTFT',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IB','Dessin','Méthode Active de Dessin Technique','André Ricardeau et Pierre COMPAIN MEFRAY','Edition ANDRE Casteilla',4000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère IB','Connaissance du matériau','Memento du Forestier','Centre Technique Forestier Tropical','Centre Technique Forestier Tropical (CTFT)',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle IB','Connaissance du Matériau bois','Guide Pratique Atlas des bois tropicaux','Jean Gérard et Al','ITTO',10000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TECHNIQUE ET GESTION FORESTIERE (TGF) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Ecologie forestière','Ecologie forestière 1998','Hans Jurgen OTTO','IDF',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Topographie','Traité de topographie et de géodésie. 2ème édition','Emile Emmanuel REGNEAULT','TIME LIFE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Cartographie forestière','Analyse de la texture en cartographie','Ahmed HAMMOUCH','FAO',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Mesure','Manuel d''inventaire forestier','Groupe d''experts','FAO',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Géomatique','Géomatique forestière','Dr MBEVO PHILIPPE, MBE MARTIN','UNIVERSITE de DOUALA 1ère EDITION',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Gestion forestière','Planification forestière','Groupe d''experts','FAO',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Opérations forestières','Exploitation forestière au Cameroun','Henri Christian ABO EYALA''A','MINFOF',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Aménagement forestier','L''homme et les forêts tropicales','François CHARNEL','MINFOF/RAMADE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Pédologie','Les sols forestiers','François CHARNEL','RAMADE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Sylviculture','Précis de sylviculture 1986','François CHARNEL, L.LANIER','AGROPARISTECH',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Ecologie forestière','Ecologie forestière','Philbert GRUINIER','AGROPARISTECH',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TGF','Législation','Législation forestière au Cameroun','Groupe d''experts','MINFOF',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GÉOMÈTRE TOPOGRAPHE (GT) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde GT','Exploitation','Chantiers de bâtiment. Préparation et suivi','Bernard VUILLERME, Henri RICHAUD','NATHAN',17500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Exploitation','Chantiers de bâtiment. Préparation et suivi','Bernard VUILLERME, Henri RICHAUD','NATHAN',17500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde GT','Sols et matériaux','Technologie des matériaux de construction. Tome I & 2','Emile Olivier','ENTREPRISE MODERNE D''EDITION',20500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Sols et matériaux','Technologie des matériaux de construction. Tome I & 2','Emile Olivier','ENTREPRISE MODERNE D''EDITION',20500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde GT','Laboratoire','Granulats, Sols, Ciments et Bétons','R. DUPAIN et AL','Casteilla',7500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Laboratoire','Granulats, Sols, Ciments et Bétons','R. DUPAIN et AL','Casteilla',7500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde GT','Topographie','Topographie appliquée aux travaux publics, bâtiments et levers urbains.','Lucien LAPOINTE, Gilles MEYER','EYROLLES',7500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Topographie','Topographie appliquée aux travaux publics, bâtiments et levers urbains.','Lucien LAPOINTE, Gilles MEYER','EYROLLES',7500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Métré','Guide de métré. Initiation à l''étude des prix','Un groupe d''auteurs','Les editions St AUGUSTIN',6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle GT','Métré','Métré et estimation prévisionnelles des travaux publics','HUBERT PASCAL','EYROLLES',14500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Topographie','Topométrie générale, 3e édition','Duquette, R., & Lauzon','Presses internationales Polytechnique Montréal',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle GT','Topographie','Topométrie générale, 3e édition','Duquette, R., & Lauzon','Presses internationales Polytechnique Montréal',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Géodésie','Introduction à la géodésie','Jean-Philippe Dufour','Hermès - Lavoisier',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle GT','Calculs topométriques','Cours de calculs topo métriques','LEROIX','Eyrolles',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde GT','Droit professionnel et règlementation','Régime foncier et domanial du Cameroun','MINDCAF','Imprimerie Nationale',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Photogrammétrie','Photogrammétrie générale, Tome 1','BONNEVAL, H','Eyrolles',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Droits fonciers','Droits fonciers urbains au Cameroun','Prof. André TIENTCHEU NJIAKO','Arika.',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère GT','Dessin topographique et dao','Dessiner un plan topographique à l''aide du logiciel AutoCAD Civil 3D','Jean-François, Meunier','Presses Internationales Polytechnique. Montréal',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle GT','Dessin topographique et dao','Dessiner un plan topographique à l''aide du logiciel AutoCAD Civil 3D','Jean-François, Meunier','Presses Internationales Polytechnique. Montréal',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GÉNIE CIVIL / BÂTIMENT (F4/BA) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde F4','Dessin','Guide du constructeur en bâtiment (nouvelle édition)','R. ADRAIT et D. SOMMIER','HACHETTE TECHNIQUE',17500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde F4','Mécanique Appliquée','Mécanique 1er F','Pierre Agati, Nicolas MATTERA, Gérard DELVILLE','TECHNIQUE ET VULGARISATION',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère F4','Mécanique Appliquée','Mécanique 1er F','Pierre Agati, Nicolas MATTERA, Gérard DELVILLE','TECHNIQUE ET VULGARISATION',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère F4','Dessin','Dessin Technique. Lecture de plan.','H. RENHAUT','FOUCHER',10500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère F4','Exploitation','Organisation pratique des chantiers. T. 1 & 2','Emile Olivier. RENHAUT','ENTREPRISE MODERNE D''EDITION',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère F4','Procédés de construction','Procédés généraux de construction','JACQUES MATHIVAT','EYROLLES',15500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle F4','Dessin','Dessin technique de bâtiment et de travaux publics','GEORGES KIENERT','EYROLLES',20000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle F4','Mécanique Appliquée','Cours de béton armé. BAEL 91. Calcul des éléments simples et des structures de bâtiment.','Jean-Pierre MOUGIN','EYROLLES',10000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle F4','Procédés de construction','La construction métallique','BERNARD LEHEMBRE','CEPER - NATHAN',12000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSTALLATION SANITAIRE ET RÉSEAUX HYDRAULIQUES (ISRH) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde ISRH','Mécanique des structures et des fluides','Cours de mécanique','MATTERA N ET AGATI P.','CLASSIQUES',20000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde ISRH','Système d''installation Hydraulique','La plomberie : J''installe, je pose, je répare','Robert longechal','Dunod',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde ISRH','Procédés assainissement','Branchements : eau potable et assainissement','Henri Renaud','Eyrolles',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde ISRH','Matériaux','Installation sanitaire dans l''habitat','Stéphane longo','Foucher',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde ISRH','TP Maintenance','Réparer la plomberie','Thierry Callauziaux, David Fédullo','Eyrolles',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère ISRH','Dessin','Guide du constructeur en bâtiment - Pour maîtriser l''ingénierie civile','Adrait et D. Sommier','Hachette technique',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère ISRH','TP Installation Hydraulique','Installation sanitaire dans l''habitat','Stéphane longo','Foucher',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère ISRH','TP Assainissement','Branchements : eau potable et assainissement','Henri Renaud','Eyrolles',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère ISRH','Mécanique des structures et des fluides','Mécanique des fluides en 20 fiches','Pascal BIGOT, Richart Mauduit, Eric Wenner','Dunod',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère ISRH','Système d''installation Hydraulique','La plomberie : J''installe, je pose, je change, je répare','Robert longechal','Dunod',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère ISRH','Adduction et Distribution','Branchements : eau potable et assainissement','Henri Renaud','Eyrolles',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle ISRH','Dessin','Guide du constructeur en bâtiment - Pour maîtriser l''ingénierie civile','C. Adrait, D. Sommier','Hachette technique',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle ISRH','TP Installation Hydraulique','Installation sanitaire dans l''habitat','Stéphane longo','Foucher',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle ISRH','TP Assainissement','Installation sanitaire dans l''habitat','Stéphane longo','Foucher',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle ISRH','TP Distribution','Installation sanitaire dans l''habitat','Stéphane longo','Foucher',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle ISRH','Mécanique des structures et des fluides','Mécanique des fluides en 20 fiches','Pascal BIGOT, Richart Mauduit, Eric Wenner','Dunod',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle ISRH','TP Adduction','Branchements : eau potable et assainissement','Henri Renaud','Eyrolles',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle ISRH','TP Maintenance','Réparer la plomberie','Thierry Callauziaux, David Fédullo','Eyrolles',12000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ÉLECTRONIQUE (F2) — Second Cycle (Génie Électrique)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nd cycle F2','Schéma et Technologie, Projet','Mémotech électronique : Circuits et composants','JC Chauvau, G. Chevalier, B. Chevalier','Casteilla',13500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle F2','Electronique','Alimentations, thyristors, optoélectronique','André Champenois','Édition du renouveau pédagogique',NULL,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','1ère F2','Dessin - Technologie','Technologie d''Electrotechnique Bac Pro, Tomes 1 et 2','Henry Ney','Nathan',17500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère F2','Circuits Electroniques Industriels et Numériques (CEIN)','Schémas et études d''équipements','Pierre Boye, Gabriel Augereau, André Bianciotto','DELAGRAVE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle F2','Installations Electriques','Technologie d''Electrotechnique Bac Pro, Tome 1','Henry Ney','Nathan',17500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle F2','Commande de Machines','Technologie d''Electrotechnique Bac Pro, Tome 2','Henry Ney','Nathan',17500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle F2','Electronique de Puissance','Mesures et Essais d''Electricité','B. Dupart, A. Le Gall, R. Prêt et J. Floc''h','Dunod,',24500,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ÉLECTROTECHNIQUE (F3) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde F3','Réfrigération de base','Le Livre de Réfrigération de base','Groupe d''enseignants','Editions St Augustin',8500,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','2nde F3','Mécanique d''entretien','l''ABC du Froid','Robert Therville','PYC Edition',45000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','1ère F3','Dessin Industriel','Guide du Dessinateur Industriel','André Chevalier','Hachette',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère F3','Electricité - Electronique','Machines électriques, Tle F3','Jean Niard','NATHAN',25000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère F3','Froid Commercial','Le nouveau POHLMANN : Manuel Technique du Froid','Maake- Eckert','PYC Edition',12500,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','Tle F3','Climatisation - Ventilation','Aide-Mémoire du Génie Climatique','Jean Desmon','RPF DUNOD',30000,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','Tle F3','Réfrigération','Mémotech du Génie Energétique','Oughla Mehdi','EL Educalivre',10500,'XAF','2025-2026',false,true),
    ('CM','francophone','Lycée/Collège technique','Tle F3','Transfert Thermique','Installations Frigorifiques T. 2','Pierre Rapin et Patrick Jacquard','PYC Edition',20000,'XAF','2025-2026',false,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MINE ET PÉTROLE (F6/MIPE) — Second Cycle (Génie Chimique)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère MIPE','Affinage minier','Métallurgie extractive vol. 2 Opérations, procédés et filières d''élaboration','A.VIGNES / Hermes','Lavoisier',28000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MIPE','Affinage minier','Métallurgie extractive vol. 2 Opérations, procédés et filières d''élaboration','A.VIGNES / Hermes','Lavoisier',28000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère MIPE','Gaz et pétrole','Le raffinage du pétrole — T.1 Pétrole brut, produits pétroliers, sch. Procédés de séparation','J.P. WAUQUIER','Technip',12500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MIPE','Gaz et pétrole','Le raffinage du pétrole — T.1 Pétrole brut, produits pétroliers, sch. Procédés de séparation','J.P. WAUQUIER','Technip',12500,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde MIPE','Procédé minier et procédé pétrolier','Génie minier et pétrolier - Retours d''expériences, exploitation des mines, du pétrole, du sel, stockage souterrain','Pierre Duffaut, Comité français de mécanique des roches','Presses des Mines Transvalor',40000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère MIPE','Procédé minier et procédé pétrolier','Génie minier et pétrolier - Retours d''expériences, exploitation des mines, du pétrole, du sel, stockage souterrain','Pierre Duffaut, Comité français de mécanique des roches','Presses des Mines Transvalor',40000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MIPE','Procédé minier et procédé pétrolier','Génie minier et pétrolier - Retours d''expériences, exploitation des mines, du pétrole, du sel, stockage souterrain','Pierre Duffaut, Comité français de mécanique des roches','Presses des Mines Transvalor',40000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- BIOPROCÉDÉ ET PÉTROCHIMIE (BIPE / F6) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère BIPE','Chimie organique industrielle','Technologies des bioprocédés industriels','Louis TESSIER','ISBN',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle BIPE','Chimie organique industrielle','Technologies des bioprocédés industriels','Louis TESSIER','ISBN',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère BIPE','Génie des procédés','Principes fondamentaux du génie des procédés et de la technologie chimique','HENRI FAUDUET','Lavoisier TEC & DOC,',27000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle BIPE','Génie des procédés','Principes fondamentaux du génie des procédés et de la technologie chimique','HENRI FAUDUET','Lavoisier TEC & DOC,',27000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COSMÉTIQUE ET PHARMACIE (COPH / F6) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère COPH','Cosmétique','Formulation cosmétique. Matières premières, concept et procédés innovants','Jean marie AUBRY et Henri SABAG','EDP Sciences',37000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle COPH','Cosmétique','Formulation cosmétique. Matières premières, concept et procédés innovants','Jean marie AUBRY et Henri SABAG','EDP Sciences',37000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère COPH','Pharmacologie','Pharmacie galénique Formulation et pharmaceutique technologie','Vangelis ANTZOULATOS et al.','Editeurs Maloine, collection Etudes',33000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle COPH','Pharmacologie','Pharmacie galénique Formulation et pharmaceutique technologie','Vangelis ANTZOULATOS et al.','Editeurs Maloine, collection Etudes',33000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère COPH','Biochimie générale','Biochimie de Harper','Bender et al.','Deboeck',55000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle COPH','Biochimie générale','Biochimie de Harper','Bender et al.','Deboeck',55000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SCIENCES BIOCHIMIQUES (F7) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nd cycle F7','Biotechnologie','Biotechnologies','Afonso Juliette, Justine Lasalle, Sophie Naud Sabine, Orsoni Charlotte Vernier','Editions Delagrave',20000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle F7','Biochimie','Biochimie: Le manuel Broché','Olivier Masson','Santé Diététique Editions',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle F7','Microbiologie','Manuel de microbiologie travaux pratiques - partie générale','Dr. Mihaela-Diana Popa, Axel Balogh de Manko-Bük','Victor Babeş',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle F7','Travaux pratiques analyse microbiologique','Manuel des Travaux Pratiques de Bactériologie','Dr. BOUSSENA SABRINA','Institut des Sciences Vétérinaires Département de Productions Animale',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CHIMIE INDUSTRIELLE ET BIOMÉDICALE (F8) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nd cycle F8','Travaux pratiques Soins infirmiers','Manuel de diagnostics infirmiers : apport essentiel aux constats d''évaluation et directives infirmières (16e édition)','ELSEVIER-MASSON','Carpenito-Moyet, Lynda Juall',30000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle F8','Soins Infirmiers','Manuel des Soins Infirmiers','MSF International Nursing Care WG','MSF International',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle F8','Santé publique et organisation sanitaire','Manuel de santé publique','Jacques Raimondeau, Pierre-Henri Bréchat','Presses de l''EHESP',30000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle F8','Biologie et physiopathologie humaines','Biologie et physiopathologie humaines','I. Fanchon, C. Malingue','Nathan',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MENUISERIE ÉBÉNISTERIE (MEB / AMEB) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde AMEB','Dessin et style','Précis d''ameublement Aménagement du cadre de vie (Dessin, conception et normalisation)','J.J LAPOIRIE, M-C ASTRE, A.FONT','AFNOR',29475,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde AMEB','Etude matériaux','Ebénisterie : Les premiers gestes','BERNARD DAUDE','VIAL',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde AMEB','Procédés de fabrication','Les métiers du bâtiment : la menuiserie dans l''habitat','Dominique VALLEE','FOURCHER',20000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde AMEB','Travaux Pratiques','Manuel complet du travail du bois','Christ Tribe','EYROLLES',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AMEB','Dessin et style','Dessin de menuiserie de bâtiment t. 3','J. HEURTEMATTE M. ORUS','DELAGRAVE',22000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AMEB','Procédés de Finition','Guide des finitions du bois','DERRICK CRUMP','LA MAISON RUSTIQUE',14000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AMEB','Procédés de fabrication','Usinage du bois','J.HEURTEMATE M.ORUS P. POUZEAU','DELAGRAVE',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AMEB','Travaux Pratiques','Art et technique menuiserie ébénisterie','GRAND MABILLE','MASSIN',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AMEB','Dessin et style','Etudes des styles de mobilier','A. AUSSEL CH. BAJONET','DUNOD',13000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AMEB','Procédés de Finition','Ameublement et produits de finition','Collectif','CTBA',24000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AMEB','Procédés de fabrication','Traité d''ébénisterie','L. Chanson','VIAL',6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AMEB','Gestion de la Production','Le guide qualité de la gestion de la production','Georges JAVEL','DUNOD',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AMEB','Réfection des Meubles','Les sièges : théorie et pratique','Collectif','LE BOUVET',9000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AMEB','Travaux Pratiques','Le Grand livre du bois','Jordi VIGUE ; Vincenç Gilbert ; Martine Richebé','Place des victoires',12000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MAINTENANCE AUTO (MA) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde MA','Technologie de l''automobile','Automobile : Electricité et Electronique','J-M LEFEBVRE ; R. TORRI et F. TOUACHE','ETAI',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère MA','Technologie de l''automobile','Automobile : Electricité et Electronique','J-M LEFEBVRE ; R. TORRI et F. TOUACHE','ETAI',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MA','Technologie de l''automobile','Automobile : Electricité et Electronique','J-M LEFEBVRE ; R. TORRI et F. TOUACHE','ETAI',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde MA','Maintenance des moteurs à combustion','Maintenance des véhicules automobiles Tome 1','Jean Claude MORIN et al','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère MA','Maintenance Liaisons mécaniques et hydrauliques','Maintenance des véhicules automobiles Tome 2','Jean Claude MORIN et al','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MA','Maintenance systèmes électrique et électronique','Guide pratique d''électricité appliquée à l''automobile pour l''enseignement technique','Célestin Bernard WABO TENGWA','HARMATHAN',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MA','Mécanique Appliquée','Mécanique (Reflexe)','Bernard B. & AL','NATHAN',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- BIJOUTERIE - JOAILLERIE (BIJO) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nd cycle BIJO','Travaux de finition','Techniques de la bijouterie','Stephen O''keeffe','Amazon.fr',35000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle BIJO','Sertissage','Le sertissage de bijoux -','Anastasia YOUNG','Unitheque.com',15000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle BIJO','Art et techniques','Art et techniques de la Bijouterie','Anastasia YOUNG','Unitheque.com',35000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MAINTENANCE ELECTRO-MÉCANIQUE (MEM) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère MEM','Dessin Technique','Dessin Technique et Technologie Industrielle','Groupe d''enseignants','NEEA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MEM','Dessin Technique','Dessin Technique et Technologie Industrielle','Groupe d''enseignants','NEEA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde MEM','Dessin & Technologie de Construction Mécanique','Manuel de Technologie Mécanique','Guill. SABATIER ; François RAGUSA ; Hubert ANTZ','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère MEM','Dessin & Technologie de Construction Mécanique','Construction Mécanique Tome 1 & Tome 2','J.M. CELERIER','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MEM','Mécanique Appliquée','Mécanique','Jean Louis FANCHON','NATHAN',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FABRICATION MÉCANIQUE (FM) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Travaux Pratiques','Ajustage','Plassard P. et Defour G.','Edition Hachette,',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Fabrication mécanique','Guide Pratique de la Productique','A. Chevalier ; J. Bohhan et A. Molina','Edition Hachette (Technique),',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Travaux Pratiques','Manuel de l''ajusteur','Makienko N','Edition MOSCOU MIR,',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Technologie des Matériaux','Précis Métallurgie','Jean Bbarralis et Gerald Maeder','Afnor - Nathan Edition',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Analyse de Fabrication','Guide du Bureau des Méthodes','G. Branger','Desforges Paris',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Outillage','Guide du Technicien en Productique','A. Chevalier et J. Bohhan','Hachette Technique Edition',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Travaux Pratiques','Procédés de Fabrication Industrielle,','Langlois B','Edition Polytechnique Ecole de Montréal',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Travaux Pratiques','Précis des Méthodes d''Usinage : Méthodologie, Production et Normalisation','Dietrich, R','5ième Edition, Nathan, Afnor',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle FM','Commande Numérique','Usinage et Commande Numérique','A. Comand ; T. Kolb','FOUCHER',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MÉTAUX EN FEUILLES (MF) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde MF','Travaux Pratiques Commande Numérique','Guide pratique de l''usinage','J. Lacombe ; I. Rak','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde MF','Technologie','Technologie professionnelle pour le chaudronnier. Tome 3','CH. LOBJOIS','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde MF','Dessin Technique','Premières notions de dessin technique','ANDRE RICARDEAU','CASTELLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde MF','Traçage','Cours de traçage, de tôlerie Chaudronnerie. Tome 2','CH. LOBJOIS','FOUCHIER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère MF','Mécanique Appliquée','Guide du calcul en mécanique','SPENLE et R. GOURHANT','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MF','Mécanique Appliquée','Guide du calcul en mécanique','SPENLE et R. GOURHANT','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère MF','Dessin industriel','Memotech structure métallique','Collectif','CASTELLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle MF','Dessin industriel','Memotech structure métallique','Collectif','CASTELLA',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONSTRUCTION MÉCANIQUE (CM) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde CM','Technologie','Technologie professionnelle pour le chaudronnier. Tome 3','CH. LOBJOIS','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde CM','Dessin Technique','Premières notions de dessin technique','ANDRE RICARDEAU','CASTELLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde CM','Traçage','Cours de traçage, de tôlerie Chaudronnerie. Tome 2','CH. LOBJOIS','FOUCHIER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère CM','Mécanique Appliquée','Guide du calcul en mécanique','SPENLE et R. GOURHANT','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle CM','Mécanique Appliquée','Guide du calcul en mécanique','SPENLE et R. GOURHANT','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère CM','Dessin industriel','Memotech structure métallique','Collectif','CASTELLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle CM','Dessin industriel','Memotech structure métallique','Collectif','CASTELLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère CM','Dessin & Technologie de Construction Mécanique','Manuel de Technologie Mécanique','Guill. SABATIER ; François RAGUSA ; Hubert ANTZ','HACHETTE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle CM','Dessin & Technologie de Construction Mécanique','Manuel de Technologie Mécanique','Guill. SABATIER ; François RAGUSA ; Hubert ANTZ','HACHETTE',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CHAUDRONNERIE TUYAUTERIE INDUSTRIELLE (CH-TI) — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nd cycle CH-TI','Technologie','Techniciens tuyauteurs, chaudronniers, métalliers et soudeurs','HAZARD CLAUDE','DELAGRAVE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle CH-TI','Traçage','Cours de traçage, de tôlerie Chaudronnerie. Tome 2','CH. LOBJOIS','FOUCHIER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle CH-TI','Dessin et technologie de construction','Méthode active de dessin technique','ANDRE RICORDEAU, PIERRE COPAIN MEFRAY','ANDRE CASTILLA',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TECHNIQUES AGRICOLES — Second Cycle
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nd cycle TAG/AQ','Aquaculture','Comment produire du poisson à coût modéré','Victor Pouomogne','Presses universitaires d''Afrique',11000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TAG/PM','Producteurs Monogastriques','Memento de l''agronome','CIRAD-GRET, Ministère des Affaires étrangères','Société Jouve',7000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TAG/PCLC','Producteur de Céréales, Légumineuses et Champignons','Memento de l''agronome','CIRAD-GRET, Ministère des Affaires étrangères','Société Jouve',27000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TCPA','Transformation et Conservation des Produits Agricoles','Science des aliments 2 — Technologie des produits alimentaires','R.JEANTET/T.CROGUENNEC/P.SCHUCK/G.BRULE','Lavoisier/Tec et Doc',12000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nd cycle TCPA','Chimie physique - Analyses - Chimiques Contrôle qualité','Techniques d''analyse et de contrôle dans les industries agroalimentaires Tome 4 : analyses des constituants alimentaires (2ème éd.) coll. Sciences et techniques agroalimentaires','MULTON Jean-Louis','Lavoisier S.A.S',9000,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ARTS et SÉRIES ARTISTIQUES (AF1 Céramique / AF2 Peinture / AF3 Sculpture)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde AF1','Pratique de la céramique','Céramique : Techniques de décor sur cru et biscuit','MOLLY HATCH','Eyrolles',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde AF1','Technologie de la céramique','Céramiques- technologies caractéristiques','Pierre LEFORT','SIAL',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde AF2','Pratique de la peinture','Le grand livre des activités artistiques','Ramon de Jesus Rodriguez','France Loisirs',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde AF3','Pratique de la sculpture','Manuel de sculpture sur bois : perfectionnement','Jean Pol GOMERIEUX','Vial',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde AF3','Technologie de la sculpture','Le guide complet de la sculpture (techniques et matériaux)','BARRY MIDGLEY','Ullisse',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde AF3','Histoire de l''art','Petites Histoires de l''art en 100 chefs d''œuvre','Susie Hodge','Pyramyd',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AF1','Pratique de la céramique','Céramique : Techniques de décor sur cru et biscuit','MOLLY HATCH','Eyrolles',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AF2','Pratique de la peinture','Le grand livre de la peinture à l''huile','Collectif','BORDAS',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AF2','Technologie de la peinture','Manuel de peinture II et vernis- des concepts à l''application','André Revillon, Pierre-Camille LACAZE','Eyrolles',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère AF3','Pratique de la sculpture','Manuel de sculpture : Techniques et création','JOHN PLOWMAN','Eyrolles',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AF1','Technologie de la sculpture','Sculpture : Guide des finitions','JOHN PLOWMAN','Eyrolles',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AF1','Histoire de l''art','Petites Histoires de l''art en 100 chefs d''œuvre','Susie Hodge','pyramid',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AF1','Dessin d''après nature','Le Guide de l''abc du dessin','Armand CASSAGNE','Vigot',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AF2','Pratique de la peinture','Le grand livre de la peinture à l''huile','collectif','BORDAS',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AF2','Technologie de la peinture','Manuel de peinture II et vernis- des concepts à l''application','André Revillon, Pierre-Camille LACAZE','Eyrolles',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle AF3','Pratique de la sculpture','Manuel de sculpture : Techniques et création','JOHN PLOWMAN','Eyrolles',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INDUSTRIE DE L'HABILLEMENT (IH) — Second Cycle (Art et Modes)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','2nde IH','Technologie des textiles','Textile Technology : The Motivate','ANDREA WYNNE',NULL,20000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IH','Patronage','Pattern Making and Grading','Metric Patterns',NULL,6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IH','Dessin Technique','Dessin HFI','R.BLANC, TAILLEUR/J.GHERARDI','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IH','Dessin de Mode','Initiation au Dessin de mode','STEF VENUTI/ALEXIA TERRUEL','MONDEUROP',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IH','Technologie des machines','Technologie des machines','G.DUGAS','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IH','Patrons / Patronage - gradation','Patrons de vêtements féminins (1)','JEANNE WEENS','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2nde IH','Analyse et fabrication','L''Organisation du travail dans les Industries de l''Habillement.','ANDRE LAURIOL','L''USINE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère IH','Technologie des textiles','Textile Technology : The Motivate','ANDREA WYNNE',NULL,20000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère IH','Patronage','Pattern Making and Grading','Metric Patterns',NULL,6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère IH','Patronage / Gradation','Patrons de vêtements féminins (1)','JEANNE WEENS','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère IH','Dessin Technique','Dessin HFI','R.BLANC, TAILLEUR/J.GHERARDI','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère IH','Dessin de Mode','Initiation au Dessin de mode','STEF VENUTI/ALEXIA TERRUEL','MONDEUROP',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère IH','Technologie des machines','Technologie des machines','G.DUGAS','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère IH','Organisation du travail','L''Organisation du travail dans les Industries de l''Habillement.','ANDRE LAURIOL','L''USINE',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle IH','Technologie des textiles','Textile Technology : The Motivate','ANDREA WYNNE',NULL,20000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle IH','Patronage','Pattern Making and Grading','Metric Patterns',NULL,6000,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle IH','Patronage / Gradation','Patrons de vêtements féminins (1)','JEANNE WEENS','CASTEILLA',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle IH','Dessin de Mode','Initiation au Dessin de mode','STEF VENUTI/ALEXIA TERRUEL','MONDEUROP',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle IH','Technologie des machines','Technologie des machines','G.DUGAS','FOUCHER',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','Tle IH','Analyse et fabrication','L''Organisation du travail dans les Industries de l''Habillement.','ANDRE LAURIOL','L''USINE',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DÉCORATION (DECO) — Premier cycle (Art et Modes)
-- ============================================================================
INSERT INTO programmes_scolaires
    (pays, systeme_educatif, niveau, classe, matiere, titre_livre, auteur_livre, editeur_livre, prix_officiel, devise, annee_scolaire, est_obligatoire, is_active)
VALUES
    ('CM','francophone','Lycée/Collège technique','1ère année DECO','Décoration modelée','Le livre du céramiste : techniques et conseils pour l''atelier','DUNCAN HOOSON, ANTHONY QUINN','La revue de la céramique et du verre',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','1ère année DECO','Dessin de décor','Education artistique. Adaptation française : Livre et exercices','Lucia Iazotti','Bulgarini-Firenze',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année DECO','Décoration picturale','Le grand livre du dessin et de la peinture','KATE WILSON','Pyramyd',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année DECO','Décoration sur bois','Manuel de sculpture sur bois : technologie et initiation','Jean Paul GOMERIEUX','Vial',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année DECO','Histoire de l''Art','Cameroun : art et architecture suivi de l''art de la sculpture','Henri MOUSSIMA NJANJO','L''Harmattan',NULL,'XAF','2025-2026',true,true),
    ('CM','francophone','Lycée/Collège technique','2ème année DECO','Outillage','Arts plastiques au collège','Fabrice WATEAU','BERLIN',NULL,'XAF','2025-2026',true,true)
ON CONFLICT DO NOTHING;

COMMIT;
