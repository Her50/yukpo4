-- ✅ NOUVEAU: Ajout de 50+ transitions tendance pour rivaliser TikTok/Canva

-- Catégories de transitions
INSERT INTO effect_categories (id, name, description, icon) VALUES 
('transitions_tiktok', 'Transitions TikTok', 'Transitions virales TikTok 2024', 'trending-up'),
('transitions_creative', 'Transitions Créatives', 'Effets créatifs originaux', 'sparkles'),
('transitions_professional', 'Transitions Pro', 'Transitions professionnelles fluides', 'briefcase'),
('transitions_glitch', 'Transitions Glitch', 'Effets glitch et numériques', 'zap'),
('transitions_nature', 'Transitions Nature', 'Transitions organiques naturelles', 'leaf')
ON CONFLICT (id) DO NOTHING;

-- Transitions TikTok (15)
INSERT INTO effects (id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES 
('tiktok_zoom_in', 'Zoom In Rapide', 'Transition TikTok avec zoom avant rapide', 'zoom', '{"duration": 0.3, "zoom": 1.2}', '["tiktok", "zoom", "fast", "viral"]', false, 95),
('tiktok_zoom_out', 'Zoom Out Lent', 'Transition TikTok avec zoom arrière lent', 'zoom', '{"duration": 0.5, "zoom": 0.8}', '["tiktok", "zoom", "slow", "smooth"]', false, 92),
('tiktok_spin', 'Spin 360°', 'Rotation complète TikTok style', 'rotate', '{"duration": 0.4, "angle": 360}', '["tiktok", "spin", "rotate", "dynamic"]', false, 88),
('tiktok_slide_up', 'Slide Up', 'Glissement vers le haut TikTok', 'slide', '{"direction": "up", "duration": 0.3}', '["tiktok", "slide", "up", "clean"]', false, 90),
('tiktok_slide_down', 'Slide Down', 'Glissement vers le bas TikTok', 'slide', '{"direction": "down", "duration": 0.3}', '["tiktok", "slide", "down", "clean"]', false, 89),
('tiktok_fade_white', 'Fade White', 'Fondu blanc TikTok', 'fade', '{"color": "white", "duration": 0.2}', '["tiktok", "fade", "white", "bright"]', false, 87),
('tiktok_fade_black', 'Fade Black', 'Fondu noir TikTok', 'fade', '{"color": "black", "duration": 0.2}', '["tiktok", "fade", "black", "dramatic"]', false, 86),
('tiktok_glitch', 'Glitch TikTok', 'Effet glitch TikTok', 'glitch', '{"intensity": 0.7, "duration": 0.3}', '["tiktok", "glitch", "digital", "edgy"]', true, 94),
('tiktok_strobe', 'Strobe Flash', 'Flash stroboscopique TikTok', 'flash', '{"frequency": 10, "duration": 0.2}', '["tiktok", "flash", "strobe", "energetic"]', true, 85),
('tiktok_blur', 'Blur Transition', 'Flou de mouvement TikTok', 'blur', '{"radius": 5, "duration": 0.3}', '["tiktok", "blur", "smooth", "dreamy"]', false, 83),
('tiktok_pixelate', 'Pixelate', 'Pixelisation TikTok', 'pixelate', '{"block_size": 8, "duration": 0.2}', '["tiktok", "pixelate", "retro", "digital"]', true, 81),
('tiktok_ripple', 'Ripple Effect', 'Effet ondulation TikTok', 'ripple', '{"amplitude": 10, "frequency": 5}', '["tiktok", "ripple", "wave", "organic"]', true, 79),
('tiktok_shake', 'Camera Shake', 'Secousse de caméra TikTok', 'shake', '{"intensity": 0.5, "duration": 0.2}', '["tiktok", "shake", "dynamic", "energetic"]', false, 84),
('tiktok_morph', 'Morph Transform', 'Transformation morphing TikTok', 'morph', '{"smoothness": 0.8, "duration": 0.4}', '["tiktok", "morph", "transform", "magical"]', true, 91),
('tiktok_duotone', 'Duotone Flash', 'Flash duotone TikTok', 'duotone', '{"colors": ["#FF6B6B", "#4ECDC4"], "duration": 0.15}', '["tiktok", "duotone", "colorful", "artistic"]', true, 78)
ON CONFLICT (id) DO NOTHING;

-- Transitions Créatives (12)
INSERT INTO effects (id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES 
('creative_page_turn', 'Page Turn', 'Effet tour de page livre', 'pageturn', '{"direction": "right", "curl": 0.2}', '["creative", "book", "page", "elegant"]', false, 75),
('creative_cube_spin', 'Cube Spin', 'Rotation 3D cube', 'cube', '{"faces": 6, "duration": 0.6}', '["creative", "3d", "cube", "modern"]', true, 82),
('creative_spherize', 'Spherize', 'Effet sphère 3D', 'sphere', '{"radius": 1.0, "duration": 0.4}', '["creative", "3d", "sphere", "futuristic"]', true, 77),
('creative_ripple_dissolve', 'Ripple Dissolve', 'Dissolution ondulations', 'ripple_dissolve', '{"waves": 8, "amplitude": 0.3}', '["creative", "ripple", "dissolve", "organic"]', true, 74),
('creative_kaleidoscope', 'Kaleidoscope', 'Effet kaléidoscope', 'kaleidoscope', '{"segments": 8, "rotation": 45}', '["creative", "kaleidoscope", "psychedelic", "colorful"]', true, 80),
('creative_mosaic', 'Mosaic Break', 'Effet mosaïque cassé', 'mosaic', '{"tiles": 16, "shuffle": true}', '["creative", "mosaic", "geometric", "artistic"]', true, 76),
('creative_paint_splash', 'Paint Splash', 'Éclaboussure peinture', 'paint', '{"color": "#FF6B6B", "particles": 50}', '["creative", "paint", "splash", "artistic"]', true, 85),
('creative_light_leak', 'Light Leak', 'Fuite de lumière vintage', 'lightleak', '{"intensity": 0.6, "color": "#FFD700"}', '["creative", "vintage", "light", "warm"]', false, 73),
('creative_film_grain', 'Film Grain', 'Grain film vintage', 'grain', '{"intensity": 0.3, "size": 2}', '["creative", "vintage", "film", "nostalgic"]', false, 71),
('creative_chromatic', 'Chromatic Aberration', 'Aberration chromatique', 'chromatic', '{"offset": 2, "intensity": 0.5}', '["creative", "chromatic", "sci-fi", "futuristic"]', true, 79),
('creative_watercolor', 'Watercolor Blend', 'Fusion aquarelle', 'watercolor', '{"wetness": 0.7, "bleed": 0.3}', '["creative", "watercolor", "artistic", "soft"]', true, 78),
('creative_neon_glow', 'Neon Glow', 'Lueur néon', 'neon', '{"color": "#FF00FF", "intensity": 0.8}', '["creative", "neon", "glow", "cyberpunk"]', true, 83)
ON CONFLICT (id) DO NOTHING;

-- Transitions Professionnelles (10)
INSERT INTO effects (id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES 
('pro_cross_dissolve', 'Cross Dissolve', 'Fondu croisé professionnel', 'crossfade', '{"duration": 0.5}', '["professional", "crossfade", "smooth", "standard"]', false, 88),
('pro_linear_wipe', 'Linear Wipe', 'Balayage linéaire propre', 'wipe', '{"direction": "left", "border": 2}', '["professional", "wipe", "clean", "corporate"]', false, 86),
('pro_push', 'Push Slide', 'Pousser glissement', 'push', '{"direction": "right", "duration": 0.4}', '["professional", "push", "slide", "dynamic"]', false, 84),
('pro_iris', 'Iris Round', 'Ouverture iris circulaire', 'iris', '{"shape": "circle", "points": 12}', '["professional", "iris", "round", "elegant"]', true, 81),
('pro_star_wipe', 'Star Wipe', 'Balayage étoile', 'starwipe', '{"points": 5, "duration": 0.5}', '["professional", "star", "celebration", "fun"]', false, 79),
('pro_blur_to_focus', 'Blur to Focus', 'Flou vers netteté', 'blur_focus', '{"blur_radius": 10, "focus_point": "center"}', '["professional", "blur", "focus", "cinematic"]', true, 87),
('pro_slide_reveal', 'Slide Reveal', 'Révélation glissée', 'reveal', '{"direction": "up", "easing": "ease-out"}', '["professional", "reveal", "slide", "clean"]', false, 85),
('pro_zoom_blur', 'Zoom Blur', 'Flou de zoom', 'zoomblur', '{"amount": 0.3, "center": "center"}', '["professional", "zoom", "blur", "dramatic"]', true, 82),
('pro_color_burn', 'Color Burn', 'Brûlure couleur', 'colorburn', '{"intensity": 0.6, "blend": "multiply"}', '["professional", "color", "burn", "artistic"]', true, 78),
('pro_luma_key', 'Luma Key', 'Clé luminance', 'lumakey', '{"threshold": 0.5, "tolerance": 0.1}', '["professional", "luma", "key", "technical"]', true, 76)
ON CONFLICT (id) DO NOTHING;

-- Transitions Glitch (8)
INSERT INTO effects (id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES 
('glitch_digital', 'Digital Glitch', 'Glitch numérique pur', 'digital_glitch', '{"blocks": 16, "shift": 5, "duration": 0.3}', '["glitch", "digital", "tech", "futuristic"]', true, 90),
('glitch_datamosh', 'Datamosh', 'Effet datamosh compression', 'datamosh', '{"intensity": 0.8, "frames": 6}', '["glitch", "datamosh", "compression", "artistic"]', true, 86),
('glitch_rgb_split', 'RGB Split', 'Séparation RVB', 'rgb_split', '{"offset": 3, "duration": 0.2}', '["glitch", "rgb", "split", "colorful"]', true, 88),
('glitch_freeze', 'Frame Freeze', 'Figé image avec glitch', 'freeze_glitch', '{"freeze_frames": 3, "glitch_intensity": 0.6}', '["glitch", "freeze", "frame", "interrupted"]', true, 84),
('glitch_pixel_sort', 'Pixel Sort', 'Tri pixels aléatoire', 'pixel_sort', '{"direction": "vertical", "randomness": 0.7}', '["glitch", "pixel", "sort", "algorithmic"]', true, 82),
('glitch_noise', 'Static Noise', 'Bruit statique TV', 'static', '{"intensity": 0.4, "frequency": "high"}', '["glitch", "static", "noise", "retro"]', false, 79),
('glitch_chaos', 'Chaos Mode', 'Glitch chaotique multiple', 'chaos_glitch', '{"effects": ["rgb", "pixel", "noise"], "random": true}', '["glitch", "chaos", "multiple", "intense"]', true, 91),
('glitch_matrix', 'Matrix Rain', 'Pluie matrix style', 'matrix', '{"density": 0.8, "color": "#00FF00", "duration": 0.4}', '["glitch", "matrix", "rain", "hacker"]', true, 85)
ON CONFLICT (id) DO NOTHING;

-- Transitions Nature (5)
INSERT INTO effects (id, name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES 
('nature_leaf_fall', 'Leaf Fall', 'Chute de feuilles automnales', 'particles', '{"type": "leaves", "count": 20, "duration": 1.0}', '["nature", "leaves", "fall", "autumn"]', true, 77),
('nature_water_ripple', 'Water Ripple', 'Ondulations eau calme', 'water_ripple', '{"amplitude": 0.2, "frequency": 3, "duration": 0.6}', '["nature", "water", "ripple", "calm"]', false, 74),
('nature_cloud_move', 'Cloud Movement', 'Mouvement nuages doux', 'cloud', '{"speed": 0.3, "density": 0.6, "duration": 0.8}', '["nature", "clouds", "sky", "dreamy"]', false, 72),
('nature_sunset_glow', 'Sunset Glow', 'Lueur coucher soleil', 'sunset', '{"colors": ["#FF6B6B", "#FFA500", "#FFD700"], "duration": 0.5}', '["nature", "sunset", "glow", "warm"]', false, 80),
('nature_rain_drop', 'Rain Drop', 'Gouttes de pluie', 'rain', '{"intensity": 0.4, "drop_size": 2, "duration": 0.4}', '["nature", "rain", "drops", "fresh"]', false, 76)
ON CONFLICT (id) DO NOTHING;

-- Mettre à jour les scores de popularité globaux
UPDATE effects SET popularity_score = popularity_score + 5 WHERE category LIKE '%tiktok%';
UPDATE effects SET popularity_score = popularity_score + 3 WHERE category LIKE '%creative%';
UPDATE effects SET popularity_score = popularity_score + 2 WHERE is_premium = true;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_effects_category_popularity ON effects(category, popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_effects_tags_search ON effects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_effects_premium_popularity ON effects(is_premium, popularity_score DESC);

COMMENT ON TABLE effects IS 'Bibliothèque complète de 50+ transitions tendance pour rivaliser avec TikTok/Canva';
COMMENT ON COLUMN effects.popularity_score IS 'Score de popularité (0-100) pour le tri automatique';
