// 🖼️ Modal galerie service - Affiche tous les médias d'un service (branding, produits, réalisations)
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Modal,
    Platform,
    Image as RNImage,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { config } from '../config/environment';
import { apiGet, mediaApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_GAP = 3;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

// ✅ CORRIGÉ: Convertir chemins relatifs en URLs complètes via /api/media/files/
const buildMediaUrl = (path: string | undefined | null): string => {
    if (!path) return '';
    const p = typeof path === 'string' ? path.trim() : '';
    if (!p) return '';
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
    const cleanPath = p.replace(/^\//, '');
    const base = (config.API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}/api/media/files/${cleanPath}` : cleanPath;
};

interface GalleryItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    category: 'branding' | 'product' | 'realisation';
    label?: string;
}

interface Service {
    id: string;
    titre: string;
    description: string;
    user_id: string;
    data?: any;
    [key: string]: any;
}

interface ServiceGalleryModalProps {
    visible: boolean;
    service: Service | null;
    onClose: () => void;
}

const extractMediaFromField = (field: any): string[] => {
    if (!field) return [];
    if (typeof field === 'string') {
        try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [field];
        } catch {
            return [field];
        }
    }
    if (Array.isArray(field)) return field;
    if (field && typeof field === 'object' && field.valeur) {
        return Array.isArray(field.valeur) ? field.valeur : [field.valeur];
    }
    return [];
};

// ✅ FIX 2026-03-11: Normaliser la clé de déduplication pour éviter les doublons
const normalizeDedupeKey = (raw: string): string => {
    if (!raw) return '';
    let key = raw.trim();
    const prefixes = [
        /^https?:\/\/[^/]+\/api\/media\/files\//i,
        /^https?:\/\/storage\.googleapis\.com\/[^/]+\//i,
        /^https?:\/\/[^/]+\.run\.app\/api\/media\/files\//i,
    ];
    for (const prefix of prefixes) {
        key = key.replace(prefix, '');
    }
    key = key.split('?')[0];
    key = key.replace(/^\//, '');
    return key.toLowerCase();
};

const ServiceGalleryModal: React.FC<ServiceGalleryModalProps> = ({
    visible,
    service,
    onClose,
}) => {
    const [media, setMedia] = React.useState<GalleryItem[]>([]);
        const { t } = useLanguageSafe();
const [filter, setFilter] = useState<'all' | 'images' | 'videos'>('all');
    const [selectedMedia, setSelectedMedia] = useState<GalleryItem | null>(null);
    const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const videoRef = useRef<ExpoVideo | null>(null);

    React.useEffect(() => {
        if (visible && service) {
            loadMedia();
        } else {
            setMedia([]);
        }
    }, [visible, service]);

    const handleImageError = useCallback((url: string) => {
        setFailedUrls(prev => new Set(prev).add(url));
    }, []);

    const loadMedia = async () => {
        if (!service) return;
        setLoading(true);
        const items: GalleryItem[] = [];
        const seen = new Set<string>();
        let counter = 0;
        const serviceId = service.id || service.service_id;

        const addItem = (rawUrl: string, type: 'image' | 'video', category: GalleryItem['category'], label?: string) => {
            const url = buildMediaUrl(rawUrl);
            // ✅ FIX 2026-03-11: Déduplication sur clé normalisée (chemin relatif)
            const dedupeKey = normalizeDedupeKey(rawUrl) || normalizeDedupeKey(url);
            if (url && dedupeKey && !seen.has(dedupeKey)) {
                seen.add(dedupeKey);
                items.push({ id: `${category}-${type}-${counter++}`, url, type, category, label });
            }
        };

        // 1. Branding (logo, banner)
        extractMediaFromField(service.data?.logo).forEach(u => addItem(u, 'image', 'branding', 'Logo'));
        extractMediaFromField(service.data?.banner).forEach(u => addItem(u, 'image', 'branding', 'Banniere'));
        extractMediaFromField(service.data?.banniere).forEach(u => addItem(u, 'image', 'branding', 'Banniere'));

        // 2. Realisations generales
        extractMediaFromField(service.data?.images_realisations).forEach(u => addItem(u, 'image', 'realisation', 'Realisation'));
        extractMediaFromField(service.data?.videos).forEach(u => addItem(u, 'video', 'realisation', 'Realisation'));

        // 3. Charger les produits et medias depuis les APIs
        let apiProductsLoaded = false;
        if (serviceId) {
            try {
                // Map product_index -> product_name pour etiqueter les medias
                let productNameMap: Record<number, string> = {};
                try {
                    const productsResp = await apiGet<any[]>(`/api/services/${serviceId}/products`);
                    const productsData = (productsResp as any)?.data;
                    const productsList = Array.isArray(productsData) ? productsData
                        : Array.isArray((productsData as any)?.data) ? (productsData as any).data : [];
                    productsList.forEach((p: any) => {
                        const idx = p.product_index ?? p.productIndex;
                        const name = p.product_name || p.productName
                            || p.product_data?.nom?.valeur || p.product_data?.nom
                            || p.product_data?.title || `Produit ${(idx ?? 0) + 1}`;
                        if (idx !== undefined && idx !== null) {
                            productNameMap[idx] = name;
                        }
                        // Extraire images/videos depuis product_data
                        const pd = p.product_data || {};
                        extractMediaFromField(pd.images).forEach((u: string) => addItem(u, 'image', 'product', name));
                        extractMediaFromField(pd.videos).forEach((u: string) => addItem(u, 'video', 'product', name));
                    });
                    apiProductsLoaded = productsList.length > 0;
                } catch (e) {
                    console.warn('[ServiceGalleryModal] Produits API non disponible:', e);
                }

                // Charger medias depuis la table media
                const mediaResponse = await mediaApi.getServiceMediaDetailed(serviceId);
                if (mediaResponse.success && mediaResponse.data) {
                    const respData = mediaResponse.data as any;
                    const apiMedia = Array.isArray(respData) ? respData
                        : respData?.media || respData?.data || [];
                    apiMedia.forEach((m: any) => {
                        const path = m.path || m.url || m.file_path;
                        const idx = m.product_index;
                        const label = (idx !== null && idx !== undefined)
                            ? (productNameMap[idx] || `Produit ${idx + 1}`)
                            : (m.type === 'video' ? 'Video' : 'Image');
                        addItem(path, m.type === 'video' ? 'video' : 'image', idx !== null && idx !== undefined ? 'product' : 'realisation', label);
                    });
                }
            } catch (e) {
                console.warn('[ServiceGalleryModal] Erreur chargement API medias:', e);
            }
        }

        // ✅ FIX 2026-03-11: Fallback produits embarqués seulement si l'API n'a pas fourni les données
        if (!apiProductsLoaded) {
            const produits = extractMediaFromField(service.data?.produits);
            if (Array.isArray(produits)) {
                produits.forEach((prod: any) => {
                    const pName = prod.nom || prod.title || 'Produit';
                    extractMediaFromField(prod.images).forEach(u => addItem(u, 'image', 'product', pName));
                    extractMediaFromField(prod.videos).forEach(u => addItem(u, 'video', 'product', pName));
                    extractMediaFromField(prod.imagesRealisations).forEach(u => addItem(u, 'image', 'product', pName));
                    extractMediaFromField(prod.videosRealisations).forEach(u => addItem(u, 'video', 'product', pName));
                });
            }
        }

        // Trier: branding d'abord, puis produits groupes par label, puis realisations
        items.sort((a, b) => {
            const order = { branding: 0, product: 1, realisation: 2 };
            const diff = order[a.category] - order[b.category];
            if (diff !== 0) return diff;
            return (a.label || '').localeCompare(b.label || '');
        });

        setFailedUrls(new Set());
        setMedia(items);
        setLoading(false);
    };

    const filteredMedia = React.useMemo(() => media.filter(item => {
        if (filter === 'images') return item.type === 'image';
        if (filter === 'videos') return item.type === 'video';
        return true;
    }), [media, filter]);

    const imageCount = React.useMemo(() => media.filter(m => m.type === 'image').length, [media]);
    const videoCount = React.useMemo(() => media.filter(m => m.type === 'video').length, [media]);

    const renderGridItem = useCallback(({ item }: { item: GalleryItem }) => {
        const isFailed = failedUrls.has(item.url);
        return (
            <TouchableOpacity
                style={styles.mediaItem}
                onPress={() => setSelectedMedia(item)}
                activeOpacity={0.8}
            >
                {!isFailed ? (
                    item.type === 'video' ? (
                        <View style={styles.videoPlaceholder}>
                            <View style={styles.playCircle}>
                                <SafeIcon name="play" size={22} color="#FFFFFF" />
                            </View>
                        </View>
                    ) : (
                        <RNImage
                            source={{ uri: item.url }}
                            style={styles.mediaImage}
                            resizeMode="cover"
                            onError={() => handleImageError(item.url)}
                        />
                    )
                ) : (
                    <View style={styles.failedPlaceholder}>
                        <SafeIcon name={item.type === 'video' ? 'video-off' : 'image'} size={24} color="#9CA3AF" />
                        <Text style={styles.failedText}>{t('serviceGallery.indisponible')}</Text>
                    </View>
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.itemGradient}>
                    <Text style={styles.itemLabel} numberOfLines={1}>{item.label || item.category}</Text>
                </LinearGradient>
                {item.type === 'video' && (
                    <View style={styles.videoBadge}>
                        <SafeIcon name="video" size={10} color="#FFFFFF" />
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [failedUrls, handleImageError]);

    if (!visible || !service) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#374151" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle} numberOfLines={1}>Galerie du service</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{service.titre}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Filtres */}
                <View style={styles.filtersContainer}>
                    {[
                        { key: 'all' as const, label: 'Tous', count: media.length, icon: 'grid' },
                        { key: 'images' as const, label: 'Photos', count: imageCount, icon: 'image' },
                        { key: 'videos' as const, label: 'Videos', count: videoCount, icon: 'video' },
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
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="loader" size={36} color={modernColors.primary} />
                        <Text style={styles.emptyTitle}>{t('serviceGallery.chargementDesMedias')}</Text>
                    </View>
                ) : media.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <SafeIcon name="image" size={36} color="#9CA3AF" />
                        </View>
                        <Text style={styles.emptyTitle}>{t('serviceGallery.aucunMediaDisponible')}</Text>
                        <Text style={styles.emptyText}>
                            Ce service ne contient pas d'images ou de videos pour le moment.
                        </Text>
                    </View>
                ) : filteredMedia.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <SafeIcon name={filter === 'videos' ? 'video-off' : 'image'} size={36} color="#9CA3AF" />
                        </View>
                        <Text style={styles.emptyTitle}>{t('serviceGallery.aucunResultat')}</Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={() => setFilter('all')}>
                            <Text style={styles.emptyButtonText}>{t('serviceGallery.voirTousLesMedias')}/Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={filteredMedia}
                        renderItem={renderGridItem}
                        keyExtractor={item => item.id}
                        numColumns={NUM_COLUMNS}
                        columnWrapperStyle={styles.gridRow}
                        contentContainerStyle={styles.gridContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* Fullscreen modal */}
                {selectedMedia && (
                    <Modal visible={!!selectedMedia} animationType="fade" transparent onRequestClose={() => setSelectedMedia(null)}>
                        <View style={styles.fullScreenContainer}>
                            <View style={styles.fullScreenHeader}>
                                <TouchableOpacity onPress={() => setSelectedMedia(null)} style={styles.fullScreenCloseBtn}>
                                    <SafeIcon name="x" size={24} color="#FFFFFF" />
                                </TouchableOpacity>
                                <View style={styles.fullScreenInfo}>
                                    <Text style={styles.fullScreenTitle} numberOfLines={1}>{selectedMedia.label || selectedMedia.category}</Text>
                                    <Text style={styles.fullScreenSubtitle} numberOfLines={1}>{service.titre}</Text>
                                </View>
                                <View style={{ width: 40 }} />
                            </View>

                            {selectedMedia.type === 'image' ? (
                                <RNImage
                                    source={{ uri: selectedMedia.url }}
                                    style={styles.fullScreenImage}
                                    resizeMode="contain"
                                    onError={() => handleImageError(selectedMedia.url)}
                                />
                            ) : (
                                <ExpoVideo
                                    ref={videoRef}
                                    source={{ uri: selectedMedia.url }}
                                    style={styles.fullScreenVideo}
                                    resizeMode={ResizeMode.CONTAIN}
                                    shouldPlay
                                    useNativeControls
                                    isLooping
                                    onError={(error: any) => console.error('[ServiceGalleryModal] Video error:', error)}
                                />
                            )}

                            {/* Bouton partage */}
                            <TouchableOpacity
                                style={styles.shareButton}
                                onPress={async () => {
                                    try {
                                        const serviceName = service?.titre || service?.data?.titre_service?.valeur || 'Yukpo';
                                        const emoji = selectedMedia.type === 'video' ? '🎬' : '📸';
                                        const typeLabel = selectedMedia.type === 'video' ? t('serviceGalleryModal.video') : 'photo';
                                        let shareText = `${emoji} ${selectedMedia.label || typeLabel} — ${serviceName}`;
                                        shareText += `\n\n🔗 Voir sur Yukpo:\n${selectedMedia.url}`;
                                        await Share.share({ message: shareText, url: selectedMedia.url, title: `${selectedMedia.label || typeLabel} — ${serviceName}` });
                                    } catch (e) { console.warn('[ServiceGalleryModal] Share error:', e); }
                                }}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="Redo2" size={22} color="#FFFFFF" />
                            </TouchableOpacity>

                            {/* Navigation arrows */}
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
    mediaImage: {
        width: '100%',
        height: '100%',
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
    shareButton: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 50 : 30,
        alignSelf: 'center',
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(99,102,241,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ServiceGalleryModal;












