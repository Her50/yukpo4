/**
 * ProductMediaCarousel - Carousel d'images et vidéos pour ProductCard
 * Support lecture vidéos avec Video component
 */

import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import OptimizedImage from './OptimizedImage';
import SafeIcon from './SafeIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - 32;
const CAROUSEL_HEIGHT = 180;

interface ProductMediaCarouselProps {
    images: string[];
    videos: string[];
    variantImage?: string; // Image spécifique à la variation sélectionnée
    onImagePress?: (index: number) => void;
    onMediaChange?: (currentIndex: number, totalMedia: number) => void; // ✅ NOUVEAU: Callback pour tracker navigation médias
    onAllMediaViewed?: () => void; // ✅ NOUVEAU: Callback quand tous les médias ont été vus
}

const ProductMediaCarousel: React.FC<ProductMediaCarouselProps> = ({
    images,
    videos,
    variantImage,
    onImagePress,
    onMediaChange,
    onAllMediaViewed,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playingVideoIndex, setPlayingVideoIndex] = useState<number | null>(null);
    const [fullscreenMedia, setFullscreenMedia] = useState<{ type: 'image' | 'video'; uri: string } | null>(null);
    // ✅ CORRIGÉ 2026-02-25: Supprimé viewedMediaIndices et preloadedIndices
    // Ces states causaient des re-renders en boucle qui verrouillaient l'écran
    const scrollViewRef = useRef<ScrollView>(null);
    const fullscreenVideoRef = useRef<Video | null>(null);
    // ✅ CORRIGÉ: Références pour chaque vidéo du carousel pour contrôler la lecture
    const videoRefs = useRef<Map<number, Video>>(new Map());
    // ✅ NOUVEAU 2026-03-02: Tracking interaction utilisateur pour pause auto-scroll
    const userInteractingRef = useRef(false);
    const autoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Combiner toutes les médias avec priorité variantImage
    const allMedia: Array<{ type: 'image' | 'video'; uri: string; index: number }> = [];

    // Image de variation en premier si existe
    if (variantImage) {
        allMedia.push({ type: 'image', uri: variantImage, index: 0 });
    }

    // ✅ CORRIGÉ: Vidéos en priorité (DOIVENT apparaître au début du carrousel)
    // Note: Les URLs sont déjà construites dans ProductCard avec buildMediaUrl
    videos.forEach((vid) => {
        if (vid) {
            allMedia.push({ type: 'video', uri: vid, index: allMedia.length });
        }
    });

    // Images normales
    images.forEach((img) => {
        if (!img) {
            return;
        }
        // Éviter de dupliquer l'image de variation
        if (!variantImage || img !== variantImage) {
            allMedia.push({ type: 'image', uri: img, index: allMedia.length });
        }
    });

    // Si pas de variantImage et pas d'images, utiliser la première image disponible
    if (allMedia.length === 0 && images.length > 0) {
        allMedia.push({ type: 'image', uri: images[0], index: 0 });
    }

    const handleScroll = (event: any) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / CAROUSEL_WIDTH);
        setCurrentIndex(index);

        // ✅ Notifier le changement de média
        onMediaChange?.(index, allMedia.length);

        // Arrêter la vidéo précédente si on change de slide
        if (playingVideoIndex !== null && playingVideoIndex !== index) {
            const previousVideoRef = videoRefs.current.get(playingVideoIndex);
            if (previousVideoRef) {
                previousVideoRef.pauseAsync().catch(() => undefined);
            }
            setPlayingVideoIndex(null);
        }

        // ✅ NOUVEAU 2026-03-02: Autoplay vidéo quand le slide vidéo devient visible par scroll utilisateur
        if (allMedia[index]?.type === 'video' && playingVideoIndex !== index) {
            setTimeout(() => {
                const videoRef = videoRefs.current.get(index);
                if (videoRef) {
                    videoRef.playAsync().catch(() => undefined);
                    setPlayingVideoIndex(index);
                }
            }, 300);
        }
    };

    const playVideo = async (index: number) => {
        if (allMedia[index]?.type === 'video') {
            // ✅ CORRIGÉ: Utiliser la ref pour démarrer la lecture de la vidéo
            const videoRef = videoRefs.current.get(index);
            if (videoRef) {
                try {
                    // ✅ CORRIGÉ: Vérifier le statut de la vidéo avant de jouer
                    const status = await videoRef.getStatusAsync();
                    if (status.isLoaded) {
                        // La vidéo est chargée, on peut jouer
                        await videoRef.setStatusAsync({ shouldPlay: true, isMuted: false });
                        await videoRef.playAsync();
                        setPlayingVideoIndex(index);
                        console.log('[ProductMediaCarousel] ✅ Vidéo démarrée avec succès, index:', index);
                    } else {
                        // La vidéo n'est pas encore chargée, attendre qu'elle se charge
                        console.log('[ProductMediaCarousel] ⏳ Vidéo pas encore chargée, attente...');
                        // Marquer comme devant jouer, le onPlaybackStatusUpdate démarrera la lecture
                        setPlayingVideoIndex(index);
                        // Essayer de charger la vidéo
                        await videoRef.loadAsync({ uri: allMedia[index].uri }, { shouldPlay: true, isMuted: false });
                    }
                } catch (error) {
                    console.error('[ProductMediaCarousel] ❌ Erreur lecture vidéo:', error);
                    // ✅ FALLBACK: Essayer de recharger la vidéo
                    try {
                        await videoRef.loadAsync({ uri: allMedia[index].uri }, { shouldPlay: true, isMuted: false });
                        setPlayingVideoIndex(index);
                    } catch (retryError) {
                        console.error('[ProductMediaCarousel] ❌ Erreur retry lecture vidéo:', retryError);
                        setPlayingVideoIndex(null);
                    }
                }
            } else {
                console.warn('[ProductMediaCarousel] ⚠️ Ref vidéo non disponible pour index:', index);
                // Si la ref n'est pas encore disponible, marquer comme devant jouer
                setPlayingVideoIndex(index);
            }
        }
    };

    const openFullscreen = (media: { type: 'image' | 'video'; uri: string }) => {
        setPlayingVideoIndex(null);
        setFullscreenMedia(media);
        onImagePress?.(media.type === 'image' ? 0 : -1);
    };

    const closeFullscreen = async () => {
        if (fullscreenVideoRef.current) {
            try {
                await fullscreenVideoRef.current.stopAsync();
            } catch (error) {
                console.warn('[ProductMediaCarousel] Erreur arrêt vidéo plein écran:', error);
            }
        }
        setFullscreenMedia(null);
    };

    useEffect(() => {
        // S'assurer que la vidéo plein écran démarre quand le modal s'ouvre
        if (fullscreenMedia?.type === 'video' && fullscreenVideoRef.current) {
            fullscreenVideoRef.current.playAsync().catch(() => undefined);
        }
    }, [fullscreenMedia]);

    // ✅ CORRIGÉ 2026-03-02: Auto-scroll continu à travers tous les médias
    // Scroll toutes les 4s pour les images, pause quand l'utilisateur interagit ou qu'une vidéo joue
    useEffect(() => {
        if (allMedia.length <= 1) return;

        const startAutoScroll = () => {
            if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
            autoScrollTimerRef.current = setInterval(() => {
                // Ne pas auto-scroll si l'utilisateur interagit ou si une vidéo est en lecture
                if (userInteractingRef.current || playingVideoIndex !== null) return;

                setCurrentIndex((prev) => {
                    const nextIndex = (prev + 1) % allMedia.length;
                    scrollViewRef.current?.scrollTo({ x: CAROUSEL_WIDTH * nextIndex, animated: true });
                    // ✅ NOUVEAU: Si le prochain slide est une vidéo, lancer l'autoplay
                    if (allMedia[nextIndex]?.type === 'video') {
                        // Petit délai pour laisser le scroll se terminer avant de lancer la vidéo
                        setTimeout(() => {
                            const videoRef = videoRefs.current.get(nextIndex);
                            if (videoRef) {
                                videoRef.playAsync().catch(() => undefined);
                                setPlayingVideoIndex(nextIndex);
                            }
                        }, 400);
                    }
                    return nextIndex;
                });
            }, 4000);
        };

        // Démarrer après un court délai pour laisser le composant se monter
        const initTimer = setTimeout(startAutoScroll, 2000);

        return () => {
            clearTimeout(initTimer);
            if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
        };
    }, [allMedia.length, playingVideoIndex]);

    if (allMedia.length === 0) {
        return (
            <View style={styles.placeholder}>
                <View style={styles.placeholderIcon}>
                    <SafeIcon name="image" size={36} color="#6366F1" />
                </View>
                <Text style={styles.placeholderText}>Aucun média disponible</Text>
            </View>
        );
    }

    // ✅ CORRIGÉ 2026-02-27: Fonction de rendu d'un média individuel
    // Bug 3 fix: Toujours monter le <Video> pour que la ref soit disponible, contrôler shouldPlay
    const renderMediaItem = (media: { type: 'image' | 'video'; uri: string; index: number }, index: number) => {
        return (
            <View key={index} style={styles.slide}>
                {media.type === 'image' ? (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => openFullscreen(media)}
                        style={styles.imageContainer}
                    >
                        <OptimizedImage
                            uri={media.uri}
                            style={styles.media as any}
                            priority={index === currentIndex ? "high" : "low"}
                            cachePolicy="memory-disk"
                            webp={false}
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.3)']}
                            style={styles.gradient}
                        />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.videoContainer}>
                        {/* ✅ CORRIGÉ 2026-02-27: Toujours monter le Video pour que la ref soit disponible */}
                        <Video
                            ref={(ref) => {
                                if (ref) {
                                    videoRefs.current.set(index, ref);
                                } else {
                                    videoRefs.current.delete(index);
                                }
                            }}
                            source={{ uri: media.uri }}
                            style={styles.media}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={playingVideoIndex === index}
                            isLooping
                            isMuted={playingVideoIndex !== index}
                            useNativeControls={playingVideoIndex === index}
                            onError={(error: any) => {
                                const errorMessage = (error as any)?.message || String(error);
                                if (!errorMessage.includes('404')) {
                                    console.error('[ProductMediaCarousel] ❌ Erreur vidéo:', error);
                                }
                                setPlayingVideoIndex(null);
                            }}
                        />
                        {/* Overlay sombre + icône quand la vidéo n'est pas en lecture */}
                        {playingVideoIndex !== index && (
                            <View style={styles.videoOverlay} />
                        )}
                        <TouchableOpacity
                            style={styles.fullscreenButton}
                            onPress={() => openFullscreen(media)}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="maximize" size={18} color="#FFF" />
                        </TouchableOpacity>
                        {playingVideoIndex !== index && (
                            <TouchableOpacity
                                style={styles.playButton}
                                onPress={() => playVideo(index)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="play" size={48} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <>
            <View style={styles.container}>
                {/* ✅ CORRIGÉ 2026-02-25: Si un seul média, pas de ScrollView (évite capture gestes) */}
                {allMedia.length === 1 ? (
                    renderMediaItem(allMedia[0], 0)
                ) : (
                    <ScrollView
                        ref={scrollViewRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={100}
                        decelerationRate="fast"
                        snapToInterval={CAROUSEL_WIDTH}
                        snapToAlignment="start"
                        nestedScrollEnabled={true}
                        bounces={false}
                        onScrollBeginDrag={() => { userInteractingRef.current = true; }}
                        onScrollEndDrag={() => { setTimeout(() => { userInteractingRef.current = false; }, 3000); }}
                    >
                        {allMedia.map((media, index) => {
                            const shouldRender = Math.abs(index - currentIndex) <= 2;
                            if (!shouldRender) {
                                return <View key={index} style={styles.slide} />;
                            }
                            return renderMediaItem(media, index);
                        })}
                    </ScrollView>
                )}

                {/* Indicateurs */}
                {allMedia.length > 1 && (
                    <View style={styles.indicators}>
                        {allMedia.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.indicator,
                                    currentIndex === index && styles.indicatorActive,
                                ]}
                            />
                        ))}
                    </View>
                )}

                {/* Compteur */}
                {allMedia.length > 1 && (
                    <View style={styles.counter}>
                        <Text style={styles.counterText}>
                            {String(currentIndex + 1)} / {String(allMedia.length)}
                        </Text>
                    </View>
                )}

                {/* Badge type média */}
                {allMedia[currentIndex] && (
                    <View style={styles.mediaBadge}>
                        <SafeIcon
                            name={allMedia[currentIndex].type === 'video' ? 'video' : 'image'}
                            size={12}
                            color="#FFF"
                        />
                        <Text style={styles.mediaBadgeText}>
                            {allMedia[currentIndex].type === 'video' ? 'Vidéo' : 'Image'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Modal plein écran */}
            {fullscreenMedia && (
                <Modal
                    visible={!!fullscreenMedia}
                    transparent
                    animationType="fade"
                    onRequestClose={closeFullscreen}
                >
                    <View style={styles.fullscreenContainer}>
                        <TouchableOpacity
                            style={styles.closeFullscreenButton}
                            onPress={closeFullscreen}
                        >
                            <SafeIcon name="x" size={24} color="#FFF" />
                        </TouchableOpacity>
                        {fullscreenMedia.type === 'image' ? (
                            <OptimizedImage
                                uri={fullscreenMedia.uri}
                                style={styles.fullscreenImage as any}
                                priority="high"
                                cachePolicy="memory-disk"
                            />
                        ) : (
                            <Video
                                ref={(ref) => {
                                    fullscreenVideoRef.current = ref;
                                }}
                                source={{ uri: fullscreenMedia.uri }}
                                style={styles.fullscreenVideo}
                                resizeMode={ResizeMode.CONTAIN}
                                shouldPlay
                                useNativeControls
                            />
                        )}
                    </View>
                </Modal>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        width: '100%',
        height: CAROUSEL_HEIGHT, // ✅ CORRIGÉ 2026-02-27: Aligné avec ProductCard.imageContainer (180px)
    },
    slide: {
        width: CAROUSEL_WIDTH,
        height: CAROUSEL_HEIGHT, // ✅ CORRIGÉ 2026-02-27: Aligné avec container
    },
    imageContainer: {
        width: '100%',
        height: '100%',
    },
    media: {
        width: '100%',
        height: '100%',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 100,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    videoContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    playButton: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -24 }, { translateY: -24 }],
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 30,
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullscreenButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 18,
        padding: 8,
        zIndex: 6,
    },
    indicators: {
        position: 'absolute',
        bottom: 12,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    indicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    indicatorActive: {
        backgroundColor: '#FFF',
        width: 20,
    },
    counter: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    counterText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    mediaBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    mediaBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
    },
    videoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    placeholder: {
        width: '100%',
        height: CAROUSEL_HEIGHT, // ✅ CORRIGÉ 2026-02-27: Aligné avec container
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        gap: 8, // ✅ RÉDUIT: 12 → 8
    },
    placeholderIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#E0E7FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        fontSize: 14,
        color: '#4C51BF',
        fontWeight: '600',
    },
    fullscreenContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeFullscreenButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullscreenImage: {
        width: SCREEN_WIDTH,
        height: '100%',
    },
    fullscreenVideo: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH * 1.3,
        maxHeight: '80%',
    },
});

export default ProductMediaCarousel;


