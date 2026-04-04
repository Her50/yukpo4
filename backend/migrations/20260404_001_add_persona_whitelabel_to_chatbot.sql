-- Migration: ajouter persona, white-label et trending au chatbot + content preferences
-- Date: 2026-04-04

-- 1. social_chatbot_config : persona + white-label
ALTER TABLE social_chatbot_config
  ADD COLUMN IF NOT EXISTS account_persona       TEXT    NOT NULL DEFAULT 'shop',
  ADD COLUMN IF NOT EXISTS white_label_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS white_label_brand_name TEXT;

-- Contrainte de valeurs valides pour le persona
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_account_persona'
  ) THEN
    ALTER TABLE social_chatbot_config
      ADD CONSTRAINT chk_account_persona
        CHECK (account_persona IN ('shop', 'creator', 'personality', 'enterprise'));
  END IF;
END $$;

-- 2. social_ai_preferences (table ai_content_service) : white-label
ALTER TABLE social_ai_preferences
  ADD COLUMN IF NOT EXISTS white_label_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. social_trend_snapshots : s'assurer que les colonnes city/sector existent
--    (table créée lors du module TrendPulse — on vérifie sans erreur)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_trend_snapshots') THEN
    BEGIN
      ALTER TABLE social_trend_snapshots ADD COLUMN IF NOT EXISTS city   TEXT;
      ALTER TABLE social_trend_snapshots ADD COLUMN IF NOT EXISTS sector TEXT;
      ALTER TABLE social_trend_snapshots ADD COLUMN IF NOT EXISTS score  DOUBLE PRECISION NOT NULL DEFAULT 1.0;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- colonnes déjà présentes
    END;
  END IF;
END $$;

-- Index pour la recherche rapide de tendances
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_city_sector
  ON social_trend_snapshots (city, sector, captured_at DESC)
  WHERE captured_at >= NOW() - INTERVAL '48 hours';
