-- ✅ NOUVEAU 2026-04-01: Documents administratifs partenaire (Cameroun)
-- RCCM = Registre du Commerce et du Crédit Mobilier
-- NIU  = Numéro d'Identifiant Unique (numéro contribuable)

ALTER TABLE delivery_partners
  ADD COLUMN IF NOT EXISTS rccm               TEXT,
  ADD COLUMN IF NOT EXISTS numero_contribuable TEXT;

COMMENT ON COLUMN delivery_partners.rccm               IS 'Numéro RCCM (Registre du Commerce), ex: RC/DLA/2024/B/12345';
COMMENT ON COLUMN delivery_partners.numero_contribuable IS 'NIU fiscal camerounais, ex: M012345678901A';
