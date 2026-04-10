-- Migration 2026-04-10 : Ajout GPS aux abonnements alertes WhatsApp
-- Permet la notification de proximité (rayon haversine par type d'alerte)

ALTER TABLE whatsapp_alert_subscriptions
  ADD COLUMN IF NOT EXISTS latitude  FLOAT8,
  ADD COLUMN IF NOT EXISTS longitude FLOAT8;

-- Index spatial (bounding box) pour les requêtes de proximité
CREATE INDEX IF NOT EXISTS idx_wa_alert_subs_gps
  ON whatsapp_alert_subscriptions (latitude, longitude)
  WHERE active = TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL;
