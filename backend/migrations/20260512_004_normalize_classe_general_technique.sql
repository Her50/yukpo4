-- ============================================================================
-- Normalisation des classes programmes_scolaires — alignement UI/seed
-- ============================================================================
-- Deux corrections idempotentes :
--
-- 1. Convention 'Terminale X' → 'Tle X' :
--    Le seed MINESEC 20260424_003 a inséré 20 entrées en 'Terminale A/C/D/E/
--    SES/TI'. L'UI (frontend/src/data/schoolSystems.ts) utilise 'Tle' comme
--    classe.nom, donc les manuels 'Terminale X' sont orphelins (jamais
--    affichés à un parent qui pioche 'Tle X').
--
-- 2. Suppression placeholders techniques génériques :
--    Le seed 20260510_007 contenait des placeholders '2nde F', '1ère F1',
--    'Tle F1', '2nde G', '1ère G2', 'Tle G2' avec auteur='NULL'::text et
--    titres génériques ("Français 2nde Technique", etc.). Le seed officiel
--    20260512_003 (MINESEC Technique 2024-2025) couvre désormais ces classes
--    avec '2nde F2/F3/...', '1ère MA/MEM/...', etc. — données ministérielles
--    réelles. On purge les placeholders pour éviter doublons et confusion.
--
-- IDEMPOTENT : peut tourner plusieurs fois sans effet additionnel.
-- ============================================================================

BEGIN;

-- ─── 1. Normalisation 'Terminale X' → 'Tle X' ───
UPDATE programmes_scolaires
SET classe = REPLACE(classe, 'Terminale ', 'Tle ')
WHERE classe LIKE 'Terminale %';

-- Cas 'Terminale' bare (sans série) si présent
UPDATE programmes_scolaires
SET classe = 'Tle'
WHERE classe = 'Terminale';

-- ─── 1bis. Maternelle CM-fr : 'Maternelle 1' / 'Maternelle 2' → forme longue ───
-- Le seed legacy 20260510_005 utilisait 'Maternelle 1' / 'Maternelle 2'
-- (forme courte). Le seed officiel MINEDUB 20260512_002 et le référentiel UI
-- utilisent 'Maternelle 1ère année' / 'Maternelle 2ème année' (forme longue,
-- conforme au PDF MINEDUB signé du 10 avril 2025).
UPDATE programmes_scolaires
SET classe = 'Maternelle 1ère année'
WHERE pays = 'CM' AND systeme_educatif = 'francophone' AND classe = 'Maternelle 1';

UPDATE programmes_scolaires
SET classe = 'Maternelle 2ème année'
WHERE pays = 'CM' AND systeme_educatif = 'francophone' AND classe = 'Maternelle 2';

-- ─── 2. Suppression placeholders techniques génériques de 20260510_007 ───
-- Identifiable par : pays='CM', etablissement_id IS NULL (national),
-- classe IN (anciennes conventions) AND titre contient marqueur placeholder
-- (Technique/Commercial dans titre + auteur NULL).
DELETE FROM programmes_scolaires
WHERE pays = 'CM'
  AND etablissement_id IS NULL
  AND classe IN ('2nde F', '2nde G', '1ère F1', '1ère G2', 'Tle F1', 'Tle G2')
  AND (auteur_livre IS NULL OR auteur_livre = 'NULL')
  AND annee_scolaire = '2025-2026';

COMMIT;
