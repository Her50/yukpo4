// 🖼️ Modal de galerie produits - Affiche toutes les images et vidéos de tous les produits
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 60) / 3; // 3 colonnes avec padding

interface MediaItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    source: 'product_creation' | 'yukpo_video' | 'publicite' | 'product_api';
    productName: string;
    serviceId: number;
    productIndex: number;
    serviceName?: string;
    thumbnail?: string;
    title?: string;
    description?: string;
    createdAt?: string;
}

interface ProductGalleryModalProps {
    visible: boolean;
    services: any[]; // Liste des services/produits de l'utilisateur
    onClose: () => void;
}

const ProductGalleryModal: React.FC<ProductGalleryModalProps> = ({
    visible,
    services,
    onClose,
}) => {
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'images' | 'videos'>('all');
    const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

    useEffect(() => {
        if (visible && services && services.length > 0) {
            loadAllMedia();
        } else {
            setMedia([]);
        }
    }, [visible, services]);

    const loadAllMedia = async () => {
        setLoading(true);
        try {
            const allMedia: MediaItem[] = [];

            // ✅ 1. Charger les médias depuis les produits (création produit)
            if (Array.isArray(services)) {
                for (const service of services) {
                    if (!service) continue;

                    const serviceId = service.service_id || service.data?.serviceId ||
                        (typeof service.id === 'string' && service.id.includes('_')
                            ? parseInt(service.id.split('_')[0], 10)
                            : parseInt(String(service.id || 0), 10));

                    if (!serviceId || isNaN(serviceId)) continue;

                    const productIndex = service.product_index ?? service.data?.product_index ?? 0;
                    const productName = service.title || service.nom || service.data?.nom || 'Produit sans nom';
                    const serviceName = service.service_title || service.data?.serviceTitre || 'Service sans titre';

                    // Charger images depuis API
                    try {
                        const imagesResp = await apiGet(`/api/media/product/${serviceId}/${productIndex}/images`);
                        if (imagesResp.success && imagesResp.data) {
                            const images = imagesResp.data.images || imagesResp.data.Images || [];
                            if (Array.isArray(images)) {
                                images.forEach((img: string, idx: number) => {
                                    if (img && typeof img === 'string') {
                                        allMedia.push({
                                            id: `product-img-${serviceId}-${productIndex}-${idx}`,
                                            url: img,
                                            type: 'image',
                                            source: 'product_api',
                                            productName,
                                            serviceId,
                                            productIndex,
                                            serviceName,
                                        });
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        console.warn(`[ProductGalleryModal] Erreur chargement images produit ${serviceId}/${productIndex}:`, error);
                    }

                    // Charger vidéos depuis API
                    try {
                        const videosResp = await apiGet(`/api/media/product/${serviceId}/${productIndex}/videos`);
                        if (videosResp.success && videosResp.data) {
                            const videos = videosResp.data.videos || videosResp.data.Videos || [];
                            if (Array.isArray(videos)) {
                                videos.forEach((vid: string, idx: number) => {
                                    if (vid && typeof vid === 'string') {
                                        allMedia.push({
                                            id: `product-video-${serviceId}-${productIndex}-${idx}`,
                                            url: vid,
                                            type: 'video',
                                            source: 'product_creation',
                                            productName,
                                            serviceId,
                                            productIndex,
                                            serviceName,
                                        });
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        console.warn(`[ProductGalleryModal] Erreur chargement vidéos produit ${serviceId}/${productIndex}:`, error);
                    }

                    // ✅ Extraire médias depuis service.data.produits (format JSON direct)
                    if (service.data?.produits) {
                        const produits = Array.isArray(service.data.produits)
                            ? service.data.produits
                            : (service.data.produits.valeur && Array.isArray(service.data.produits.valeur))
                                ? service.data.produits.valeur
                                : [];

                        produits.forEach((prod: any, prodIdx: number) => {
                            if (prod.images && Array.isArray(prod.images)) {
                                prod.images.forEach((img: string, imgIdx: number) => {
                                    if (img && typeof img === 'string') {
                                        allMedia.push({
                                            id: `prod-data-img-${serviceId}-${prodIdx}-${imgIdx}`,
                                            url: img,
                                            type: 'image',
                                            source: 'product_creation',
                                            productName: prod.nom || prod.title || productName,
                                            serviceId,
                                            productIndex: prodIdx,
                                            serviceName,
                                        });
                                    }
                                });
                            }

                            if (prod.videos && Array.isArray(prod.videos)) {
                                prod.videos.forEach((vid: string, vidIdx: number) => {
                                    if (vid && typeof vid === 'string') {
                                        allMedia.push({
                                            id: `prod-data-video-${serviceId}-${prodIdx}-${vidIdx}`,
                                            url: vid,
                                            type: 'video',
                                            source: 'product_creation',
                                            productName: prod.nom || prod.title || productName,
                                            serviceId,
                                            productIndex: prodIdx,
                                            serviceName,
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            }

            // ✅ 2. Charger les vidéos créées via publicités
            try {
                const publicitesResp = await apiGet('/api/publicites/dashboard');
                if (publicitesResp.success && publicitesResp.data?.publicites) {
                    const publicites = Array.isArray(publicitesResp.data.publicites)
                        ? publicitesResp.data.publicites
                        : [];

                    publicites.forEach((pub: any) => {
                        if (pub.videos && Array.isArray(pub.videos)) {
                            pub.videos.forEach((videoBase64: string, vidIdx: number) => {
                                if (videoBase64 && typeof videoBase64 === 'string') {
                                    const videoUrl = videoBase64.startsWith('data:')
                                        ? videoBase64
                                        : `data:video/mp4;base64,${videoBase64}`;

                                    allMedia.push({
                                        id: `publicite-${pub.id}-${vidIdx}`,
                                        url: videoUrl,
                                        type: 'video',
                                        source: 'publicite',
                                        productName: pub.titre || 'Publicité',
                                        serviceId: 0,
                                        productIndex: 0,
                                        serviceName: 'Publicité',
                                        thumbnail: pub.thumbnails?.[vidIdx]
                                            ? (pub.thumbnails[vidIdx].startsWith('data:')
                                                ? pub.thumbnails[vidIdx]
                                                : `data:image/png;base64,${pub.thumbnails[vidIdx]}`)
                                            : undefined,
                                        title: pub.titre,
                                        description: pub.description,
                                    });
                                }
                            });
                        }
                    });
                }
            } catch (error) {
                console.warn('[ProductGalleryModal] Erreur chargement publicités:', error);
            }

            setMedia(allMedia);
        } catch (error) {
            console.error('[ProductGalleryModal] Erreur chargement médias:', error);
            Alert.alert('Erreur', 'Impossible de charger la galerie');
        } finally {
            setLoading(false);
        }
    };

    const filteredMedia = media.filter((item) => {
        if (filter === 'images') return item.type === 'image';
        if (filter === 'videos') return item.type === 'video';
        return true;
    });

    const images = filteredMedia.filter((m) => m.type === 'image');
    const videos = filteredMedia.filter((m) => m.type === 'video');

    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'product_creation': return '📦 Création produit';
            case 'yukpo_video': return '🎬 Yukpo IA';
            case 'publicite': return '📢 Publicité';
            case 'product_api': return '🖼️ Produit';
            default: return '📁 Autre';
        }
    };

    const renderMediaItem = (item: MediaItem, index: number) => {
        const isSelected = selectedMedia?.id === item.id;

        return (
            <TouchableOpacity
                key={`${item.id}-${index}`}
                style={[styles.mediaItem, isSelected && styles.mediaItemSelected]}
                onPress={() => setSelectedMedia(item)}
                activeOpacity={0.8}
            >
                {item.type === 'image' ? (
                    <Image
                        source={{ uri: item.url }}
                        style={styles.mediaImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.videoThumbnail}>
                        {item.thumbnail ? (
                            <Image
                                source={{ uri: item.thumbnail }}
                                style={styles.mediaImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.videoPlaceholder}>
                                <SafeIcon name="play-circle" size={32} color="#fff" />
                            </View>
                        )}
                        <View style={styles.videoOverlay}>
                            <SafeIcon name="play" size={20} color="#fff" />
                        </View>
                    </View>
                )}
                <View style={styles.mediaBadge}>
                    <Text style={styles.mediaBadgeText} numberOfLines={1}>
                        {getSourceLabel(item.source)}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.headerTitle}>Galerie Produits</Text>
                            <Text style={styles.headerSubtitle}>
                                {media.length} média{media.length !== 1 ? 's' : ''}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Filtres */}
                <View style={styles.filters}>
                    <TouchableOpacity
                        style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                        onPress={() => setFilter('all')}
                    >
                        <SafeIcon name="grid" size={16} color={filter === 'all' ? '#fff' : modernColors.textSecondary} />
                        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                            Tout ({media.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, filter === 'images' && styles.filterChipActive]}
                        onPress={() => setFilter('images')}
                    >
                        <SafeIcon name="image" size={16} color={filter === 'images' ? '#fff' : modernColors.textSecondary} />
                        <Text style={[styles.filterText, filter === 'images' && styles.filterTextActive]}>
                            Images ({images.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, filter === 'videos' && styles.filterChipActive]}
                        onPress={() => setFilter('videos')}
                    >
                        <SafeIcon name="video" size={16} color={filter === 'videos' ? '#fff' : modernColors.textSecondary} />
                        <Text style={[styles.filterText, filter === 'videos' && styles.filterTextActive]}>
                            Vidéos ({videos.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Contenu */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Chargement de la galerie...</Text>
                    </View>
                ) : filteredMedia.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="image" size={64} color={modernColors.textSecondary} />
                        <Text style={styles.emptyTitle}>Aucun média trouvé</Text>
                        <Text style={styles.emptyText}>
                            {filter === 'images'
                                ? 'Aucune image dans vos produits'
                                : filter === 'videos'
                                    ? 'Aucune vidéo dans vos produits'
                                    : 'Aucun média dans vos produits'}
                        </Text>
                    </View>
                ) : (
                    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                        {/* Section Images */}
                        {filter !== 'videos' && images.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <SafeIcon name="image" size={20} color={modernColors.primary} />
                                    <Text style={styles.sectionTitle}>
                                        Images ({images.length})
                                    </Text>
                                </View>
                                <View style={styles.mediaGrid}>
                                    {images.map((item, index) => renderMediaItem(item, index))}
                                </View>
                            </View>
                        )}

                        {/* Section Vidéos */}
                        {filter !== 'images' && videos.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <SafeIcon name="video" size={20} color={modernColors.primary} />
                                    <Text style={styles.sectionTitle}>
                                        Vidéos ({videos.length})
                                    </Text>
                                </View>
                                <View style={styles.mediaGrid}>
                                    {videos.map((item, index) => renderMediaItem(item, index))}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                )}

                {/* Modal détail média sélectionné */}
                {selectedMedia && (
                    <Modal
                        visible={!!selectedMedia}
                        animationType="fade"
                        transparent={true}
                        onRequestClose={() => setSelectedMedia(null)}
                    >
                        <View style={styles.detailModal}>
                            <TouchableOpacity
                                style={styles.detailCloseButton}
                                onPress={() => setSelectedMedia(null)}
                            >
                                <SafeIcon name="x" size={24} color="#fff" />
                            </TouchableOpacity>
                            <ScrollView contentContainerStyle={styles.detailContent}>
                                {selectedMedia.type === 'image' ? (
                                    <Image
                                        source={{ uri: selectedMedia.url }}
                                        style={styles.detailImage}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <View style={styles.detailVideoContainer}>
                                        {/* TODO: Implémenter lecteur vidéo */}
                                        <Text style={styles.detailVideoText}>Lecteur vidéo à implémenter</Text>
                                    </View>
                                )}
                                <View style={styles.detailInfo}>
                                    <Text style={styles.detailTitle}>{selectedMedia.productName}</Text>
                                    {selectedMedia.serviceName && (
                                        <Text style={styles.detailSubtitle}>
                                            Service: {selectedMedia.serviceName}
                                        </Text>
                                    )}
                                    <Text style={styles.detailSource}>
                                        {getSourceLabel(selectedMedia.source)}
                                    </Text>
                                    {selectedMedia.description && (
                                        <Text style={styles.detailDescription}>
                                            {selectedMedia.description}
                                        </Text>
                                    )}
                                </View>
                            </ScrollView>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    headerSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    filters: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#fff',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 16,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    mediaItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    mediaItemSelected: {
        borderWidth: 3,
        borderColor: modernColors.primary,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: modernColors.textSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoOverlay: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        padding: 4,
    },
    mediaBadge: {
        position: 'absolute',
        top: 4,
        left: 4,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    mediaBadgeText: {
        fontSize: 10,
        color: '#fff',
    },
    detailModal: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
    },
    detailCloseButton: {
        position: 'absolute',
        top: 50,
        right: 16,
        zIndex: 10,
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    detailContent: {
        flex: 1,
        justifyContent: 'center',
        padding: 16,
    },
    detailImage: {
        width: '100%',
        height: 400,
        borderRadius: 8,
    },
    detailVideoContainer: {
        width: '100%',
        height: 400,
        backgroundColor: '#000',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailVideoText: {
        color: '#fff',
        fontSize: 16,
    },
    detailInfo: {
        marginTop: 24,
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
    },
    detailTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    detailSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    detailSource: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 8,
    },
    detailDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
    },
});

export default ProductGalleryModal;

