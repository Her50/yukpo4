/**
 * Service de préchargement intelligent des vidéos
 * Gère le cache, la compression adaptative, et le préchargement selon la connexion
 */

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.cacheDirectory}video_cache/`;
const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500 MB
// ✅ OPTIMISÉ: Préchargement agressif comme TikTok
const PRELOAD_COUNT_WIFI = 10; // Nombre de vidéos à précharger en WiFi (augmenté de 5 à 10)
const PRELOAD_COUNT_4G = 5; // Nombre de vidéos à précharger en 4G (augmenté de 3 à 5)
const PRELOAD_COUNT_3G = 2; // Nombre de vidéos à précharger en 3G (augmenté de 1 à 2)

interface VideoItem {
    id: string;
    videoUrl: string;
    thumbnail?: string;
}

interface CacheEntry {
    videoId: string;
    localPath: string;
    size: number;
    timestamp: number;
    quality: 'high' | 'medium' | 'low';
}

class VideoPreloadService {
    private preloadQueue: string[] = [];
    private isPreloading = false;
    private cacheMap = new Map<string, CacheEntry>();

    /**
     * Initialise le service (crée le dossier cache)
     */
    async initialize(): Promise<void> {
        try {
            const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
            }
            await this.loadCacheMap();
            await this.cleanupOldCache();
        } catch (error) {
            console.error('[VideoPreloadService] Erreur initialisation:', error);
        }
    }

    /**
     * Charge la carte du cache depuis AsyncStorage
     */
    private async loadCacheMap(): Promise<void> {
        try {
            const cached = await SafeStorage.getItem('video_cache_map');
            if (cached) {
                const entries = JSON.parse(cached) as CacheEntry[];
                entries.forEach(entry => {
                    this.cacheMap.set(entry.videoId, entry);
                });
            }
        } catch (error) {
            console.error('[VideoPreloadService] Erreur chargement cache map:', error);
        }
    }

    /**
     * Sauvegarde la carte du cache
     */
    private async saveCacheMap(): Promise<void> {
        try {
            const entries = Array.from(this.cacheMap.values());
            await SafeStorage.setItem('video_cache_map', JSON.stringify(entries));
        } catch (error) {
            console.error('[VideoPreloadService] Erreur sauvegarde cache map:', error);
        }
    }

    /**
     * Nettoie le cache ancien si la taille dépasse la limite
     */
    private async cleanupOldCache(): Promise<void> {
        try {
            let totalSize = 0;
            const entries = Array.from(this.cacheMap.values());

            // Calculer taille totale
            entries.forEach(entry => {
                totalSize += entry.size;
            });

            if (totalSize > MAX_CACHE_SIZE) {
                // Trier par timestamp (plus ancien en premier)
                entries.sort((a, b) => a.timestamp - b.timestamp);

                // Supprimer les plus anciens jusqu'à ce qu'on soit sous la limite
                for (const entry of entries) {
                    if (totalSize <= MAX_CACHE_SIZE * 0.8) break; // Arrêter à 80% de la limite

                    try {
                        const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
                        if (fileInfo.exists) {
                            await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
                        }
                        this.cacheMap.delete(entry.videoId);
                        totalSize -= entry.size;
                    } catch (error) {
                        console.error('[VideoPreloadService] Erreur suppression cache:', error);
                    }
                }

                await this.saveCacheMap();
            }
        } catch (error) {
            console.error('[VideoPreloadService] Erreur cleanup cache:', error);
        }
    }

    /**
     * Détermine la qualité vidéo selon la connexion
     */
    private async getQualityForConnection(): Promise<'high' | 'medium' | 'low'> {
        const netInfo = await NetInfo.fetch();

        if (netInfo.type === 'wifi') {
            return 'high';
        } else if (netInfo.type === 'cellular') {
            // Détecter 4G vs 3G (approximatif)
            const details = netInfo.details as any;
            if (details?.cellularGeneration === '4g' || details?.cellularGeneration === '5g') {
                return 'medium';
            }
            return 'low';
        }

        return 'low'; // Par défaut qualité basse
    }

    /**
     * Détermine le nombre de vidéos à précharger selon la connexion
     */
    private async getPreloadCount(): Promise<number> {
        const netInfo = await NetInfo.fetch();

        if (netInfo.type === 'wifi') {
            return PRELOAD_COUNT_WIFI;
        } else if (netInfo.type === 'cellular') {
            const details = netInfo.details as any;
            if (details?.cellularGeneration === '4g' || details?.cellularGeneration === '5g') {
                return PRELOAD_COUNT_4G;
            }
            return PRELOAD_COUNT_3G;
        }

        return PRELOAD_COUNT_3G;
    }

    /**
     * Précharge une vidéo
     */
    private async preloadVideo(video: VideoItem, quality: 'high' | 'medium' | 'low'): Promise<string | null> {
        try {
            // Vérifier si déjà en cache
            const cached = this.cacheMap.get(video.id);
            if (cached) {
                const fileInfo = await FileSystem.getInfoAsync(cached.localPath);
                if (fileInfo.exists) {
                    return cached.localPath;
                }
                // Fichier supprimé, retirer de la map
                this.cacheMap.delete(video.id);
            }

            // Télécharger la vidéo
            const localPath = `${CACHE_DIR}${video.id}_${quality}.mp4`;
            const downloadResult = await FileSystem.downloadAsync(video.videoUrl, localPath);

            if (downloadResult.status === 200) {
                const fileInfo = await FileSystem.getInfoAsync(localPath);
                const size = fileInfo.exists ? (fileInfo.size || 0) : 0;

                const entry: CacheEntry = {
                    videoId: video.id,
                    localPath,
                    size,
                    timestamp: Date.now(),
                    quality,
                };

                this.cacheMap.set(video.id, entry);
                await this.saveCacheMap();

                return localPath;
            }

            return null;
        } catch (error) {
            console.error('[VideoPreloadService] Erreur préchargement vidéo:', error);
            return null;
        }
    }

    /**
     * Précharge les vidéos suivantes
     */
    async preloadNextVideos(videos: VideoItem[], currentIndex: number): Promise<void> {
        if (this.isPreloading) return;

        this.isPreloading = true;

        try {
            const quality = await this.getQualityForConnection();
            const preloadCount = await this.getPreloadCount();

            // Précharger les vidéos suivantes
            const videosToPreload = videos.slice(
                currentIndex + 1,
                currentIndex + 1 + preloadCount
            );

            // ✅ OPTIMISÉ: Précharger en parallèle (5 max comme TikTok au lieu de 2)
            const preloadPromises = videosToPreload.slice(0, 5).map(video =>
                this.preloadVideo(video, quality)
            );

            await Promise.allSettled(preloadPromises);

            // Précharger les suivantes en arrière-plan
            videosToPreload.slice(5).forEach(video => {
                this.preloadVideo(video, quality).catch(() => {
                    // Ignorer erreurs silencieusement
                });
            });
        } catch (error) {
            console.error('[VideoPreloadService] Erreur préchargement batch:', error);
        } finally {
            this.isPreloading = false;
        }
    }

    /**
     * Récupère le chemin local d'une vidéo si elle est en cache
     */
    async getCachedPath(videoId: string): Promise<string | null> {
        const cached = this.cacheMap.get(videoId);
        if (cached) {
            const fileInfo = await FileSystem.getInfoAsync(cached.localPath);
            if (fileInfo.exists) {
                return cached.localPath;
            }
            // Fichier supprimé
            this.cacheMap.delete(videoId);
            await this.saveCacheMap();
        }
        return null;
    }

    /**
     * Nettoie le cache d'une vidéo spécifique
     */
    async clearVideoCache(videoId: string): Promise<void> {
        const cached = this.cacheMap.get(videoId);
        if (cached) {
            try {
                await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
                this.cacheMap.delete(videoId);
                await this.saveCacheMap();
            } catch (error) {
                console.error('[VideoPreloadService] Erreur suppression cache vidéo:', error);
            }
        }
    }

    /**
     * Nettoie tout le cache
     */
    async clearAllCache(): Promise<void> {
        try {
            await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
            this.cacheMap.clear();
            await SafeStorage.removeItem('video_cache_map');
        } catch (error) {
            console.error('[VideoPreloadService] Erreur nettoyage cache complet:', error);
        }
    }
}

export const videoPreloadService = new VideoPreloadService();

