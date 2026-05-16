-- ============================================================================
-- 2026-05-16 — Nettoyage référentiel accessoires_populaires_par_classe
--
-- Décision utilisateur :
--   ✅ GARDER : cahiers (tous types/pages/lignes), crayons, stylos, gomme,
--     règle, compas, équerre, rapporteur, calculatrices, ardoise, craie,
--     feutres, marqueurs, surligneurs, trousse, taille-crayon, effaceur,
--     colle, ciseaux scolaires, dictionnaire, atlas, papier, classeur,
--     pochette, intercalaires, papier millimétré, couvre-livre/protège-cahier.
--
--   ❌ SUPPRIMER (gadgets / vêtements / outils non-didactiques) :
--     - Sacs : sac à dos, cartable, school bag, backpack, sac d'école
--     - Hydratation / repas : bouteille d'eau, water bottle, lunch box,
--       boîte à goûter
--     - Vêtements / EPI : blouse, combinaison, overall, coverall, tablier,
--       apron, veste de cuisine, school uniform, bleu de travail, pantalon
--       pied-de-poule, toque, charlotte, coiffe, casque de chantier
--     - Chaussures : bottes (terrain, sécurité), chaussures de sécurité
--     - Outils pro non-didactiques : mètre 5m, mètre menuisier 2m, niveau à
--       bulle, mètre couturier, kit aiguilles, échantillons tissus, craie
--       tailleur, gants (atelier/jardinage), lunettes de sécurité, safety
--       glasses, crayon menuisier (plat) — outil ébéniste, pas didactique
--
-- Approche : DELETE par patterns LIKE/ILIKE (case-insensitive). Idempotent.
-- ============================================================================

-- Patterns à supprimer (liste exhaustive en lower-case)
DELETE FROM accessoires_populaires_par_classe
WHERE lower(nom) ~* (
    -- Sacs scolaires (cartable, sac à dos, backpack, school bag, sac d'école)
    '^(sac|cartable|school[[:space:]]*bag|backpack)'
    -- Hydratation et repas (bouteille, water bottle, lunch box, boîte à goûter)
    || '|^(bouteille|water[[:space:]]*bottle|lunch[[:space:]]*box|bo[iî]te[[:space:]]*[àa][[:space:]]*go[uû]ter)'
    -- Vêtements et EPI (blouse atelier, combinaison, overall, coverall,
    -- tablier, apron, veste cuisine, school uniform, bleu de travail,
    -- pantalon pied-de-poule, toque, charlotte, coiffe cuisine, casque chantier)
    || '|^(blouse|combinaison|overall|coverall|tablier|apron|veste|school[[:space:]]*uniform|bleu[[:space:]]*de[[:space:]]*travail|pantalon[[:space:]]*pied|toque|charlotte|coiffe|casque)'
    -- Chaussures (bottes, chaussures de sécurité, safety shoes)
    || '|^(bottes|chaussures|safety[[:space:]]*shoes)'
    -- EPI optique / mains (gants, lunettes de sécurité, safety glasses)
    || '|^(gants|gloves|lunettes[[:space:]]*de[[:space:]]*s[ée]curit[ée]|safety[[:space:]]*glasses)'
    -- Outils pro (mètre menuisier/5m, niveau à bulle, kit aiguilles,
    -- échantillons tissus, craie tailleur, mètre couturier, crayon menuisier)
    || '|^(m[èe]tre[[:space:]]*(5|menuisier|couturier))'
    || '|^(niveau[[:space:]]*[àa][[:space:]]*bulle)'
    || '|^(kit[[:space:]]*aiguilles)'
    || '|^([ée]chantillons[[:space:]]*tissus)'
    || '|^(craie[[:space:]]*tailleur)'
    || '|^(crayon[[:space:]]*menuisier)'
    -- Couteaux d'office, trousse de couteaux (cuisine/atelier pro)
    || '|^(trousse[[:space:]]*de[[:space:]]*couteaux)'
);

-- ─── Ajout "couvre-livre" et "protège-cahier" ──────────────────────────────
-- Ces 2 accessoires sont indispensables côté scolaire CM et étaient absents
-- du référentiel. Ajoutés pour toutes les classes existantes dans le pays CM,
-- avec une quantité médiane raisonnable (varie selon nb de manuels/cahiers).

-- Stratégie : pour chaque (pays, niveau, classe) pré-existant au CM,
-- insérer 1 ligne "couvre-livre" et 1 "protège-cahier" SAUF si déjà présente.
-- Pas de contrainte UNIQUE en DB → on guard via WHERE NOT EXISTS.
-- On hérite niveau/systeme_id de la ligne source pour rester cohérent.
INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, prix_median, prix_min, prix_max,
     gamme_defaut, devise, occurrences, derniere_vue, created_at, updated_at)
SELECT DISTINCT
    src.pays,
    src.systeme_id,
    src.niveau,
    src.classe,
    'Couvre-livre transparent (rouleau)',
    'couvre-livre',
    1,
    1500.0,
    1000.0,
    3000.0,
    'standard',
    'XAF',
    50,
    NOW(), NOW(), NOW()
FROM accessoires_populaires_par_classe src
WHERE src.pays = 'CM'
  AND NOT EXISTS (
    SELECT 1 FROM accessoires_populaires_par_classe a
    WHERE a.pays = src.pays
      AND a.classe = src.classe
      AND a.nom_normalise = 'couvre-livre'
  );

INSERT INTO accessoires_populaires_par_classe
    (pays, systeme_id, niveau, classe, nom, nom_normalise,
     quantite_mediane, prix_median, prix_min, prix_max,
     gamme_defaut, devise, occurrences, derniere_vue, created_at, updated_at)
SELECT DISTINCT
    src.pays,
    src.systeme_id,
    src.niveau,
    src.classe,
    'Protège-cahier (lot de 5)',
    'protege-cahier',
    1,
    1000.0,
    500.0,
    2000.0,
    'standard',
    'XAF',
    50,
    NOW(), NOW(), NOW()
FROM accessoires_populaires_par_classe src
WHERE src.pays = 'CM'
  AND NOT EXISTS (
    SELECT 1 FROM accessoires_populaires_par_classe a
    WHERE a.pays = src.pays
      AND a.classe = src.classe
      AND a.nom_normalise = 'protege-cahier'
  );
