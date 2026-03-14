import { useIsFocused, useNavigation } from '@react-navigation/native';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { config } from '../config/environment';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.82;
const CARD_MARGIN = 16;
const AUTO_SCROLL_INTERVAL = 6000;

interface PublicitesCarouselProps {
    userId?: string;
    userBehavior?: string[];
}

interface PubliciteVideoMeta {
    format?: string | null;
    source?: string | null;
    duration_ms?: number | null;
    ai_generated?: boolean | null;
}

interface ApiPublicite {
    id: string;
    titre?: string;
    description?: string;
    produits?: any[];
    videos_meta?: PubliciteVideoMeta[];
    video_stats?: Record<string, any>;
    [key: string]: any;
}

const looksLikeBase64 = (value?: string | null): boolean => {
    if (!value || typeof value !== 'string') {
        return false;
    }
    const sanitized = value.replace(/\s/g, '');
    if (sanitized.startsWith('data:')) {
        return false;
    }
    return sanitized.length > 64 && /^[A-Za-z0-9+/=]+$/.test(sanitized);
};

const toVideoUri = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith('data:video')) {
        return trimmed;
    }
    if (trimmed.startsWith('/')) {
        const base = (config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
        if (base) {
            return `${base}/${trimmed.replace(/^\//, '')}`;
        }
    }
    if (trimmed.startsWith('uploads/')) {
        const base = (config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
        if (base) {
            return `${base}/${trimmed}`;
        }
    }
    return null;
};

const toImageUri = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.startsWith('data:image')) {
        return trimmed;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (looksLikeBase64(trimmed)) {
        return `data:image/jpeg;base64,${trimmed}`;
    }
    if (trimmed.startsWith('/')) {
        const base = (config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
        if (base) {
            return `${base}/${trimmed.replace(/^\//, '')}`;
        }
    }
    if (trimmed.startsWith('uploads/')) {
        const base = (config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
        if (base) {
            return `${base}/${trimmed}`;
        }
    }
    return null;
};

const resolveVideoSource = (pub: ApiPublicite): string | null => {
    const candidates: Array<string | null | undefined> = [
        pub?.square_video_url,
        pub?.squareVideoUrl,
        pub?.video_square_url,
        pub?.videoSquareUrl,
        pub?.primary_square_video,
        pub?.video_url,
        pub?.videoUrl,
    ];

    if (Array.isArray(pub?.video_urls)) {
        candidates.push(...pub.video_urls);
    }

    if (Array.isArray(pub?.videos)) {
        const prioritized = pub.videos.filter((video: string) =>
            typeof video === 'string' && (video.toLowerCase().includes('square') || video.toLowerCase().includes('1x1'))
        );
        candidates.push(...prioritized, ...pub.videos);
    }

    const variants = pub?.video_variants || pub?.videoVariants || pub?.additional_outputs;
    if (Array.isArray(variants)) {
        variants.forEach((variant: any) => {
            if (!variant) {
                return;
            }
            const format = String(variant.format || variant.type || '').toLowerCase();
            const url = variant.video_url || variant.url || variant.path;
            if (format.includes('square') || format.includes('1x1') || format.includes('feed') || format.includes('carre')) {
                candidates.push(url);
            }
        });
    } else if (variants && typeof variants === 'object') {
        ['square', '1x1', 'feed', 'carre'].forEach((key) => {
            const data = variants[key];
            if (!data) {
                return;
            }
            if (typeof data === 'string') {
                candidates.push(data);
            } else if (typeof data === 'object') {
                candidates.push(data.video_url || data.url || data.path);
            }
        });
    }

    for (const candidate of candidates) {
        const uri = toVideoUri(candidate);
        if (uri) {
            return uri;
        }
    }
    return null;
};

const resolveThumbnail = (pub: ApiPublicite): string | null => {
    const candidates: Array<string | null | undefined> = [];

    if (Array.isArray(pub?.thumbnails)) {
        const firstThumb = pub.thumbnails.find((thumb: unknown) => typeof thumb === 'string' && thumb.trim().length > 0);
        if (firstThumb) {
            candidates.push(firstThumb);
        }
    }

    candidates.push(pub?.thumbnail, pub?.preview_image, pub?.previewImage, pub?.cover_image);

    if (Array.isArray(pub?.produits) && pub.produits.length > 0) {
        const firstProduct = pub.produits[0];
        if (Array.isArray(firstProduct?.images)) {
            const productImage = firstProduct.images.find((img: unknown) => typeof img === 'string' && img.length > 0);
            if (productImage) {
                candidates.push(
                    productImage.startsWith('data:image')
                        ? productImage
                        : `data:image/jpeg;base64,${productImage}`,
                );
            }
        }
    }

    for (const candidate of candidates) {
        const uri = toImageUri(candidate);
        if (uri) {
            return uri;
        }
    }
    return null;
};

const getCategoryIcon = (type: string): string => {
    const icons: Record<string, string> = {
        immobilier_batiment: '🏠',
        immobilier_terrain: '🏞️',
        hotellerie: '🏨',
        automobile: '🚗',
        ticket_voyage: '🎫',
        telephone: '📱',
        ordinateur: '💻',
        vetement: '👔',
        electromenager: '🔌',
        mobilier: '🪑',
        pharmacie: '💊',
        default: '📦',
    };
    return icons[type] || icons.default;
};

const getPrimaryVideoMeta = (pub: ApiPublicite, hasVideo: boolean): { format: string; source: string } => {
    const metas = Array.isArray(pub.videos_meta) ? pub.videos_meta : [];
    if (metas.length > 0) {
        const preferred =
            metas.find((meta) => {
                const hasFormat = typeof meta.format === 'string' && meta.format.trim().length > 0;
                const hasSource = typeof meta.source === 'string' && meta.source.trim().length > 0;
                return hasFormat || hasSource;
            }) ?? metas[0];

        const aiHint =
            preferred.ai_generated ??
            (typeof preferred.source === 'string' && preferred.source.toLowerCase().includes('ai'));

        const format =
            typeof preferred.format === 'string' && preferred.format.trim().length > 0
                ? preferred.format.trim().toLowerCase()
                : aiHint
                    ? 'square'
                    : hasVideo
                        ? 'video'
                        : 'image';

        const source =
            typeof preferred.source === 'string' && preferred.source.trim().length > 0
                ? preferred.source.trim().toLowerCase()
                : aiHint
                    ? 'ai'
                    : hasVideo
                        ? 'manual'
                        : 'image';

        return { format, source };
    }

    if (hasVideo) {
        return { format: 'video', source: 'unknown' };
    }

    return { format: 'image', source: 'image' };
};

const PublicitesCarousel: React.FC<PublicitesCarouselProps> = ({ userId, userBehavior = [] }) => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { t } = useLanguageSafe();
    const scrollViewRef = useRef<ScrollView>(null);
    const videoRefs = useRef<Record<string, Video | null>>({});
    const viewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewedRef = useRef<Set<string>>(new Set());

    const [publicites, setPublicites] = useState<ApiPublicite[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [videoReady, setVideoReady] = useState<Record<string, boolean>>({});
    const [failedVideos, setFailedVideos] = useState<Record<string, boolean>>({});
    const [needsManualPlay, setNeedsManualPlay] = useState<Record<string, boolean>>({});

    const orderedPublicites = useMemo(() => publicites ?? [], [publicites]);

    const loadPublicites = useCallback(async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            // ✅ SÉCURITÉ: Vérifier que userBehavior est un array valide
            if (Array.isArray(userBehavior) && userBehavior.length > 0) {
                try {
                    params.append('categories', userBehavior.join(','));
                } catch (e) {
                    console.warn('[PublicitesCarousel] Erreur ajout catégories:', e);
                }
            }
            if (userId) {
                try {
                    params.append('user_id', String(userId));
                } catch (e) {
                    console.warn('[PublicitesCarousel] Erreur ajout user_id:', e);
                }
            }
            // ✅ NOUVEAU: Ajouter placement (par défaut: "feed")
            params.append('placement', 'feed');

            // ✅ SÉCURITÉ: Timeout pour éviter les appels API bloquants
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 10000); // 10s timeout
            });

            try {
                const response = await Promise.race([
                    apiGet(`/api/publicites/actives?${params.toString()}`),
                    timeoutPromise,
                ]) as any;

                if (response && response.success && response.data) {
                    let pubs = Array.isArray(response.data) ? response.data : [];

                    // ✅ SÉCURITÉ: Trier seulement si on a des pubs et des catégories valides
                    if (Array.isArray(userBehavior) && userBehavior.length > 0 && pubs.length > 0) {
                        try {
                            pubs = pubs.sort((a: ApiPublicite, b: ApiPublicite) => {
                                try {
                                    const produitsA = Array.isArray(a.produits) ? a.produits : [];
                                    const produitsB = Array.isArray(b.produits) ? b.produits : [];
                                    const scoreA = produitsA.filter((p: any) =>
                                        p && typeof p === 'object' && userBehavior.includes(p.type)
                                    ).length;
                                    const scoreB = produitsB.filter((p: any) =>
                                        p && typeof p === 'object' && userBehavior.includes(p.type)
                                    ).length;
                                    return scoreB - scoreA;
                                } catch (e) {
                                    console.warn('[PublicitesCarousel] Erreur tri:', e);
                                    return 0;
                                }
                            });
                        } catch (e) {
                            console.warn('[PublicitesCarousel] Erreur lors du tri:', e);
                        }
                    }

                    // ✅ SÉCURITÉ: Normaliser avec vérifications
                    const normalized = pubs
                        .filter((pub: any) => pub && (pub.id || pub.publicite_id))
                        .map((pub: ApiPublicite) => {
                            try {
                                const id = String(pub.id ?? pub.publicite_id ?? Math.random().toString(36).slice(2));
                                return {
                                    ...pub,
                                    id,
                                    videos_meta: Array.isArray(pub.videos_meta) ? pub.videos_meta : [],
                                    video_stats: pub.video_stats && typeof pub.video_stats === 'object' ? pub.video_stats : {},
                                };
                            } catch (e) {
                                console.warn('[PublicitesCarousel] Erreur normalisation pub:', e);
                                return null;
                            }
                        })
                        .filter((pub: any) => pub !== null);

                    setPublicites(normalized);
                    setCurrentIndex(0);
                    setVideoReady({});
                    setFailedVideos({});
                    setNeedsManualPlay({});
                    viewedRef.current.clear();
                } else {
                    setPublicites([]);
                }
            } catch (apiError: any) {
                if (apiError?.message === 'Timeout') {
                    console.warn('[PublicitesCarousel] Timeout chargement publicités');
                } else {
                    console.error('[PublicitesCarousel] Erreur API:', apiError);
                }
                setPublicites([]);
            }
        } catch (error) {
            console.error('[PublicitesCarousel] Erreur chargement:', error);
            setPublicites([]);
        } finally {
            setLoading(false);
        }
    }, [userBehavior, userId]);

    useEffect(() => {
        loadPublicites();
    }, [loadPublicites]);

    useEffect(() => {
        // ✅ SÉCURITÉ: Ne pas auto-scroll si pas focus ou moins de 2 items
        if (!isFocused || !orderedPublicites || orderedPublicites.length <= 1) {
            return;
        }

        // ✅ SÉCURITÉ: Vérifier que scrollViewRef est valide
        const interval = setInterval(() => {
            try {
                if (!scrollViewRef.current) {
                    return;
                }

                setCurrentIndex((prev) => {
                    try {
                        const nextIndex = (prev + 1) % orderedPublicites.length;
                        scrollViewRef.current?.scrollTo({
                            x: nextIndex * (CARD_WIDTH + CARD_MARGIN),
                            animated: true,
                        });
                        return nextIndex;
                    } catch (e) {
                        console.warn('[PublicitesCarousel] Erreur calcul index:', e);
                        return prev;
                    }
                });
            } catch (e) {
                console.warn('[PublicitesCarousel] Erreur interval scroll:', e);
            }
        }, AUTO_SCROLL_INTERVAL);

        return () => {
            try {
                clearInterval(interval);
            } catch (e) {
                console.warn('[PublicitesCarousel] Erreur nettoyage interval:', e);
            }
        };
    }, [orderedPublicites.length, isFocused]);

    useEffect(() => {
        const activePub = orderedPublicites[currentIndex];
        Object.entries(videoRefs.current).forEach(([id, ref]) => {
            if (!ref) {
                return;
            }

            if (!isFocused || !activePub || String(activePub.id) !== id) {
                ref.pauseAsync().catch(() => undefined);
                ref.setPositionAsync(0).catch(() => undefined);
                return;
            }

            ref.playAsync()
                .then(() => {
                    setNeedsManualPlay((prev) => ({ ...prev, [id]: false }));
                })
                .catch(() => {
                    setNeedsManualPlay((prev) => ({ ...prev, [id]: true }));
                });
        });
    }, [currentIndex, isFocused, orderedPublicites]);

    useEffect(() => {
        if (viewTimeoutRef.current) {
            clearTimeout(viewTimeoutRef.current);
            viewTimeoutRef.current = null;
        }

        const activePub = orderedPublicites[currentIndex];
        if (!activePub) {
            return;
        }
        const pubId = String(activePub.id);
        if (viewedRef.current.has(pubId)) {
            return;
        }

        viewTimeoutRef.current = setTimeout(() => {
            viewedRef.current.add(pubId);
            const hasVideo = Boolean(resolveVideoSource(activePub));
            const primaryMeta = getPrimaryVideoMeta(activePub, hasVideo);
            apiPost('/api/publicites/track-view', {
                publicite_id: Number(pubId),
                user_id: userId,
                video_format: primaryMeta.format,
                video_source: primaryMeta.source,
            }).catch(() => undefined);
        }, 2000);

        return () => {
            if (viewTimeoutRef.current) {
                clearTimeout(viewTimeoutRef.current);
                viewTimeoutRef.current = null;
            }
        };
    }, [currentIndex, orderedPublicites, userId]);

    const handlePlaybackStatus = useCallback(
        (pubId: string) => (status: AVPlaybackStatus) => {
            if (!status.isLoaded) {
                return;
            }
            setVideoReady((prev) => {
                if (prev[pubId]) {
                    return prev;
                }
                return { ...prev, [pubId]: true };
            });

            if (status.didJustFinish) {
                const ref = videoRefs.current[pubId];
                if (ref) {
                    ref.setPositionAsync(0).then(() => {
                        if (isFocused) {
                            ref.playAsync().catch(() => undefined);
                        }
                    }).catch(() => undefined);
                }
            }
        },
        [isFocused],
    );

    // Fonction pour parser produits_indexes et extraire service_id + product_index
    const parseProductIndex = useCallback((indexStr: string): { serviceId: number; productIndex: number } | null => {
        if (!indexStr || typeof indexStr !== 'string') return null;
        const parts = indexStr.split('_');
        if (parts.length >= 2) {
            const serviceId = parseInt(parts[0], 10);
            const productIndex = parseInt(parts[1], 10);
            if (!isNaN(serviceId) && !isNaN(productIndex)) {
                return { serviceId, productIndex };
            }
        }
        return null;
    }, []);

    // Handler pour le CTA (bouton "Voir le produit")
    const handleCTAClick = useCallback(
        async (pub: ApiPublicite, event?: any) => {
            if (event) {
                event.stopPropagation();
            }

            try {
                const hasVideo = Boolean(resolveVideoSource(pub));
                const primaryMeta = getPrimaryVideoMeta(pub, hasVideo);
                await apiPost('/api/publicites/track-click', {
                    publicite_id: Number(pub.id),
                    user_id: userId,
                    video_format: primaryMeta.format,
                    video_source: primaryMeta.source,
                });

                // Essayer d'abord avec produits_indexes (format "service_id_product_index")
                if (Array.isArray(pub.produits_indexes) && pub.produits_indexes.length > 0) {
                    const firstIndex = pub.produits_indexes[0];
                    const parsed = parseProductIndex(firstIndex);
                    if (parsed) {
                        // Navigation vers ProductDetail avec service_id + product_index
                        (navigation as any).navigate('ProductDetail', {
                            serviceId: parsed.serviceId,
                            productIndex: parsed.productIndex,
                        });
                        return;
                    }
                }

                // Fallback: utiliser produits enrichis si disponibles
                if (Array.isArray(pub.produits) && pub.produits.length > 0) {
                    const firstProduct = pub.produits[0];
                    if (firstProduct?.serviceId) {
                        // Si productIndex est disponible dans le produit enrichi
                        if (firstProduct.productIndex !== undefined) {
                            (navigation as any).navigate('ProductDetail', {
                                serviceId: firstProduct.serviceId,
                                productIndex: firstProduct.productIndex,
                            });
                        } else if (firstProduct.id) {
                            // Fallback vers ServiceDetail si productIndex n'est pas disponible
                            (navigation as any).navigate('ServiceDetail', {
                                serviceId: firstProduct.serviceId,
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('[PublicitesCarousel] Erreur tracking clic CTA:', error);
            }
        },
        [navigation, userId, parseProductIndex],
    );

    const handlePubliciteClick = useCallback(
        async (pub: ApiPublicite) => {
            try {
                const hasVideo = Boolean(resolveVideoSource(pub));
                const primaryMeta = getPrimaryVideoMeta(pub, hasVideo);
                await apiPost('/api/publicites/track-click', {
                    publicite_id: Number(pub.id),
                    user_id: userId,
                    video_format: primaryMeta.format,
                    video_source: primaryMeta.source,
                });

                // Par défaut, naviguer vers le produit via CTA
                handleCTAClick(pub);
            } catch (error) {
                console.error('[PublicitesCarousel] Erreur tracking clic:', error);
            }
        },
        [navigation, userId, handleCTAClick],
    );

    const handleRetryVideo = useCallback(
        (cardId: string, videoUri: string | null) => {
            if (!videoUri) {
                return;
            }
            setFailedVideos((prev) => ({ ...prev, [cardId]: false }));
            setNeedsManualPlay((prev) => ({ ...prev, [cardId]: false }));

            const ref = videoRefs.current[cardId];
            if (ref) {
                ref.setStatusAsync({ shouldPlay: true, isMuted }).catch(() => {
                    setNeedsManualPlay((prev) => ({ ...prev, [cardId]: true }));
                });
            }
        },
        [isMuted],
    );

    const handleManualPlay = useCallback((cardId: string) => {
        const ref = videoRefs.current[cardId];
        if (!ref) {
            return;
        }

        ref.playAsync()
            .then(() => {
                setNeedsManualPlay((prev) => ({ ...prev, [cardId]: false }));
            })
            .catch(() => {
                setNeedsManualPlay((prev) => ({ ...prev, [cardId]: true }));
            });
    }, []);

    // ✅ SÉCURITÉ: Retourner null de manière sûre
    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>✨ {t('publicite.promotions')}</Text>
                </View>
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                </View>
            </View>
        );
    }

    // ✅ SÉCURITÉ: Ne pas afficher si pas de publicités
    if (!orderedPublicites || orderedPublicites.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>✨ {t('publicite.promotions')}</Text>
                <Text style={styles.headerSubtitle}>
                    {userBehavior.length > 0
                        ? t('publicite.selected_for_you')
                        : t('publicite.discover_offers')}
                </Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={CARD_WIDTH + CARD_MARGIN}
                snapToAlignment="start"
                contentContainerStyle={styles.scrollContent}
                onMomentumScrollEnd={(event) => {
                    const newIndex = Math.round(
                        event.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_MARGIN),
                    );
                    setCurrentIndex(newIndex);
                }}
            >
                {orderedPublicites.map((pub) => {
                    const cardId = String(pub.id);
                    const videoUri = resolveVideoSource(pub);
                    const thumbnailUri = resolveThumbnail(pub);
                    const isActive = orderedPublicites[currentIndex]?.id === pub.id;
                    const isVideoFailed = failedVideos[cardId];
                    const requiresManualPlay = needsManualPlay[cardId];

                    return (
                        <TouchableOpacity
                            key={cardId}
                            activeOpacity={0.92}
                            onPress={() => handlePubliciteClick(pub)}
                            style={[styles.card, { width: CARD_WIDTH, marginRight: CARD_MARGIN }]}
                        >
                            <View style={styles.mediaSection}>
                                {videoUri && !isVideoFailed ? (
                                    <>
                                        <Video
                                            ref={(ref) => {
                                                videoRefs.current[cardId] = ref;
                                            }}
                                            source={{ uri: videoUri }}
                                            style={styles.video}
                                            resizeMode={ResizeMode.COVER}
                                            shouldPlay={isFocused && isActive && !requiresManualPlay}
                                            isLooping
                                            isMuted={isMuted}
                                            onError={() => {
                                                setFailedVideos((prev) => ({ ...prev, [cardId]: true }));
                                            }}
                                            onPlaybackStatusUpdate={(status) => {
                                                handlePlaybackStatus(cardId)(status);
                                                if (!status.isLoaded && 'error' in status && status.error) {
                                                    setFailedVideos((prev) => ({ ...prev, [cardId]: true }));
                                                }
                                            }}
                                        />
                                        {!videoReady[cardId] && (
                                            <View style={styles.loadingOverlay}>
                                                <ActivityIndicator size="small" color="#fff" />
                                            </View>
                                        )}
                                        {requiresManualPlay && (
                                            <TouchableOpacity
                                                activeOpacity={0.9}
                                                style={styles.manualPlayOverlay}
                                                onPress={(event) => {
                                                    event.stopPropagation();
                                                    handleManualPlay(cardId);
                                                }}
                                            >
                                                <SafeIcon name="play" size={28} color="#fff" />
                                                <Text style={styles.manualPlayText}>
                                                    {t('publicite.play_video') ?? 'Lire la vidéo'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        {/* Overlay CTA cliquable sur la vidéo */}
                                        <TouchableOpacity
                                            activeOpacity={0.9}
                                            style={styles.ctaOverlay}
                                            onPress={(event) => {
                                                event.stopPropagation();
                                                handleCTAClick(pub, event);
                                            }}
                                        >
                                            <View style={styles.ctaOverlayContent}>
                                                <Text style={styles.ctaOverlayText}>Voir le produit</Text>
                                                <SafeIcon name="arrow-right" size={18} color="#fff" />
                                            </View>
                                        </TouchableOpacity>
                                        <View style={styles.badgesRow}>
                                            <View style={styles.squareBadge}>
                                                <Text style={styles.squareBadgeText}>1:1</Text>
                                            </View>
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={(event) => {
                                                    event.stopPropagation();
                                                    setIsMuted((prev) => !prev);
                                                }}
                                                style={styles.soundToggle}
                                            >
                                                <SafeIcon
                                                    name={isMuted ? 'volume-x' : 'volume-2'}
                                                    size={16}
                                                    color="#fff"
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                ) : thumbnailUri ? (
                                    <Image source={{ uri: thumbnailUri }} style={styles.fallbackImage} />
                                ) : (
                                    <View style={styles.fallbackMedia}>
                                        <SafeIcon name="image" size={42} color="#CBD5F5" />
                                    </View>
                                )}

                                {isVideoFailed && (
                                    <TouchableOpacity
                                        activeOpacity={0.9}
                                        style={styles.manualPlayOverlay}
                                        onPress={(event) => {
                                            event.stopPropagation();
                                            handleRetryVideo(cardId, videoUri);
                                        }}
                                    >
                                        <SafeIcon name="refresh-cw" size={26} color="#fff" />
                                        <Text style={styles.manualPlayText}>
                                            {t('publicite.retry_video') ?? 'Relancer la vidéo'}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {pub.produits?.[0]?.type ? (
                                    <View style={styles.categoryBadge}>
                                        <Text style={styles.categoryBadgeText}>
                                            {getCategoryIcon(pub.produits[0].type)}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <View style={styles.contentSection}>
                                <Text style={styles.title} numberOfLines={2}>
                                    {pub.titre || 'Promotion Yukpo'}
                                </Text>
                                {pub.description ? (
                                    <Text style={styles.description} numberOfLines={2}>
                                        {pub.description}
                                    </Text>
                                ) : null}

                                <View style={styles.metricsRow}>
                                    <View style={styles.metric}>
                                        <SafeIcon name="package" size={14} color={modernColors.textSecondary} />
                                        <Text style={styles.metricText}>
                                            {(pub.produits?.length || 0).toString()} {t('publicite.products')}
                                        </Text>
                                    </View>
                                    {pub.produits?.[0]?.prix ? (
                                        <View style={styles.metric}>
                                            <SafeIcon name="tag" size={14} color={modernColors.textSecondary} />
                                            <Text style={styles.metricText}>
                                                À partir de {pub.produits[0].prix} FCFA
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>

                                <View style={styles.footerRow}>
                                    <View style={styles.zonePill}>
                                        <SafeIcon
                                            name={pub.zone_geographique === 'local' ? 'map-pin' : 'globe'}
                                            size={12}
                                            color='#fff'
                                        />
                                        <Text style={styles.zoneText}>
                                            {pub.zone_geographique === 'local'
                                                ? t('publicite.zone.local')
                                                : pub.zone_geographique === 'regional'
                                                    ? t('publicite.zone.regional')
                                                    : t('publicite.zone.international')}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        style={styles.ctaPill}
                                        onPress={(event) => handleCTAClick(pub, event)}
                                    >
                                        <Text style={styles.ctaText}>Voir le produit</Text>
                                        <SafeIcon name="arrow-right" size={14} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {orderedPublicites.length > 1 ? (
                <View style={styles.pagination}>
                    {orderedPublicites.map((pub, index) => (
                        <TouchableOpacity
                            key={String(pub.id)}
                            onPress={() => {
                                scrollViewRef.current?.scrollTo({
                                    x: index * (CARD_WIDTH + CARD_MARGIN),
                                    animated: true,
                                });
                                setCurrentIndex(index);
                            }}
                            style={[
                                styles.paginationDot,
                                index === currentIndex && styles.paginationDotActive,
                            ]}
                        />
                    ))}
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 4,
    },
    card: {
        borderRadius: 22,
        backgroundColor: modernColors.surface,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 6,
    },
    mediaSection: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#0F172A',
        position: 'relative',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    manualPlayOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    manualPlayText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    badgesRow: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    squareBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
    },
    squareBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        letterSpacing: 0.4,
    },
    soundToggle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallbackMedia: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1E293B',
    },
    fallbackImage: {
        width: '100%',
        height: '100%',
    },
    categoryBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 4,
    },
    categoryBadgeText: {
        fontSize: 22,
    },
    contentSection: {
        paddingHorizontal: 18,
        paddingVertical: 16,
        gap: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        color: modernColors.textSecondary,
    },
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    metric: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metricText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    zonePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#312E81',
    },
    zoneText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    ctaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: modernColors.primary,
    },
    ctaText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    ctaOverlay: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 10,
    },
    ctaOverlayContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: 'rgba(99, 102, 241, 0.95)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    ctaOverlayText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.3,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.border,
    },
    paginationDotActive: {
        width: 26,
        backgroundColor: modernColors.primary,
    },
});

export default PublicitesCarousel;

