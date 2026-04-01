-- Migration: Colonnes d'analyse IA pour la vérification KYC des conducteurs
-- Ajoutées pour Google Cloud Vision API (OCR CNI + détection visage)

ALTER TABLE driver_verifications
  ADD COLUMN IF NOT EXISTS ai_score          INTEGER,
  ADD COLUMN IF NOT EXISTS ai_decision       TEXT,
  ADD COLUMN IF NOT EXISTS ai_extracted_name TEXT,
  ADD COLUMN IF NOT EXISTS ai_extracted_id   TEXT,
  ADD COLUMN IF NOT EXISTS ai_details        TEXT;

COMMENT ON COLUMN driver_verifications.ai_score IS 'Score IA 0-100 (Vision API)';
COMMENT ON COLUMN driver_verifications.ai_decision IS 'Décision IA: approved / under_review / rejected';
COMMENT ON COLUMN driver_verifications.ai_extracted_name IS 'Nom extrait par OCR depuis la CNI';
COMMENT ON COLUMN driver_verifications.ai_extracted_id IS 'Numéro CNI extrait par OCR';
COMMENT ON COLUMN driver_verifications.ai_details IS 'JSON array des détails de l''analyse IA';
