-- Migration : seed des fournitures pour filières techniques & professionnelles (Cameroun)
-- Date : 2026-05-06
--
-- Complète 20260506_001_seed_accessoires_cameroun.sql avec :
--   - Lycée technique — Industriel (filières F1, F2, F3, F4)
--   - Lycée technique — Commercial (filières G1, G2, G3, ACA, ACC)
--   - Lycée agro-pastoral
--   - Lycée hôtellerie & restauration
--   - Formation professionnelle (CAP, BEP, BT)
--   - Technical Secondary (anglophone)
--
-- Idempotent grâce à ON CONFLICT (pays, niveau, classe, nom_normalise).

BEGIN;

-- ============================================================================
-- LYCÉE TECHNIQUE — INDUSTRIEL (niveau="Lycée technique — Industriel")
-- Toutes les classes héritent du tronc commun lycée + spécifique atelier.
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème TI'), ('5ème TI'), ('4ème TI'), ('3ème TI'),
           ('2nde F'), ('1ère'), ('Tle')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 200 pages grands carreaux',          5, 'standard',  1000,  1300,  2000),
        ('Cahier de TP / atelier',                    4, 'standard',   800,  1200,  2000),
        ('Cahier de dessin technique',                2, 'standard',  1000,  1500,  2500),
        ('Stylo bille bleu',                          5, 'entree',     100,   150,   250),
        ('Stylo bille rouge',                         3, 'entree',     100,   150,   250),
        ('Stylo bille noir',                          3, 'entree',     100,   150,   250),
        ('Crayon HB',                                 4, 'entree',      75,   100,   200),
        ('Crayon 2H et 4H (dessin technique)',        2, 'standard',   200,   300,   500),
        ('Gomme blanche',                             2, 'entree',     100,   150,   300),
        ('Règle 30 cm',                               1, 'standard',   300,   500,   800),
        ('Set de géométrie complet',                  1, 'standard',  1500,  2500,  5000),
        ('Té et compas (dessin industriel)',          1, 'standard',  3000,  5000,  9000),
        ('Papier millimétré (pochette)',              2, 'standard',   500,   800,  1500),
        ('Calculatrice scientifique Casio fx-991',    1, 'premium',   8000, 15000, 30000),
        ('Blouse / combinaison atelier',              1, 'standard',  3500,  6000, 10000),
        ('Lunettes de sécurité',                      1, 'standard',  1500,  2500,  5000),
        ('Cahier d''observations atelier',            1, 'standard',   800,  1200,  2000),
        ('Sac à dos',                                 1, 'standard',  8000, 14000, 30000),
        ('Trousse',                                   1, 'standard',  1000,  2000,  4000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée technique — Industriel', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- LYCÉE TECHNIQUE — COMMERCIAL (niveau="Lycée technique — Commercial")
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème CG'), ('5ème CG'), ('4ème CG'), ('3ème CG'),
           ('2nde G'), ('1ère'), ('Tle')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 200 pages grands carreaux',                  6, 'standard',  1000,  1300,  2000),
        ('Cahier de comptabilité (papier ledger)',            2, 'standard',  1500,  2000,  3500),
        ('Classeur grand format',                             2, 'standard',  1500,  2500,  4500),
        ('Pochettes plastifiées (lot)',                       1, 'standard',   800,  1200,  2500),
        ('Stylo bille bleu',                                  5, 'entree',     100,   150,   250),
        ('Stylo bille rouge',                                 3, 'entree',     100,   150,   250),
        ('Stylo bille noir',                                  3, 'entree',     100,   150,   250),
        ('Crayon HB',                                         3, 'entree',      75,   100,   200),
        ('Gomme blanche',                                     2, 'entree',     100,   150,   300),
        ('Règle 30 cm',                                       1, 'standard',   300,   500,   800),
        ('Calculatrice de bureau (12 chiffres)',              1, 'standard',  3000,  5000,  9000),
        ('Calculatrice scientifique Casio fx-991',            1, 'premium',   8000, 15000, 30000),
        ('Plan comptable OHADA',                              1, 'standard',  4000,  6500, 12000),
        ('Dictionnaire bilingue (français-anglais)',          1, 'standard',  6000, 12000, 25000),
        ('Ramette de papier A4',                              1, 'standard',  3000,  4500,  6500),
        ('Sac à dos',                                         1, 'standard',  8000, 14000, 30000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée technique — Commercial', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- LYCÉE AGRO-PASTORAL (niveau="Lycée agro-pastoral")
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('2nde EA'), ('1ère'), ('Tle')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 200 pages grands carreaux',     5, 'standard',  1000,  1300,  2000),
        ('Cahier d''observations terrain',       2, 'standard',   800,  1200,  2000),
        ('Cahier de TP',                         3, 'standard',   800,  1200,  2000),
        ('Stylo bille bleu',                     5, 'entree',     100,   150,   250),
        ('Stylo bille rouge',                    3, 'entree',     100,   150,   250),
        ('Crayon HB',                            4, 'entree',      75,   100,   200),
        ('Gomme blanche',                        2, 'entree',     100,   150,   300),
        ('Règle 30 cm',                          1, 'standard',   300,   500,   800),
        ('Calculatrice scientifique',            1, 'standard',  4000,  6500, 12000),
        ('Bottes de terrain',                    1, 'standard',  4000,  7000, 12000),
        ('Tablier / blouse de jardinage',        1, 'standard',  3000,  5000,  8000),
        ('Gants de jardinage',                   1, 'standard',   800,  1500,  3000),
        ('Loupe',                                1, 'standard',   500,  1000,  2500),
        ('Sac à dos',                            1, 'standard',  6000, 12000, 25000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée agro-pastoral', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- LYCÉE HÔTELLERIE & RESTAURATION (niveau="Lycée hôtellerie & restauration")
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('2nde HR'), ('1ère'), ('Tle')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 200 pages grands carreaux',     5, 'standard',  1000,  1300,  2000),
        ('Cahier de recettes',                   2, 'standard',  1000,  1500,  2500),
        ('Stylo bille bleu',                     5, 'entree',     100,   150,   250),
        ('Stylo bille rouge',                    3, 'entree',     100,   150,   250),
        ('Crayon HB',                            3, 'entree',      75,   100,   200),
        ('Tablier blanc de cuisine',             2, 'standard',  3000,  5000,  8000),
        ('Toque / calot',                        2, 'standard',  1500,  2500,  4500),
        ('Veste de cuisine blanche',             2, 'standard',  6000, 10000, 18000),
        ('Pantalon pied-de-poule',               2, 'standard',  4000,  7000, 12000),
        ('Chaussures de sécurité cuisine',       1, 'standard',  8000, 15000, 30000),
        ('Trousse de couteaux d''office',        1, 'premium',  10000, 20000, 50000),
        ('Manuel cuisine de référence',          1, 'standard',  5000,  9000, 18000),
        ('Calculatrice de poche',                1, 'entree',    1500,  2500,  5000),
        ('Sac à dos',                            1, 'standard',  6000, 12000, 25000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée hôtellerie & restauration', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- FORMATION PROFESSIONNELLE (niveau="Formation professionnelle")
-- CAP, BEP, BT — couvre tous les corps de métier
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('CAP 1'), ('CAP 2'), ('CAP 3'),
           ('BEP 1'), ('BEP 2'),
           ('BT 1'), ('BT 2'), ('BT 3')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 200 pages',                          5, 'standard',  1000,  1300,  2000),
        ('Cahier d''atelier',                         3, 'standard',   800,  1200,  2000),
        ('Stylo bille bleu',                          5, 'entree',     100,   150,   250),
        ('Stylo bille rouge',                         3, 'entree',     100,   150,   250),
        ('Crayon HB',                                 4, 'entree',      75,   100,   200),
        ('Gomme blanche',                             2, 'entree',     100,   150,   300),
        ('Règle 30 cm',                               1, 'standard',   300,   500,   800),
        ('Calculatrice scientifique',                 1, 'standard',  4000,  6500, 12000),
        ('Blouse / combinaison atelier',              1, 'standard',  3500,  6000, 10000),
        ('Lunettes de sécurité',                      1, 'standard',  1500,  2500,  5000),
        ('Sac à dos',                                 1, 'standard',  6000, 12000, 25000),
        ('Trousse',                                   1, 'standard',  1000,  2000,  4000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Formation professionnelle', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- TECHNICAL SECONDARY ANGLOPHONE (niveau="Technical Secondary")
-- Form 1T → Form 5T
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('Form 1T'), ('Form 2T'), ('Form 3T'), ('Form 4T'), ('Form 5T')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Exercise book 200 pages',                  6, 'standard',  1000,  1300,  2000),
        ('Workshop / Lab notebook',                  4, 'standard',   800,  1200,  2000),
        ('Technical drawing pad',                    2, 'standard',  1000,  1500,  2500),
        ('Blue pen',                                 5, 'entree',     100,   150,   250),
        ('Red pen',                                  3, 'entree',     100,   150,   250),
        ('Black pen',                                3, 'entree',     100,   150,   250),
        ('HB Pencils',                               4, 'entree',      75,   100,   200),
        ('Drawing pencils (2H, 4H)',                 2, 'standard',   200,   300,   500),
        ('Eraser',                                   2, 'entree',     100,   150,   300),
        ('Ruler 30 cm',                              1, 'standard',   300,   500,   800),
        ('Drawing instruments set',                  1, 'standard',  3000,  5000,  9000),
        ('Mathematical / Geometry set',              1, 'standard',  1500,  2500,  5000),
        ('Scientific calculator (Casio fx-82MS)',    1, 'standard',  4000,  6500, 12000),
        ('Workshop overall / coverall',              1, 'standard',  3500,  6000, 10000),
        ('Safety glasses',                           1, 'standard',  1500,  2500,  5000),
        ('Backpack',                                 1, 'standard',  6000, 12000, 25000),
        ('A4 paper ream',                            1, 'standard',  3000,  4500,  6500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-en', 'Technical Secondary', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

COMMIT;
