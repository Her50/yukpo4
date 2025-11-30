import { ResizeMode, Video } from 'expo-av';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { API_BASE_URL } from '../config/api.config';
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
}

// ✅ NOUVEAU: Collection d'exemples avec les 4 styles
const VIDEO_EXAMPLES: VideoExample[] = [
    {
        id: 'tiktok',
        style: 'tiktok',
        label: 'TikTok Boost',
        description: 'Transitions rapides, texte dynamique, format vertical 9:16',
        icon: '🎬',
        videoUrl: `${API_BASE_URL}/api/media/examples/tiktok-demo.mp4`,
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
    const [currentIndex, setCurrentIndex] = useState(0);
    const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});
    const [videoLoading, setVideoLoading] = useState<Record<string, boolean>>({});
    const flatListRef = useRef<FlatList>(null);

    const currentExample = VIDEO_EXAMPLES[currentIndex];
    const hasError = videoErrors[currentExample?.id || ''] || false;
    const isLoading = videoLoading[currentExample?.id || ''] !== false;

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
        if (index >= 0 && index < VIDEO_EXAMPLES.length) {
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
                    {isLoadingVideo && !isError && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                            <Text style={styles.loadingText}>Chargement de la vidéo...</Text>
                        </View>
                    )}
                    {!isError && (
                        <Video
                            source={{ uri: item.videoUrl }}
                            style={styles.video}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay={false}
                            useNativeControls={true}
                            onError={(error) => handleVideoError(item.id, error)}
                            onLoad={() => handleVideoLoad(item.id)}
                        />
                    )}
                    {isError && (
                        <View style={styles.videoFallback}>
                            <Text style={styles.fallbackIcon}>{item.icon}</Text>
                            <SafeIcon name="film" size={48} color={modernColors.primary} />
                            <Text style={styles.fallbackText}>{item.label}</Text>
                            <Text style={styles.fallbackDescription}>
                                {item.description}
                            </Text>
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
                        <FlatList
                            ref={flatListRef}
                            data={VIDEO_EXAMPLES}
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
                    </View>

                    {/* Indicateurs de pagination */}
                    <View style={styles.paginationContainer}>
                        <View style={styles.pagination}>
                            {VIDEO_EXAMPLES.map((_, index) => (
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
                            {currentIndex + 1} / {VIDEO_EXAMPLES.length}
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
                            style={[styles.navButton, currentIndex === VIDEO_EXAMPLES.length - 1 && styles.navButtonDisabled]}
                            onPress={() => scrollToIndex(currentIndex + 1)}
                            disabled={currentIndex === VIDEO_EXAMPLES.length - 1}
                        >
                            <SafeIcon
                                name="chevron-right"
                                size={24}
                                color={currentIndex === VIDEO_EXAMPLES.length - 1 ? modernColors.textSecondary : modernColors.primary}
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
    videoContainer: {
        width: '100%',
        height: 250,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: modernColors.background,
        marginBottom: 20,
    },
    video: {
        width: '100%',
        height: '100%',
    },
    videoFallback: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.primary + '10',
        padding: 20,
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
    },
    features: {
        marginBottom: 20,
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 14,
        color: modernColors.text,
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

