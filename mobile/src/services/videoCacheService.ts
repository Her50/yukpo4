/**
 * Service de cache vidéo local avec stratégie LRU intelligente
 * Gère le cache vidéo avec nettoyage automatique et préchargement
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.cacheDirectory}video_cache/`;
const MAX_CACHE_SIZE = 1000 * 1024 * 1024; // 1 GB (augmenté de 500 MB)

interface CacheEntry {
    videoId: string;
    localPath: string;
    size: number;
    timestamp: number;
    accessCount: number; // Pour stratégie LRU
}

class VideoCacheService {
    private cacheMap = new Map<string, CacheEntry>();
    private isInitialized = false;

    /**
     * Initialise le service (crée le dossier cache)
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
            }
            await this.loadCacheMap();
            await this.cleanupOldCache();
            this.isInitialized = true;
        } catch (error) {
            console.error('[VideoCacheService] Erreur initialisation:', error);
        }
    }

    /**
     * Charge la carte du cache depuis AsyncStorage
     */
    private async loadCacheMap(): Promise<void> {
        try {
            const cached = await AsyncStorage.getItem('video_cache_map');
            if (cached) {
                const entries = JSON.parse(cached) as CacheEntry[];
                entries.forEach(entry => {
                    this.cacheMap.set(entry.videoId, entry);
                });
            }
        } catch (error) {
            console.error('[VideoCacheService] Erreur chargement cache map:', error);
        }
    }

    /**
     * Sauvegarde la carte du cache
     */
    private async saveCacheMap(): Promise<void> {
        try {
            const entries = Array.from(this.cacheMap.values());
            await AsyncStorage.setItem('video_cache_map', JSON.stringify(entries));
        } catch (error) {
            console.error('[VideoCacheService] Erreur sauvegarde cache map:', error);
        }
    }

    /**
     * Nettoie le cache ancien si la taille dépasse la limite (stratégie LRU)
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
                // Trier par accessCount (LRU) puis par timestamp
                entries.sort((a, b) => {
                    if (a.accessCount !== b.accessCount) {
                        return a.accessCount - b.accessCount; // Moins accédé en premier
                    }
                    return a.timestamp - b.timestamp; // Plus ancien en premier
                });

                // Supprimer les plus anciens/peu utilisés jusqu'à ce qu'on soit sous la limite
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
                        console.error('[VideoCacheService] Erreur suppression cache:', error);
                    }
                }

                await this.saveCacheMap();
            }
        } catch (error) {
            console.error('[VideoCacheService] Erreur cleanup cache:', error);
        }
    }

    /**
     * Précharge une vidéo dans le cache
     */
    async preloadVideo(videoUrl: string): Promise<string | null> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Générer un ID unique pour la vidéo (basé sur l'URL)
            const videoId = this.generateVideoId(videoUrl);

            // Vérifier si déjà en cache
            const cached = this.cacheMap.get(videoId);
            if (cached) {
                const fileInfo = await FileSystem.getInfoAsync(cached.localPath);
                if (fileInfo.exists) {
                    // Mettre à jour accessCount et timestamp
                    cached.accessCount++;
                    cached.timestamp = Date.now();
                    await this.saveCacheMap();
                    return cached.localPath;
                }
                // Fichier supprimé, retirer de la map
                this.cacheMap.delete(videoId);
            }

            // Télécharger la vidéo
            const localPath = `${CACHE_DIR}${videoId}.mp4`;
            const downloadResult = await FileSystem.downloadAsync(videoUrl, localPath);

            if (downloadResult.status === 200) {
                const fileInfo = await FileSystem.getInfoAsync(localPath);
                const size = fileInfo.exists ? (fileInfo.size || 0) : 0;

                const entry: CacheEntry = {
                    videoId,
                    localPath,
                    size,
                    timestamp: Date.now(),
                    accessCount: 1,
                };

                this.cacheMap.set(videoId, entry);
                await this.saveCacheMap();

                // Nettoyer si nécessaire
                await this.cleanupOldCache();

                return localPath;
            }

            return null;
        } catch (error) {
            console.error('[VideoCacheService] Erreur préchargement vidéo:', error);
            return null;
        }
    }

    /**
     * Récupère le chemin local d'une vidéo si elle est en cache
     */
    async getCachedPath(videoUrl: string): Promise<string | null> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const videoId = this.generateVideoId(videoUrl);
        const cached = this.cacheMap.get(videoId);

        if (cached) {
            const fileInfo = await FileSystem.getInfoAsync(cached.localPath);
            if (fileInfo.exists) {
                // Mettre à jour accessCount et timestamp (LRU)
                cached.accessCount++;
                cached.timestamp = Date.now();
                await this.saveCacheMap();
                return cached.localPath;
            }
            // Fichier supprimé
            this.cacheMap.delete(videoId);
            await this.saveCacheMap();
        }

        return null;
    }

    /**
     * Génère un ID unique pour une vidéo basé sur son URL
     */
    private generateVideoId(videoUrl: string): string {
        // Utiliser un hash simple de l'URL
        let hash = 0;
        for (let i = 0; i < videoUrl.length; i++) {
            const char = videoUrl.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Nettoie le cache d'une vidéo spécifique
     */
    async clearVideoCache(videoUrl: string): Promise<void> {
        const videoId = this.generateVideoId(videoUrl);
        const cached = this.cacheMap.get(videoId);

        if (cached) {
            try {
                await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
                this.cacheMap.delete(videoId);
                await this.saveCacheMap();
            } catch (error) {
                console.error('[VideoCacheService] Erreur suppression cache vidéo:', error);
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
            await AsyncStorage.removeItem('video_cache_map');
            this.isInitialized = false;
        } catch (error) {
            console.error('[VideoCacheService] Erreur nettoyage cache complet:', error);
        }
    }
}

export const videoCacheService = new VideoCacheService();

