-- Migration : enrichissement du seed accessoires_populaires_par_classe
-- Date : 2026-05-06
--
-- Objectif : couvrir un maximum de variantes de cahiers et fournitures pour
-- que le matching pg_trgm + LLM trouve un candidat dès que possible.
-- Variantes ajoutées :
--   • Pages : 32, 48, 60, 80, 96, 100, 120, 140, 200, 250, 300
--   • Réglures : Seyès, lignes simples, grands carreaux, petits carreaux,
--                blanc/dessin, écriture manuscrite, TP/travaux pratiques
--   • Spécialisations : musique, anglais, sciences, géométrie, atelier
-- Plus quelques fournitures couramment scannées non couvertes par le seed initial.
--
-- Idempotent grâce à ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING.

BEGIN;

-- ============================================================================
-- PRIMAIRE FR : variantes de cahiers + accessoires courants
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('SIL'), ('CP'), ('CE1'), ('CE2'), ('CM1'), ('CM2'), ('Primaire')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        -- Cahiers Seyès (avec marge — primaire)
        ('Cahier 32 pages Seyès',           5, 'standard',   200,   300,   500),
        ('Cahier 48 pages Seyès',           4, 'standard',   300,   450,   700),
        ('Cahier 60 pages Seyès',           4, 'standard',   400,   550,   800),
        ('Cahier 80 pages Seyès',           3, 'standard',   500,   650,   900),
        ('Cahier 96 pages Seyès',           4, 'standard',   500,   700,  1000),
        ('Cahier 100 pages Seyès',          3, 'standard',   600,   800,  1100),
        ('Cahier 120 pages Seyès',          2, 'standard',   700,   900,  1300),
        -- Cahiers lignes simples
        ('Cahier 32 pages lignes simples',  3, 'standard',   200,   300,   500),
        ('Cahier 48 pages lignes simples',  3, 'standard',   300,   450,   700),
        ('Cahier 60 pages lignes simples',  3, 'standard',   400,   550,   800),
        ('Cahier 80 pages lignes simples',  3, 'standard',   500,   650,   900),
        ('Cahier 96 pages lignes simples',  3, 'standard',   500,   700,  1000),
        -- Cahiers carreaux (grands / petits)
        ('Cahier 32 pages grands carreaux', 2, 'standard',   200,   300,   500),
        ('Cahier 48 pages grands carreaux', 2, 'standard',   300,   450,   700),
        ('Cahier 60 pages grands carreaux', 2, 'standard',   400,   550,   800),
        ('Cahier 80 pages grands carreaux', 2, 'standard',   500,   650,   900),
        ('Cahier 96 pages grands carreaux', 3, 'standard',   500,   700,  1000),
        ('Cahier 32 pages petits carreaux', 2, 'standard',   200,   300,   500),
        ('Cahier 48 pages petits carreaux', 2, 'standard',   300,   450,   700),
        ('Cahier 96 pages petits carreaux', 2, 'standard',   500,   700,  1000),
        -- Cahiers spéciaux
        ('Cahier de dessin',                1, 'standard',   400,   600,   900),
        ('Cahier de coloriage',             1, 'standard',   400,   600,   900),
        ('Cahier 20 pages écriture manuscrite', 2, 'standard',  300,  400,   600),
        ('Cahier d''écriture manuscrite',   2, 'standard',   300,   400,   600),
        ('Cahier d''anglais',               1, 'standard',   400,   600,   900),
        ('Cahier de musique',               1, 'standard',   500,   700,  1000),
        ('Cahier bananier',                 2, 'entree',     150,   250,   400),
        -- Petites fournitures courantes
        ('Pochette plastique transparente', 1, 'standard',   200,   300,   500),
        ('Stylo à plume',                   1, 'standard',   500,   800,  1500),
        ('Cartouches d''encre (boîte)',     1, 'standard',   500,   800,  1500),
        ('Effaceur',                        1, 'standard',   200,   400,   700),
        ('Marqueur permanent',              1, 'standard',   300,   500,   900),
        ('Surligneur fluo',                 1, 'standard',   200,   400,   700),
        ('Colle stick',                     1, 'standard',   300,   500,   900),
        ('Ciseaux scolaires',               1, 'standard',   500,  1000,  2000),
        ('Bouteille d''eau',                1, 'standard',  1500,  2500,  4500),
        ('Boîte à goûter',                  1, 'standard',  1500,  2500,  4500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT 'CM', 'CM-fr', 'Primaire', c.classe, a.nom, lower(a.nom),
       a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- SECONDAIRE GÉNÉRAL FR : variantes cahiers étendus
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('6ème'), ('5ème'), ('4ème'), ('3ème'), ('2nde'), ('1ère'), ('Tle'), ('Secondaire général')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        -- Cahiers grands carreaux variantes pages
        ('Cahier 48 pages grands carreaux',   2, 'standard',   300,   450,   700),
        ('Cahier 60 pages grands carreaux',   2, 'standard',   400,   550,   800),
        ('Cahier 80 pages grands carreaux',   2, 'standard',   500,   650,   900),
        ('Cahier 96 pages grands carreaux',   6, 'standard',   500,   700,  1000),
        ('Cahier 100 pages grands carreaux',  4, 'standard',   600,   800,  1100),
        ('Cahier 120 pages grands carreaux',  3, 'standard',   700,   900,  1300),
        ('Cahier 140 pages grands carreaux',  2, 'standard',   800,  1000,  1400),
        ('Cahier 200 pages grands carreaux',  4, 'standard',  1000,  1300,  2000),
        ('Cahier 250 pages grands carreaux',  2, 'standard',  1300,  1700,  2300),
        ('Cahier 300 pages grands carreaux',  2, 'standard',  1500,  1800,  2500),
        -- Cahiers petits carreaux
        ('Cahier 96 pages petits carreaux',   3, 'standard',   500,   700,  1000),
        ('Cahier 200 pages petits carreaux',  2, 'standard',  1000,  1300,  2000),
        -- Cahiers Seyès (gardé pour matières langues)
        ('Cahier 96 pages Seyès',             2, 'standard',   500,   700,  1000),
        ('Cahier 200 pages Seyès',            1, 'standard',  1000,  1300,  2000),
        -- Cahiers lignes simples
        ('Cahier 96 pages lignes simples',    2, 'standard',   500,   700,  1000),
        ('Cahier 200 pages lignes simples',   1, 'standard',  1000,  1300,  2000),
        -- Cahiers spécialisés
        ('Cahier de TP / travaux pratiques',  3, 'standard',   800,  1200,  2000),
        ('Cahier de TP physique',             1, 'standard',   800,  1200,  2000),
        ('Cahier de TP chimie',               1, 'standard',   800,  1200,  2000),
        ('Cahier de TP biologie',             1, 'standard',   800,  1200,  2000),
        ('Cahier de TP SVT',                  1, 'standard',   800,  1200,  2000),
        ('Cahier de dessin technique',        2, 'standard',  1000,  1500,  2500),
        ('Cahier de musique',                 1, 'standard',   500,   700,  1000),
        ('Cahier de poésie',                  1, 'standard',   400,   600,   900),
        ('Cahier de rédaction',               1, 'standard',   500,   700,  1000),
        ('Cahier de brouillon',               2, 'entree',     300,   500,   800),
        -- Calculatrices spécifiques
        ('Calculatrice scientifique Casio fx-82', 1, 'standard',  4000,  6500, 12000),
        ('Calculatrice scientifique Casio fx-92', 1, 'premium',   8000, 12000, 20000),
        ('Calculatrice scientifique Casio fx-991', 1, 'premium',  8000, 15000, 30000),
        ('Calculatrice TI-30',                1, 'standard',  4000,  6000, 10000),
        -- Petits accessoires manquants
        ('Stylo bille vert',                  1, 'entree',     100,   150,   250),
        ('Stylo bille noir',                  3, 'entree',     100,   150,   250),
        ('Crayon 2H',                         1, 'standard',   100,   150,   250),
        ('Crayon 4H',                         1, 'standard',   100,   150,   250),
        ('Crayon HB pour dessin',             2, 'standard',   100,   150,   250),
        ('Marqueur permanent',                1, 'standard',   300,   500,   900),
        ('Effaceur',                          1, 'standard',   200,   400,   700),
        ('Stylo à plume',                     1, 'standard',   500,   800,  1500),
        ('Cartouches d''encre (boîte)',       1, 'standard',   500,   800,  1500),
        ('Pochettes plastifiées (lot)',       1, 'standard',   800,  1200,  2500),
        ('Classeur grand format',             2, 'standard',  1500,  2500,  4500),
        ('Intercalaires (lot)',               1, 'standard',   500,   800,  1500),
        ('Atlas géographique',                1, 'standard',  4000,  6000,  9000),
        ('Bible scolaire',                    1, 'standard',  3000,  5000,  9000),
        ('Bouteille d''eau',                  1, 'standard',  1500,  2500,  4500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT 'CM', 'CM-fr', 'Secondaire général', c.classe, a.nom, lower(a.nom),
       a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- ANGLOPHONE PRIMARY : variantes exercise books étendues
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('Class 1'), ('Class 2'), ('Class 3'), ('Class 4'), ('Class 5'), ('Class 6'), ('Primary')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Exercise book 32 pages',           5, 'standard',   200,   300,   500),
        ('Exercise book 48 pages',           4, 'standard',   300,   450,   700),
        ('Exercise book 60 pages',           3, 'standard',   400,   550,   800),
        ('Exercise book 80 pages',           5, 'standard',   400,   600,   900),
        ('Exercise book 96 pages',           3, 'standard',   500,   700,  1000),
        ('Exercise book 120 pages',          2, 'standard',   700,   900,  1300),
        ('Drawing book',                     1, 'standard',   400,   600,   900),
        ('Music book',                       1, 'standard',   500,   700,  1000),
        ('English handwriting book',         2, 'standard',   300,   400,   600),
        ('Spelling book',                    1, 'standard',   400,   600,   900),
        ('Slate (small)',                    1, 'standard',   500,   800,  1500),
        ('Coloured pencils set',             1, 'standard',  1000,  1500,  3000),
        ('Felt-tip pens',                    1, 'standard',  1200,  2000,  3500),
        ('Glue stick',                       1, 'standard',   300,   500,   900),
        ('Scissors (kids)',                  1, 'standard',   500,  1000,  2000),
        ('Water bottle',                     1, 'standard',  1500,  2500,  4500),
        ('Lunch box',                        1, 'standard',  1500,  2500,  4500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT 'CM', 'CM-en', 'Primary', c.classe, a.nom, lower(a.nom),
       a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

-- ============================================================================
-- ANGLOPHONE SECONDARY (O Level) : variantes exercise books étendues
-- ============================================================================
WITH classes(classe) AS (
    VALUES ('Form 1'), ('Form 2'), ('Form 3'), ('Form 4'), ('Form 5'), ('Secondary (O Level)')
), accessoires(nom, qte, gamme, prix_min, prix_med, prix_max) AS (
    VALUES
        ('Exercise book 80 pages',                3, 'standard',   400,   600,   900),
        ('Exercise book 96 pages',                3, 'standard',   500,   700,  1000),
        ('Exercise book 120 pages',               3, 'standard',   700,   900,  1300),
        ('Exercise book 200 pages',               6, 'standard',  1000,  1300,  2000),
        ('Exercise book 300 pages',               2, 'standard',  1500,  1800,  2500),
        ('Practical / Lab notebook',              3, 'standard',   800,  1200,  2000),
        ('Physics lab notebook',                  1, 'standard',   800,  1200,  2000),
        ('Chemistry lab notebook',                1, 'standard',   800,  1200,  2000),
        ('Biology lab notebook',                  1, 'standard',   800,  1200,  2000),
        ('Drawing book / Technical drawing pad',  1, 'standard',  1000,  1500,  2500),
        ('Music book',                            1, 'standard',   500,   700,  1000),
        ('Atlas',                                 1, 'standard',  4000,  6000,  9000),
        ('Scientific calculator (Casio fx-82MS)', 1, 'standard',  4000,  6500, 12000),
        ('Scientific calculator (Casio fx-991)',  1, 'premium',   8000, 15000, 30000),
        ('Highlighters set',                      1, 'standard',   800,  1200,  2500),
        ('Glue stick',                            1, 'standard',   300,   500,   900),
        ('A4 paper ream',                         1, 'standard',  3000,  4500,  6500),
        ('Plastic folder set',                    1, 'standard',   800,  1200,  2500),
        ('Big classeur / ring binder',            2, 'standard',  1500,  2500,  4500)
)
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, gamme_defaut, prix_min, prix_median, prix_max, devise, occurrences)
SELECT 'CM', 'CM-en', 'Secondary (O Level)', c.classe, a.nom, lower(a.nom),
       a.qte, a.gamme, a.prix_min, a.prix_med, a.prix_max, 'XAF', 0
FROM classes c CROSS JOIN accessoires a
ON CONFLICT (pays, niveau, classe, nom_normalise) DO NOTHING;

COMMIT;
