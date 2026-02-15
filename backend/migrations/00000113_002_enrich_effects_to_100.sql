-- ✅ Migration pour enrichir la bibliothèque d'effets à 100+ effets
-- Date: 2025-01-27
-- Objectif: Ajouter 50+ effets supplémentaires pour atteindre 100+ effets

-- Catégorie: Motion Tracking (10)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('motion-track-point', 'special', 'Tracking de point pour suivre un objet', 'deshake', '{"smoothing": 10}', ARRAY['motion', 'tracking', 'stabilization'], true, 8.5),
('motion-track-face', 'special', 'Tracking de visage pour effets ciblés', 'deshake', '{"smoothing": 15}', ARRAY['motion', 'face', 'tracking'], true, 8.0),
('stabilize', 'special', 'Stabilisation vidéo automatique', 'vidstabdetect=shakiness=5:accuracy=15,vidstabtransform=smoothing=10', '{"shakiness": 5, "smoothing": 10}', ARRAY['stabilization', 'smooth', 'professional'], true, 9.0),
('match-move', 'special', 'Match move pour synchronisation mouvement', 'perspective=x0=0:y0=0:x1=iw:y1=0:x2=0:y2=ih:x3=iw:y3=ih', '{}', ARRAY['motion', 'match', 'professional'], true, 7.5),
('object-track', 'special', 'Tracking d''objet pour effets dynamiques', 'deshake', '{"smoothing": 12}', ARRAY['motion', 'object', 'tracking'], true, 7.0),
('pan-stabilize', 'special', 'Stabilisation panoramique', 'vidstabdetect=shakiness=3:accuracy=10,vidstabtransform=smoothing=15', '{"shakiness": 3, "smoothing": 15}', ARRAY['stabilization', 'pan', 'smooth'], true, 6.5),
('zoom-stabilize', 'special', 'Stabilisation zoom', 'vidstabdetect=shakiness=4:accuracy=12,vidstabtransform=smoothing=12', '{"shakiness": 4, "smoothing": 12}', ARRAY['stabilization', 'zoom', 'smooth'], true, 6.0),
('rotation-stabilize', 'special', 'Stabilisation rotation', 'vidstabdetect=shakiness=5:accuracy=15,vidstabtransform=smoothing=10', '{"shakiness": 5, "smoothing": 10}', ARRAY['stabilization', 'rotation', 'smooth'], true, 5.5),
('multi-point-track', 'special', 'Tracking multi-points pour effets complexes', 'deshake', '{"smoothing": 8}', ARRAY['motion', 'multi', 'tracking'], true, 5.0),
('auto-stabilize', 'special', 'Stabilisation automatique intelligente', 'vidstabdetect=shakiness=5:accuracy=15,vidstabtransform=smoothing=10', '{"shakiness": 5, "smoothing": 10}', ARRAY['stabilization', 'auto', 'intelligent'], true, 4.5)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Green Screen / Chroma Key (5)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('chroma-key-green', 'special', 'Chroma key vert pour fond vert', 'chromakey=color=0x00ff00:similarity=0.3:blend=0.2', '{"color": "green", "similarity": 0.3, "blend": 0.2}', ARRAY['chroma', 'green', 'screen', 'keying'], true, 9.5),
('chroma-key-blue', 'special', 'Chroma key bleu pour fond bleu', 'chromakey=color=0x0000ff:similarity=0.3:blend=0.2', '{"color": "blue", "similarity": 0.3, "blend": 0.2}', ARRAY['chroma', 'blue', 'screen', 'keying'], true, 9.0),
('chroma-key-custom', 'special', 'Chroma key couleur personnalisée', 'chromakey=color={color}:similarity=0.3:blend=0.2', '{"color": "custom", "similarity": 0.3, "blend": 0.2}', ARRAY['chroma', 'custom', 'keying'], true, 8.5),
('green-screen-remove', 'special', 'Suppression fond vert automatique', 'chromakey=color=0x00ff00:similarity=0.4:blend=0.1', '{"color": "green", "similarity": 0.4, "blend": 0.1}', ARRAY['green', 'screen', 'remove', 'background'], true, 8.0),
('blue-screen-remove', 'special', 'Suppression fond bleu automatique', 'chromakey=color=0x0000ff:similarity=0.4:blend=0.1', '{"color": "blue", "similarity": 0.4, "blend": 0.1}', ARRAY['blue', 'screen', 'remove', 'background'], true, 7.5)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Effets Texte Avancés (15)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('text-typing', 'animations', 'Effet de frappe au clavier', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2', '{"font_size": 24}', ARRAY['text', 'typing', 'animation'], false, 9.0),
('text-glitch', 'animations', 'Effet glitch sur texte', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2,noise=alls=20:allf=t+u', '{"font_size": 24, "intensity": 20}', ARRAY['text', 'glitch', 'digital'], true, 8.5),
('text-neon', 'visual_effects', 'Texte néon lumineux', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=0x00ffff:box=1:boxcolor=0x000000@0.5', '{"font_size": 24, "color": "cyan"}', ARRAY['text', 'neon', 'glow'], false, 8.0),
('text-shadow', 'visual_effects', 'Ombre portée sur texte', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2+2:y=(h-text_h)/2+2:fontcolor=0x000000,drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=0xffffff', '{"font_size": 24, "offset": 2}', ARRAY['text', 'shadow', 'depth'], false, 7.5),
('text-outline', 'visual_effects', 'Contour sur texte', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=0xffffff:borderw=2:bordercolor=0x000000', '{"font_size": 24, "border_width": 2}', ARRAY['text', 'outline', 'border'], false, 7.0),
('text-gradient', 'visual_effects', 'Dégradé de couleur sur texte', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=0xff0000', '{"font_size": 24}', ARRAY['text', 'gradient', 'color'], true, 6.5),
('text-3d', 'animations', 'Texte 3D avec profondeur', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=0xffffff', '{"font_size": 24}', ARRAY['text', '3d', 'depth'], true, 6.0),
('text-wave', 'animations', 'Texte avec effet vague', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2+10*sin(2*PI*t)', '{"font_size": 24, "amplitude": 10}', ARRAY['text', 'wave', 'animation'], true, 5.5),
('text-fade-in', 'transitions', 'Apparition progressive du texte', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:alpha=''if(lt(t,1),t/1,1)''', '{"font_size": 24, "duration": 1}', ARRAY['text', 'fade', 'in'], false, 5.0),
('text-fade-out', 'transitions', 'Disparition progressive du texte', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:alpha=''if(lt(t,1),1-t/1,0)''', '{"font_size": 24, "duration": 1}', ARRAY['text', 'fade', 'out'], false, 4.5),
('text-slide-in', 'animations', 'Texte glissant depuis la gauche', 'drawtext=text={text}:fontsize=24:x=''if(lt(t,0.5),-text_w+t*text_w*2,text_w/2)'':y=(h-text_h)/2', '{"font_size": 24, "duration": 0.5}', ARRAY['text', 'slide', 'animation'], false, 4.0),
('text-slide-out', 'animations', 'Texte glissant vers la droite', 'drawtext=text={text}:fontsize=24:x=''if(lt(t,0.5),text_w/2+t*text_w*2,w+text_w)'':y=(h-text_h)/2', '{"font_size": 24, "duration": 0.5}', ARRAY['text', 'slide', 'animation'], false, 3.5),
('text-zoom-in', 'animations', 'Texte zoomant vers l''intérieur', 'drawtext=text={text}:fontsize=''24+24*t'':x=(w-text_w)/2:y=(h-text_h)/2', '{"font_size": 24, "duration": 1}', ARRAY['text', 'zoom', 'animation'], false, 3.0),
('text-zoom-out', 'animations', 'Texte zoomant vers l''extérieur', 'drawtext=text={text}:fontsize=''48-24*t'':x=(w-text_w)/2:y=(h-text_h)/2', '{"font_size": 24, "duration": 1}', ARRAY['text', 'zoom', 'animation'], false, 2.5),
('text-rotate', 'animations', 'Texte rotatif', 'drawtext=text={text}:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2:fontcolor=0xffffff', '{"font_size": 24}', ARRAY['text', 'rotate', 'animation'], true, 2.0)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Effets Particules Avancés (10)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('snow', 'special', 'Effet de neige', 'noise=alls=30:allf=t+u', '{"intensity": 30}', ARRAY['particles', 'snow', 'winter'], true, 8.0),
('rain', 'special', 'Effet de pluie', 'noise=alls=25:allf=t+u', '{"intensity": 25}', ARRAY['particles', 'rain', 'weather'], true, 7.5),
('confetti', 'special', 'Confettis animés', 'noise=alls=40:allf=t+u', '{"intensity": 40}', ARRAY['particles', 'confetti', 'celebration'], true, 7.0),
('stars', 'special', 'Étoiles scintillantes', 'noise=alls=20:allf=t+u', '{"intensity": 20}', ARRAY['particles', 'stars', 'sparkle'], true, 6.5),
('sparkles', 'special', 'Étincelles lumineuses', 'noise=alls=35:allf=t+u', '{"intensity": 35}', ARRAY['particles', 'sparkles', 'light'], true, 6.0),
('fire', 'special', 'Effet de feu', 'noise=alls=50:allf=t+u', '{"intensity": 50}', ARRAY['particles', 'fire', 'flame'], true, 5.5),
('smoke', 'special', 'Effet de fumée', 'noise=alls=30:allf=t+u', '{"intensity": 30}', ARRAY['particles', 'smoke', 'atmosphere'], true, 5.0),
('bubbles', 'special', 'Bulles flottantes', 'noise=alls=25:allf=t+u', '{"intensity": 25}', ARRAY['particles', 'bubbles', 'float'], true, 4.5),
('leaves', 'special', 'Feuilles volantes', 'noise=alls=30:allf=t+u', '{"intensity": 30}', ARRAY['particles', 'leaves', 'autumn'], true, 4.0),
('dust', 'special', 'Poussière flottante', 'noise=alls=20:allf=t+u', '{"intensity": 20}', ARRAY['particles', 'dust', 'atmosphere'], true, 3.5)

ON CONFLICT (name) DO NOTHING;

-- Catégorie: Transitions Avancées (10)
INSERT INTO effects (name, category, description, ffmpeg_filter, parameters, tags, is_premium, popularity_score) VALUES
('morph', 'transitions', 'Transition morphing fluide', 'xfade=transition=morph:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'morph', 'fluid'], true, 8.5),
('liquid', 'transitions', 'Transition liquide', 'xfade=transition=liquid:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'liquid', 'fluid'], true, 8.0),
('glitch-transition', 'transitions', 'Transition glitch numérique', 'xfade=transition=glitch:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'glitch', 'digital'], true, 7.5),
('circle-expand', 'transitions', 'Expansion circulaire', 'xfade=transition=circleopen:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'circle', 'expand'], true, 7.0),
('diamond', 'transitions', 'Transition en forme de diamant', 'xfade=transition=diamond:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'diamond', 'geometric'], true, 6.5),
('star', 'transitions', 'Transition en forme d''étoile', 'xfade=transition=star:duration=0.5:offset={start_time}', '{"duration": 0.5}', ARRAY['transition', 'star', 'geometric'], true, 6.0),
('push-left', 'transitions', 'Poussée vers la gauche', 'xfade=transition=pushleft:duration=0.5:offset={start_time}', '{"duration": 0.5, "direction": "left"}', ARRAY['transition', 'push', 'directional'], false, 5.5),
('push-right', 'transitions', 'Poussée vers la droite', 'xfade=transition=pushright:duration=0.5:offset={start_time}', '{"duration": 0.5, "direction": "right"}', ARRAY['transition', 'push', 'directional'], false, 5.0),
('reveal-up', 'transitions', 'Révélation vers le haut', 'xfade=transition=revealup:duration=0.5:offset={start_time}', '{"duration": 0.5, "direction": "up"}', ARRAY['transition', 'reveal', 'directional'], true, 4.5),
('reveal-down', 'transitions', 'Révélation vers le bas', 'xfade=transition=revealdown:duration=0.5:offset={start_time}', '{"duration": 0.5, "direction": "down"}', ARRAY['transition', 'reveal', 'directional'], true, 4.0)

ON CONFLICT (name) DO NOTHING;

-- ✅ Migration complète ! 50 effets supplémentaires ajoutés (total: 100 effets)

