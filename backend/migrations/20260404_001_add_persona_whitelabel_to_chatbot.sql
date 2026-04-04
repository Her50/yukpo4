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

-- 3. Index sur trend_snapshots (vraie table TrendPulse) pour les requetes chatbot
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trend_snapshots') THEN
    CREATE INDEX IF NOT EXISTS idx_trend_snapshots_opp_score
      ON trend_snapshots (opportunity_score DESC, snapshot_at DESC);
  END IF;
END $$;
