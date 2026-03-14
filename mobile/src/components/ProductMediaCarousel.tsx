/**
 * ProductMediaCarousel - Carousel d'images et vidéos pour ProductCard
 * Support lecture vidéos avec Video component
 */

import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    onVideoRef?: (videoRef: Video, mediaKey: string) => void; // ✅ NOUVEAU: Callback pour enregistrer les refs vidéos
    onStopVideo?: (mediaKey: string) => void; // ✅ NOUVEAU: Callback pour arrêter une vidéo spécifique
    isScrolling?: boolean; // ✅ NOUVEAU: Indicateur de scroll pour arrêter les vidéos
    isVisible?: boolean; // ✅ NOUVEAU 2026-03-14: Carte visible à l'écran — gate tout auto-play
    // ✅ NOUVEAU 2026-03-12: Props du coordinateur vidéo
    onVideoPlaybackRequest?: (playCallback: () => void) => boolean;
    onVideoRelease?: () => void;
}

const ProductMediaCarousel: React.FC<ProductMediaCarouselProps> = ({
    images,
    videos,
    variantImage,
    onImagePress,
    onMediaChange,
    onAllMediaViewed,
    onVideoRef,
    onStopVideo,
    isScrolling = false,
    isVisible,
    onVideoPlaybackRequest,
    onVideoRelease,
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
    // ✅ FIX 2026-03-11: Ref pour tracker immédiatement l'état de lecture vidéo (évite le délai du state React)
    const videoPlayingRef = useRef<number | null>(null);
    const currentIndexRef = useRef(0);
    // ✅ NOUVEAU 2026-03-12: Ref pour suivre les vidéos réellement en lecture (pas juste en pause)
    const videoActivePlayingRef = useRef<number | null>(null);

    // ✅ NOUVEAU 2026-03-12: Fonction pour demander la permission de jouer avec le coordinateur
    const requestVideoPlayWithCoordinator = useCallback((videoIndex: number, playCallback: () => void) => {
        if (onVideoPlaybackRequest) {
            // Utiliser le coordinateur pour demander la permission
            const canPlay = onVideoPlaybackRequest(() => {
                playCallback();
                setPlayingVideoIndex(videoIndex);
                videoPlayingRef.current = videoIndex;
                videoActivePlayingRef.current = videoIndex; // ✅ AJOUT: Marquer comme réellement active
            });

            if (!canPlay) {
                console.log(`[ProductMediaCarousel] Vidéo ${videoIndex} mise en file d'attente`);
            }

            return canPlay;
        } else {
            // Fallback: jouer directement si pas de coordinateur
            playCallback();
            setPlayingVideoIndex(videoIndex);
            videoPlayingRef.current = videoIndex;
            videoActivePlayingRef.current = videoIndex; // ✅ AJOUT: Marquer comme réellement active
            return true;
        }
    }, [onVideoPlaybackRequest]);

    // ✅ NOUVEAU 2026-03-12: Fonction pour libérer une vidéo avec le coordinateur
    const releaseVideoWithCoordinator = useCallback(() => {
        setPlayingVideoIndex(null);
        videoPlayingRef.current = null;
        videoActivePlayingRef.current = null; // ✅ AJOUT: Libérer aussi la référence active

        if (onVideoRelease) {
            onVideoRelease();
        }
    }, [onVideoRelease]);

    // ✅ CORRIGÉ 2026-03-11: Fonction pour gérer la lecture vidéo avec coordinateur
    const handleVideoPlay = useCallback((index: number) => {
        // Arrêter la vidéo précédente si elle existe
        if (playingVideoIndex !== null && playingVideoIndex !== index) {
            const previousVideoRef = videoRefs.current.get(playingVideoIndex);
            if (previousVideoRef) {
                previousVideoRef.pauseAsync().catch(() => undefined);
            }
            // Libérer la vidéo précédente avec le coordinateur
            releaseVideoWithCoordinator();
        }

        // Demander la permission de jouer la nouvelle vidéo
        const videoRef = videoRefs.current.get(index);
        if (videoRef) {
            requestVideoPlayWithCoordinator(index, () => {
                videoRef.playAsync().catch(() => undefined);
            });
        }
    }, [playingVideoIndex, requestVideoPlayWithCoordinator, releaseVideoWithCoordinator]);

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

        currentIndexRef.current = index;

        // Arrêter la vidéo précédente si on change de slide
        if (playingVideoIndex !== null && playingVideoIndex !== index) {
            const previousVideoRef = videoRefs.current.get(playingVideoIndex);
            if (previousVideoRef) {
                previousVideoRef.pauseAsync().catch(() => undefined);
            }
            setPlayingVideoIndex(null);
            videoPlayingRef.current = null;
            videoActivePlayingRef.current = null; // ✅ AJOUT: Libérer aussi la référence active
        }

        // ✅ FIX 2026-03-14: Autoplay vidéo sur scroll intra-carousel SEULEMENT si isVisible === true
        if (allMedia[index]?.type === 'video' && playingVideoIndex !== index && !isScrolling && isVisible === true) {
            videoPlayingRef.current = index;
            setTimeout(() => {
                const videoRef = videoRefs.current.get(index);
                if (videoRef && !isScrolling && videoPlayingRef.current === index && isVisible === true) {
                    handleVideoPlay(index);
                    setPlayingVideoIndex(index);
                } else {
                    videoPlayingRef.current = null;
                    videoActivePlayingRef.current = null;
                }
            }, 300);
        }
    };

    const playVideo = async (index: number) => {
        if (allMedia[index]?.type === 'video') {
            // ✅ FIX 2026-03-14: Passer par le coordinateur même pour le tap manuel
            // Empêche les lectures simultanées quand l'utilisateur tape play sur plusieurs cartes
            const videoRef = videoRefs.current.get(index);
            if (videoRef) {
                // Arrêter la vidéo précédente si elle existe
                if (playingVideoIndex !== null && playingVideoIndex !== index) {
                    const previousVideoRef = videoRefs.current.get(playingVideoIndex);
                    if (previousVideoRef) {
                        previousVideoRef.pauseAsync().catch(() => undefined);
                    }
                    releaseVideoWithCoordinator();
                }

                requestVideoPlayWithCoordinator(index, () => {
                    videoRef.setStatusAsync({ shouldPlay: true, isMuted: false }).catch(() => undefined);
                    videoRef.playAsync().catch(() => undefined);
                });
            }
        }
    };

    const openFullscreen = (media: { type: 'image' | 'video'; uri: string }) => {
        setPlayingVideoIndex(null);
        videoPlayingRef.current = null;
        videoActivePlayingRef.current = null; // ✅ AJOUT: Libérer aussi la référence active
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
        // ✅ Note: Les références vidéo sont déjà gérées par onPlaybackStatusUpdate
    };

    useEffect(() => {
        // S'assurer que la vidéo plein écran démarre quand le modal s'ouvre
        if (fullscreenMedia?.type === 'video' && fullscreenVideoRef.current) {
            fullscreenVideoRef.current.playAsync().catch(() => undefined);
        }
    }, [fullscreenMedia]);

    // ✅ CORRIGÉ 2026-03-06: Arrêter les vidéos lors du scroll avec coordinateur
    useEffect(() => {
        if (isScrolling) {
            // Arrêter toutes les vidéos de cette carte
            videoRefs.current.forEach((videoRef, mediaKey) => {
                if (videoRef) {
                    videoRef.pauseAsync().catch(() => undefined);
                }
            });

            // Libérer les références
            setPlayingVideoIndex(null);
            videoPlayingRef.current = null;
            videoActivePlayingRef.current = null; // ✅ AJOUT: Libérer aussi la référence active

            // Prévenir le parent
            if (onStopVideo) {
                onStopVideo('all');
            }
            onVideoRelease?.();
        }
    }, [isScrolling, onVideoRelease]);

    // ✅ FIX 2026-03-14: Arrêter TOUTES les vidéos quand la carte quitte l'écran
    useEffect(() => {
        if (isVisible === false) {
            videoRefs.current.forEach((videoRef) => {
                if (videoRef) {
                    videoRef.pauseAsync().catch(() => undefined);
                }
            });
            setPlayingVideoIndex(null);
            videoPlayingRef.current = null;
            videoActivePlayingRef.current = null;
            onVideoRelease?.();
        }
    }, [isVisible, onVideoRelease]);

    // ✅ FIX 2026-03-14: Auto-play la première vidéo SEULEMENT si isVisible === true et pas en scroll
    // Sans isVisible explicite, PAS d'auto-play (l'utilisateur doit taper play)
    useEffect(() => {
        if (isVisible === true && allMedia.length > 0 && allMedia[0]?.type === 'video' && !isScrolling) {
            const timer = setTimeout(() => {
                const videoRef = videoRefs.current.get(0);
                if (videoRef && videoPlayingRef.current === null && !isScrolling && isVisible === true) {
                    requestVideoPlayWithCoordinator(0, () => {
                        videoRef.playAsync().catch(() => undefined);
                    });
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [allMedia.length, isScrolling, isVisible, requestVideoPlayWithCoordinator]);

    // ✅ FIX 2026-03-14: Auto-scroll continu — NE PAS auto-play les vidéos lors du scroll automatique
    // L'auto-scroll ne fait que défiler visuellement. La lecture vidéo nécessite isVisible + coordinateur ou tap utilisateur.
    useEffect(() => {
        if (allMedia.length <= 1) return;
        // ✅ FIX 2026-03-14: Pas d'auto-scroll si la carte n'est pas visible (économie de ressources)
        if (isVisible === false) return;

        const startAutoScroll = () => {
            if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
            autoScrollTimerRef.current = setInterval(() => {
                if (userInteractingRef.current || videoActivePlayingRef.current !== null || isScrolling) {
                    return;
                }

                const curIdx = currentIndexRef.current;
                const nextIndex = (curIdx + 1) % allMedia.length;
                scrollViewRef.current?.scrollTo({ x: CAROUSEL_WIDTH * nextIndex, animated: true });
                setCurrentIndex(nextIndex);
                currentIndexRef.current = nextIndex;

                // ✅ FIX 2026-03-14: NE PAS auto-play la vidéo ici — seulement si isVisible ET coordinateur le permet
                if (allMedia[nextIndex]?.type === 'video' && isVisible === true) {
                    setTimeout(() => {
                        const videoRef = videoRefs.current.get(nextIndex);
                        if (videoRef && !isScrolling && isVisible === true) {
                            requestVideoPlayWithCoordinator(nextIndex, () => {
                                videoRef.playAsync().catch(() => undefined);
                            });
                        }
                    }, 400);
                }
            }, 4000); // ✅ FIX 2026-03-14: 4s au lieu de 2s — scroll moins agressif
        };

        const initTimer = setTimeout(startAutoScroll, 1500);

        return () => {
            clearTimeout(initTimer);
            if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
        };
    }, [allMedia.length, isScrolling, isVisible, requestVideoPlayWithCoordinator]);

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
                                    // ✅ NOUVEAU 2026-03-06: Enregistrer la ref auprès du parent
                                    const mediaKey = media.uri;
                                    if (onVideoRef && mediaKey) {
                                        onVideoRef(ref, mediaKey);
                                    }
                                } else {
                                    videoRefs.current.delete(index);
                                }
                            }}
                            source={{ uri: media.uri }}
                            style={styles.media}
                            resizeMode={ResizeMode.COVER} // ✅ CORRIGÉ: COVER au lieu de CONTAIN pour éviter les espaces noirs
                            shouldPlay={playingVideoIndex === index && !isScrolling}
                            isLooping={false}
                            isMuted={playingVideoIndex !== index}
                            useNativeControls={false}
                            onPlaybackStatusUpdate={(status) => {
                                // ✅ FIX 2026-03-14: didJustFinish en PREMIER pour poser le sentinel
                                // avant que le tracking isPlaying ne libère videoActivePlayingRef
                                if (status.isLoaded && status.didJustFinish && playingVideoIndex === index) {
                                    console.log('[ProductMediaCarousel] Vidéo terminée, passage au média suivant');

                                    // ✅ FIX BUG 1: Libérer le coordinateur pour que d'autres cartes puissent jouer
                                    releaseVideoWithCoordinator();

                                    // ✅ FIX BUG 2: Sentinel -1 pour bloquer l'auto-scroll pendant la transition
                                    // -1 !== null donc l'intervalle auto-scroll ne scrollera pas en parallèle
                                    videoActivePlayingRef.current = -1;

                                    // Passer au média suivant après un court délai
                                    setTimeout(() => {
                                        const nextIndex = (index + 1) % allMedia.length;
                                        scrollViewRef.current?.scrollTo({ x: CAROUSEL_WIDTH * nextIndex, animated: true });
                                        setCurrentIndex(nextIndex);
                                        currentIndexRef.current = nextIndex;

                                        // Libérer le sentinel après le scroll pour que l'auto-scroll reprenne
                                        setTimeout(() => {
                                            videoActivePlayingRef.current = null;
                                            userInteractingRef.current = false;
                                        }, 800);
                                    }, 500);
                                } else if (status.isLoaded) {
                                    // ✅ Tracking isPlaying — seulement si PAS didJustFinish (évite d'écraser le sentinel -1)
                                    if (status.isPlaying && playingVideoIndex === index) {
                                        videoActivePlayingRef.current = index;
                                    } else if (!status.isPlaying && videoActivePlayingRef.current === index) {
                                        // Pause normale (pas fin de vidéo) → libérer
                                        videoActivePlayingRef.current = null;
                                    }
                                }
                            }}
                            onError={(error: any) => {
                                const errorMessage = (error as any)?.message || String(error);
                                if (!errorMessage.includes('404')) {
                                    console.error('[ProductMediaCarousel] ❌ Erreur vidéo:', error);
                                }
                                setPlayingVideoIndex(null);
                                videoPlayingRef.current = null;
                                videoActivePlayingRef.current = null; // ✅ AJOUT: Libérer aussi la référence active
                            }}
                        />
                        {/* Overlay sombre + icône quand la vidéo n'est pas en lecture */}
                        {playingVideoIndex !== index && (
                            <View style={styles.videoOverlay} pointerEvents="none" />
                        )}
                        <TouchableOpacity
                            style={styles.fullscreenButton}
                            onPress={() => openFullscreen(media)}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="maximize" size={18} color="#FFF" />
                        </TouchableOpacity>
                        {playingVideoIndex !== index ? (
                            <TouchableOpacity
                                style={styles.playButton}
                                onPress={() => playVideo(index)}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="play" size={48} color="#FFF" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.pauseButton}
                                onPress={() => {
                                    const videoRef = videoRefs.current.get(index);
                                    if (videoRef) { videoRef.pauseAsync().catch(() => undefined); }
                                    // Libérer avec le coordinateur
                                    releaseVideoWithCoordinator();
                                }}
                                activeOpacity={0.8}
                            >
                                <SafeIcon name="pause" size={28} color="#FFF" />
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
                        scrollEventThrottle={16}
                        decelerationRate="fast"
                        snapToInterval={CAROUSEL_WIDTH}
                        snapToAlignment="start"
                        nestedScrollEnabled={true}
                        bounces={false}
                        onScrollBeginDrag={() => { userInteractingRef.current = true; }}
                        onScrollEndDrag={() => { setTimeout(() => { userInteractingRef.current = false; }, 1500); }}
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
                                resizeMode={ResizeMode.COVER} // ✅ CORRIGÉ: COVER pour cohérence et éviter les espaces
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
    videoContainer: {
        width: '100%',
        height: '100%',
        overflow: 'hidden', // ✅ CORRIGÉ: Assurer que le rognage est contenu dans les limites
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        position: 'relative',
    },
    media: {
        width: '100%',
        height: '100%',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        backgroundColor: '#1a1a2e', // ✅ CORRIGÉ: Background pour les vidéos sans média
        // ✅ CORRIGÉ: Positionnement pour minimiser le rognage visible avec COVER
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
    pauseButton: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        borderRadius: 16,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 6,
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


