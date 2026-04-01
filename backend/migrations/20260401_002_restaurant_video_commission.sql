-- ============================================================
-- Restaurant : ajout vidéo sur les plats + commission à 2%
-- ============================================================

-- Colonne vidéo sur les plats du menu (URL YouTube, Vimeo, stockage Yukpo…)
ALTER TABLE restaurant_menu_items
    ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Mise à jour du taux de commission à 2%
UPDATE yukpo_commission_config
SET rate = 0.02, updated_at = NOW()
WHERE service_type = 'restaurant';

-- S'assure que la ligne existe avec le bon taux au cas où la migration précédente n'a pas tournée
INSERT INTO yukpo_commission_config (service_type, rate)
VALUES ('restaurant', 0.02)
ON CONFLICT (service_type) DO UPDATE SET rate = 0.02, updated_at = NOW();
