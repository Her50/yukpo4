/**
 * Service de gestion des effets et filtres vidéo
 * Supporte filtres en temps réel et effets post-traitement
 */


export type VideoFilter =
    | 'none'
    | 'vintage'
    | 'blackwhite'
    | 'sepia'
    | 'warm'
    | 'cool'
    | 'dramatic'
    | 'cinematic'
    | 'vibrant'
    | 'soft'
    // ✅ NOUVEAU: 40+ filtres supplémentaires
    | 'retro'
    | 'neon'
    | 'pastel'
    | 'monochrome'
    | 'highcontrast'
    | 'lowlight'
    | 'sunset'
    | 'ocean'
    | 'forest'
    | 'urban'
    | 'portrait'
    | 'landscape'
    | 'night'
    | 'daylight'
    | 'golden'
    | 'silver'
    | 'copper'
    | 'platinum'
    | 'rainbow'
    | 'neonpink'
    | 'neonblue'
    | 'neongreen'
    | 'neonyellow'
    | 'vintage70s'
    | 'vintage80s'
    | 'vintage90s'
    | 'filmnoir'
    | 'horror'
    | 'sci-fi'
    | 'fantasy'
    | 'romantic'
    | 'energetic'
    | 'calm'
    | 'mysterious'
    | 'elegant'
    | 'playful'
    | 'serious'
    | 'artistic'
    | 'minimalist'
    | 'maximalist'
    | 'glitch'
    | 'vaporwave'
    | 'cyberpunk';

export type VideoEffect =
    | 'none'
    | 'slowmo'
    | 'fastmo'
    | 'reverse'
    | 'loop'
    | 'zoom'
    | 'pan'
    | 'fade';

export interface VideoEffectConfig {
    filter: VideoFilter;
    effect: VideoEffect;
    intensity?: number; // 0-100
    stickers?: StickerConfig[];
}

export interface StickerConfig {
    id: string;
    type: 'emoji' | 'image' | 'animated';
    url?: string;
    emoji?: string;
    position: { x: number; y: number };
    size: number;
    rotation?: number;
    startTime: number; // en secondes
    duration: number; // en secondes
}

class VideoEffectsService {
    private static instance: VideoEffectsService;
    private availableFilters: VideoFilter[] = [
        'none',
        'vintage',
        'blackwhite',
        'sepia',
        'warm',
        'cool',
        'dramatic',
        'cinematic',
        'vibrant',
        'soft',
        // ✅ NOUVEAU: 40+ filtres supplémentaires
        'retro',
        'neon',
        'pastel',
        'monochrome',
        'highcontrast',
        'lowlight',
        'sunset',
        'ocean',
        'forest',
        'urban',
        'portrait',
        'landscape',
        'night',
        'daylight',
        'golden',
        'silver',
        'copper',
        'platinum',
        'rainbow',
        'neonpink',
        'neonblue',
        'neongreen',
        'neonyellow',
        'vintage70s',
        'vintage80s',
        'vintage90s',
        'filmnoir',
        'horror',
        'sci-fi',
        'fantasy',
        'romantic',
        'energetic',
        'calm',
        'mysterious',
        'elegant',
        'playful',
        'serious',
        'artistic',
        'minimalist',
        'maximalist',
        'glitch',
        'vaporwave',
        'cyberpunk',
    ];

    private availableEffects: VideoEffect[] = [
        'none',
        'slowmo',
        'fastmo',
        'reverse',
        'loop',
        'zoom',
        'pan',
        'fade',
    ];

    /**
     * Obtenir la liste des filtres disponibles
     */
    getAvailableFilters(): VideoFilter[] {
        return this.availableFilters;
    }

    /**
     * Obtenir la liste des effets disponibles
     */
    getAvailableEffects(): VideoEffect[] {
        return this.availableEffects;
    }

    /**
     * Appliquer un filtre à une vidéo
     * Note: Pour l'instant, retourne la config. L'application réelle nécessite un processeur vidéo
     */
    applyFilter(videoUrl: string, filter: VideoFilter, intensity: number = 100): VideoEffectConfig {
        return {
            filter,
            effect: 'none',
            intensity: Math.max(0, Math.min(100, intensity)),
        };
    }

    /**
     * Appliquer un effet à une vidéo
     */
    applyEffect(videoUrl: string, effect: VideoEffect): VideoEffectConfig {
        return {
            filter: 'none',
            effect,
        };
    }

    /**
     * Obtenir la configuration CSS/Shader pour un filtre
     * Utilisé pour appliquer des filtres visuels en temps réel
     */
    getFilterStyle(filter: VideoFilter, intensity: number = 100): any {
        const normalizedIntensity = intensity / 100;

        switch (filter) {
            case 'vintage':
                return {
                    filter: `sepia(${normalizedIntensity * 100}%) contrast(${1 + normalizedIntensity * 0.2}) brightness(${1 - normalizedIntensity * 0.1})`,
                };
            case 'blackwhite':
                return {
                    filter: `grayscale(${normalizedIntensity * 100}%)`,
                };
            case 'sepia':
                return {
                    filter: `sepia(${normalizedIntensity * 100}%)`,
                };
            case 'warm':
                return {
                    filter: `sepia(${normalizedIntensity * 30}%) saturate(${1 + normalizedIntensity * 0.3}) brightness(${1 + normalizedIntensity * 0.1})`,
                };
            case 'cool':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 180}deg) saturate(${1 - normalizedIntensity * 0.2})`,
                };
            case 'dramatic':
                return {
                    filter: `contrast(${1 + normalizedIntensity * 0.5}) brightness(${1 - normalizedIntensity * 0.2}) saturate(${1 + normalizedIntensity * 0.3})`,
                };
            case 'cinematic':
                return {
                    filter: `contrast(${1 + normalizedIntensity * 0.3}) brightness(${1 - normalizedIntensity * 0.15}) saturate(${1 - normalizedIntensity * 0.1})`,
                };
            case 'vibrant':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.5}) contrast(${1 + normalizedIntensity * 0.2})`,
                };
            case 'soft':
                return {
                    filter: `blur(${normalizedIntensity * 2}px) brightness(${1 + normalizedIntensity * 0.1})`,
                };
            // ✅ NOUVEAU: 40+ filtres supplémentaires
            case 'retro':
                return {
                    filter: `sepia(${normalizedIntensity * 60}%) contrast(${1 + normalizedIntensity * 0.3}) brightness(${1 - normalizedIntensity * 0.2}) saturate(${1 - normalizedIntensity * 0.2})`,
                };
            case 'neon':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 1.5}) contrast(${1 + normalizedIntensity * 0.8}) brightness(${1 + normalizedIntensity * 0.3})`,
                };
            case 'pastel':
                return {
                    filter: `saturate(${1 - normalizedIntensity * 0.4}) brightness(${1 + normalizedIntensity * 0.2}) contrast(${1 - normalizedIntensity * 0.2})`,
                };
            case 'monochrome':
                return {
                    filter: `grayscale(${normalizedIntensity * 100}%) contrast(${1 + normalizedIntensity * 0.2})`,
                };
            case 'highcontrast':
                return {
                    filter: `contrast(${1 + normalizedIntensity * 1.0}) brightness(${1 - normalizedIntensity * 0.1})`,
                };
            case 'lowlight':
                return {
                    filter: `brightness(${1 - normalizedIntensity * 0.4}) contrast(${1 + normalizedIntensity * 0.3})`,
                };
            case 'sunset':
                return {
                    filter: `sepia(${normalizedIntensity * 40}%) saturate(${1 + normalizedIntensity * 0.5}) brightness(${1 + normalizedIntensity * 0.15}) hue-rotate(${normalizedIntensity * -15}deg)`,
                };
            case 'ocean':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 200}deg) saturate(${1 + normalizedIntensity * 0.3}) brightness(${1 - normalizedIntensity * 0.1})`,
                };
            case 'forest':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 120}deg) saturate(${1 + normalizedIntensity * 0.4}) contrast(${1 + normalizedIntensity * 0.2})`,
                };
            case 'urban':
                return {
                    filter: `grayscale(${normalizedIntensity * 30}%) contrast(${1 + normalizedIntensity * 0.4}) brightness(${1 - normalizedIntensity * 0.1})`,
                };
            case 'portrait':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.2}) contrast(${1 + normalizedIntensity * 0.15}) brightness(${1 + normalizedIntensity * 0.05})`,
                };
            case 'landscape':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.3}) contrast(${1 + normalizedIntensity * 0.2}) brightness(${1 + normalizedIntensity * 0.1})`,
                };
            case 'night':
                return {
                    filter: `brightness(${1 - normalizedIntensity * 0.5}) contrast(${1 + normalizedIntensity * 0.4}) saturate(${1 - normalizedIntensity * 0.2})`,
                };
            case 'daylight':
                return {
                    filter: `brightness(${1 + normalizedIntensity * 0.2}) contrast(${1 + normalizedIntensity * 0.1}) saturate(${1 + normalizedIntensity * 0.1})`,
                };
            case 'golden':
                return {
                    filter: `sepia(${normalizedIntensity * 50}%) saturate(${1 + normalizedIntensity * 0.3}) brightness(${1 + normalizedIntensity * 0.15}) hue-rotate(${normalizedIntensity * -10}deg)`,
                };
            case 'silver':
                return {
                    filter: `grayscale(${normalizedIntensity * 80}%) contrast(${1 + normalizedIntensity * 0.3}) brightness(${1 + normalizedIntensity * 0.1})`,
                };
            case 'copper':
                return {
                    filter: `sepia(${normalizedIntensity * 70}%) saturate(${1 + normalizedIntensity * 0.4}) brightness(${1 + normalizedIntensity * 0.1}) hue-rotate(${normalizedIntensity * 15}deg)`,
                };
            case 'platinum':
                return {
                    filter: `grayscale(${normalizedIntensity * 60}%) contrast(${1 + normalizedIntensity * 0.4}) brightness(${1 + normalizedIntensity * 0.15})`,
                };
            case 'rainbow':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 360}deg) saturate(${1 + normalizedIntensity * 0.5})`,
                };
            case 'neonpink':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 320}deg) saturate(${1 + normalizedIntensity * 1.2}) brightness(${1 + normalizedIntensity * 0.3})`,
                };
            case 'neonblue':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 200}deg) saturate(${1 + normalizedIntensity * 1.2}) brightness(${1 + normalizedIntensity * 0.3})`,
                };
            case 'neongreen':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 120}deg) saturate(${1 + normalizedIntensity * 1.2}) brightness(${1 + normalizedIntensity * 0.3})`,
                };
            case 'neonyellow':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 60}deg) saturate(${1 + normalizedIntensity * 1.2}) brightness(${1 + normalizedIntensity * 0.3})`,
                };
            case 'vintage70s':
                return {
                    filter: `sepia(${normalizedIntensity * 50}%) saturate(${1 + normalizedIntensity * 0.6}) contrast(${1 + normalizedIntensity * 0.3}) brightness(${1 - normalizedIntensity * 0.1}) hue-rotate(${normalizedIntensity * -20}deg)`,
                };
            case 'vintage80s':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.8}) contrast(${1 + normalizedIntensity * 0.4}) brightness(${1 + normalizedIntensity * 0.1}) hue-rotate(${normalizedIntensity * 10}deg)`,
                };
            case 'vintage90s':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.5}) contrast(${1 + normalizedIntensity * 0.2}) brightness(${1 - normalizedIntensity * 0.15})`,
                };
            case 'filmnoir':
                return {
                    filter: `grayscale(${normalizedIntensity * 100}%) contrast(${1 + normalizedIntensity * 0.6}) brightness(${1 - normalizedIntensity * 0.3})`,
                };
            case 'horror':
                return {
                    filter: `grayscale(${normalizedIntensity * 40}%) contrast(${1 + normalizedIntensity * 0.5}) brightness(${1 - normalizedIntensity * 0.4}) saturate(${1 - normalizedIntensity * 0.3})`,
                };
            case 'sci-fi':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 180}deg) saturate(${1 + normalizedIntensity * 0.4}) contrast(${1 + normalizedIntensity * 0.3}) brightness(${1 - normalizedIntensity * 0.1})`,
                };
            case 'fantasy':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.6}) contrast(${1 + normalizedIntensity * 0.2}) brightness(${1 + normalizedIntensity * 0.15}) hue-rotate(${normalizedIntensity * -5}deg)`,
                };
            case 'romantic':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.3}) brightness(${1 + normalizedIntensity * 0.2}) contrast(${1 - normalizedIntensity * 0.1}) sepia(${normalizedIntensity * 20}%)`,
                };
            case 'energetic':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.7}) contrast(${1 + normalizedIntensity * 0.4}) brightness(${1 + normalizedIntensity * 0.2})`,
                };
            case 'calm':
                return {
                    filter: `saturate(${1 - normalizedIntensity * 0.3}) brightness(${1 + normalizedIntensity * 0.1}) contrast(${1 - normalizedIntensity * 0.2})`,
                };
            case 'mysterious':
                return {
                    filter: `brightness(${1 - normalizedIntensity * 0.3}) contrast(${1 + normalizedIntensity * 0.3}) saturate(${1 - normalizedIntensity * 0.2})`,
                };
            case 'elegant':
                return {
                    filter: `grayscale(${normalizedIntensity * 20}%) contrast(${1 + normalizedIntensity * 0.2}) brightness(${1 + normalizedIntensity * 0.1}) saturate(${1 - normalizedIntensity * 0.1})`,
                };
            case 'playful':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.5}) brightness(${1 + normalizedIntensity * 0.15}) contrast(${1 + normalizedIntensity * 0.15})`,
                };
            case 'serious':
                return {
                    filter: `grayscale(${normalizedIntensity * 30}%) contrast(${1 + normalizedIntensity * 0.3}) brightness(${1 - normalizedIntensity * 0.1})`,
                };
            case 'artistic':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.4}) contrast(${1 + normalizedIntensity * 0.25}) brightness(${1 + normalizedIntensity * 0.1}) sepia(${normalizedIntensity * 15}%)`,
                };
            case 'minimalist':
                return {
                    filter: `grayscale(${normalizedIntensity * 50}%) contrast(${1 - normalizedIntensity * 0.2}) brightness(${1 + normalizedIntensity * 0.1}) saturate(${1 - normalizedIntensity * 0.3})`,
                };
            case 'maximalist':
                return {
                    filter: `saturate(${1 + normalizedIntensity * 0.8}) contrast(${1 + normalizedIntensity * 0.5}) brightness(${1 + normalizedIntensity * 0.2})`,
                };
            case 'glitch':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 90}deg) saturate(${1 + normalizedIntensity * 0.5}) contrast(${1 + normalizedIntensity * 0.4}) brightness(${1 + normalizedIntensity * 0.1})`,
                };
            case 'vaporwave':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 280}deg) saturate(${1 + normalizedIntensity * 0.6}) brightness(${1 + normalizedIntensity * 0.2}) contrast(${1 + normalizedIntensity * 0.2})`,
                };
            case 'cyberpunk':
                return {
                    filter: `hue-rotate(${normalizedIntensity * 200}deg) saturate(${1 + normalizedIntensity * 0.9}) contrast(${1 + normalizedIntensity * 0.5}) brightness(${1 - normalizedIntensity * 0.1})`,
                };
            case 'none':
            default:
                return {};
        }
    }

    /**
     * Obtenir la description d'un filtre
     */
    getFilterDescription(filter: VideoFilter): string {
        const descriptions: Record<VideoFilter, string> = {
            none: 'Aucun filtre',
            vintage: 'Effet vintage rétro',
            blackwhite: 'Noir et blanc classique',
            sepia: 'Sépia nostalgique',
            warm: 'Ton chaud et doux',
            cool: 'Ton froid et moderne',
            dramatic: 'Contraste dramatique',
            cinematic: 'Style cinématographique',
            vibrant: 'Couleurs vibrantes',
            soft: 'Flou doux',
            // ✅ NOUVEAU: Descriptions pour 40+ filtres supplémentaires
            retro: 'Style rétro années 60-70',
            neon: 'Effet néon vibrant',
            pastel: 'Couleurs pastel douces',
            monochrome: 'Monochrome élégant',
            highcontrast: 'Contraste élevé',
            lowlight: 'Ambiance faible lumière',
            sunset: 'Couleurs coucher de soleil',
            ocean: 'Teinte océan bleu',
            forest: 'Teinte forêt verte',
            urban: 'Style urbain moderne',
            portrait: 'Optimisé portrait',
            landscape: 'Optimisé paysage',
            night: 'Ambiance nocturne',
            daylight: 'Lumière du jour',
            golden: 'Teinte dorée',
            silver: 'Teinte argentée',
            copper: 'Teinte cuivrée',
            platinum: 'Teinte platine',
            rainbow: 'Arc-en-ciel coloré',
            neonpink: 'Néon rose',
            neonblue: 'Néon bleu',
            neongreen: 'Néon vert',
            neonyellow: 'Néon jaune',
            vintage70s: 'Vintage années 70',
            vintage80s: 'Vintage années 80',
            vintage90s: 'Vintage années 90',
            filmnoir: 'Film noir classique',
            horror: 'Ambiance horreur',
            'sci-fi': 'Science-fiction futuriste',
            fantasy: 'Fantaisie magique',
            romantic: 'Romantique doux',
            energetic: 'Énergique dynamique',
            calm: 'Calme apaisant',
            mysterious: 'Mystérieux sombre',
            elegant: 'Élégant raffiné',
            playful: 'Joueur amusant',
            serious: 'Sérieux professionnel',
            artistic: 'Artistique créatif',
            minimalist: 'Minimaliste épuré',
            maximalist: 'Maximaliste coloré',
            glitch: 'Glitch numérique',
            vaporwave: 'Vaporwave rétro-futuriste',
            cyberpunk: 'Cyberpunk néon',
        };
        return descriptions[filter] || 'Filtre inconnu';
    }

    /**
     * Obtenir la description d'un effet
     */
    getEffectDescription(effect: VideoEffect): string {
        const descriptions: Record<VideoEffect, string> = {
            none: 'Aucun effet',
            slowmo: 'Ralenti',
            fastmo: 'Accéléré',
            reverse: 'Inversé',
            loop: 'Boucle',
            zoom: 'Zoom',
            pan: 'Panoramique',
            fade: 'Fondu',
        };
        return descriptions[effect] || 'Effet inconnu';
    }

    /**
     * Créer une configuration d'effet complète
     */
    createEffectConfig(
        filter: VideoFilter = 'none',
        effect: VideoEffect = 'none',
        intensity: number = 100,
        stickers: StickerConfig[] = []
    ): VideoEffectConfig {
        return {
            filter,
            effect,
            intensity,
            stickers,
        };
    }
}

export const videoEffectsService = new VideoEffectsService();

