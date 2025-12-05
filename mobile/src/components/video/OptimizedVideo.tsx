/**
 * Composant Video avec optimisation automatique (CDN + compression adaptative + cache local)
 */

import { Video, VideoProps } from 'expo-av';
import React, { forwardRef, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { adaptiveVideoService } from '../../services/adaptiveVideoService';
import { cdnService } from '../../services/cdnService';
import { videoCacheService } from '../../services/videoCacheService';

interface OptimizedVideoProps extends Omit<VideoProps, 'source'> {
    originalUri: string;
    contentId: string;
    isActive?: boolean;
    enableCache?: boolean; // ✅ NOUVEAU: Option pour activer/désactiver le cache
    showCacheIndicator?: boolean; // ✅ NOUVEAU: Afficher indicateur cache HIT/MISS
}

const OptimizedVideo = forwardRef<Video, OptimizedVideoProps>(({
    originalUri,
    contentId,
    isActive = true,
    enableCache = true,
    showCacheIndicator = false,
    ...videoProps
}, ref) => {
    const [optimizedUri, setOptimizedUri] = useState<string>(originalUri);
    const [cacheStatus, setCacheStatus] = useState<'checking' | 'hit' | 'miss' | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialiser le service de cache
    useEffect(() => {
        if (enableCache && !isInitialized) {
            videoCacheService.initialize().then(() => {
                setIsInitialized(true);
            }).catch(() => {
                // Ignorer erreurs silencieusement
                setIsInitialized(true);
            });
        }
    }, [enableCache, isInitialized]);

    useEffect(() => {
        const optimizeUrl = async () => {
            if (!isActive || !originalUri) {
                setOptimizedUri(originalUri);
                return;
            }

            try {
                // 1. Obtenir URL CDN
                const cdnUrl = cdnService.getVideoUrl(originalUri, true);

                // 2. Vérifier le cache si activé
                if (enableCache && isInitialized) {
                    setCacheStatus('checking');
                    const cachedPath = await videoCacheService.getCachedPath(cdnUrl);

                    if (cachedPath) {
                        // CACHE HIT
                        setCacheStatus('hit');
                        setOptimizedUri(cachedPath);
                        return;
                    }

                    // CACHE MISS
                    setCacheStatus('miss');

                    // Précharger la vidéo dans le cache en arrière-plan
                    videoCacheService.preloadVideo(cdnUrl).catch(() => {
                        // Ignorer erreurs de préchargement
                    });
                }

                // 3. ✅ IMPLÉMENTÉ: Vérifier si HLS/DASH disponible (qualité adaptative serveur)
                // Support HLS/DASH natif pour qualité adaptative serveur (comme TikTok)
                const isHLS = originalUri.includes('.m3u8') || originalUri.endsWith('.m3u8');
                const isDASH = originalUri.includes('.mpd') || originalUri.endsWith('.mpd');

                // Si déjà HLS/DASH, utiliser directement
                if (isHLS || isDASH) {
                    setOptimizedUri(cdnUrl);
                    return;
                }

                // Tester si variantes HLS/DASH existent
                const hlsUrl = originalUri.replace(/\.mp4$/i, '.m3u8');
                const dashUrl = originalUri.replace(/\.mp4$/i, '.mpd');

                // Vérifier si HLS existe en testant l'URL
                try {
                    const hlsTest = await fetch(hlsUrl, { method: 'HEAD' });
                    if (hlsTest.ok) {
                        // HLS disponible - utiliser pour qualité adaptative serveur
                        setOptimizedUri(hlsUrl);
                        return;
                    }
                } catch (error) {
                    // HLS non disponible, continuer avec DASH ou fallback
                }

                // Vérifier si DASH existe
                try {
                    const dashTest = await fetch(dashUrl, { method: 'HEAD' });
                    if (dashTest.ok) {
                        // DASH disponible
                        setOptimizedUri(dashUrl);
                        return;
                    }
                } catch (error) {
                    // DASH non disponible, utiliser compression adaptative client
                }

                // 4. Fallback: Appliquer compression adaptative client (si pas HLS/DASH)
                const finalUrl = await adaptiveVideoService.getVideoUrl(cdnUrl);
                setOptimizedUri(finalUrl);
            } catch (error) {
                console.warn('[OptimizedVideo] Erreur optimisation URL:', error);
                // Fallback vers URL originale
                setOptimizedUri(originalUri);
            }
        };

        optimizeUrl();
    }, [originalUri, contentId, isActive, enableCache, isInitialized]);

    return (
        <View style={styles.container}>
            <Video ref={ref} {...videoProps} source={{ uri: optimizedUri }} />
            {showCacheIndicator && cacheStatus && (
                <View style={[
                    styles.cacheIndicator,
                    cacheStatus === 'hit' ? styles.cacheHit : cacheStatus === 'miss' ? styles.cacheMiss : styles.cacheChecking
                ]}>
                    <Text style={styles.cacheIndicatorText}>
                        CACHE {cacheStatus.toUpperCase()}
                    </Text>
                </View>
            )}
        </View>
    );
});

OptimizedVideo.displayName = 'OptimizedVideo';

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    cacheIndicator: {
        position: 'absolute',
        top: 10,
        right: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        zIndex: 1000,
    },
    cacheHit: {
        backgroundColor: '#10B981',
    },
    cacheMiss: {
        backgroundColor: '#F59E0B',
    },
    cacheChecking: {
        backgroundColor: '#6B7280',
    },
    cacheIndicatorText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default OptimizedVideo;

