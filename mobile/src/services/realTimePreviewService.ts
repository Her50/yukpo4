// ✅ NOUVEAU: Service de preview temps réel pendant l'édition vidéo

import { TimelineScene, VideoTimeline } from '../components/TimelinePreview';

export interface EffectConfig {
    name: string;
    intensity?: number; // 0.0 à 1.0
    parameters?: Record<string, any>;
}

export interface TransitionConfig {
    type: 'fade' | 'slide' | 'zoom' | 'wipe' | 'dissolve' | 'none';
    duration?: number; // secondes
}

export interface RealtimePreviewParams {
    timeline: VideoTimeline;
    currentTime: number;
    effects?: EffectConfig[];
    transitions?: TransitionConfig[];
    playbackRate?: number;
}

export interface EffectShader {
    name: string;
    apply: (frame: ImageData, intensity: number, params?: Record<string, any>) => ImageData;
    webglShader?: string; // Pour extension WebGL future
}

/**
 * Service de preview temps réel qui applique les effets/transitions en temps réel
 * sur le device sans attendre un rendu backend
 */
export class RealTimePreviewService {
    private effectCache: Map<string, EffectShader> = new Map();
    private previewBuffer: Map<string, HTMLVideoElement | null> = new Map();

    constructor() {
        this.initializeEffects();
    }

    /**
     * Initialise les shaders d'effets disponibles
     */
    private initializeEffects(): void {
        // Effets de base - peuvent être étendus avec WebGL shaders
        const effects: EffectShader[] = [
            {
                name: 'zoom',
                apply: (frame, intensity) => frame, // Placeholder - sera implémenté avec transformation
            },
            {
                name: 'fade',
                apply: (frame, intensity) => frame,
            },
            {
                name: 'glow',
                apply: (frame, intensity) => frame,
            },
            {
                name: 'blur',
                apply: (frame, intensity) => frame,
            },
            {
                name: 'sharpen',
                apply: (frame, intensity) => frame,
            },
            {
                name: 'vintage',
                apply: (frame, intensity) => frame,
            },
            {
                name: 'neon',
                apply: (frame, intensity) => frame,
            },
            {
                name: 'blackwhite',
                apply: (frame, intensity) => frame,
            },
            {
                name: 'warm',
                apply: (frame, intensity) => frame,
            },
            {
                name: 'cool',
                apply: (frame, intensity) => frame,
            },
        ];

        effects.forEach(effect => {
            this.effectCache.set(effect.name, effect);
        });
    }

    /**
     * Obtient les paramètres d'effets pour une position dans la timeline
     * Retourne les paramètres sans la vidéo (pour calcul local)
     */
    getEffectParams(params: RealtimePreviewParams): {
        sceneIndex: number;
        scene: TimelineScene;
        activeEffects: EffectConfig[];
        transition: TransitionConfig | null;
        shouldApplyTransition: boolean;
    } {
        const { timeline, currentTime } = params;

        // Trouver la scène active
        let activeSceneIndex = 0;
        let activeScene = timeline.scenes[0];

        for (let i = 0; i < timeline.scenes.length; i++) {
            const scene = timeline.scenes[i];
            if (currentTime >= scene.start_time && currentTime < scene.start_time + scene.duration) {
                activeSceneIndex = i;
                activeScene = scene;
                break;
            }
        }

        // Effets actifs de la scène
        const activeEffects: EffectConfig[] = (activeScene.effects || [])
            .map(effectName => ({
                name: effectName,
                intensity: 1.0,
            }));

        // Transition entre scènes
        let transition: TransitionConfig | null = null;
        let shouldApplyTransition = false;

        if (activeScene.transition && activeScene.transition !== 'none') {
            const transitionDuration = 0.5; // Durée par défaut
            const sceneEndTime = activeScene.start_time + activeScene.duration;
            const transitionStartTime = sceneEndTime - transitionDuration;

            if (currentTime >= transitionStartTime) {
                transition = {
                    type: activeScene.transition as any,
                    duration: transitionDuration,
                };
                shouldApplyTransition = true;
            }
        }

        return {
            sceneIndex: activeSceneIndex,
            scene: activeScene,
            activeEffects,
            transition,
            shouldApplyTransition,
        };
    }

    /**
     * Prépare le preview pour scrubbing fluide
     * Cache les médias nécessaires pour performance
     */
    async preparePreviewBuffer(timeline: VideoTimeline): Promise<void> {
        // Précharger les médias de la timeline pour performance
        const mediaUrls = timeline.scenes
            .filter(scene => scene.media_url)
            .map(scene => scene.media_url!)
            .filter((url, index, self) => self.indexOf(url) === index); // Unique

        for (const url of mediaUrls) {
            if (!this.previewBuffer.has(url)) {
                try {
                    // Précharger la vidéo (sera utilisé par expo-video)
                    // Pour l'instant, on marque juste comme chargé
                    this.previewBuffer.set(url, null);
                } catch (error) {
                    console.warn(`[RealTimePreview] Impossible de précharger ${url}:`, error);
                }
            }
        }
    }

    /**
     * Nettoie le buffer de preview
     */
    clearPreviewBuffer(): void {
        this.previewBuffer.clear();
    }

    /**
     * Vérifie si un effet est disponible
     */
    isEffectAvailable(effectName: string): boolean {
        return this.effectCache.has(effectName);
    }

    /**
     * Liste tous les effets disponibles
     */
    getAvailableEffects(): string[] {
        return Array.from(this.effectCache.keys());
    }
}

// Instance singleton
let previewServiceInstance: RealTimePreviewService | null = null;

/**
 * Obtient l'instance singleton du service de preview temps réel
 */
export const getRealTimePreviewService = (): RealTimePreviewService => {
    if (!previewServiceInstance) {
        previewServiceInstance = new RealTimePreviewService();
    }
    return previewServiceInstance;
};

/**
 * Service helper pour intégration facile
 */
export const realTimePreviewService = {
    /**
     * Obtient les paramètres d'effets pour une position dans la timeline
     */
    getEffectParams: (params: RealtimePreviewParams) => {
        const service = getRealTimePreviewService();
        return service.getEffectParams(params);
    },

    /**
     * Prépare le preview pour scrubbing fluide
     */
    preparePreview: async (timeline: VideoTimeline) => {
        const service = getRealTimePreviewService();
        await service.preparePreviewBuffer(timeline);
    },

    /**
     * Nettoie le buffer
     */
    clearBuffer: () => {
        const service = getRealTimePreviewService();
        service.clearPreviewBuffer();
    },

    /**
     * Vérifie si un effet est disponible
     */
    isEffectAvailable: (effectName: string): boolean => {
        const service = getRealTimePreviewService();
        return service.isEffectAvailable(effectName);
    },

    /**
     * Liste tous les effets disponibles
     */
    getAvailableEffects: (): string[] => {
        const service = getRealTimePreviewService();
        return service.getAvailableEffects();
    },
};


