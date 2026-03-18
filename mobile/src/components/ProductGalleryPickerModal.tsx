// \uD83D\uDDBC️ Modal pour sélectionner des images/vidéos de la galerie produit et les envoyer dans le chat
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { config } from '../config/environment';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 3;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// ✅ CORRIGÉ 2026-03-03: Utiliser /api/media/files/ pour convertir les chemins relatifs en URLs complètes
// Sans cela, les images ne s'affichent pas car <Image> reçoit un chemin relatif "uploads/..."
const buildMediaUrl = (path: string | undefined | null): string => {
    if (!path) return '';
    const p = typeof path === 'string' ? path.trim() : '';
    if (!p) return '';
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
    const cleanPath = p.replace(/^\//, '');
    const base = (config.API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/api/media/files/${cleanPath}` : cleanPath;
};

interface ProductGalleryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    onSelectMedia: (selectedUrls: string[]) => void;
}

const ProductGalleryPickerModal: React.FC<ProductGalleryPickerModalProps> = ({
    visible,
    onClose,
    service,
    onSelectMedia
}) => {
    const [media, setMedia] = useState<any[]>([]);
    const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'products'>('all');
    const [loading, setLoading] = useState(false);
    const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (visible && service) {
            loadMedia();
        } else {
            setSelectedMedia(new Set());
        }
    }, [visible, service]);

    const loadMedia = async () => {
        setLoading(true);
        setFailedUrls(new Set());
        const mediaList: any[] = [];

        // ✅ CORRIGÉ 2026-02-27: Helper pour extraire tableau depuis {valeur: [...]} ou tableau simple
        const extractMediaArray = (field: any): any[] => {
            if (Array.isArray(field) && field.length > 0) return field;
            if (field && typeof field === 'object' && Array.isArray(field.valeur) && field.valeur.length > 0) return field.valeur;
            if (field && typeof field === 'string' && field.trim()) return [field];
            return [];
        };

        // Logo
        if (service.data?.logo?.valeur) {
            mediaList.push({
                type: 'image',
                url: buildMediaUrl(service.data.logo.valeur),
                category: 'branding',
                description: 'Logo'
            });
        }

        // Banner
        if (service.data?.banner?.valeur) {
            mediaList.push({
                type: 'image',
                url: buildMediaUrl(service.data.banner.valeur),
                category: 'branding',
                description: 'Bannière'
            });
        }

        // ✅ CORRIGÉ 2026-02-27: Charger médias depuis l'API media table (nouveau système prioritaire)
        const serviceId = service.id || service.service_id;
        if (serviceId) {
            try {
                const { mediaApi } = await import('../services/api');
                const mediaResponse = await mediaApi.getServiceMediaDetailed(serviceId);
                if (mediaResponse.success && mediaResponse.data) {
                    const respData = mediaResponse.data as any;
                    const apiMedia = Array.isArray(respData) ? respData
                        : respData?.media || respData?.data || [];

                    apiMedia.forEach((m: any) => {
                        const path = m.path || m.url || m.file_path;
                        const fullUrl = buildMediaUrl(typeof path === 'string' ? path.trim() : null);
                        if (fullUrl) {
                            mediaList.push({
                                type: m.type === 'video' ? 'video' : 'image',
                                url: fullUrl,
                                category: 'products',
                                description: m.product_index !== null && m.product_index !== undefined
                                    ? `Produit ${m.product_index + 1}`
                                    : (m.type === 'video' ? 'Vidéo' : 'Image'),
                                source: 'media_table'
                            });
                        }
                    });
                    console.log(`[ProductGalleryPickerModal] ✅ ${apiMedia.length} médias depuis API`);
                }
            } catch (error) {
                console.warn('[ProductGalleryPickerModal] ⚠️ Erreur API médias:', error);
            }
        }

        // Fallback: Médias depuis service.data.produits ou service.products
        const produits =
            (Array.isArray(service.products) && service.products.length > 0) ? service.products
                : (service.data?.produits?.valeur || service.data?.produits || []);
        const seenUrls = new Set(mediaList.map(m => m.url));
        if (Array.isArray(produits) && produits.length > 0) {
            for (let idx = 0; idx < produits.length; idx++) {
                const product = produits[idx];
                const productName = product.nom || product.titre || product.name || `Produit ${idx + 1}`;

                // ✅ CORRIGÉ 2026-02-27: Utiliser extractMediaArray pour gérer {valeur: [...]}
                const productImages = extractMediaArray(product.images).length > 0 ? extractMediaArray(product.images)
                    : extractMediaArray(product.product_data?.images).length > 0 ? extractMediaArray(product.product_data?.images)
                        : extractMediaArray(product.data?.images);

                const productVideos = extractMediaArray(product.videos).length > 0 ? extractMediaArray(product.videos)
                    : extractMediaArray(product.product_data?.videos).length > 0 ? extractMediaArray(product.product_data?.videos)
                        : extractMediaArray(product.data?.videos);

                // Ajouter les images trouvées dans le JSON (avec déduplication)
                productImages.forEach((img: any, imgIdx: number) => {
                    const rawImgUrl = typeof img === 'string' ? img : (img?.url || img?.path || img?.valeur);
                    const imgUrl = buildMediaUrl(rawImgUrl);
                    if (imgUrl && !seenUrls.has(imgUrl)) {
                        seenUrls.add(imgUrl);
                        mediaList.push({
                            type: 'image',
                            url: imgUrl,
                            category: 'products',
                            description: `${productName} - Image ${imgIdx + 1}`,
                            productName: productName,
                            productIndex: idx
                        });
                    }
                });

                // Ajouter les vidéos trouvées dans le JSON (avec déduplication)
                productVideos.forEach((vid: any, vidIdx: number) => {
                    const rawVidUrl = typeof vid === 'string' ? vid : (vid?.url || vid?.path || vid?.valeur);
                    const vidUrl = buildMediaUrl(rawVidUrl);
                    if (vidUrl && !seenUrls.has(vidUrl)) {
                        seenUrls.add(vidUrl);
                        mediaList.push({
                            type: 'video',
                            url: vidUrl,
                            category: 'products',
                            description: `${productName} - Vidéo ${vidIdx + 1}`,
                            productName: productName,
                            productIndex: idx
                        });
                    }
                });

                // ✅ PRIORITÉ 2: Si pas de médias dans le JSON, essayer l'API
                if (productImages.length === 0 && productVideos.length === 0 && service.id) {
                    try {
                        const { apiGet } = await import('../services/api');

                        // Charger images depuis API
                        const imagesResp = await apiGet(`/api/media/product/${service.id}/${idx}/images`);
                        if (imagesResp.success && imagesResp.data) {
                            const respImgData = imagesResp.data as any;
                            const images = respImgData?.images || respImgData?.Images || [];
                            if (Array.isArray(images) && images.length > 0) {
                                images.forEach((img: string, imgIdx: number) => {
                                    if (img && typeof img === 'string') {
                                        mediaList.push({
                                            type: 'image',
                                            url: buildMediaUrl(img),
                                            category: 'products',
                                            description: `${productName} - Image ${imgIdx + 1}`,
                                            productName: productName,
                                            productIndex: idx
                                        });
                                    }
                                });
                            }
                        }

                        // Charger vidéos depuis API
                        const videosResp = await apiGet(`/api/media/product/${service.id}/${idx}/videos`);
                        if (videosResp.success && videosResp.data) {
                            const respVidData = videosResp.data as any;
                            const videos = respVidData?.videos || respVidData?.Videos || [];
                            if (Array.isArray(videos) && videos.length > 0) {
                                videos.forEach((vid: string, vidIdx: number) => {
                                    if (vid && typeof vid === 'string') {
                                        mediaList.push({
                                            type: 'video',
                                            url: buildMediaUrl(vid),
                                            category: 'products',
                                            description: `${productName} - Vidéo ${vidIdx + 1}`,
                                            productName: productName,
                                            productIndex: idx
                                        });
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        console.log(`[ProductGalleryPickerModal] Erreur API pour produit ${idx}:`, error);
                    }
                }

                // Images de réalisations (toujours depuis JSON)
                const realisations = product.imagesRealisations || product.images_realisations || product.realisations || [];
                if (Array.isArray(realisations) && realisations.length > 0) {
                    realisations.forEach((img: any, imgIdx: number) => {
                        const rawUrl = typeof img === 'string' ? img : (img?.url || img?.path || img?.valeur);
                        const imgUrl = buildMediaUrl(rawUrl);
                        if (imgUrl) {
                            mediaList.push({
                                type: 'image',
                                url: imgUrl,
                                category: 'realisations',
                                description: `${productName} - Réalisation ${imgIdx + 1}`,
                                productName: productName,
                                productIndex: idx
                            });
                        }
                    });
                }
            }
        }

        console.log(`[ProductGalleryPickerModal] ✅ ${mediaList.length} médias chargés`, {
            produits: produits.length,
            images: mediaList.filter(m => m.type === 'image').length,
            videos: mediaList.filter(m => m.type === 'video').length,
            branding: mediaList.filter(m => m.category === 'branding').length,
            products: mediaList.filter(m => m.category === 'products').length,
        });
        setMedia(mediaList);
        setLoading(false);
    };

    const handleImageError = useCallback((url: string) => {
        setFailedUrls(prev => new Set(prev).add(url));
    }, []);

    const toggleMediaSelection = (url: string) => {
        const newSelection = new Set(selectedMedia);
        if (newSelection.has(url)) {
            newSelection.delete(url);
        } else {
            // Limiter à 5 sélections max
            if (newSelection.size >= 5) {
                Alert.alert('Limite atteinte', 'Vous ne pouvez sélectionner que 5 médias maximum');
                return;
            }
            newSelection.add(url);
        }
        setSelectedMedia(newSelection);
    };

    const handleConfirm = () => {
        const selectedUrls = Array.from(selectedMedia);
        onSelectMedia(selectedUrls);
        setSelectedMedia(new Set());
        onClose();
    };

    const filteredMedia = useMemo(() => media.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'images') return item.type === 'image';
        if (filter === 'videos') return item.type === 'video';
        if (filter === 'products') return item.category === 'products';
        return true;
    }), [media, filter]);

    const imageCount = useMemo(() => media.filter(m => m.type === 'image').length, [media]);
    const videoCount = useMemo(() => media.filter(m => m.type === 'video').length, [media]);
    const productCount = useMemo(() => media.filter(m => m.category === 'products').length, [media]);

    const renderGridItem = useCallback(({ item, index }: { item: any; index: number }) => {
        const isSelected = selectedMedia.has(item.url);
        const isFailed = failedUrls.has(item.url);

        return (
            <TouchableOpacity
                style={[styles.mediaItem, isSelected && styles.mediaItemSelected]}
                onPress={() => toggleMediaSelection(item.url)}
                activeOpacity={0.8}
            >
                {!isFailed ? (
                    item.type === 'video' ? (
                        <View style={styles.videoContainer}>
                            <Image
                                source={{ uri: item.url }}
                                style={styles.mediaImage}
                                resizeMode="cover"
                                onError={() => handleImageError(item.url)}
                            />
                            <View style={styles.videoOverlay}>
                                <View style={styles.playCircle}>
                                    <SafeIcon name="play" size={20} color="#FFFFFF" />
                                </View>
                            </View>
                        </View>
                    ) : (
                        <Image
                            source={{ uri: item.url }}
                            style={styles.mediaImage}
                            resizeMode="cover"
                            onError={() => handleImageError(item.url)}
                        />
                    )
                ) : (
                    <View style={styles.failedPlaceholder}>
                        <SafeIcon name={item.type === 'video' ? 'video-off' : 'image'} size={24} color="#9CA3AF" />
                        <Text style={styles.failedText}>Indisponible</Text>
                    </View>
                )}

                {/* Indicateur de sélection */}
                <View style={[styles.selectionIndicator, isSelected && styles.selectionIndicatorActive]}>
                    {isSelected ? (
                        <SafeIcon name="check" size={14} color="#FFFFFF" />
                    ) : (
                        <View style={styles.selectionIndicatorInner} />
                    )}
                </View>

                {/* Label avec gradient */}
                {item.description && (
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.mediaDescription}
                    >
                        <Text style={styles.mediaDescriptionText} numberOfLines={1}>
                            {item.description}
                        </Text>
                    </LinearGradient>
                )}

                {/* Badge vidéo */}
                {item.type === 'video' && (
                    <View style={styles.videoBadge}>
                        <SafeIcon name="video" size={10} color="#FFFFFF" />
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [selectedMedia, failedUrls, handleImageError]);

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
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <SafeIcon name="x" size={22} color="#374151" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={styles.title}>Galerie du service</Text>
                        <Text style={styles.subtitle}>
                            {selectedMedia.size > 0 ? `${selectedMedia.size} sélectionné(s)` : `${media.length} média${media.length > 1 ? 's' : ''}`}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={selectedMedia.size === 0}
                        style={[styles.confirmButton, selectedMedia.size === 0 && styles.confirmButtonDisabled]}
                    >
                        <SafeIcon name="send" size={16} color={selectedMedia.size > 0 ? '#FFFFFF' : '#9CA3AF'} />
                        <Text style={[styles.confirmText, selectedMedia.size === 0 && styles.confirmTextDisabled]}>
                            {selectedMedia.size || ''}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Filtres */}
                <View style={styles.filtersContainer}>
                    {[
                        { key: 'all' as const, label: 'Tous', count: media.length, icon: 'grid' },
                        { key: 'images' as const, label: 'Photos', count: imageCount, icon: 'image' },
                        { key: 'videos' as const, label: 'Vidéos', count: videoCount, icon: 'video' },
                        { key: 'products' as const, label: 'Produits', count: productCount, icon: 'package' },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                            onPress={() => setFilter(f.key)}
                        >
                            <SafeIcon name={f.icon} size={13} color={filter === f.key ? '#FFFFFF' : '#6B7280'} />
                            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                                {f.label}
                            </Text>
                            <View style={[styles.filterBadge, filter === f.key && styles.filterBadgeActive]}>
                                <Text style={[styles.filterBadgeText, filter === f.key && styles.filterBadgeTextActive]}>
                                    {f.count}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Grille de médias */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Chargement des médias...</Text>
                    </View>
                ) : filteredMedia.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <SafeIcon name={filter === 'videos' ? 'video-off' : 'image'} size={36} color="#9CA3AF" />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {media.length === 0 ? 'Aucun média' : `Aucun résultat`}
                        </Text>
                        <Text style={styles.emptyText}>
                            {media.length === 0
                                ? 'Aucun média trouvé dans ce service'
                                : `Aucun média de type "${filter}"`}
                        </Text>
                        {filter !== 'all' && (
                            <TouchableOpacity style={styles.emptyButton} onPress={() => setFilter('all')}>
                                <Text style={styles.emptyButtonText}>Voir tous les médias</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <FlatList
                        data={filteredMedia}
                        renderItem={renderGridItem}
                        keyExtractor={(item, i) => `${item.url}-${i}`}
                        numColumns={NUM_COLUMNS}
                        columnWrapperStyle={styles.gridRow}
                        contentContainerStyle={styles.gridContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: Platform.OS === 'ios' ? 56 : 16,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    closeBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    confirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    confirmButtonDisabled: {
        backgroundColor: '#E5E7EB',
    },
    confirmText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
    },
    confirmTextDisabled: {
        color: '#9CA3AF',
    },
    filtersContainer: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingVertical: 10,
        gap: 6,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 7,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
    },
    filterChipActive: {
        backgroundColor: modernColors.primary || '#6366F1',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    filterBadge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    filterBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6B7280',
    },
    filterBadgeTextActive: {
        color: '#FFFFFF',
    },
    gridContainer: {
        paddingTop: GRID_GAP,
        paddingHorizontal: GRID_GAP,
        paddingBottom: 40,
    },
    gridRow: {
        gap: GRID_GAP,
        marginBottom: GRID_GAP,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 15,
        color: '#6B7280',
    },
    mediaItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#E5E7EB',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    mediaItemSelected: {
        borderColor: modernColors.primary,
        borderWidth: 3,
        borderRadius: 6,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    videoContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1F2937',
    },
    videoOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    playCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 2,
    },
    failedPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    failedText: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    selectionIndicator: {
        position: 'absolute',
        top: 5,
        right: 5,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    selectionIndicatorActive: {
        backgroundColor: modernColors.primary,
        borderColor: '#FFFFFF',
    },
    selectionIndicatorInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'transparent',
    },
    mediaDescription: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 28,
        justifyContent: 'flex-end',
        paddingHorizontal: 5,
        paddingBottom: 3,
    },
    mediaDescriptionText: {
        fontSize: 9,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    videoBadge: {
        position: 'absolute',
        top: 5,
        left: 5,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(239,68,68,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    emptyButton: {
        marginTop: 20,
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: modernColors.primary || '#6366F1',
    },
    emptyButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default ProductGalleryPickerModal;

