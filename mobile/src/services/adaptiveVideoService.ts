/**
 * Service de compression vidéo adaptative
 * Détecte la qualité de connexion et sélectionne la qualité vidéo appropriée
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export type VideoQuality = '360p' | '480p' | '720p' | '1080p' | 'auto';

interface ConnectionQuality {
    type: 'wifi' | 'cellular' | 'unknown';
    effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
    isConnected: boolean;
    isInternetReachable?: boolean;
}

interface VideoQualityConfig {
    quality: VideoQuality;
    bitrate: number; // kbps
    resolution: { width: number; height: number };
}

const QUALITY_CONFIGS: Record<VideoQuality, VideoQualityConfig> = {
    '360p': {
        quality: '360p',
        bitrate: 500,
        resolution: { width: 640, height: 360 },
    },
    '480p': {
        quality: '480p',
        bitrate: 1000,
        resolution: { width: 854, height: 480 },
    },
    '720p': {
        quality: '720p',
        bitrate: 2500,
        resolution: { width: 1280, height: 720 },
    },
    '1080p': {
        quality: '1080p',
        bitrate: 5000,
        resolution: { width: 1920, height: 1080 },
    },
    auto: {
        quality: 'auto',
        bitrate: 0,
        resolution: { width: 0, height: 0 },
    },
};

class AdaptiveVideoService {
    private currentQuality: VideoQuality = 'auto';
    private connectionQuality: ConnectionQuality | null = null;
    private qualityPreference: VideoQuality | null = null;

    /**
     * Initialise le service et charge les préférences utilisateur
     */
    async initialize(): Promise<void> {
        try {
            const saved = await AsyncStorage.getItem('video_quality_preference');
            if (saved && this.isValidQuality(saved)) {
                this.qualityPreference = saved as VideoQuality;
            }
            await this.detectConnectionQuality();
        } catch (error) {
            console.error('[AdaptiveVideoService] Erreur initialisation:', error);
        }
    }

    /**
     * Détecte la qualité de connexion actuelle
     */
    async detectConnectionQuality(): Promise<ConnectionQuality> {
        try {
            const state = await NetInfo.fetch();
            const connectionQuality: ConnectionQuality = {
                type: state.type === 'wifi' ? 'wifi' : state.type === 'cellular' ? 'cellular' : 'unknown',
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable ?? false,
            };

            // Détecter le type de connexion cellulaire si disponible
            if (state.type === 'cellular' && 'details' in state) {
                const details = state.details as any;
                if (details.cellularGeneration) {
                    connectionQuality.effectiveType = details.cellularGeneration.toLowerCase() as '2g' | '3g' | '4g';
                }
            }

            this.connectionQuality = connectionQuality;
            return connectionQuality;
        } catch (error) {
            console.error('[AdaptiveVideoService] Erreur détection connexion:', error);
            return {
                type: 'unknown',
                isConnected: false,
            };
        }
    }

    /**
     * Détermine la qualité vidéo optimale selon la connexion
     */
    async getOptimalQuality(): Promise<VideoQuality> {
        // Si l'utilisateur a une préférence manuelle, l'utiliser
        if (this.qualityPreference && this.qualityPreference !== 'auto') {
            return this.qualityPreference;
        }

        // Détecter la connexion si nécessaire
        if (!this.connectionQuality) {
            await this.detectConnectionQuality();
        }

        const connection = this.connectionQuality!;

        // WiFi : qualité maximale
        if (connection.type === 'wifi' && connection.isConnected) {
            return '1080p';
        }

        // 4G : qualité haute
        if (connection.type === 'cellular' && connection.effectiveType === '4g' && connection.isConnected) {
            return '720p';
        }

        // 3G : qualité moyenne
        if (connection.type === 'cellular' && connection.effectiveType === '3g' && connection.isConnected) {
            return '480p';
        }

        // 2G ou connexion lente : qualité basse
        if (connection.type === 'cellular' && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g')) {
            return '360p';
        }

        // Par défaut : qualité moyenne
        return '480p';
    }

    /**
     * Obtient l'URL vidéo avec la qualité appropriée
     * Si le backend supporte plusieurs qualités, retourne l'URL correspondante
     */
    async getVideoUrl(originalUrl: string, quality?: VideoQuality): Promise<string> {
        const targetQuality = quality || (await this.getOptimalQuality());

        // Si la qualité est auto ou si l'URL originale n'a pas de variantes, retourner l'originale
        if (targetQuality === 'auto' || !originalUrl.includes('.')) {
            return originalUrl;
        }

        // Si le backend supporte les variantes de qualité, construire l'URL
        // Format attendu: https://cdn.example.com/video.mp4 -> https://cdn.example.com/video_720p.mp4
        const urlParts = originalUrl.split('.');
        if (urlParts.length >= 2) {
            const extension = urlParts[urlParts.length - 1];
            const baseUrl = urlParts.slice(0, -1).join('.');
            return `${baseUrl}_${targetQuality}.${extension}`;
        }

        return originalUrl;
    }

    /**
     * Définit la préférence de qualité de l'utilisateur
     */
    async setQualityPreference(quality: VideoQuality): Promise<void> {
        if (!this.isValidQuality(quality)) {
            throw new Error(`Qualité invalide: ${quality}`);
        }

        this.qualityPreference = quality;
        await AsyncStorage.setItem('video_quality_preference', quality);
    }

    /**
     * Obtient la configuration de qualité
     */
    getQualityConfig(quality: VideoQuality): VideoQualityConfig {
        return QUALITY_CONFIGS[quality];
    }

    /**
     * Vérifie si une qualité est valide
     */
    private isValidQuality(quality: string): boolean {
        return ['360p', '480p', '720p', '1080p', 'auto'].includes(quality);
    }

    /**
     * Obtient la qualité actuelle
     */
    getCurrentQuality(): VideoQuality {
        return this.currentQuality;
    }

    /**
     * Obtient les informations de connexion
     */
    getConnectionInfo(): ConnectionQuality | null {
        return this.connectionQuality;
    }
}

export const adaptiveVideoService = new AdaptiveVideoService();

