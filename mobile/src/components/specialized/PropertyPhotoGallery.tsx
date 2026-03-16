// Composant galerie photos avancée pour biens immobiliers
import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { mediaService } from '../../services/mediaService';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface PropertyPhotoGalleryProps {
    photos: string[];
    virtualTours?: Array<{
        id: number;
        tour_type: string;
        media_url: string;
        thumbnail_url?: string;
    }>;
    onPhotoPress?: (index: number) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = 80;
const GAP = 8;

const PropertyPhotoGallery: React.FC<PropertyPhotoGalleryProps> = ({
    photos,
    virtualTours = [],
    onPhotoPress,
}) => {
        const { t } = useLanguageSafe();
const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [showFullScreen, setShowFullScreen] = useState(false);

    // ✅ CORRIGÉ: Transformer les chemins en URLs CDN via mediaService
    const allMedia: any[] = [
        ...photos.map((url, index) => ({ type: 'photo', url: mediaService.getImageUrl(url), index })),
        ...virtualTours.map((tour) => ({
            type: 'virtual_tour',
            url: mediaService.getVideoUrl(tour.media_url),
            thumbnail: tour.thumbnail_url ? mediaService.getImageUrl(tour.thumbnail_url) : undefined,
            tourType: tour.tour_type,
            index: photos.length + tour.id,
        })),
    ];

    const handlePhotoPress = (index: number) => {
        setSelectedIndex(index);
        setShowFullScreen(true);
        if (onPhotoPress) {
            onPhotoPress(index);
        }
    };

    const handleCloseFullScreen = () => {
        setShowFullScreen(false);
        setSelectedIndex(null);
    };

    const handlePrevious = () => {
        if (selectedIndex !== null && selectedIndex > 0) {
            setSelectedIndex(selectedIndex - 1);
        }
    };

    const handleNext = () => {
        if (selectedIndex !== null && selectedIndex < allMedia.length - 1) {
            setSelectedIndex(selectedIndex + 1);
        }
    };

    if (allMedia.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <SafeIcon name="image" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>{t('propertyPhotoGallery.aucunePhotoDisponible')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Photo principale */}
            {allMedia.length > 0 && (
                <TouchableOpacity
                    style={styles.mainPhotoContainer}
                    onPress={() => handlePhotoPress(0)}
                    activeOpacity={0.9}
                >
                    <Image
                        source={{ uri: allMedia[0].url }}
                        style={styles.mainPhoto}
                        resizeMode="cover"
                    />
                    {allMedia.length > 1 && (
                        <View style={styles.photoCountBadge}>
                            <SafeIcon name="image" size={16} color="#fff" />
                            <Text style={styles.photoCountText}>
                                +{String(allMedia.length - 1)}
                            </Text>
                        </View>
                    )}
                    {allMedia[0].type === 'virtual_tour' && (
                        <View style={styles.virtualTourBadge}>
                            <SafeIcon name="video" size={16} color="#fff" />
                            <Text style={styles.virtualTourText}>Visite 360°</Text>
                        </View>
                    )}
                </TouchableOpacity>
            )}

            {/* Miniatures */}
            {allMedia.length > 1 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.thumbnailsContainer}
                    contentContainerStyle={styles.thumbnailsContent}
                >
                    {allMedia.slice(1, 6).map((media, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.thumbnailContainer}
                            onPress={() => handlePhotoPress(index + 1)}
                        >
                            <Image
                                source={{ uri: media.thumbnail || media.url }}
                                style={styles.thumbnail}
                                resizeMode="cover"
                            />
                            {media.type === 'virtual_tour' && (
                                <View style={styles.thumbnailBadge}>
                                    <SafeIcon name="video" size={12} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                    {allMedia.length > 6 && (
                        <TouchableOpacity
                            style={styles.moreThumbnails}
                            onPress={() => handlePhotoPress(6)}
                        >
                            <Text style={styles.moreThumbnailsText}>
                                +{String(allMedia.length - 6)}
                            </Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            )}

            {/* Modal plein écran */}
            <Modal
                visible={showFullScreen}
                transparent
                animationType="fade"
                onRequestClose={handleCloseFullScreen}
            >
                <View style={styles.modalContainer}>
                    <TouchableOpacity
                        style={styles.modalCloseButton}
                        onPress={handleCloseFullScreen}
                    >
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>

                    {selectedIndex !== null && (
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            contentOffset={{ x: selectedIndex * SCREEN_WIDTH, y: 0 }}
                            onMomentumScrollEnd={(event) => {
                                const index = Math.round(
                                    event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                                );
                                setSelectedIndex(index);
                            }}
                        >
                            {allMedia.map((media, index) => (
                                <View key={index} style={styles.fullScreenImageContainer}>
                                    {media.type === 'photo' ? (
                                        <Image
                                            source={{ uri: media.url }}
                                            style={styles.fullScreenImage}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <View style={styles.virtualTourContainer}>
                                            <SafeIcon name="video" size={64} color="#fff" />
                                            <Text style={styles.virtualTourLabel}>
                                                Visite virtuelle 360°
                                            </Text>
                                            <Text style={styles.virtualTourSubLabel}>
                                                {media.tourType === '360_video'
                                                    ? t('propertyPhotoGallery.video360')
                                                    : t('propertyPhotoGallery.modele3d')}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Indicateur de position */}
                    {selectedIndex !== null && (
                        <View style={styles.imageIndicator}>
                            <Text style={styles.imageIndicatorText}>
                                {String(selectedIndex + 1)} / {String(allMedia.length)}
                            </Text>
                        </View>
                    )}

                    {/* Boutons navigation */}
                    {selectedIndex !== null && selectedIndex > 0 && (
                        <TouchableOpacity
                            style={[styles.navButton, styles.prevButton]}
                            onPress={handlePrevious}
                        >
                            <SafeIcon name="chevron-left" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                    {selectedIndex !== null &&
                        selectedIndex < allMedia.length - 1 && (
                            <TouchableOpacity
                                style={[styles.navButton, styles.nextButton]}
                                onPress={handleNext}
                            >
                                <SafeIcon name="chevron-right" size={24} color="#fff" />
                            </TouchableOpacity>
                        )}
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    emptyContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    mainPhotoContainer: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 12,
        position: 'relative',
    },
    mainPhoto: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F3F4F6',
    },
    photoCountBadge: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    photoCountText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    virtualTourBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    virtualTourText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    thumbnailsContainer: {
        marginTop: 8,
    },
    thumbnailsContent: {
        gap: GAP,
    },
    thumbnailContainer: {
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F3F4F6',
    },
    thumbnailBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        padding: 4,
    },
    moreThumbnails: {
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreThumbnailsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    modalCloseButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenImageContainer: {
        width: SCREEN_WIDTH,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenImage: {
        width: SCREEN_WIDTH,
        height: '100%',
    },
    virtualTourContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    virtualTourLabel: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    virtualTourSubLabel: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
    },
    imageIndicator: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    imageIndicatorText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    prevButton: {
        left: 20,
    },
    nextButton: {
        right: 20,
    },
});

export default PropertyPhotoGallery;

