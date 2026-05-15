-- Migration : seed des filières du sous-cycle technique (6ème-3ème)
-- Date : 2026-05-06
--
-- Ajoute les 5 filières supplémentaires couramment proposées dans les CETIC
-- camerounais : Menuiserie-Bois (MB), Économie Sociale Familiale (ESF),
-- Habillement-Couture (HC), Bâtiment-Travaux Publics (BTP), Mécanique Auto (MA).
-- Les filières TI (Industrielle) et CG (Commerciale) ont déjà été seedées via
-- 20260506_002.

BEGIN;

-- ============================================================================
-- BASE COMMUNE — fournitures applicables à TOUTES les filières du sous-cycle
-- technique (6ème, 5ème, 4ème, 3ème de toutes spécialités).
-- ============================================================================
WITH classes(classe) AS (
    VALUES
        ('6ème MB'), ('5ème MB'), ('4ème MB'), ('3ème MB'),
        ('6ème ESF'), ('5ème ESF'), ('4ème ESF'), ('3ème ESF'),
        ('6ème HC'),  ('5ème HC'),  ('4ème HC'),  ('3ème HC'),
        ('6ème BTP'), ('5ème BTP'), ('4ème BTP'), ('3ème BTP'),
        ('6ème MA'),  ('5ème MA'),  ('4ème MA'),  ('3ème MA')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier 96 pages grands carreaux',   5, 'standard',   500,   700,  1000),
        ('Cahier 200 pages grands carreaux',  3, 'standard',  1000,  1300,  2000),
        ('Cahier de TP / atelier',            3, 'standard',   800,  1200,  2000),
        ('Stylo bille bleu',                  4, 'entree',     100,   150,   250),
        ('Stylo bille rouge',                 2, 'entree',     100,   150,   250),
        ('Crayon HB',                         3, 'entree',      75,   100,   200),
        ('Gomme blanche',                     2, 'entree',     100,   150,   300),
        ('Règle 30 cm',                       1, 'standard',   300,   500,   800),
        ('Calculatrice basique',              1, 'entree',    1500,  2500,  5000),
        ('Trousse',                           1, 'standard',  1000,  2000,  4000),
        ('Sac à dos',                         1, 'standard',  6000, 10000, 20000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée/Collège technique', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- MB — Menuiserie-Bois / Ébénisterie
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème MB'), ('5ème MB'), ('4ème MB'), ('3ème MB')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Blouse / combinaison atelier (bois)',     1, 'standard',  3500,  6000, 10000),
        ('Mètre menuisier 2 m',                     1, 'standard',  1500,  2500,  5000),
        ('Crayon menuisier (plat)',                 2, 'entree',     200,   300,   500),
        ('Carnet de croquis A4',                    1, 'standard',  1000,  1500,  2500),
        ('Lunettes de sécurité',                    1, 'standard',  1500,  2500,  5000),
        ('Cahier de dessin technique',              1, 'standard',  1000,  1500,  2500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée/Collège technique', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- ESF — Économie Sociale Familiale (Sciences ménagères)
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème ESF'), ('5ème ESF'), ('4ème ESF'), ('3ème ESF')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Tablier blanc de cuisine',          1, 'standard',  3000,  5000,  8000),
        ('Charlotte / coiffe cuisine',        2, 'standard',  1000,  1500,  3000),
        ('Cahier de cuisine / recettes',      1, 'standard',  1000,  1500,  2500),
        ('Cahier de couture',                 1, 'standard',  1000,  1500,  2500),
        ('Kit aiguilles à coudre',            1, 'standard',   500,  1000,  2000),
        ('Mètre couturier',                   1, 'entree',     500,   800,  1500),
        ('Ciseaux de couture',                1, 'standard',  1500,  2500,  4500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée/Collège technique', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- HC — Habillement-Couture / Mode
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème HC'), ('5ème HC'), ('4ème HC'), ('3ème HC')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Cahier de croquis / patrons',       2, 'standard',  1000,  1500,  2500),
        ('Mètre couturier',                   1, 'entree',     500,   800,  1500),
        ('Kit aiguilles + épingles',          1, 'standard',   500,  1000,  2000),
        ('Ciseaux de couture',                1, 'standard',  1500,  2500,  4500),
        ('Craie tailleur (lot)',              1, 'entree',     300,   500,  1000),
        ('Échantillons tissus / pochette',    1, 'standard',  1000,  2000,  4000),
        ('Tablier d''atelier',                1, 'standard',  2500,  4000,  7000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée/Collège technique', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- BTP — Bâtiment / Travaux Publics / Maçonnerie
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème BTP'), ('5ème BTP'), ('4ème BTP'), ('3ème BTP')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Blouse / combinaison atelier',      1, 'standard',  3500,  6000, 10000),
        ('Casque de chantier',                1, 'standard',  2500,  4500,  8000),
        ('Lunettes de sécurité',              1, 'standard',  1500,  2500,  5000),
        ('Mètre 5 m',                         1, 'standard',  1500,  2500,  5000),
        ('Niveau à bulle 30 cm',              1, 'standard',  2000,  3500,  7000),
        ('Cahier de dessin technique',        1, 'standard',  1000,  1500,  2500),
        ('Crayon menuisier (plat)',           2, 'entree',     200,   300,   500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée/Collège technique', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- MA — Mécanique Auto
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème MA'), ('5ème MA'), ('4ème MA'), ('3ème MA')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Bleu de travail / combinaison',     1, 'standard',  4000,  7000, 12000),
        ('Gants d''atelier',                  1, 'standard',   800,  1500,  3000),
        ('Lunettes de sécurité',              1, 'standard',  1500,  2500,  5000),
        ('Cahier de dessin technique',        1, 'standard',  1000,  1500,  2500),
        ('Carnet d''observations atelier',    1, 'standard',   800,  1200,  2000)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT
    'CM', 'CM-fr', 'Lycée/Collège technique', c.classe, a.nom, lower(a.nom),
    a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

COMMIT;
