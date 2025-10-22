import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface ServiceMediaGalleryProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    prestataireInfo?: any;
}

const ServiceMediaGallery: React.FC<ServiceMediaGalleryProps> = ({
    visible,
    onClose,
    service,
    prestataireInfo
}) => {
    const [media, setMedia] = useState<any[]>([]);
    const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'images' | 'videos'>('all');

    useEffect(() => {
        if (visible && service) {
            loadMedia();
        }
    }, [visible, service]);

    const loadMedia = async () => {
        setLoading(true);
        try {
            // Extraire les médias du service
            const mediaList = [];

            // Images du service
            if (service.data?.images) {
                const images = Array.isArray(service.data.images)
                    ? service.data.images
                    : [service.data.images];

                images.forEach((img: any) => {
                    if (img.valeur || img) {
                        mediaList.push({
                            type: 'image',
                            url: img.valeur || img,
                            description: 'Image du service'
                        });
                    }
                });
            }

            // Logo
            if (service.data?.logo?.valeur) {
                mediaList.push({
                    type: 'image',
                    url: service.data.logo.valeur,
                    description: 'Logo'
                });
            }

            // Banner
            if (service.data?.banner?.valeur) {
                mediaList.push({
                    type: 'image',
                    url: service.data.banner.valeur,
                    description: 'Bannière'
                });
            }

            // Vidéos
            if (service.data?.videos) {
                const videos = Array.isArray(service.data.videos)
                    ? service.data.videos
                    : [service.data.videos];

                videos.forEach((vid: any) => {
                    if (vid.valeur || vid) {
                        mediaList.push({
                            type: 'video',
                            url: vid.valeur || vid,
                            description: 'Vidéo du service'
                        });
                    }
                });
            }

            // Médias des produits
            const products = service.data?.produits || [];
            if (Array.isArray(products)) {
                products.forEach((product: any, index: number) => {
                    const productType = product.type || 'autre';
                    const productName = product.nom || `Produit ${index + 1}`;

                    // Images du produit
                    if (product.images && Array.isArray(product.images)) {
                        product.images.forEach((img: string) => {
                            mediaList.push({
                                type: 'image',
                                url: img,
                                description: `📦 ${productName}`,
                                category: productType
                            });
                        });
                    }

                    // Vidéos du produit
                    if (product.videos && Array.isArray(product.videos)) {
                        product.videos.forEach((vid: string) => {
                            mediaList.push({
                                type: 'video',
                                url: vid,
                                description: `🎬 ${productName}`,
                                category: productType
                            });
                        });
                    }

                    // Images de réalisations (pour prestations de service)
                    if (product.imagesRealisations && Array.isArray(product.imagesRealisations)) {
                        product.imagesRealisations.forEach((img: string) => {
                            mediaList.push({
                                type: 'image',
                                url: img,
                                description: `💼 Réalisation - ${productName}`,
                                category: 'prestation_service'
                            });
                        });
                    }

                    // Vidéos de réalisations (pour prestations de service)
                    if (product.videosRealisations && Array.isArray(product.videosRealisations)) {
                        product.videosRealisations.forEach((vid: string) => {
                            mediaList.push({
                                type: 'video',
                                url: vid,
                                description: `💼 Réalisation - ${productName}`,
                                category: 'prestation_service'
                            });
                        });
                    }
                });
            }

            setMedia(mediaList);
        } catch (error) {
            console.error('Erreur chargement médias:', error);
            Alert.alert('Erreur', 'Impossible de charger les médias');
        } finally {
            setLoading(false);
        }
    };

    const filteredMedia = media.filter(m => {
        if (filter === 'all') return true;
        if (filter === 'images') return m.type === 'image';
        if (filter === 'videos') return m.type === 'video';
        return true;
    });

    const nomPrestataire = prestataireInfo?.nom_complet || prestataireInfo?.nom || 'Prestataire';

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Médias de {nomPrestataire}</Text>
                        <Text style={styles.headerSubtitle}>
                            {filteredMedia.length} {filteredMedia.length > 1 ? 'médias' : 'média'}
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Filtres */}
                <View style={styles.filtersContainer}>
                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                        onPress={() => setFilter('all')}
                    >
                        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                            Tous
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'images' && styles.filterButtonActive]}
                        onPress={() => setFilter('images')}
                    >
                        <Text style={[styles.filterText, filter === 'images' && styles.filterTextActive]}>
                            Photos
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'videos' && styles.filterButtonActive]}
                        onPress={() => setFilter('videos')}
                    >
                        <Text style={[styles.filterText, filter === 'videos' && styles.filterTextActive]}>
                            Vidéos
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Galerie */}
                <ScrollView style={styles.gallery} contentContainerStyle={styles.galleryContent}>
                    {loading && (
                        <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>Chargement...</Text>
                        </View>
                    )}

                    {!loading && filteredMedia.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="image" size={48} color={modernColors.textSecondary} />
                            <Text style={styles.emptyText}>Aucun média disponible</Text>
                        </View>
                    )}

                    <View style={styles.mediaGrid}>
                        {filteredMedia.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.mediaItem}
                                onPress={() => setSelectedMedia(item)}
                            >
                                {item.type === 'image' ? (
                                    <Image source={{ uri: item.url }} style={styles.mediaImage} />
                                ) : (
                                    <View style={styles.videoPlaceholder}>
                                        <SafeIcon name="play-circle" size={40} color="#FFFFFF" />
                                    </View>
                                )}
                                {item.type === 'video' && (
                                    <View style={styles.videoBadge}>
                                        <SafeIcon name="play-circle" size={16} color="#FFFFFF" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                {/* Modal de visualisation plein écran */}
                {selectedMedia && (
                    <Modal visible={true} transparent onRequestClose={() => setSelectedMedia(null)}>
                        <View style={styles.fullScreenContainer}>
                            <TouchableOpacity
                                style={styles.fullScreenClose}
                                onPress={() => setSelectedMedia(null)}
                            >
                                <SafeIcon name="x" size={32} color="#FFFFFF" />
                            </TouchableOpacity>

                            {selectedMedia.type === 'image' ? (
                                <Image
                                    source={{ uri: selectedMedia.url }}
                                    style={styles.fullScreenImage}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.fullScreenVideo}>
                                    <SafeIcon name="play-circle" size={80} color="#FFFFFF" />
                                    <Text style={styles.fullScreenText}>Lecteur vidéo à venir</Text>
                                </View>
                            )}
                        </View>
                    </Modal>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    closeButton: {
        padding: 8,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    filtersContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
    },
    filterText: {
        fontSize: 14,
        color: modernColors.text,
    },
    filterTextActive: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    gallery: {
        flex: 1,
    },
    galleryContent: {
        padding: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        marginTop: 16,
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    mediaItem: {
        width: (width - 32) / 3,
        height: (width - 32) / 3,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: modernColors.surfaceVariant,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenClose: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 8,
    },
    fullScreenImage: {
        width: width,
        height: '100%',
    },
    fullScreenVideo: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenText: {
        fontSize: 16,
        color: '#FFFFFF',
        marginTop: 16,
    },
});

export default ServiceMediaGallery;
