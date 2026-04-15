-- Ajout colonne video_url sur restaurant_menu_items
-- Manquante dans la migration initiale mais référencée dans le controller

ALTER TABLE restaurant_menu_items
    ADD COLUMN IF NOT EXISTS video_url TEXT;
