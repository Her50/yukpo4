-- ✅ Script SQL pour appliquer la migration effects sur la base Render
-- Base: yukpo_db sur dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com
-- Usage: psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db" -f APPLY_EFFECTS_MIGRATION_RENDER.sql

-- ✅ NOUVEAU 2025-01-27: Table pour bibliothèque d'effets vidéo étendue (50+)

CREATE TABLE IF NOT EXISTS effects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('transitions', 'visual_effects', 'animations', 'special')),
    description TEXT NOT NULL,
    ffmpeg_filter TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_effects_category ON effects(category);
CREATE INDEX IF NOT EXISTS idx_effects_tags ON effects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_effects_popularity ON effects(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_effects_name ON effects(name);

-- Index composite pour recherche par catégorie et popularité
CREATE INDEX IF NOT EXISTS idx_effects_category_popularity ON effects(category, popularity_score DESC);

-- Trigger pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_effects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_effects_updated_at ON effects;
CREATE TRIGGER trigger_update_effects_updated_at
    BEFORE UPDATE ON effects
    FOR EACH ROW
    EXECUTE FUNCTION update_effects_updated_at();

-- Insertion des 50+ effets initiaux
-- Catégorie: Transitions (15)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('fade', 'transitions', 'Fondu en entrée et sortie pour transition douce', 'fade=t=in:st=0:d=0.5,fade=t=out:st={end_time}-0.5:d=0.5', '{"duration": 0.5}', ARRAY['transition', 'fade', 'smooth'], false, 10.0),
('slide', 'transitions', 'Glissement horizontal entre scènes', 'xfade=transition=slideleft:duration=0.5:offset={start_time}', '{"duration": 0.5, "direction": "left"}', ARRAY['transition', 'slide', 'horizontal'], false, 9.5),
('zoom', 'transitions', 'Zoom progressif pour transition dynamique', 'zoompan=z=''if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))'':d=75', '{"zoom_amount": 1.5}', ARRAY['transition', 'zoom', 'dynamic'], false, 9.0),
('cube', 'transitions', 'Transition 3D en forme de cube', 'xfade=transition=cubelr:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', '3d', 'cube'], true, 8.5),
('wipe', 'transitions', 'Effacement progressif d''une scène à l''autre', 'xfade=transition=wiperight:duration=0.5:offset={start_time}', '{"duration": 0.5, "direction": "right"}', ARRAY['transition', 'wipe', 'clean'], false, 8.0),
('dissolve', 'transitions', 'Fondu croisé entre deux scènes', 'xfade=transition=dissolve:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'dissolve', 'crossfade'], false, 7.5),
('split', 'transitions', 'Division et séparation de l''écran', 'xfade=transition=split:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'split', 'divided'], true, 7.0),
('iris', 'transitions', 'Ouverture/fermeture en forme d''iris', 'xfade=transition=iris:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'iris', 'circle'], true, 6.5),
('clock', 'transitions', 'Transition en forme d''aiguille d''horloge', 'xfade=transition=clock:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'clock', 'rotate'], true, 6.0),
('radial', 'transitions', 'Transition radiale depuis le centre', 'xfade=transition=radial:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'radial', 'center'], true, 5.5),
('linear', 'transitions', 'Transition linéaire simple', 'xfade=transition=linear:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'linear', 'simple'], false, 5.0),
('bounce', 'transitions', 'Transition avec effet rebond', 'xfade=transition=bounce:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'bounce', 'dynamic'], true, 4.5),
('elastic', 'transitions', 'Transition élastique animée', 'xfade=transition=elastic:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'elastic', 'animated'], true, 4.0),
('flip', 'transitions', 'Retournement de page 3D', 'xfade=transition=flip:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'flip', '3d'], true, 3.5),
('rotate', 'transitions', 'Rotation entre scènes', 'xfade=transition=rotate:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'rotate', '3d'], true, 3.0)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Effets Visuels (20)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('blur', 'visual_effects', 'Flou doux pour effet artistique', 'boxblur=2:1', '{"intensity": 2}', ARRAY['blur', 'soft', 'artistic'], false, 9.5),
('sharpen', 'visual_effects', 'Renforcement des détails pour netteté accrue', 'unsharp=5:5:1.0:5:5:0.0', '{"strength": 1.0}', ARRAY['sharpen', 'detail', 'crisp'], false, 9.0),
('glow', 'visual_effects', 'Effet lumineux avec saturation augmentée', 'curves=all=''0/0 0.5/0.58 1/1'',eq=brightness=0.15:saturation=0.2', '{"brightness": 0.15, "saturation": 0.2}', ARRAY['glow', 'bright', 'luminous'], false, 8.5),
('neon', 'visual_effects', 'Effet néon avec couleurs vives et contrastées', 'eq=brightness=0.2:contrast=1.5:saturation=2.0', '{"brightness": 0.2, "contrast": 1.5, "saturation": 2.0}', ARRAY['neon', 'vivid', 'contrast'], false, 8.0),
('vintage', 'visual_effects', 'Effet vintage avec couleurs désaturées', 'curves=all=''0/0 0.5/0.45 1/1'',eq=saturation=0.7:contrast=1.2', '{"saturation": 0.7, "contrast": 1.2}', ARRAY['vintage', 'retro', 'desaturated'], false, 7.5),
('blackwhite', 'visual_effects', 'Conversion noir et blanc élégante', 'hue=s=0', '{}', ARRAY['blackwhite', 'monochrome', 'classic'], false, 7.0),
('warm', 'visual_effects', 'Tons chauds pour ambiance accueillante', 'colorbalance=rs=0.3:gs=0:bs=-0.3', '{"red_shift": 0.3, "blue_shift": -0.3}', ARRAY['warm', 'tones', 'cozy'], false, 6.5),
('cool', 'visual_effects', 'Tons froids pour ambiance moderne', 'colorbalance=rs=-0.2:gs=0:bs=0.2', '{"red_shift": -0.2, "blue_shift": 0.2}', ARRAY['cool', 'tones', 'modern'], false, 6.0),
('sepia', 'visual_effects', 'Effet sépia rétro', 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131', '{}', ARRAY['sepia', 'retro', 'brown'], false, 5.5),
('contrast', 'visual_effects', 'Ajustement du contraste', 'eq=contrast=1.5', '{"contrast": 1.5}', ARRAY['contrast', 'adjustment', 'enhance'], false, 5.0),
('saturation', 'visual_effects', 'Ajustement de la saturation', 'eq=saturation=1.5', '{"saturation": 1.5}', ARRAY['saturation', 'color', 'vibrant'], false, 4.5),
('brightness', 'visual_effects', 'Ajustement de la luminosité', 'eq=brightness=0.2', '{"brightness": 0.2}', ARRAY['brightness', 'light', 'exposure'], false, 4.0),
('hue', 'visual_effects', 'Ajustement de la teinte', 'hue=h={hue_shift}', '{"hue_shift": 0}', ARRAY['hue', 'color', 'tint'], false, 3.5),
('invert', 'visual_effects', 'Inversion des couleurs', 'negate', '{}', ARRAY['invert', 'negative', 'psychedelic'], false, 3.0),
('posterize', 'visual_effects', 'Effet de postérisation', 'curves=preset=color_negative', '{}', ARRAY['posterize', 'artistic', 'stylized'], true, 2.5),
('emboss', 'visual_effects', 'Effet de relief', 'convolution=0 -3 0 -3 0 -3 0 3 0:0 -3 0 -3 0 -3 0 3 0:0 -3 0 -3 0 -3 0 3 0:0 -3 0 -3 0 -3 0 3 0', '{}', ARRAY['emboss', 'relief', '3d'], true, 2.0),
('edge', 'visual_effects', 'Détection de contours', 'edgedetect=low=0.1:high=0.4', '{"low": 0.1, "high": 0.4}', ARRAY['edge', 'detection', 'outline'], true, 1.5),
('mosaic', 'visual_effects', 'Effet de mosaïque/pixélisation', 'pixelize=w=10:h=10', '{"width": 10, "height": 10}', ARRAY['mosaic', 'pixel', 'censor'], true, 1.0),
('pixelate', 'visual_effects', 'Pixélisation stylisée', 'scale=iw/10:ih/10,scale=iw*10:ih*10:flags=neighbor', '{"pixel_size": 10}', ARRAY['pixelate', 'retro', '8bit'], true, 0.5),
('kaleidoscope', 'visual_effects', 'Effet kaléidoscope', 'split[s0][s1];[s0]hflip[s2];[s1][s2]blend=all_mode=addition', '{}', ARRAY['kaleidoscope', 'mirror', 'psychedelic'], true, 0.0)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Animations (10)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('zoom-in', 'animations', 'Zoom progressif vers l''intérieur', 'zoompan=z=''min(zoom+0.0015,1.5)'':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=75', '{"zoom_speed": 0.0015, "max_zoom": 1.5}', ARRAY['animation', 'zoom', 'inward'], false, 9.0),
('zoom-out', 'animations', 'Zoom progressif vers l''extérieur', 'zoompan=z=''max(zoom-0.0015,1.0)'':x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):d=75', '{"zoom_speed": 0.0015, "min_zoom": 1.0}', ARRAY['animation', 'zoom', 'outward'], false, 8.5),
('pan-left', 'animations', 'Déplacement panoramique vers la gauche', 'crop=iw-{offset}:ih:0:0', '{"offset": 10}', ARRAY['animation', 'pan', 'left'], false, 8.0),
('pan-right', 'animations', 'Déplacement panoramique vers la droite', 'crop=iw-{offset}:ih:{offset}:0', '{"offset": 10}', ARRAY['animation', 'pan', 'right'], false, 7.5),
('tilt-up', 'animations', 'Inclinaison vers le haut', 'perspective=x0=0:y0=0:x1=iw:y1=0:x2=0:y2=ih:x3=iw:y3=ih', '{}', ARRAY['animation', 'tilt', 'up'], true, 7.0),
('tilt-down', 'animations', 'Inclinaison vers le bas', 'perspective=x0=0:y0={offset}:x1=iw:y1={offset}:x2=0:y2=ih:x3=iw:y3=ih', '{"offset": 50}', ARRAY['animation', 'tilt', 'down'], true, 6.5),
('rotate-360', 'animations', 'Rotation complète à 360 degrés', 'rotate={angle}', '{"angle": "2*PI*t/3"}', ARRAY['animation', 'rotate', '360'], true, 6.0),
('bounce', 'animations', 'Effet de rebond', 'crop=iw:ih-{bounce}:0:{bounce}', '{"bounce": "20*sin(2*PI*t)"}', ARRAY['animation', 'bounce', 'elastic'], true, 5.5),
('shake', 'animations', 'Effet de tremblement', 'crop=iw-{shake}:ih:{shake}:0', '{"shake": "5*sin(20*PI*t)"}', ARRAY['animation', 'shake', 'vibration'], true, 5.0),
('pulse', 'animations', 'Effet de pulsation', 'scale=iw*{scale}:ih*{scale}', '{"scale": "1+0.1*sin(4*PI*t)"}', ARRAY['animation', 'pulse', 'breathing'], true, 4.5)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Effets Spéciaux (5)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('lens-flare', 'special', 'Reflet de lentille cinématique', 'lenscorrection=k1=-0.15:k2=-0.05,eq=brightness=0.1', '{"intensity": 0.15}', ARRAY['special', 'lens', 'cinematic'], true, 8.0),
('vignette', 'special', 'Vignettage sombre autour des bords', 'vignette=PI/4:mode=in', '{"angle": "PI/4"}', ARRAY['special', 'vignette', 'dark'], false, 7.5),
('grain', 'special', 'Ajout de grain cinématique', 'noise=alls=20:allf=t+u', '{"strength": 20}', ARRAY['special', 'grain', 'film'], true, 7.0),
('chromatic-aberration', 'special', 'Aberration chromatique stylisée', 'chromakey=color=0x00ff00:similarity=0.1:blend=0.1', '{"similarity": 0.1}', ARRAY['special', 'chromatic', 'glitch'], true, 6.5),
('glitch', 'special', 'Effet de glitch numérique', 'hue=H=2*PI*t,crop=iw-10:ih:5:0', '{"intensity": 10}', ARRAY['special', 'glitch', 'digital'], true, 6.0)

ON CONFLICT (name) DO NOTHING;

-- ✅ Migration complète ! Table effects créée avec 50+ effets.


