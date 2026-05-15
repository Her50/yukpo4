-- Migration : seed des fournitures/accessoires par défaut pour le Cameroun
-- Date : 2026-05-06
--
-- Objectif : résoudre le cold-start problem.
-- La table accessoires_populaires_par_classe se remplit naturellement par UPSERT
-- à chaque scan IA, mais le 1er parent qui scanne sur une liste de manuels
-- (sans section "Fournitures") n'a aucune suggestion. Ce seed fournit la base
-- de fournitures réelles pour le Cameroun, distinguant le système francophone
-- (CM-fr) du système anglophone (CM-en), avec les vraies classes officielles.
--
-- Idempotent grâce à ON CONFLICT (pays, niveau, classe, nom_normalise).
-- Les valeurs `niveau` correspondent exactement à frontend/src/data/schoolSystems.ts
-- pour que la requête de fallback `niveau ILIKE $3` matche correctement.

BEGIN;

-- ============================================================================
-- FRANCOPHONE — PRIMAIRE (niveau="Primaire")
-- Classes : SIL, CP, CE1, CE2, CM1, CM2
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('SIL'), ('CP'), ('CE1'), ('CE2'), ('CM1'), ('CM2')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 32 pages Seyès',          5, 'standard',   200,   300,   500),
        ('Cahier 96 pages Seyès',          4, 'standard',   500,   700,  1000),
        ('Cahier de dessin',               1, 'standard',   400,   600,   900),
        ('Stylo bille bleu',               4, 'entree',     100,   150,   250),
        ('Stylo bille rouge',              2, 'entree',     100,   150,   250),
        ('Crayon HB',                      4, 'entree',      75,   100,   200),
        ('Boîte de crayons de couleur',    1, 'standard',  1000,  1500,  3000),
        ('Boîte de feutres',               1, 'standard',  1200,  2000,  3500),
        ('Gomme blanche',                  2, 'entree',     100,   150,   300),
        ('Taille-crayon',                  1, 'entree',     150,   250,   500),
        ('Règle 30 cm',                    1, 'standard',   300,   500,   800),
        ('Ardoise',                        1, 'standard',   500,   800,  1500),
        ('Boîte de craies',                1, 'entree',     200,   300,   500),
        ('Tablier / Blouse',               1, 'standard',  3000,  5000,  8000),
        ('Cartable',                       1, 'standard',  5000,  9000, 18000),
        ('Trousse',                        1, 'standard',  1000,  2000,  4000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Primaire', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- FRANCOPHONE — COLLÈGE (niveau="Collège")
-- Classes : 6ème, 5ème, 4ème, 3ème
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème'), ('5ème'), ('4ème'), ('3ème')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 96 pages grands carreaux',   6, 'standard',   500,   700,  1000),
        ('Cahier 200 pages grands carreaux',  4, 'standard',  1000,  1300,  2000),
        ('Cahier de TP',                      2, 'standard',   800,  1200,  2000),
        ('Stylo bille bleu',                  5, 'entree',     100,   150,   250),
        ('Stylo bille rouge',                 3, 'entree',     100,   150,   250),
        ('Stylo bille noir',                  3, 'entree',     100,   150,   250),
        ('Stylo bille vert',                  1, 'entree',     100,   150,   250),
        ('Crayon HB',                         4, 'entree',      75,   100,   200),
        ('Gomme blanche',                     2, 'entree',     100,   150,   300),
        ('Surligneurs (lot de 4)',            1, 'standard',   800,  1200,  2500),
        ('Règle 30 cm',                       1, 'standard',   300,   500,   800),
        ('Équerre',                           1, 'standard',   400,   600,  1000),
        ('Rapporteur',                        1, 'standard',   400,   600,  1000),
        ('Compas',                            1, 'standard',   800,  1500,  3500),
        ('Calculatrice scientifique Casio fx-82',  1, 'standard',  4000,  6500, 12000),
        ('Dictionnaire français Larousse',    1, 'standard',  4000,  8000, 18000),
        ('Sac d''école',                      1, 'standard',  6000, 12000, 25000),
        ('Trousse',                           1, 'standard',  1000,  2000,  4000),
        ('Ramette de papier A4',              1, 'standard',  3000,  4500,  6500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Collège', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- FRANCOPHONE — LYCÉE GÉNÉRAL (niveau="Lycée général")
-- Classes : 2nde, 1ère, Tle (les séries A/C/D/E/TI/SES/AC sont gérées via
-- match niveau pour ne pas multiplier les variants Tle A / Tle C / etc.)
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('2nde'), ('1ère'), ('Tle')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 200 pages grands carreaux',          5, 'standard',  1000,  1300,  2000),
        ('Cahier 300 pages',                          2, 'standard',  1500,  1800,  2500),
        ('Cahier de TP',                              3, 'standard',   800,  1200,  2000),
        ('Stylo bille bleu',                          5, 'entree',     100,   150,   250),
        ('Stylo bille rouge',                         3, 'entree',     100,   150,   250),
        ('Stylo bille noir',                          3, 'entree',     100,   150,   250),
        ('Crayon HB',                                 4, 'entree',      75,   100,   200),
        ('Gomme blanche',                             2, 'entree',     100,   150,   300),
        ('Surligneurs (lot de 4)',                    1, 'standard',   800,  1200,  2500),
        ('Règle 30 cm',                               1, 'standard',   300,   500,   800),
        ('Set de géométrie complet',                  1, 'standard',  1500,  2500,  5000),
        ('Calculatrice scientifique Casio fx-991',    1, 'premium',   8000, 15000, 30000),
        ('Dictionnaire bilingue (français-anglais)',  1, 'standard',  6000, 12000, 25000),
        ('Ramette de papier A4',                      1, 'standard',  3000,  4500,  6500),
        ('Sac à dos',                                 1, 'standard',  8000, 14000, 30000),
        ('Trousse',                                   1, 'standard',  1000,  2000,  4000),
        ('Pochette de papier Canson',                 1, 'standard',  1500,  2500,  4500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée général', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- ANGLOPHONE — PRIMARY (niveau="Primary")
-- Classes : Class 1 → Class 6
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('Class 1'), ('Class 2'), ('Class 3'), ('Class 4'), ('Class 5'), ('Class 6')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Exercise book 80 pages',             5, 'standard',   400,   600,   900),
        ('Drawing book',                       1, 'standard',   400,   600,   900),
        ('HB Pencils',                         4, 'entree',      75,   100,   200),
        ('Coloured pencils set',               1, 'standard',  1000,  1500,  3000),
        ('Felt-tip pens',                      1, 'standard',  1200,  2000,  3500),
        ('Eraser',                             2, 'entree',     100,   150,   300),
        ('Pencil sharpener',                   1, 'entree',     150,   250,   500),
        ('Ruler 30 cm',                        1, 'standard',   300,   500,   800),
        ('Slate',                              1, 'standard',   500,   800,  1500),
        ('Box of chalks',                      1, 'entree',     200,   300,   500),
        ('School uniform',                     1, 'standard',  3000,  5000,  8000),
        ('School bag',                         1, 'standard',  5000,  9000, 18000),
        ('Pencil case',                        1, 'standard',  1000,  2000,  4000),
        ('English picture dictionary',         1, 'standard',  3000,  5000, 10000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-en', 'Primary', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- ANGLOPHONE — SECONDARY O LEVEL (niveau="Secondary (O Level)")
-- Classes : Form 1 → Form 5
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('Form 1'), ('Form 2'), ('Form 3'), ('Form 4'), ('Form 5')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Exercise book 200 pages',                  6, 'standard',  1000,  1300,  2000),
        ('Practical / Lab notebook',                 3, 'standard',   800,  1200,  2000),
        ('Blue pen',                                 5, 'entree',     100,   150,   250),
        ('Red pen',                                  3, 'entree',     100,   150,   250),
        ('Black pen',                                3, 'entree',     100,   150,   250),
        ('HB Pencils',                               4, 'entree',      75,   100,   200),
        ('Eraser',                                   2, 'entree',     100,   150,   300),
        ('Highlighters set',                         1, 'standard',   800,  1200,  2500),
        ('Ruler 30 cm',                              1, 'standard',   300,   500,   800),
        ('Mathematical / Geometry set',              1, 'standard',  1500,  2500,  5000),
        ('Scientific calculator (Casio fx-82MS)',    1, 'standard',  4000,  6500, 12000),
        ('Oxford English Dictionary',                1, 'standard',  4000,  8000, 18000),
        ('Backpack',                                 1, 'standard',  6000, 12000, 25000),
        ('Pencil case',                              1, 'standard',  1000,  2000,  4000),
        ('A4 paper ream',                            1, 'standard',  3000,  4500,  6500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-en', 'Secondary (O Level)', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- ANGLOPHONE — HIGH SCHOOL A LEVEL (niveau="High School (A Level)")
-- Classes : Lower Sixth, Upper Sixth
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('Lower Sixth'), ('Upper Sixth')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Exercise book 300 pages',                       3, 'standard',  1500,  1800,  2500),
        ('Practical / Lab notebook',                      4, 'standard',   800,  1200,  2000),
        ('Blue pen',                                      5, 'entree',     100,   150,   250),
        ('Red pen',                                       3, 'entree',     100,   150,   250),
        ('HB Pencils',                                    4, 'entree',      75,   100,   200),
        ('Highlighters set',                              1, 'standard',   800,  1200,  2500),
        ('Drawing instruments set',                       1, 'standard',  1500,  2500,  5000),
        ('Advanced scientific calculator (Casio fx-991)', 1, 'premium',   8000, 15000, 30000),
        ('Bilingual dictionary (English-French)',         1, 'standard',  6000, 12000, 25000),
        ('Backpack',                                      1, 'standard',  8000, 14000, 30000),
        ('A4 paper ream',                                 1, 'standard',  3000,  4500,  6500),
        ('A3 drawing pad',                                1, 'standard',  1500,  2500,  4500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-en', 'High School (A Level)', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

COMMIT;
