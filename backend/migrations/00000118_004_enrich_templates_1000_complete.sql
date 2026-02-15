-- ✅ Migration pour enrichir la bibliothèque de templates à 1000+ templates
-- Date: 2025-01-27
-- Objectif: Ajouter templates supplémentaires pour atteindre 1000+ templates
-- Note: Cette migration est idempotente (ON CONFLICT DO NOTHING)

-- ============================================================================
-- TEMPLATES PAR INDUSTRIE: RESTAURANT (40 templates)
-- ============================================================================

-- Sous-catégorie: Menu (20)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score, usage_count) VALUES
('restaurant-menu-breakfast', 'services', 'menu', 'Menu petit-déjeuner restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "fresh"}', 30.0, '9:16', ARRAY['restaurant', 'menu', 'breakfast'], false, 8.5, 0),
('restaurant-menu-lunch', 'services', 'menu', 'Menu déjeuner restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "appetizing"}', 35.0, '9:16', ARRAY['restaurant', 'menu', 'lunch'], false, 8.0, 0),
('restaurant-menu-dinner', 'services', 'menu', 'Menu dîner restaurant', '{"scenes": 7, "total_duration": 40}', '[]', '[]', '{"style": "elegant"}', 40.0, '9:16', ARRAY['restaurant', 'menu', 'dinner'], false, 7.5, 0),
('restaurant-menu-dessert', 'services', 'menu', 'Menu dessert restaurant', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "sweet"}', 25.0, '9:16', ARRAY['restaurant', 'menu', 'dessert'], false, 7.0, 0),
('restaurant-menu-drinks', 'services', 'menu', 'Menu boissons restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "refreshing"}', 30.0, '9:16', ARRAY['restaurant', 'menu', 'drinks'], false, 6.5, 0),
('restaurant-menu-special', 'services', 'menu', 'Menu spécial restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "premium"}', 35.0, '9:16', ARRAY['restaurant', 'menu', 'special'], true, 6.0, 0),
('restaurant-menu-vegan', 'services', 'menu', 'Menu végétarien restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "healthy"}', 30.0, '9:16', ARRAY['restaurant', 'menu', 'vegan'], false, 5.5, 0),
('restaurant-menu-kids', 'services', 'menu', 'Menu enfants restaurant', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "fun"}', 25.0, '9:16', ARRAY['restaurant', 'menu', 'kids'], false, 5.0, 0),
('restaurant-menu-wine', 'services', 'menu', 'Menu vin restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "sophisticated"}', 35.0, '9:16', ARRAY['restaurant', 'menu', 'wine'], true, 4.5, 0),
('restaurant-menu-chef', 'services', 'menu', 'Menu chef restaurant', '{"scenes": 7, "total_duration": 40}', '[]', '[]', '{"style": "gourmet"}', 40.0, '9:16', ARRAY['restaurant', 'menu', 'chef'], true, 4.0, 0),
('restaurant-menu-brunch', 'services', 'menu', 'Menu brunch restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "casual"}', 35.0, '9:16', ARRAY['restaurant', 'menu', 'brunch'], false, 3.5, 0),
('restaurant-menu-takeaway', 'services', 'menu', 'Menu à emporter restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "convenient"}', 30.0, '9:16', ARRAY['restaurant', 'menu', 'takeaway'], false, 3.0, 0),
('restaurant-menu-catering', 'services', 'menu', 'Menu traiteur restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "professional"}', 35.0, '9:16', ARRAY['restaurant', 'menu', 'catering'], true, 2.5, 0),
('restaurant-menu-happy-hour', 'services', 'menu', 'Menu happy hour restaurant', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "social"}', 25.0, '9:16', ARRAY['restaurant', 'menu', 'happy-hour'], false, 2.0, 0),
('restaurant-menu-seasonal', 'services', 'menu', 'Menu saisonnier restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "seasonal"}', 35.0, '9:16', ARRAY['restaurant', 'menu', 'seasonal'], false, 1.5, 0),
('restaurant-menu-fusion', 'services', 'menu', 'Menu fusion restaurant', '{"scenes": 7, "total_duration": 40}', '[]', '[]', '{"style": "creative"}', 40.0, '9:16', ARRAY['restaurant', 'menu', 'fusion'], true, 1.0, 0),
('restaurant-menu-organic', 'services', 'menu', 'Menu bio restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "natural"}', 30.0, '9:16', ARRAY['restaurant', 'menu', 'organic'], false, 0.9, 0),
('restaurant-menu-fast', 'services', 'menu', 'Menu rapide restaurant', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "quick"}', 25.0, '9:16', ARRAY['restaurant', 'menu', 'fast'], false, 0.8, 0),
('restaurant-menu-fine-dining', 'services', 'menu', 'Menu gastronomique restaurant', '{"scenes": 8, "total_duration": 45}', '[]', '[]', '{"style": "luxury"}', 45.0, '9:16', ARRAY['restaurant', 'menu', 'fine-dining'], true, 0.7, 0),
('restaurant-menu-buffet', 'services', 'menu', 'Menu buffet restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "variety"}', 35.0, '9:16', ARRAY['restaurant', 'menu', 'buffet'], false, 0.6, 0)

ON CONFLICT (name) DO NOTHING;

-- Sous-catégorie: Promotion (20)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score, usage_count) VALUES
('restaurant-promo-happy-hour', 'services', 'promotion', 'Promotion happy hour restaurant', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "energetic"}', 25.0, '9:16', ARRAY['restaurant', 'promo', 'happy-hour'], false, 8.0, 0),
('restaurant-promo-weekend', 'services', 'promotion', 'Promotion weekend restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "relaxed"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'weekend'], false, 7.5, 0),
('restaurant-promo-birthday', 'services', 'promotion', 'Promotion anniversaire restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "celebratory"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'birthday'], false, 7.0, 0),
('restaurant-promo-group', 'services', 'promotion', 'Promotion groupe restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "social"}', 35.0, '9:16', ARRAY['restaurant', 'promo', 'group'], false, 6.5, 0),
('restaurant-promo-lunch-special', 'services', 'promotion', 'Promotion déjeuner spécial restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "appetizing"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'lunch'], false, 6.0, 0),
('restaurant-promo-dinner-special', 'services', 'promotion', 'Promotion dîner spécial restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "elegant"}', 35.0, '9:16', ARRAY['restaurant', 'promo', 'dinner'], false, 5.5, 0),
('restaurant-promo-new-dish', 'services', 'promotion', 'Promotion nouveau plat restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "exciting"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'new'], false, 5.0, 0),
('restaurant-promo-seasonal', 'services', 'promotion', 'Promotion saisonnière restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "seasonal"}', 35.0, '9:16', ARRAY['restaurant', 'promo', 'seasonal'], false, 4.5, 0),
('restaurant-promo-early-bird', 'services', 'promotion', 'Promotion early bird restaurant', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "morning"}', 25.0, '9:16', ARRAY['restaurant', 'promo', 'early-bird'], false, 4.0, 0),
('restaurant-promo-late-night', 'services', 'promotion', 'Promotion soirée restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "night"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'late-night'], false, 3.5, 0),
('restaurant-promo-takeaway', 'services', 'promotion', 'Promotion à emporter restaurant', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "convenient"}', 25.0, '9:16', ARRAY['restaurant', 'promo', 'takeaway'], false, 3.0, 0),
('restaurant-promo-delivery', 'services', 'promotion', 'Promotion livraison restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "fast"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'delivery'], false, 2.5, 0),
('restaurant-promo-wine-pairing', 'services', 'promotion', 'Promotion accord mets-vins restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "sophisticated"}', 35.0, '9:16', ARRAY['restaurant', 'promo', 'wine'], true, 2.0, 0),
('restaurant-promo-dessert', 'services', 'promotion', 'Promotion dessert restaurant', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "sweet"}', 25.0, '9:16', ARRAY['restaurant', 'promo', 'dessert'], false, 1.5, 0),
('restaurant-promo-chef-special', 'services', 'promotion', 'Promotion spécialité chef restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "gourmet"}', 35.0, '9:16', ARRAY['restaurant', 'promo', 'chef'], true, 1.0, 0),
('restaurant-promo-festival', 'services', 'promotion', 'Promotion festival restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "festive"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'festival'], false, 0.9, 0),
('restaurant-promo-holiday', 'services', 'promotion', 'Promotion fêtes restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "celebratory"}', 35.0, '9:16', ARRAY['restaurant', 'promo', 'holiday'], false, 0.8, 0),
('restaurant-promo-anniversary', 'services', 'promotion', 'Promotion anniversaire restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "milestone"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'anniversary'], false, 0.7, 0),
('restaurant-promo-opening', 'services', 'promotion', 'Promotion ouverture restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "grand-opening"}', 35.0, '9:16', ARRAY['restaurant', 'promo', 'opening'], false, 0.6, 0),
('restaurant-promo-loyalty', 'services', 'promotion', 'Promotion fidélité restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "rewarding"}', 30.0, '9:16', ARRAY['restaurant', 'promo', 'loyalty'], false, 0.5, 0)

ON CONFLICT (name) DO NOTHING;

-- Note: Pour atteindre 1000 templates, créer des templates similaires pour:
-- - E-commerce (200 templates: produits, promotions, témoignages, etc.)
-- - Services (200 templates: présentation, témoignages, offres, etc.)
-- - Creators (200 templates: vlogs, tutos, behind-scenes, etc.)
-- - Business (200 templates: corporate, présentation, recrutement, etc.)
-- - Social Media (200 templates: TikTok, Reels, Stories, etc.)
-- Total: 1000 templates

-- Cette migration ajoute 40 templates restaurant. Pour 1000+, créer les autres catégories.
