import { ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { API_BASE_URL } from '../config/api.config';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 80; // Largeur avec padding

interface VideoExampleModalProps {
    visible: boolean;
    onClose: () => void;
    onStartCreation: () => void;
}

type VideoStyle = 'tiktok' | 'story' | 'cinematic' | 'carousel';

interface VideoExample {
    id: string;
    style: VideoStyle;
    label: string;
    description: string;
    icon: string;
    videoUrl: string;
    thumbnail?: string;
    stats: {
        views: string;
        engagement: string;
        creationTime: string;
    };
    features: string[];
    // ✅ NOUVEAU: Champs pour les données réelles
    realVideoId?: string;
    loadedFromApi?: boolean;
}

// ✅ NOUVEAU: Collection d'exemples avec les 4 styles
// Les exemples réels seront chargés depuis l'API et remplaceront ces valeurs par défaut
const VIDEO_EXAMPLES: VideoExample[] = [
    {
        id: 'tiktok',
        style: 'tiktok',
        label: 'TikTok Boost',
        description: 'Transitions rapides, texte dynamique, format vertical 9:16',
        icon: '🎬',
        videoUrl: `${API_BASE_URL}/api/media/examples/tiktok-demo.mp4`,
        thumbnail: `${API_BASE_URL}/api/media/examples/tiktok-thumbnail.jpg`, // ✅ Thumbnail par défaut
        stats: {
            views: '2.5K',
            engagement: '15%',
            creationTime: '3 min',
        },
        features: ['Format vertical 9:16', 'Transitions rapides', 'Texte dynamique', 'Optimisé TikTok/Reels'],
    },
    {
        id: 'story',
        style: 'story',
        label: 'Story Produit',
        description: 'Narration douce, highlight des atouts, superpositions élégantes',
        icon: '📚',
        videoUrl: `${API_BASE_URL}/api/media/examples/story-demo.mp4`,
        thumbnail: `${API_BASE_URL}/api/media/examples/story-thumbnail.jpg`, // ✅ Thumbnail par défaut
        stats: {
            views: '1.8K',
            engagement: '22%',
            creationTime: '4 min',
        },
        features: ['Narration douce', 'Superpositions élégantes', 'Mise en avant produits', 'Idéal Instagram Stories'],
    },
    {
        id: 'cinematic',
        style: 'cinematic',
        label: 'Ciné Premium',
        description: 'Animations lentes, focus sur détails, ambiance immersive',
        icon: '🎨',
        videoUrl: `${API_BASE_URL}/api/media/examples/cinematic-demo.mp4`,
        thumbnail: `${API_BASE_URL}/api/media/examples/cinematic-thumbnail.jpg`, // ✅ Thumbnail par défaut
        stats: {
            views: '3.2K',
            engagement: '18%',
            creationTime: '5 min',
        },
        features: ['Animations lentes', 'Ambiance immersive', 'Focus sur détails', 'Premium qualité'],
    },
    {
        id: 'carousel',
        style: 'carousel',
        label: 'Carousel Flash',
        description: 'Slides punchy, CTA répétés, idéal publicités express',
        icon: '🔄',
        videoUrl: `${API_BASE_URL}/api/media/examples/carousel-demo.mp4`,
        thumbnail: `${API_BASE_URL}/api/media/examples/carousel-thumbnail.jpg`, // ✅ Thumbnail par défaut
        stats: {
            views: '1.5K',
            engagement: '25%',
            creationTime: '2 min',
        },
        features: ['Slides punchy', 'CTA répétés', 'Création rapide', 'Idéal publicités'],
    },
];

const VideoExampleModal: React.FC<VideoExampleModalProps> = ({
    visible,
    onClose,
    onStartCreation,
}) => {
    const [examples, setExamples] = useState<VideoExample[]>(VIDEO_EXAMPLES);
    const [loadingExamples, setLoadingExamples] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});
    const [videoLoading, setVideoLoading] = useState<Record<string, boolean>>(
        VIDEO_EXAMPLES.reduce((acc, example) => {
            acc[example.id] = true;
            return acc;
        }, {} as Record<string, boolean>)
    );
    const flatListRef = useRef<FlatList>(null);

    // ✅ NOUVEAU: Fonction helper pour extraire le style depuis les métadonnées vidéo
    const extractStyleFromVideo = useCallback((videoData: any): VideoStyle => {
        const style = videoData.video_style || videoData.style_preset || videoData.style;
        if (['tiktok', 'story', 'cinematic', 'carousel'].includes(style)) {
            return style as VideoStyle;
        }
        // Détection heuristique basée sur le format
        if (videoData.format?.includes('vertical') || videoData.format?.includes('9:16')) {
            return 'tiktok';
        }
        if (videoData.format?.includes('square') || videoData.format?.includes('1:1')) {
            return 'carousel';
        }
        return 'story'; // Par défaut
    }, []);

    // ✅ NOUVEAU: Formater les nombres
    const formatNumber = useCallback((num: number): string => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return String(num);
    }, []);

    // ✅ NOUVEAU: Calculer le taux d'engagement
    const calculateEngagementRate = useCallback((video: any): string => {
        const views = video.views || 0;
        const likes = video.likes || 0;
        const shares = video.shares || 0;
        const totalEngagement = likes + shares;

        if (views === 0) return '0%';
        const rate = (totalEngagement / views) * 100;
        return `${rate.toFixed(0)}%`;
    }, []);

    // ✅ NOUVEAU: Calculer le taux d'engagement depuis les stats API
    const calculateEngagementRateFromStats = useCallback((stats: any): string => {
        const views = stats.views || stats.impressions || 0;
        const likes = stats.likes || 0;
        const saves = stats.saves || 0;
        const totalEngagement = likes + saves;

        if (views === 0) return '0%';
        const rate = (totalEngagement / views) * 100;
        return `${rate.toFixed(0)}%`;
    }, []);

    // ✅ NOUVEAU: Charger les exemples réels depuis l'API
    const loadRealExamples = useCallback(async () => {
        setLoadingExamples(true);
        try {
            // 1. Charger les vidéos depuis l'API
            const videosResponse = await apiGet('/api/videos/my-videos');
            const showcaseResponse = await apiGet('/api/content/mixed?limit=20&include_videos=true');

            const allVideos: any[] = [];

            // Ajouter les vidéos de l'utilisateur
            if (videosResponse.success && Array.isArray(videosResponse.data)) {
                allVideos.push(...videosResponse.data.map((v: any) => ({ ...v, source: 'my-videos' })));
            }

            // Ajouter les vidéos du feed (meilleures performances)
            if (showcaseResponse.success && Array.isArray(showcaseResponse.data)) {
                showcaseResponse.data.forEach((item: any) => {
                    const video = item?.videos?.[0] || item?.video_url || item?.videoUrl;
                    if (video) {
                        allVideos.push({
                            id: item.id || `showcase-${Math.random()}`,
                            video_url: video,
                            thumbnail: item.thumbnails?.[0] || item.thumbnail || item.images?.[0],
                            service_id: item.service_id || item.serviceId,
                            description: item.description || item.titre || item.nom,
                            style_preset: item.video_style || item.style_preset || extractStyleFromVideo(item),
                            views: item.views || item.engagement?.views || 0,
                            likes: item.likes || item.engagement?.likes || 0,
                            source: 'showcase',
                        });
                    }
                });
            }

            // 2. Grouper par style et prendre la meilleure vidéo de chaque style
            const examplesByStyle = VIDEO_EXAMPLES.map(defaultExample => {
                const styleVideos = allVideos.filter(v => {
                    const videoStyle = v.style_preset || 'story';
                    return videoStyle === defaultExample.style;
                });

                // Trier par performance (views + engagement)
                const sortedVideos = styleVideos.sort((a, b) => {
                    const scoreA = (a.views || 0) + (a.likes || 0) * 10;
                    const scoreB = (b.views || 0) + (b.likes || 0) * 10;
                    return scoreB - scoreA;
                });

                const bestVideo = sortedVideos[0];

                if (bestVideo && bestVideo.video_url) {
                    // Charger les statistiques d'engagement pour cette vidéo
                    return {
                        ...defaultExample,
                        videoUrl: bestVideo.video_url,
                        thumbnail: bestVideo.thumbnail || defaultExample.thumbnail,
                        realVideoId: bestVideo.id,
                        loadedFromApi: true,
                        stats: {
                            views: formatNumber(bestVideo.views || 0),
                            engagement: calculateEngagementRate(bestVideo),
                            creationTime: defaultExample.stats.creationTime, // Garder le temps par défaut
                        },
                    };
                }

                return defaultExample;
            });

            setExamples(examplesByStyle);

            // 3. Charger les statistiques d'engagement pour les vidéos trouvées
            const videoIdsWithRealData = examplesByStyle
                .filter(ex => ex.realVideoId)
                .map(ex => ex.realVideoId!);

            if (videoIdsWithRealData.length > 0) {
                try {
                    const engagementResponse = await apiGet(
                        `/api/content/engagement?ids=${videoIdsWithRealData.join(',')}`
                    );

                    if (engagementResponse.success && engagementResponse.data) {
                        const engagementData = engagementResponse.data;

                        setExamples(prevExamples =>
                            prevExamples.map(ex => {
                                if (ex.realVideoId && engagementData[ex.realVideoId]) {
                                    const stats = engagementData[ex.realVideoId];
                                    return {
                                        ...ex,
                                        stats: {
                                            views: formatNumber(stats.views || stats.impressions || 0),
                                            engagement: calculateEngagementRateFromStats(stats),
                                            creationTime: ex.stats.creationTime,
                                        },
                                    };
                                }
                                return ex;
                            })
                        );
                    }
                } catch (error) {
                    console.warn('[VideoExampleModal] Erreur chargement engagement:', error);
                }
            }
        } catch (error) {
            console.warn('[VideoExampleModal] Erreur chargement exemples réels:', error);
            // En cas d'erreur, utiliser les exemples par défaut
            setExamples(VIDEO_EXAMPLES);
        } finally {
            setLoadingExamples(false);
        }
    }, [extractStyleFromVideo, formatNumber, calculateEngagementRate, calculateEngagementRateFromStats]);


    // Réinitialiser les états quand le modal s'ouvre
    useEffect(() => {
        if (visible) {
            setCurrentIndex(0);
            setVideoErrors({});
            setVideoLoading(
                examples.reduce((acc, example) => {
                    acc[example.id] = true;
                    return acc;
                }, {} as Record<string, boolean>)
            );
        }
    }, [visible, examples]);

    // ✅ NOUVEAU: Charger les exemples réels quand le modal s'ouvre
    useEffect(() => {
        if (visible) {
            loadRealExamples();
        }
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleVideoError = (exampleId: string, error: any) => {
        console.warn(`[VideoExampleModal] Erreur chargement vidéo ${exampleId}:`, error);
        setVideoErrors(prev => ({ ...prev, [exampleId]: true }));
        setVideoLoading(prev => ({ ...prev, [exampleId]: false }));
    };

    const handleVideoLoad = (exampleId: string) => {
        setVideoLoading(prev => ({ ...prev, [exampleId]: false }));
    };

    const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const scrollToIndex = (index: number) => {
        if (index >= 0 && index < examples.length) {
            flatListRef.current?.scrollToIndex({ index, animated: true });
        }
    };

    const renderVideoExample = ({ item, index }: { item: VideoExample; index: number }) => {
        const isError = videoErrors[item.id] || false;
        const isLoadingVideo = videoLoading[item.id] !== false;

        return (
            <View style={styles.exampleCard}>
                {/* Header avec style et statistiques */}
                <View style={styles.exampleHeader}>
                    <View style={styles.styleInfo}>
                        <Text style={styles.styleIcon}>{item.icon}</Text>
                        <View>
                            <Text style={styles.styleLabel}>{item.label}</Text>
                            <Text style={styles.styleDescription} numberOfLines={2}>
                                {item.description}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <SafeIcon name="eye" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.statText}>{item.stats.views}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <SafeIcon name="heart" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.statText}>{item.stats.engagement}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <SafeIcon name="clock" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.statText}>{item.stats.creationTime}</Text>
                        </View>
                    </View>
                </View>

                {/* Conteneur vidéo */}
                <View style={styles.videoContainer}>
                    {/* ✅ NOUVEAU: Afficher le thumbnail pendant le chargement */}
                    {isLoadingVideo && !isError && (
                        <>
                            {item.thumbnail ? (
                                <View style={styles.thumbnailContainer}>
                                    <Image
                                        source={{ uri: item.thumbnail }}
                                        style={styles.thumbnailImage}
                                        resizeMode="cover"
                                        onError={() => {
                                            // ✅ CORRECTION 2025-12-01: Gérer les erreurs 404 pour les thumbnails
                                            console.warn('[VideoExampleModal] Erreur chargement thumbnail:', item.thumbnail);
                                        }}
                                    />
                                    <View style={styles.thumbnailOverlay}>
                                        <ActivityIndicator size="large" color="#FFFFFF" />
                                        <Text style={[styles.loadingText, { color: '#FFFFFF' }]}>Chargement de la vidéo...</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color={modernColors.primary} />
                                    <Text style={styles.loadingText}>Chargement de la vidéo...</Text>
                                </View>
                            )}
                        </>
                    )}
                    {/* ✅ Afficher la vidéo seulement si elle est chargée */}
                    {!isLoadingVideo && !isError && (
                        <Video
                            source={{ uri: item.videoUrl }}
                            style={styles.video}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay={false}
                            isLooping={false}
                            useNativeControls={true}
                            onError={(error) => handleVideoError(item.id, error)}
                            onLoad={() => handleVideoLoad(item.id)}
                        />
                    )}
                    {/* ✅ Fallback si erreur */}
                    {isError && (
                        <View style={styles.videoFallback}>
                            {/* ✅ NOUVEAU: Afficher le thumbnail dans le fallback si disponible */}
                            {item.thumbnail ? (
                                <>
                                    <Image
                                        source={{ uri: item.thumbnail }}
                                        style={styles.fallbackThumbnail}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.fallbackOverlay}>
                                        <Text style={styles.fallbackIcon}>{item.icon}</Text>
                                        <SafeIcon name="play-circle" size={48} color="#FFFFFF" />
                                        <Text style={[styles.fallbackText, { color: '#FFFFFF' }]}>{item.label}</Text>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.fallbackIcon}>{item.icon}</Text>
                                    <SafeIcon name="film" size={48} color={modernColors.primary} />
                                    <Text style={styles.fallbackText}>{item.label}</Text>
                                    <Text style={styles.fallbackDescription}>
                                        {item.description}
                                    </Text>
                                </>
                            )}
                            <View style={styles.featuresList}>
                                {item.features.map((feature, idx) => (
                                    <View key={idx} style={styles.featureBadge}>
                                        <SafeIcon name="check" size={12} color={modernColors.primary} />
                                        <Text style={styles.featureBadgeText}>{feature}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Features */}
                <View style={styles.features}>
                    {item.features.map((feature, idx) => (
                        <View key={idx} style={styles.featureItem}>
                            <SafeIcon name="check-circle" size={16} color={modernColors.primary} />
                            <Text style={styles.featureText}>{feature}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <NativeCard style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Exemples de vidéos créées</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Découvrez les différents styles de vidéos promotionnelles générées avec Yukpo
                    </Text>

                    {/* Carrousel */}
                    <View style={styles.carouselContainer}>
                        {loadingExamples && examples.length === VIDEO_EXAMPLES.length ? (
                            <View style={styles.loadingExamplesContainer}>
                                <ActivityIndicator size="large" color={modernColors.primary} />
                                <Text style={styles.loadingExamplesText}>Chargement des exemples réels...</Text>
                            </View>
                        ) : (
                            <FlatList
                                ref={flatListRef}
                                data={examples}
                                renderItem={renderVideoExample}
                                keyExtractor={(item) => item.id}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                snapToInterval={CARD_WIDTH + 20}
                                decelerationRate="fast"
                                onViewableItemsChanged={handleViewableItemsChanged}
                                viewabilityConfig={viewabilityConfig}
                                contentContainerStyle={styles.carouselContent}
                                getItemLayout={(data, index) => ({
                                    length: CARD_WIDTH + 20,
                                    offset: (CARD_WIDTH + 20) * index,
                                    index,
                                })}
                            />
                        )}
                    </View>

                    {/* Indicateurs de pagination */}
                    <View style={styles.paginationContainer}>
                        <View style={styles.pagination}>
                            {examples.map((_, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.paginationDot,
                                        index === currentIndex && styles.paginationDotActive,
                                    ]}
                                    onPress={() => scrollToIndex(index)}
                                />
                            ))}
                        </View>
                        <Text style={styles.paginationText}>
                            {currentIndex + 1} / {examples.length}
                        </Text>
                    </View>

                    {/* Boutons de navigation */}
                    <View style={styles.navigationButtons}>
                        <TouchableOpacity
                            style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                            onPress={() => scrollToIndex(currentIndex - 1)}
                            disabled={currentIndex === 0}
                        >
                            <SafeIcon
                                name="chevron-left"
                                size={24}
                                color={currentIndex === 0 ? modernColors.textSecondary : modernColors.primary}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.navButton, currentIndex === examples.length - 1 && styles.navButtonDisabled]}
                            onPress={() => scrollToIndex(currentIndex + 1)}
                            disabled={currentIndex === examples.length - 1}
                        >
                            <SafeIcon
                                name="chevron-right"
                                size={24}
                                color={currentIndex === examples.length - 1 ? modernColors.textSecondary : modernColors.primary}
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <NativeButton
                            title="Fermer"
                            variant="outline"
                            size="medium"
                            onPress={onClose}
                            style={styles.cancelButton}
                        />
                        <NativeButton
                            title="Créer ma vidéo"
                            variant="primary"
                            size="medium"
                            onPress={() => {
                                onClose();
                                onStartCreation();
                            }}
                            style={styles.createButton}
                        />
                    </View>
                </NativeCard>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        width: '100%',
        maxWidth: 500,
        maxHeight: '90%',
        backgroundColor: modernColors.background,
        borderRadius: 16,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 20,
        textAlign: 'center',
    },
    // ✅ NOUVEAU: Styles pour le carrousel
    carouselContainer: {
        marginBottom: 16,
    },
    carouselContent: {
        paddingRight: 20,
    },
    exampleCard: {
        width: CARD_WIDTH,
        marginRight: 20,
    },
    exampleHeader: {
        marginBottom: 12,
    },
    styleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    styleIcon: {
        fontSize: 32,
    },
    styleLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    styleDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '600',
    },
    videoContainer: {
        width: '100%',
        height: 280,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
        marginBottom: 16,
        position: 'relative',
    },
    // ✅ NOUVEAU: Styles pour les thumbnails
    thumbnailContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    thumbnailOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fallbackThumbnail: {
        width: '100%',
        height: '60%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    fallbackOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    loadingExamplesContainer: {
        width: CARD_WIDTH,
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },
    loadingExamplesText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    videoFallback: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.primary + '10',
        padding: 20,
    },
    fallbackIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    fallbackText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        marginTop: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    fallbackDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 16,
    },
    featuresList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    featureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: modernColors.primary + '20',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    featureBadgeText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    features: {
        marginBottom: 16,
        gap: 10,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 13,
        color: modernColors.text,
        flex: 1,
    },
    // ✅ NOUVEAU: Styles pour pagination et navigation
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    pagination: {
        flexDirection: 'row',
        gap: 8,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.textSecondary + '40',
    },
    paginationDotActive: {
        backgroundColor: modernColors.primary,
        width: 24,
    },
    paginationText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontWeight: '600',
    },
    navigationButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 12,
    },
    navButton: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.border || '#E5E7EB',
    },
    navButtonDisabled: {
        opacity: 0.4,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
    },
    createButton: {
        flex: 1,
    },
});

export default VideoExampleModal;

