-- ✅ NOUVEAU 2026-04-01: Colonnes Vision AI pour delivery_partners
-- Stocke les résultats de vérification RCCM/NIU via Google Cloud Vision API

ALTER TABLE delivery_partners
  ADD COLUMN IF NOT EXISTS ai_score          INTEGER,
  ADD COLUMN IF NOT EXISTS ai_decision       TEXT,
  ADD COLUMN IF NOT EXISTS ai_extracted_id   TEXT,
  ADD COLUMN IF NOT EXISTS ai_extracted_name TEXT,
  ADD COLUMN IF NOT EXISTS ai_details        TEXT;

COMMENT ON COLUMN delivery_partners.ai_score          IS 'Score Vision AI 0-100 (RCCM + NIU)';
COMMENT ON COLUMN delivery_partners.ai_decision       IS 'approved | under_review | rejected';
COMMENT ON COLUMN delivery_partners.ai_extracted_id   IS 'Numéro RCCM extrait par OCR';
COMMENT ON COLUMN delivery_partners.ai_extracted_name IS 'Résumé NIU extrait (format: NIU:xxx score:N décision:yyy)';
COMMENT ON COLUMN delivery_partners.ai_details        IS 'JSON array des détails de vérification';
