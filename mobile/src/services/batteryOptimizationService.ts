/**
 * Service d'optimisation batterie pour Video Feed
 * Réduit consommation CPU/GPU, optimise rendu, gestion background
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface BatteryOptimizationConfig {
    reduceFPSWhenBackground: boolean;
    pauseVideosWhenBackground: boolean;
    reducePreloadWhenLowBattery: boolean;
    optimizeRendering: boolean;
}

const DEFAULT_CONFIG: BatteryOptimizationConfig = {
    reduceFPSWhenBackground: true,
    pauseVideosWhenBackground: true,
    reducePreloadWhenLowBattery: true,
    optimizeRendering: true,
};

class BatteryOptimizationService {
    private config: BatteryOptimizationConfig;
    private isBackground = false;
    private listeners: Array<() => void> = [];

    constructor(config: Partial<BatteryOptimizationConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initialize();
    }

    /**
     * Initialise le service
     */
    private initialize(): void {
        // Écouter changements d'état de l'app
        AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    }

    /**
     * Gère les changements d'état de l'app
     */
    private handleAppStateChange(nextAppState: AppStateStatus): void {
        const wasBackground = this.isBackground;
        this.isBackground = nextAppState !== 'active';

        if (wasBackground !== this.isBackground) {
            this.notifyListeners();
        }
    }

    /**
     * Notifie les listeners
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => listener());
    }

    /**
     * Ajoute un listener pour changements d'état
     */
    onStateChange(listener: () => void): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Vérifie si l'app est en background
     */
    isInBackground(): boolean {
        return this.isBackground;
    }

    /**
     * Devrait-on réduire la qualité vidéo ?
     */
    shouldReduceQuality(): boolean {
        return this.config.reducePreloadWhenLowBattery && this.isBackground;
    }

    /**
     * Devrait-on pauser les vidéos ?
     */
    shouldPauseVideos(): boolean {
        return this.config.pauseVideosWhenBackground && this.isBackground;
    }

    /**
     * Devrait-on réduire le préchargement ?
     */
    shouldReducePreload(): boolean {
        return this.config.reducePreloadWhenLowBattery && this.isBackground;
    }

    /**
     * Optimise le rendu (réduit FPS si background)
     */
    getOptimalFPS(): number {
        if (this.config.reduceFPSWhenBackground && this.isBackground) {
            return 30; // Réduire à 30 FPS en background
        }
        return 60; // 60 FPS normal
    }

    /**
     * Nettoie les ressources
     */
    cleanup(): void {
        // AppState.removeEventListener removed in newer RN; use subscription pattern instead
        this.listeners = [];
    }
}

export const batteryOptimizationService = new BatteryOptimizationService();

/**
 * Hook pour utiliser l'optimisation batterie
 */
export function useBatteryOptimization() {
    const isBackgroundRef = useRef(false);

    useEffect(() => {
        const unsubscribe = batteryOptimizationService.onStateChange(() => {
            isBackgroundRef.current = batteryOptimizationService.isInBackground();
        });

        return unsubscribe;
    }, []);

    return {
        isBackground: batteryOptimizationService.isInBackground(),
        shouldPauseVideos: batteryOptimizationService.shouldPauseVideos(),
        shouldReducePreload: batteryOptimizationService.shouldReducePreload(),
        shouldReduceQuality: batteryOptimizationService.shouldReduceQuality(),
        optimalFPS: batteryOptimizationService.getOptimalFPS(),
    };
}

