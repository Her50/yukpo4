-- ✅ Migration pour enrichir la bibliothèque de templates à 1000+ templates
-- Date: 2025-01-27
-- Objectif: Ajouter templates supplémentaires pour atteindre 1000+ templates

-- Note: Cette migration ajoute des templates de base. Pour atteindre 1000+, 
-- il faudra créer des templates plus spécifiques par industrie et format.

-- Templates par Industrie: Restaurant (5)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score, usage_count) VALUES
('restaurant-menu-showcase', 'services', 'menu', 'Mise en avant de menu restaurant', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "elegant"}', 30.0, '16:9', ARRAY['restaurant', 'menu', 'food'], false, 9.5, 0),
('restaurant-special-dish', 'services', 'promotion', 'Promotion plat spécial', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "appetizing"}', 25.0, '16:9', ARRAY['restaurant', 'promotion', 'food'], false, 9.0, 0),
('restaurant-ambiance', 'services', 'ambiance', 'Présentation ambiance restaurant', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "warm"}', 35.0, '16:9', ARRAY['restaurant', 'ambiance', 'atmosphere'], false, 8.5, 0),
('restaurant-chef-story', 'services', 'story', 'Histoire du chef', '{"scenes": 7, "total_duration": 40}', '[]', '[]', '{"style": "personal"}', 40.0, '16:9', ARRAY['restaurant', 'chef', 'story'], true, 8.0, 0),
('restaurant-opening-hours', 'services', 'info', 'Horaires d''ouverture', '{"scenes": 3, "total_duration": 15}', '[]', '[]', '{"style": "informative"}', 15.0, '16:9', ARRAY['restaurant', 'hours', 'info'], false, 7.5, 0)

ON CONFLICT (name) DO NOTHING;

-- Templates par Format: TikTok (5)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score, usage_count) VALUES
('tiktok-trend-dance', 'social_media', 'tiktok', 'Template TikTok danse tendance', '{"scenes": 3, "total_duration": 15}', '[]', '[]', '{"style": "energetic"}', 15.0, '9:16', ARRAY['tiktok', 'dance', 'trend'], false, 10.0, 0),
('tiktok-product-showcase', 'ecommerce', 'tiktok', 'Mise en avant produit TikTok', '{"scenes": 4, "total_duration": 20}', '[]', '[]', '{"style": "dynamic"}', 20.0, '9:16', ARRAY['tiktok', 'product', 'showcase'], false, 9.5, 0),
('tiktok-tutorial', 'creators', 'tiktok', 'Tutoriel TikTok', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "educational"}', 30.0, '9:16', ARRAY['tiktok', 'tutorial', 'education'], false, 9.0, 0),
('tiktok-behind-scenes', 'social_media', 'tiktok', 'Coulisses TikTok', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "authentic"}', 25.0, '9:16', ARRAY['tiktok', 'behind', 'scenes'], false, 8.5, 0),
('tiktok-challenge', 'social_media', 'tiktok', 'Défi TikTok', '{"scenes": 3, "total_duration": 15}', '[]', '[]', '{"style": "fun"}', 15.0, '9:16', ARRAY['tiktok', 'challenge', 'fun'], false, 8.0, 0)

ON CONFLICT (name) DO NOTHING;

-- Templates par Format: Reels (5)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score, usage_count) VALUES
('reels-product-launch', 'ecommerce', 'reels', 'Lancement produit Reels', '{"scenes": 5, "total_duration": 30}', '[]', '[]', '{"style": "premium"}', 30.0, '9:16', ARRAY['reels', 'product', 'launch'], false, 9.5, 0),
('reels-testimonial', 'business', 'reels', 'Témoignage client Reels', '{"scenes": 4, "total_duration": 25}', '[]', '[]', '{"style": "trustworthy"}', 25.0, '9:16', ARRAY['reels', 'testimonial', 'trust'], false, 9.0, 0),
('reels-quick-tip', 'creators', 'reels', 'Astuce rapide Reels', '{"scenes": 3, "total_duration": 15}', '[]', '[]', '{"style": "informative"}', 15.0, '9:16', ARRAY['reels', 'tip', 'quick'], false, 8.5, 0),
('reels-before-after', 'services', 'reels', 'Avant/Après Reels', '{"scenes": 4, "total_duration": 20}', '[]', '[]', '{"style": "transformative"}', 20.0, '9:16', ARRAY['reels', 'before', 'after'], false, 8.0, 0),
('reels-day-in-life', 'creators', 'reels', 'Journée type Reels', '{"scenes": 6, "total_duration": 35}', '[]', '[]', '{"style": "authentic"}', 35.0, '9:16', ARRAY['reels', 'lifestyle', 'day'], false, 7.5, 0)

ON CONFLICT (name) DO NOTHING;

-- Templates par Format: YouTube (5)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score, usage_count) VALUES
('youtube-intro', 'creators', 'youtube', 'Intro YouTube professionnelle', '{"scenes": 3, "total_duration": 10}', '[]', '[]', '{"style": "professional"}', 10.0, '16:9', ARRAY['youtube', 'intro', 'professional'], false, 9.5, 0),
('youtube-outro', 'creators', 'youtube', 'Outro YouTube avec CTA', '{"scenes": 2, "total_duration": 8}', '[]', '[]', '{"style": "call-to-action"}', 8.0, '16:9', ARRAY['youtube', 'outro', 'cta'], false, 9.0, 0),
('youtube-tutorial', 'creators', 'youtube', 'Tutoriel YouTube complet', '{"scenes": 10, "total_duration": 300}', '[]', '[]', '{"style": "educational"}', 300.0, '16:9', ARRAY['youtube', 'tutorial', 'long'], false, 8.5, 0),
('youtube-product-review', 'ecommerce', 'youtube', 'Avis produit YouTube', '{"scenes": 8, "total_duration": 180}', '[]', '[]', '{"style": "review"}', 180.0, '16:9', ARRAY['youtube', 'review', 'product'], false, 8.0, 0),
('youtube-vlog', 'creators', 'youtube', 'Vlog YouTube', '{"scenes": 12, "total_duration": 600}', '[]', '[]', '{"style": "authentic"}', 600.0, '16:9', ARRAY['youtube', 'vlog', 'lifestyle'], false, 7.5, 0)

ON CONFLICT (name) DO NOTHING;

-- Note: Pour atteindre 1000+ templates, il faudra créer des templates plus spécifiques:
-- - Par industrie (restaurant, e-commerce, beauté, fitness, etc.)
-- - Par sous-catégorie (menu, promotion, témoignage, etc.)
-- - Par format (TikTok, Reels, YouTube, Stories, etc.)
-- - Par style (cinématique, dynamique, minimaliste, etc.)

-- Cette migration ajoute 20 templates de base. Pour 1000+, créer des templates plus spécifiques.
