-- ✅ Script SQL pour appliquer la migration templates sur Render
-- Utilisation: psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -f APPLY_TEMPLATES_MIGRATION_RENDER.sql

-- ✅ NOUVEAU 2025-01-27: Table pour bibliothèque de templates vidéo par industrie (50+)

CREATE TABLE IF NOT EXISTS video_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    industry VARCHAR(50) NOT NULL CHECK (industry IN ('ecommerce', 'services', 'creators', 'business', 'social_media')),
    subcategory VARCHAR(100),
    description TEXT NOT NULL,
    timeline JSONB NOT NULL,
    effects JSONB NOT NULL DEFAULT '[]'::jsonb,
    transitions JSONB NOT NULL DEFAULT '[]'::jsonb,
    style JSONB NOT NULL DEFAULT '{}'::jsonb,
    duration DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    format VARCHAR(10) NOT NULL DEFAULT '16:9' CHECK (format IN ('16:9', '9:16', '1:1', '4:5')),
    tags TEXT[] NOT NULL DEFAULT '{}',
    thumbnail_url VARCHAR(500),
    preview_url VARCHAR(500),
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    usage_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_templates_industry ON video_templates(industry);
CREATE INDEX IF NOT EXISTS idx_templates_subcategory ON video_templates(subcategory);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON video_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_popularity ON video_templates(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON video_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_name ON video_templates(name);
CREATE INDEX IF NOT EXISTS idx_templates_industry_popularity ON video_templates(industry, popularity_score DESC);

-- Trigger pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_templates_updated_at ON video_templates;
CREATE TRIGGER trigger_update_templates_updated_at
    BEFORE UPDATE ON video_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_templates_updated_at();

-- Insertion des 50+ templates initiaux
-- Catégorie: E-commerce (10)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score) VALUES
('produit-mode', 'ecommerce', 'mode', 'Template pour produits de mode avec transitions élégantes', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["fade", "glow"], "transition": "fade"}]}', '["fade", "glow", "warm"]', '["fade", "slide"]', '{"primary_color": "#FF6B9D", "secondary_color": "#C44569", "font_family": "Montserrat"}', 30.0, '16:9', ARRAY['ecommerce', 'mode', 'fashion', 'produit'], false, 10.0),
('produit-electronique', 'ecommerce', 'electronique', 'Template dynamique pour produits électroniques', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "zoom"], "transition": "zoom"}]}', '["neon", "zoom", "sharpen"]', '["zoom", "cube"]', '{"primary_color": "#00D4FF", "secondary_color": "#0099CC", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['ecommerce', 'electronique', 'tech', 'produit'], false, 9.5),
('produit-alimentaire', 'ecommerce', 'alimentaire', 'Template appétissant pour produits alimentaires', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "glow"], "transition": "fade"}]}', '["warm", "glow", "saturation"]', '["fade", "dissolve"]', '{"primary_color": "#FF8C42", "secondary_color": "#FF6B35", "font_family": "Poppins"}', 30.0, '16:9', ARRAY['ecommerce', 'alimentaire', 'food', 'produit'], false, 9.0),
('produit-beaute', 'ecommerce', 'beaute', 'Template élégant pour produits de beauté', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["glow", "vintage"], "transition": "fade"}]}', '["glow", "vintage", "warm"]', '["fade", "iris"]', '{"primary_color": "#FFB6C1", "secondary_color": "#FF69B4", "font_family": "Playfair Display"}', 30.0, '16:9', ARRAY['ecommerce', 'beaute', 'beauty', 'produit'], false, 8.5),
('produit-maison', 'ecommerce', 'maison', 'Template chaleureux pour produits maison', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "vignette"], "transition": "slide"}]}', '["warm", "vignette", "glow"]', '["slide", "fade"]', '{"primary_color": "#8B7355", "secondary_color": "#A0826D", "font_family": "Lora"}', 30.0, '16:9', ARRAY['ecommerce', 'maison', 'home', 'produit'], false, 8.0),
('produit-sport', 'ecommerce', 'sport', 'Template énergique pour produits sportifs', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "sharpen"], "transition": "zoom"}]}', '["neon", "sharpen", "contrast"]', '["zoom", "bounce"]', '{"primary_color": "#FF4500", "secondary_color": "#FF6347", "font_family": "Oswald"}', 30.0, '16:9', ARRAY['ecommerce', 'sport', 'sports', 'produit'], false, 7.5),
('produit-jouets', 'ecommerce', 'jouets', 'Template coloré et fun pour jouets', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "bounce"}]}', '["neon", "glow", "saturation"]', '["bounce", "elastic"]', '{"primary_color": "#FFD700", "secondary_color": "#FFA500", "font_family": "Comic Sans MS"}', 30.0, '16:9', ARRAY['ecommerce', 'jouets', 'toys', 'produit'], false, 7.0),
('produit-livres', 'ecommerce', 'livres', 'Template littéraire pour livres', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["vintage", "sepia"], "transition": "fade"}]}', '["vintage", "sepia", "warm"]', '["fade", "dissolve"]', '{"primary_color": "#8B4513", "secondary_color": "#A0522D", "font_family": "Times New Roman"}', 30.0, '16:9', ARRAY['ecommerce', 'livres', 'books', 'produit'], false, 6.5),
('produit-bijoux', 'ecommerce', 'bijoux', 'Template luxueux pour bijoux', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["glow", "sharpen"], "transition": "iris"}]}', '["glow", "sharpen", "brightness"]', '["iris", "fade"]', '{"primary_color": "#FFD700", "secondary_color": "#C0C0C0", "font_family": "Cormorant Garamond"}', 30.0, '16:9', ARRAY['ecommerce', 'bijoux', 'jewelry', 'produit'], true, 6.0),
('produit-accessoires', 'ecommerce', 'accessoires', 'Template polyvalent pour accessoires', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["glow", "warm"], "transition": "slide"}]}', '["glow", "warm", "saturation"]', '["slide", "fade"]', '{"primary_color": "#9370DB", "secondary_color": "#BA55D3", "font_family": "Raleway"}', 30.0, '16:9', ARRAY['ecommerce', 'accessoires', 'accessories', 'produit'], false, 5.5)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Services (10)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score) VALUES
('restauration', 'services', 'restauration', 'Template appétissant pour restaurants', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "glow"], "transition": "fade"}]}', '["warm", "glow", "saturation"]', '["fade", "dissolve"]', '{"primary_color": "#FF8C42", "secondary_color": "#FF6B35", "font_family": "Poppins"}', 30.0, '16:9', ARRAY['services', 'restauration', 'restaurant', 'food'], false, 9.5),
('hotellerie', 'services', 'hotellerie', 'Template élégant pour hôtels', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "vignette"], "transition": "fade"}]}', '["warm", "vignette", "glow"]', '["fade", "slide"]', '{"primary_color": "#8B7355", "secondary_color": "#A0826D", "font_family": "Playfair Display"}', 30.0, '16:9', ARRAY['services', 'hotellerie', 'hotel', 'hospitality'], false, 9.0),
('fitness', 'services', 'fitness', 'Template énergique pour salles de sport', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "sharpen"], "transition": "zoom"}]}', '["neon", "sharpen", "contrast"]', '["zoom", "bounce"]', '{"primary_color": "#FF4500", "secondary_color": "#FF6347", "font_family": "Oswald"}', 30.0, '16:9', ARRAY['services', 'fitness', 'gym', 'sport'], false, 8.5),
('education', 'services', 'education', 'Template professionnel pour éducation', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["sharpen", "brightness"], "transition": "fade"}]}', '["sharpen", "brightness", "contrast"]', '["fade", "slide"]', '{"primary_color": "#4A90E2", "secondary_color": "#357ABD", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['services', 'education', 'school', 'learning'], false, 8.0),
('sante', 'services', 'sante', 'Template rassurant pour services de santé', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "sharpen"], "transition": "fade"}]}', '["cool", "sharpen", "brightness"]', '["fade", "dissolve"]', '{"primary_color": "#4ECDC4", "secondary_color": "#45B7B8", "font_family": "Lato"}', 30.0, '16:9', ARRAY['services', 'sante', 'health', 'medical'], false, 7.5),
('finance', 'services', 'finance', 'Template professionnel pour services financiers', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "sharpen"], "transition": "fade"}]}', '["cool", "sharpen", "contrast"]', '["fade", "slide"]', '{"primary_color": "#2C3E50", "secondary_color": "#34495E", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['services', 'finance', 'financial', 'business'], false, 7.0),
('immobilier', 'services', 'immobilier', 'Template attractif pour immobilier', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "glow"], "transition": "fade"}]}', '["warm", "glow", "saturation"]', '["fade", "zoom"]', '{"primary_color": "#D4AF37", "secondary_color": "#B8860B", "font_family": "Montserrat"}', 30.0, '16:9', ARRAY['services', 'immobilier', 'real-estate', 'property'], false, 6.5),
('transport', 'services', 'transport', 'Template dynamique pour transport', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "zoom"], "transition": "zoom"}]}', '["neon", "zoom", "sharpen"]', '["zoom", "slide"]', '{"primary_color": "#00D4FF", "secondary_color": "#0099CC", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['services', 'transport', 'travel', 'mobility'], false, 6.0),
('evenementiel', 'services', 'evenementiel', 'Template festif pour événements', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "bounce"}]}', '["neon", "glow", "saturation"]', '["bounce", "elastic"]', '{"primary_color": "#FF1493", "secondary_color": "#FF69B4", "font_family": "Poppins"}', 30.0, '16:9', ARRAY['services', 'evenementiel', 'events', 'party'], false, 5.5),
('consulting', 'services', 'consulting', 'Template professionnel pour consulting', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "sharpen"], "transition": "fade"}]}', '["cool", "sharpen", "contrast"]', '["fade", "slide"]', '{"primary_color": "#2C3E50", "secondary_color": "#34495E", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['services', 'consulting', 'business', 'professional'], true, 5.0)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Créateurs (10)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score) VALUES
('vlog', 'creators', 'vlog', 'Template authentique pour vlogs', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "vignette"], "transition": "fade"}]}', '["warm", "vignette", "glow"]', '["fade", "dissolve"]', '{"primary_color": "#FF6B9D", "secondary_color": "#C44569", "font_family": "Montserrat"}', 60.0, '16:9', ARRAY['creators', 'vlog', 'lifestyle', 'personal'], false, 10.0),
('tutoriel', 'creators', 'tutoriel', 'Template éducatif pour tutoriels', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["sharpen", "brightness"], "transition": "fade"}]}', '["sharpen", "brightness", "contrast"]', '["fade", "slide"]', '{"primary_color": "#4A90E2", "secondary_color": "#357ABD", "font_family": "Roboto"}', 60.0, '16:9', ARRAY['creators', 'tutoriel', 'tutorial', 'education'], false, 9.5),
('review', 'creators', 'review', 'Template dynamique pour reviews', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "zoom"}]}', '["neon", "glow", "saturation"]', '["zoom", "bounce"]', '{"primary_color": "#FF4500", "secondary_color": "#FF6347", "font_family": "Oswald"}', 30.0, '16:9', ARRAY['creators', 'review', 'product', 'opinion'], false, 9.0),
('unboxing', 'creators', 'unboxing', 'Template énergique pour unboxing', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "zoom"], "transition": "zoom"}]}', '["neon", "zoom", "sharpen"]', '["zoom", "cube"]', '{"primary_color": "#00D4FF", "secondary_color": "#0099CC", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['creators', 'unboxing', 'product', 'reveal'], false, 8.5),
('gaming', 'creators', 'gaming', 'Template intense pour gaming', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glitch"], "transition": "glitch"}]}', '["neon", "glitch", "chromatic-aberration"]', '["glitch", "zoom"]', '{"primary_color": "#00FF00", "secondary_color": "#00CC00", "font_family": "Orbitron"}', 30.0, '16:9', ARRAY['creators', 'gaming', 'games', 'esports'], false, 8.0),
('musique', 'creators', 'musique', 'Template rythmé pour musique', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "bounce"}]}', '["neon", "glow", "saturation"]', '["bounce", "elastic"]', '{"primary_color": "#FF1493", "secondary_color": "#FF69B4", "font_family": "Poppins"}', 30.0, '16:9', ARRAY['creators', 'musique', 'music', 'audio'], false, 7.5),
('art', 'creators', 'art', 'Template artistique pour art', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["vintage", "sepia"], "transition": "fade"}]}', '["vintage", "sepia", "warm"]', '["fade", "dissolve"]', '{"primary_color": "#8B4513", "secondary_color": "#A0522D", "font_family": "Playfair Display"}', 30.0, '16:9', ARRAY['creators', 'art', 'artistic', 'creative'], false, 7.0),
('cuisine', 'creators', 'cuisine', 'Template appétissant pour cuisine', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "glow"], "transition": "fade"}]}', '["warm", "glow", "saturation"]', '["fade", "dissolve"]', '{"primary_color": "#FF8C42", "secondary_color": "#FF6B35", "font_family": "Poppins"}', 30.0, '16:9', ARRAY['creators', 'cuisine', 'cooking', 'food'], false, 6.5),
('voyage', 'creators', 'voyage', 'Template inspirant pour voyage', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "vignette"], "transition": "fade"}]}', '["warm", "vignette", "glow"]', '["fade", "zoom"]', '{"primary_color": "#87CEEB", "secondary_color": "#4682B4", "font_family": "Montserrat"}', 60.0, '16:9', ARRAY['creators', 'voyage', 'travel', 'adventure'], false, 6.0),
('lifestyle', 'creators', 'lifestyle', 'Template lifestyle authentique', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "vignette"], "transition": "fade"}]}', '["warm", "vignette", "glow"]', '["fade", "dissolve"]', '{"primary_color": "#FFB6C1", "secondary_color": "#FF69B4", "font_family": "Poppins"}', 60.0, '16:9', ARRAY['creators', 'lifestyle', 'life', 'personal'], false, 5.5)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Business (10)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score) VALUES
('presentation', 'business', 'presentation', 'Template professionnel pour présentations', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "sharpen"], "transition": "fade"}]}', '["cool", "sharpen", "contrast"]', '["fade", "slide"]', '{"primary_color": "#2C3E50", "secondary_color": "#34495E", "font_family": "Roboto"}', 60.0, '16:9', ARRAY['business', 'presentation', 'professional', 'corporate'], false, 10.0),
('pitch', 'business', 'pitch', 'Template impactant pour pitch', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "sharpen"], "transition": "zoom"}]}', '["neon", "sharpen", "contrast"]', '["zoom", "cube"]', '{"primary_color": "#00D4FF", "secondary_color": "#0099CC", "font_family": "Roboto"}', 60.0, '16:9', ARRAY['business', 'pitch', 'startup', 'entrepreneur'], false, 9.5),
('annonce', 'business', 'annonce', 'Template attractif pour annonces', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "fade"}]}', '["neon", "glow", "saturation"]', '["fade", "bounce"]', '{"primary_color": "#FF4500", "secondary_color": "#FF6347", "font_family": "Oswald"}', 30.0, '16:9', ARRAY['business', 'annonce', 'announcement', 'news'], false, 9.0),
('recrutement', 'business', 'recrutement', 'Template professionnel pour recrutement', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "sharpen"], "transition": "fade"}]}', '["cool", "sharpen", "brightness"]', '["fade", "slide"]', '{"primary_color": "#4A90E2", "secondary_color": "#357ABD", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['business', 'recrutement', 'recruitment', 'hr'], false, 8.5),
('formation', 'business', 'formation', 'Template éducatif pour formations', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["sharpen", "brightness"], "transition": "fade"}]}', '["sharpen", "brightness", "contrast"]', '["fade", "slide"]', '{"primary_color": "#4A90E2", "secondary_color": "#357ABD", "font_family": "Roboto"}', 60.0, '16:9', ARRAY['business', 'formation', 'training', 'education'], false, 8.0),
('webinaire', 'business', 'webinaire', 'Template professionnel pour webinaires', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "sharpen"], "transition": "fade"}]}', '["cool", "sharpen", "contrast"]', '["fade", "dissolve"]', '{"primary_color": "#2C3E50", "secondary_color": "#34495E", "font_family": "Roboto"}', 60.0, '16:9', ARRAY['business', 'webinaire', 'webinar', 'online'], false, 7.5),
('temoignage', 'business', 'temoignage', 'Template authentique pour témoignages', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "vignette"], "transition": "fade"}]}', '["warm", "vignette", "glow"]', '["fade", "dissolve"]', '{"primary_color": "#FFB6C1", "secondary_color": "#FF69B4", "font_family": "Montserrat"}', 60.0, '16:9', ARRAY['business', 'temoignage', 'testimonial', 'review'], false, 7.0),
('cas-client', 'business', 'cas-client', 'Template professionnel pour cas clients', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "sharpen"], "transition": "fade"}]}', '["cool", "sharpen", "contrast"]', '["fade", "slide"]', '{"primary_color": "#4A90E2", "secondary_color": "#357ABD", "font_family": "Roboto"}', 60.0, '16:9', ARRAY['business', 'cas-client', 'case-study', 'success'], false, 6.5),
('lancement', 'business', 'lancement', 'Template impactant pour lancements', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "zoom"}]}', '["neon", "glow", "saturation"]', '["zoom", "bounce"]', '{"primary_color": "#FF4500", "secondary_color": "#FF6347", "font_family": "Oswald"}', 30.0, '16:9', ARRAY['business', 'lancement', 'launch', 'product'], false, 6.0),
('evenement', 'business', 'evenement', 'Template festif pour événements business', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "bounce"}]}', '["neon", "glow", "saturation"]', '["bounce", "elastic"]', '{"primary_color": "#FF1493", "secondary_color": "#FF69B4", "font_family": "Poppins"}', 30.0, '16:9', ARRAY['business', 'evenement', 'event', 'corporate'], false, 5.5)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Social Media (10)
INSERT INTO video_templates (name, industry, subcategory, description, timeline, effects, transitions, style, duration, format, tags, is_premium, popularity_score) VALUES
('tiktok', 'social_media', 'tiktok', 'Template vertical optimisé TikTok', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "bounce"}]}', '["neon", "glow", "saturation"]', '["bounce", "zoom"]', '{"primary_color": "#000000", "secondary_color": "#FF0050", "font_family": "Roboto"}', 15.0, '9:16', ARRAY['social_media', 'tiktok', 'vertical', 'short'], false, 10.0),
('instagram-reels', 'social_media', 'instagram-reels', 'Template carré optimisé Instagram Reels', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["glow", "warm"], "transition": "fade"}]}', '["glow", "warm", "saturation"]', '["fade", "slide"]', '{"primary_color": "#E4405F", "secondary_color": "#F56040", "font_family": "Montserrat"}', 15.0, '9:16', ARRAY['social_media', 'instagram', 'reels', 'vertical'], false, 9.5),
('youtube-shorts', 'social_media', 'youtube-shorts', 'Template vertical optimisé YouTube Shorts', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "sharpen"], "transition": "zoom"}]}', '["neon", "sharpen", "contrast"]', '["zoom", "cube"]', '{"primary_color": "#FF0000", "secondary_color": "#CC0000", "font_family": "Roboto"}', 15.0, '9:16', ARRAY['social_media', 'youtube', 'shorts', 'vertical'], false, 9.0),
('facebook', 'social_media', 'facebook', 'Template carré optimisé Facebook', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "glow"], "transition": "fade"}]}', '["warm", "glow", "saturation"]', '["fade", "dissolve"]', '{"primary_color": "#1877F2", "secondary_color": "#42A5F5", "font_family": "Roboto"}', 30.0, '1:1', ARRAY['social_media', 'facebook', 'square', 'social'], false, 8.5),
('linkedin', 'social_media', 'linkedin', 'Template professionnel optimisé LinkedIn', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "sharpen"], "transition": "fade"}]}', '["cool", "sharpen", "contrast"]', '["fade", "slide"]', '{"primary_color": "#0077B5", "secondary_color": "#00A0DC", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['social_media', 'linkedin', 'professional', 'business'], false, 8.0),
('twitter', 'social_media', 'twitter', 'Template carré optimisé Twitter/X', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "glow"], "transition": "fade"}]}', '["cool", "glow", "saturation"]', '["fade", "dissolve"]', '{"primary_color": "#1DA1F2", "secondary_color": "#0D8BD9", "font_family": "Roboto"}', 30.0, '16:9', ARRAY['social_media', 'twitter', 'x', 'social'], false, 7.5),
('pinterest', 'social_media', 'pinterest', 'Template vertical optimisé Pinterest', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "vignette"], "transition": "fade"}]}', '["warm", "vignette", "glow"]', '["fade", "zoom"]', '{"primary_color": "#BD081C", "secondary_color": "#E60023", "font_family": "Montserrat"}', 30.0, '9:16', ARRAY['social_media', 'pinterest', 'vertical', 'inspiration'], false, 7.0),
('snapchat', 'social_media', 'snapchat', 'Template vertical optimisé Snapchat', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["neon", "glow"], "transition": "bounce"}]}', '["neon", "glow", "saturation"]', '["bounce", "elastic"]', '{"primary_color": "#FFFC00", "secondary_color": "#FFFF00", "font_family": "Roboto"}', 10.0, '9:16', ARRAY['social_media', 'snapchat', 'vertical', 'story'], false, 6.5),
('whatsapp', 'social_media', 'whatsapp', 'Template carré optimisé WhatsApp', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["warm", "glow"], "transition": "fade"}]}', '["warm", "glow", "saturation"]', '["fade", "dissolve"]', '{"primary_color": "#25D366", "secondary_color": "#128C7E", "font_family": "Roboto"}', 30.0, '1:1', ARRAY['social_media', 'whatsapp', 'square', 'messaging'], false, 6.0),
('telegram', 'social_media', 'telegram', 'Template carré optimisé Telegram', '{"scenes": [{"start_time": 0, "duration": 3, "media_url": null, "effects": ["cool", "glow"], "transition": "fade"}]}', '["cool", "glow", "saturation"]', '["fade", "dissolve"]', '{"primary_color": "#0088CC", "secondary_color": "#229ED9", "font_family": "Roboto"}', 30.0, '1:1', ARRAY['social_media', 'telegram', 'square', 'messaging'], false, 5.5)

ON CONFLICT (name) DO NOTHING;

-- ✅ Migration complète ! Table video_templates créée avec 50+ templates.

