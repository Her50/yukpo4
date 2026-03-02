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
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { config } from '../config/environment';
import { mediaApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_GAP = 3;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

interface MediaItem {
    type: 'image' | 'video';
    url: string;
    description: string;
    category?: string;
    source?: string;
}

interface ServiceMediaGalleryProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    prestataireInfo?: any;
}

// ✅ CORRIGÉ 2026-03-03: Utiliser /api/media/files/ comme buildMediaUrl dans les autres composants
// L'ancien normalizeMediaUrl utilisait mediaService CDN qui retournait des URLs incorrectes
const buildMediaUrl = (path: string | undefined | null): string => {
    if (!path) return '';
    const p = typeof path === 'string' ? path.trim() : '';
    if (!p) return '';
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
    const cleanPath = p.replace(/^\//, '');
    const base = (config.API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/api/media/files/${cleanPath}` : cleanPath;
};

const extractMediaArray = (field: any): any[] => {
    if (Array.isArray(field) && field.length > 0) return field;
    if (field && typeof field === 'object' && Array.isArray(field.valeur) && field.valeur.length > 0) return field.valeur;
    if (field && typeof field === 'string' && field.trim()) return [field];
    return [];
};

const extractUrl = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    return (item.valeur || item.url || item.path || '').toString().trim();
};

const ServiceMediaGallery: React.FC<ServiceMediaGalleryProps> = ({
    visible,
    onClose,
    service,
    prestataireInfo
}) => {
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'images' | 'videos'>('all');
    const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
    const videoRef = useRef<Video | null>(null);

    useEffect(() => {
        if (visible && service) {
            loadMedia();
        }
        if (!visible) {
            setSelectedIndex(null);
            setFilter('all');
        }
    }, [visible, service]);

    const loadMedia = useCallback(async () => {
        setLoading(true);
        setFailedUrls(new Set());
        try {
            const mediaList: MediaItem[] = [];
            const seenUrls = new Set<string>();
            const serviceId = service.id || service.service_id;

            const addMedia = (type: 'image' | 'video', rawUrl: any, description: string, category?: string, source?: string) => {
                const raw = extractUrl(rawUrl);
                const url = buildMediaUrl(raw);
                if (url && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    mediaList.push({ type, url, description, category, source });
                }
            };

            // Logo
            const logoVal = service.data?.logo?.valeur || service.data?.logo;
            if (logoVal) addMedia('image', logoVal, 'Logo');

            // Bannière
            const bannerVal = service.data?.banner?.valeur || service.data?.banner;
            if (bannerVal) addMedia('image', bannerVal, 'Bannière');

            // Images du service
            extractMediaArray(service.data?.images).forEach((img: any) => addMedia('image', img, 'Image du service'));

            // Vidéos du service
            extractMediaArray(service.data?.videos).forEach((vid: any) => addMedia('video', vid, 'Vidéo du service'));

            // ✅ Charger depuis l'API media table (nouveau système)
            if (serviceId) {
                try {
                    const mediaResponse = await mediaApi.getServiceMediaDetailed(serviceId);
                    if (mediaResponse.success && mediaResponse.data) {
                        const respData = mediaResponse.data as any;
                        const apiMedia = Array.isArray(respData) ? respData
                            : respData?.media || respData?.data || [];
                        apiMedia.forEach((m: any) => {
                            const path = m.path || m.url || m.file_path;
                            const desc = m.product_index !== null && m.product_index !== undefined
                                ? `Produit ${m.product_index + 1}`
                                : (m.type === 'video' ? 'Vidéo' : 'Image');
                            addMedia(m.type === 'video' ? 'video' : 'image', path, desc, undefined, 'media_table');
                        });
                        console.log(`[ServiceMediaGallery] ✅ ${apiMedia.length} médias depuis API (service ${serviceId})`);
                    }
                } catch (error) {
                    console.warn('[ServiceMediaGallery] ⚠️ Erreur API médias, fallback service.data:', error);
                }
            }

            // Fallback: produits dans service.data
            const products = service.data?.produits || [];
            if (Array.isArray(products)) {
                products.forEach((product: any, index: number) => {
                    const name = product.nom || `Produit ${index + 1}`;
                    const type = product.type || 'autre';
                    extractMediaArray(product.images).forEach((img: any) => addMedia('image', img, name, type, 'services_data'));
                    extractMediaArray(product.videos).forEach((vid: any) => addMedia('video', vid, name, type, 'services_data'));
                });
            }

            console.log(`[ServiceMediaGallery] Total: ${mediaList.length} médias (${mediaList.filter(m => m.type === 'image').length} images, ${mediaList.filter(m => m.type === 'video').length} vidéos)`);
            setMedia(mediaList);
        } catch (error) {
            console.error('[ServiceMediaGallery] Erreur chargement médias:', error);
            Alert.alert('Erreur', 'Impossible de charger les médias');
        } finally {
            setLoading(false);
        }
    }, [service]);

    const filteredMedia = useMemo(() => media.filter(m => {
        if (filter === 'all') return true;
        if (filter === 'images') return m.type === 'image';
        if (filter === 'videos') return m.type === 'video';
        return true;
    }), [media, filter]);

    const imageCount = useMemo(() => media.filter(m => m.type === 'image').length, [media]);
    const videoCount = useMemo(() => media.filter(m => m.type === 'video').length, [media]);

    const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null;
    const nomPrestataire = prestataireInfo?.nom_complet || prestataireInfo?.nom || 'Prestataire';

    const handleImageError = useCallback((url: string) => {
        setFailedUrls(prev => new Set(prev).add(url));
    }, []);

    const navigateFullscreen = useCallback((direction: 'prev' | 'next') => {
        if (selectedIndex === null) return;
        const newIndex = direction === 'next'
            ? Math.min(selectedIndex + 1, filteredMedia.length - 1)
            : Math.max(selectedIndex - 1, 0);
        setSelectedIndex(newIndex);
    }, [selectedIndex, filteredMedia.length]);

    // ✅ Rendu d'un item dans la grille
    const renderGridItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => {
        const isFailed = failedUrls.has(item.url);

        return (
            <TouchableOpacity
                style={styles.mediaItem}
                activeOpacity={0.8}
                onPress={() => setSelectedIndex(index)}
            >
                {item.type === 'image' && !isFailed ? (
                    <Image
                        source={{ uri: item.url }}
                        style={styles.mediaImage}
                        resizeMode="cover"
                        onError={() => handleImageError(item.url)}
                    />
                ) : item.type === 'video' && !isFailed ? (
                    <View style={styles.videoThumb}>
                        <Image
                            source={{ uri: item.url }}
                            style={styles.mediaImage}
                            resizeMode="cover"
                            onError={() => { }}
                        />
                        <View style={styles.videoPlayOverlay}>
                            <View style={styles.playIconCircle}>
                                <SafeIcon name="play" size={22} color="#FFFFFF" />
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.failedPlaceholder}>
                        <SafeIcon name={item.type === 'video' ? 'video-off' : 'image'} size={28} color="#9CA3AF" />
                        <Text style={styles.failedText}>Indisponible</Text>
                    </View>
                )}

                {/* Label en bas avec gradient */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.itemGradient}
                >
                    <Text style={styles.itemLabel} numberOfLines={1}>
                        {item.description}
                    </Text>
                </LinearGradient>

                {/* Badge vidéo */}
                {item.type === 'video' && (
                    <View style={styles.videoBadge}>
                        <SafeIcon name="video" size={12} color="#FFFFFF" />
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [failedUrls, handleImageError]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="arrow-left" size={22} color={modernColors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle} numberOfLines={1}>Galerie de {nomPrestataire}</Text>
                        <Text style={styles.headerSubtitle}>
                            {media.length} média{media.length > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Filtres avec compteurs */}
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
                            <SafeIcon name={f.icon} size={14} color={filter === f.key ? '#FFFFFF' : modernColors.textSecondary} />
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

                {/* Galerie */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Chargement des médias...</Text>
                    </View>
                ) : filteredMedia.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <SafeIcon name={filter === 'videos' ? 'video-off' : 'image'} size={40} color={modernColors.textSecondary} />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {filter === 'all' ? 'Aucun média' : filter === 'images' ? 'Aucune photo' : 'Aucune vidéo'}
                        </Text>
                        <Text style={styles.emptyText}>
                            Ce prestataire n'a pas encore ajouté de {filter === 'all' ? 'média' : filter === 'images' ? 'photo' : 'vidéo'}
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
                        keyExtractor={(_, i) => i.toString()}
                        numColumns={NUM_COLUMNS}
                        columnWrapperStyle={styles.gridRow}
                        contentContainerStyle={styles.galleryContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* Modal plein écran */}
                {selectedMedia && selectedIndex !== null && (
                    <Modal visible={true} transparent animationType="fade" onRequestClose={() => setSelectedIndex(null)}>
                        <View style={styles.fullScreenContainer}>
                            {/* Header plein écran */}
                            <View style={styles.fullScreenHeader}>
                                <TouchableOpacity onPress={() => setSelectedIndex(null)} style={styles.fullScreenCloseBtn}>
                                    <SafeIcon name="x" size={24} color="#FFFFFF" />
                                </TouchableOpacity>
                                <Text style={styles.fullScreenTitle}>{selectedMedia.description}</Text>
                                <Text style={styles.fullScreenCounter}>
                                    {selectedIndex + 1} / {filteredMedia.length}
                                </Text>
                            </View>

                            {/* Contenu */}
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
                                        console.error('[ServiceMediaGallery] Erreur vidéo:', error);
                                    }}
                                />
                            )}

                            {/* Navigation précédent/suivant */}
                            {selectedIndex > 0 && (
                                <TouchableOpacity
                                    style={[styles.navButton, styles.navButtonLeft]}
                                    onPress={() => navigateFullscreen('prev')}
                                >
                                    <SafeIcon name="chevron-left" size={30} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                            {selectedIndex < filteredMedia.length - 1 && (
                                <TouchableOpacity
                                    style={[styles.navButton, styles.navButtonRight]}
                                    onPress={() => navigateFullscreen('next')}
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
    closeButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    headerContent: {
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
        fontSize: 13,
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
    galleryContent: {
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
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    emptyButton: {
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: modernColors.primary || '#6366F1',
    },
    emptyButtonText: {
        fontSize: 14,
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
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    videoThumb: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1F2937',
    },
    videoPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    playIconCircle: {
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
    fullScreenTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        paddingHorizontal: 8,
    },
    fullScreenCounter: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        minWidth: 50,
        textAlign: 'right',
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

export default ServiceMediaGallery;
