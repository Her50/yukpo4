// 🖼️ Modal de galerie produits - Affiche toutes les images et vidéos de tous les produits
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    View,
} from 'react-native';
import { config } from '../config/environment';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_GAP = 3;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// ✅ CORRIGÉ 2026-03-03: Convertir chemins relatifs en URLs complètes via /api/media/files/
const buildMediaUrl = (path: string | undefined | null): string => {
    if (!path) return '';
    const p = typeof path === 'string' ? path.trim() : '';
    if (!p) return '';
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
    const cleanPath = p.replace(/^\//, '');
    const base = (config.API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/api/media/files/${cleanPath}` : cleanPath;
};

// ✅ CORRIGÉ: Extraire tableau depuis {valeur: [...]} ou tableau simple
const extractMediaArray = (field: any): any[] => {
    if (Array.isArray(field) && field.length > 0) return field;
    if (field && typeof field === 'object' && Array.isArray(field.valeur) && field.valeur.length > 0) return field.valeur;
    if (field && typeof field === 'string' && field.trim()) return [field];
    return [];
};

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
    const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
    const videoRef = useRef<Video | null>(null);

    useEffect(() => {
        if (visible && services && services.length > 0) {
            loadAllMedia();
        } else {
            setMedia([]);
        }
    }, [visible, services]);

    const handleImageError = useCallback((url: string) => {
        setFailedUrls(prev => new Set(prev).add(url));
    }, []);

    const loadAllMedia = async () => {
        setLoading(true);
        setFailedUrls(new Set());
        try {
            const allMedia: MediaItem[] = [];
            const seenUrls = new Set<string>();

            // ✅ 1. Charger les médias depuis les produits (API优先, JSON fallback)
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

                    // ✅ PRIORITÉ 1: Charger depuis API media table (comme ProductGalleryPickerModal)
                    let mediaFromApi: any[] = [];
                    try {
                        const { mediaApi } = await import('../services/api');
                        const mediaResponse = await mediaApi.getServiceMediaDetailed(serviceId);
                        if (mediaResponse.success && mediaResponse.data) {
                            const respData = mediaResponse.data as any;
                            mediaFromApi = Array.isArray(respData) ? respData
                                : respData?.media || respData?.data || [];

                            console.log(`[ProductGalleryModal] Service ${serviceId}: ${mediaFromApi.length} médias depuis API`);
                        }
                    } catch (error) {
                        console.warn(`[ProductGalleryModal] Erreur API médias service ${serviceId}:`, error);
                    }

                    // Ajouter les médias de l'API (avec déduplication)
                    mediaFromApi.forEach((m: any) => {
                        const path = m.path || m.url || m.file_path;
                        const fullUrl = buildMediaUrl(typeof path === 'string' ? path.trim() : null);
                        if (fullUrl && !seenUrls.has(fullUrl)) {
                            seenUrls.add(fullUrl);
                            allMedia.push({
                                id: `api-media-${serviceId}-${m.product_index || 0}-${m.id || Math.random()}`,
                                url: fullUrl,
                                type: m.type === 'video' ? 'video' : 'image',
                                source: 'product_api',
                                productName: m.product_index !== null && m.product_index !== undefined
                                    ? `${productName} (Produit ${m.product_index + 1})`
                                    : productName,
                                serviceId,
                                productIndex: m.product_index || productIndex,
                                serviceName,
                            });
                        }
                    });

                    // ✅ PRIORITÉ 2: Si l'API n'a rien retourné, essayer les anciennes APIs par produit
                    if (mediaFromApi.length === 0) {
                        // Charger images depuis API (ancien système)
                        try {
                            const imagesResp = await apiGet(`/api/media/product/${serviceId}/${productIndex}/images`);
                            if (imagesResp.success && imagesResp.data) {
                                const respImgData = imagesResp.data as any;
                                const images = respImgData?.images || respImgData?.Images || [];
                                if (Array.isArray(images)) {
                                    images.forEach((img: string, idx: number) => {
                                        const url = buildMediaUrl(img);
                                        if (url && !seenUrls.has(url)) {
                                            seenUrls.add(url);
                                            allMedia.push({
                                                id: `product-img-${serviceId}-${productIndex}-${idx}`,
                                                url,
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

                        // Charger vidéos depuis API (ancien système)
                        try {
                            const videosResp = await apiGet(`/api/media/product/${serviceId}/${productIndex}/videos`);
                            if (videosResp.success && videosResp.data) {
                                const respVidData = videosResp.data as any;
                                const videos = respVidData?.videos || respVidData?.Videos || [];
                                if (Array.isArray(videos)) {
                                    videos.forEach((vid: string, idx: number) => {
                                        const url = buildMediaUrl(vid);
                                        if (url && !seenUrls.has(url)) {
                                            seenUrls.add(url);
                                            allMedia.push({
                                                id: `product-video-${serviceId}-${productIndex}-${idx}`,
                                                url,
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
                    }

                    // ✅ PRIORITÉ 3: Fallback JSON direct seulement si aucune donnée de l'API
                    if (mediaFromApi.length === 0 && service.data?.produits) {
                        const produits = extractMediaArray(service.data.produits);

                        produits.forEach((prod: any, prodIdx: number) => {
                            const pName = prod.nom || prod.title || productName;
                            extractMediaArray(prod.images).forEach((img: any, imgIdx: number) => {
                                const rawUrl = typeof img === 'string' ? img : (img?.url || img?.path || img?.valeur);
                                const url = buildMediaUrl(rawUrl);
                                // ✅ FIX: Vérifier la déduplication avec seenUrls
                                if (url && !seenUrls.has(url)) {
                                    seenUrls.add(url);
                                    allMedia.push({
                                        id: `json-img-${serviceId}-${prodIdx}-${imgIdx}`,
                                        url,
                                        type: 'image',
                                        source: 'product_creation',
                                        productName: pName,
                                        serviceId,
                                        productIndex: prodIdx,
                                        serviceName,
                                    });
                                }
                            });

                            extractMediaArray(prod.videos).forEach((vid: any, vidIdx: number) => {
                                const rawUrl = typeof vid === 'string' ? vid : (vid?.url || vid?.path || vid?.valeur);
                                const url = buildMediaUrl(rawUrl);
                                // ✅ FIX: Vérifier la déduplication avec seenUrls
                                if (url && !seenUrls.has(url)) {
                                    seenUrls.add(url);
                                    allMedia.push({
                                        id: `json-video-${serviceId}-${prodIdx}-${vidIdx}`,
                                        url,
                                        type: 'video',
                                        source: 'product_creation',
                                        productName: pName,
                                        serviceId,
                                        productIndex: prodIdx,
                                        serviceName,
                                    });
                                }
                            });
                        });
                    }
                }
            }

            // ✅ 2. Charger les vidéos créées via publicités
            try {
                const publicitesResp = await apiGet('/api/publicites/dashboard');
                if (publicitesResp.success && (publicitesResp.data as any)?.publicites) {
                    const publicites = Array.isArray((publicitesResp.data as any).publicites)
                        ? (publicitesResp.data as any).publicites
                        : [];

                    publicites.forEach((pub: any) => {
                        if (pub.videos && Array.isArray(pub.videos)) {
                            pub.videos.forEach((videoBase64: string, vidIdx: number) => {
                                if (videoBase64 && typeof videoBase64 === 'string') {
                                    const videoUrl = videoBase64.startsWith('data:')
                                        ? videoBase64
                                        : `data:video/mp4;base64,${videoBase64}`;

                                    // ✅ FIX: Déduplication aussi pour les publicités
                                    if (!seenUrls.has(videoUrl)) {
                                        seenUrls.add(videoUrl);
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
                                }
                            });
                        }
                    });
                }
            } catch (error) {
                console.warn('[ProductGalleryModal] Erreur chargement publicités:', error);
            }

            setMedia(allMedia);
            console.log(`[ProductGalleryModal] ✅ Médias chargés: ${allMedia.length} éléments (déduplication: ${seenUrls.size} URLs uniques)`);
        } catch (error) {
            console.error('[ProductGalleryModal] Erreur chargement médias:', error);
            Alert.alert('Erreur', 'Impossible de charger la galerie');
        } finally {
            setLoading(false);
        }
    };

    const filteredMedia = useMemo(() => media.filter((item) => {
        if (filter === 'images') return item.type === 'image';
        if (filter === 'videos') return item.type === 'video';
        return true;
    }), [media, filter]);

    const imageCount = useMemo(() => media.filter(m => m.type === 'image').length, [media]);
    const videoCount = useMemo(() => media.filter(m => m.type === 'video').length, [media]);

    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'product_creation': return '📦 Création produit';
            case 'yukpo_video': return '🎬 Yukpo IA';
            case 'publicite': return '📢 Publicité';
            case 'product_api': return '🖼️ Produit';
            default: return '📁 Autre';
        }
    };

    const renderGridItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => {
        const isSelected = selectedMedia?.id === item.id;
        const isFailed = failedUrls.has(item.url);

        return (
            <TouchableOpacity
                style={[styles.mediaItem, isSelected && styles.mediaItemSelected]}
                onPress={() => setSelectedMedia(item)}
                activeOpacity={0.8}
            >
                {!isFailed ? (
                    item.type === 'video' ? (
                        <View style={styles.videoThumbnail}>
                            {item.thumbnail ? (
                                <Image
                                    source={{ uri: item.thumbnail }}
                                    style={styles.mediaImage}
                                    resizeMode="cover"
                                    onError={() => handleImageError(item.url)}
                                />
                            ) : (
                                <View style={styles.videoPlaceholder}>
                                    <View style={styles.playCircle}>
                                        <SafeIcon name="play" size={22} color="#FFFFFF" />
                                    </View>
                                </View>
                            )}
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

                {/* Label avec gradient */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.itemGradient}
                >
                    <Text style={styles.itemLabel} numberOfLines={1}>
                        {item.productName}
                    </Text>
                </LinearGradient>

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
                        <SafeIcon name="arrow-left" size={22} color="#374151" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Galerie Produits</Text>
                        <Text style={styles.headerSubtitle}>
                            {media.length} média{media.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Filtres */}
                <View style={styles.filtersContainer}>
                    {[
                        { key: 'all' as const, label: 'Tous', count: media.length, icon: 'grid' },
                        { key: 'images' as const, label: 'Photos', count: imageCount, icon: 'image' },
                        { key: 'videos' as const, label: 'Vidéos', count: videoCount, icon: 'video' },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                            onPress={() => setFilter(f.key)}
                        >
                            <SafeIcon name={f.icon} size={14} color={filter === f.key ? '#FFFFFF' : '#6B7280'} />
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

                {/* Contenu */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Chargement de la galerie...</Text>
                    </View>
                ) : filteredMedia.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <SafeIcon name={filter === 'videos' ? 'video-off' : 'image'} size={36} color="#9CA3AF" />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {media.length === 0 ? 'Aucun média' : 'Aucun résultat'}
                        </Text>
                        <Text style={styles.emptyText}>
                            {filter === 'images'
                                ? 'Aucune image dans vos produits'
                                : filter === 'videos'
                                    ? 'Aucune vidéo dans vos produits'
                                    : 'Aucun média dans vos produits'}
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
                        keyExtractor={(item, i) => `${item.id}-${i}`}
                        numColumns={NUM_COLUMNS}
                        columnWrapperStyle={styles.gridRow}
                        contentContainerStyle={styles.gridContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* Modal détail média plein écran */}
                {selectedMedia && (
                    <Modal
                        visible={!!selectedMedia}
                        animationType="fade"
                        transparent
                        onRequestClose={() => setSelectedMedia(null)}
                    >
                        <View style={styles.fullScreenContainer}>
                            {/* Header plein écran */}
                            <View style={styles.fullScreenHeader}>
                                <TouchableOpacity onPress={() => setSelectedMedia(null)} style={styles.fullScreenCloseBtn}>
                                    <SafeIcon name="x" size={24} color="#FFFFFF" />
                                </TouchableOpacity>
                                <View style={styles.fullScreenInfo}>
                                    <Text style={styles.fullScreenTitle} numberOfLines={1}>{selectedMedia.productName}</Text>
                                    {selectedMedia.serviceName && (
                                        <Text style={styles.fullScreenSubtitle} numberOfLines={1}>{selectedMedia.serviceName}</Text>
                                    )}
                                </View>
                                <View style={{ width: 40 }} />
                            </View>

                            {/* Contenu plein écran */}
                            {selectedMedia.type === 'image' ? (
                                <Image
                                    source={{ uri: selectedMedia.url }}
                                    style={styles.fullScreenImage}
                                    resizeMode="contain"
                                    onError={() => handleImageError(selectedMedia.url)}
                                />
                            ) : (
                                <Video
                                    ref={videoRef}
                                    source={{ uri: selectedMedia.url }}
                                    style={styles.fullScreenVideo}
                                    resizeMode={ResizeMode.CONTAIN}
                                    shouldPlay
                                    useNativeControls
                                    isLooping
                                    onError={(error: any) => {
                                        console.error('[ProductGalleryModal] Erreur vidéo:', error);
                                    }}
                                />
                            )}

                            {/* Navigation */}
                            {filteredMedia.indexOf(selectedMedia) > 0 && (
                                <TouchableOpacity
                                    style={[styles.navButton, styles.navButtonLeft]}
                                    onPress={() => {
                                        const idx = filteredMedia.indexOf(selectedMedia);
                                        if (idx > 0) setSelectedMedia(filteredMedia[idx - 1]);
                                    }}
                                >
                                    <SafeIcon name="chevron-left" size={30} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                            {filteredMedia.indexOf(selectedMedia) < filteredMedia.length - 1 && (
                                <TouchableOpacity
                                    style={[styles.navButton, styles.navButtonRight]}
                                    onPress={() => {
                                        const idx = filteredMedia.indexOf(selectedMedia);
                                        if (idx < filteredMedia.length - 1) setSelectedMedia(filteredMedia[idx + 1]);
                                    }}
                                >
                                    <SafeIcon name="chevron-right" size={30} color="#FFFFFF" />
                                </TouchableOpacity>
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
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    filtersContainer: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
    },
    filterChipActive: {
        backgroundColor: modernColors.primary || '#6366F1',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    filterBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    filterBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    filterBadgeText: {
        fontSize: 11,
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
    emptyContainer: {
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
    mediaItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#E5E7EB',
    },
    mediaItemSelected: {
        borderWidth: 3,
        borderColor: modernColors.primary,
        borderRadius: 6,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1F2937',
    },
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1F2937',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 3,
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
    itemGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        justifyContent: 'flex-end',
        paddingHorizontal: 6,
        paddingBottom: 4,
    },
    itemLabel: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    videoBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(239,68,68,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenContainer: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 56 : 16,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    fullScreenCloseBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    fullScreenInfo: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    fullScreenTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    fullScreenSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    fullScreenImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.75,
    },
    fullScreenVideo: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.65,
    },
    navButton: {
        position: 'absolute',
        top: '45%',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    navButtonLeft: {
        left: 12,
    },
    navButtonRight: {
        right: 12,
    },
});

export default ProductGalleryModal;

