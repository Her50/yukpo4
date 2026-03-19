// ✅ Écran Résultats Recherche Automobile/Véhicules
// ✅ AMÉLIORÉ 2026-03-07: Recherche au niveau PRODUIT via /api/auto/search
// ✅ AMÉLIORÉ 2026-03-07: Communication vendeur (chat, WhatsApp, appel, partage)
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Linking,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { hapticPress } from '../../utils/hapticFeedback';
import { generateSmartShareLink } from '../../utils/productShareHelper';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const ACCENT_COLOR = '#1E3A5F';
const ACCENT_LIGHT = '#2563EB';
const SCREEN_WIDTH = Dimensions.get('window').width;

interface AutoProduct {
    product_id: number;
    service_id: number;
    product_index: number;
    nom: string;
    description: string;
    prix: number | null;
    devise: string;
    marque: string | null;
    modele: string | null;
    type_vehicule: string | null;
    annee: number | null;
    kilometrage: number | null;
    carburant: string | null;
    transmission: string | null;
    couleur: string | null;
    etat: string | null;
    images: string[];
    ville: string | null;
    quartier: string | null;
    distance_km: number | null;
    vendeur_nom: string | null;
    vendeur_user_id: number | null;
    vendeur_telephone: string | null;
    vendeur_whatsapp: string | null;
    created_at: string | null;
}

interface SearchResponse {
    products: AutoProduct[];
    total: number;
    page: number;
    limit: number;
    filters_applied: any;
}

const SORT_OPTIONS = [
    { key: 'recent', label: 'Récent', icon: 'clock' },
    { key: 'price_asc', label: 'Prix croissant', icon: 'trending-up' },
    { key: 'price_desc', label: 'Prix décroissant', icon: 'trending-down' },
    { key: 'year_desc', label: 'Année récente', icon: 'calendar' },
];

const AutoServicesResultsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as { filters?: any } | undefined;
    const initialFilters = params?.filters || {};

    const [results, setResults] = useState<AutoProduct[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [currentSort, setCurrentSort] = useState(initialFilters.sort || 'recent');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());

    const loadResults = useCallback(async (pageNum: number = 0, append: boolean = false) => {
        try {
            if (pageNum === 0) setLoading(true);
            else setLoadingMore(true);

            // Construire les query params depuis les filtres
            const queryParams = new URLSearchParams();
            if (initialFilters.q) queryParams.append('q', initialFilters.q);
            if (initialFilters.marque) queryParams.append('marque', initialFilters.marque);
            if (initialFilters.type_vehicule) queryParams.append('type_vehicule', initialFilters.type_vehicule);
            if (initialFilters.carburant) queryParams.append('carburant', initialFilters.carburant);
            if (initialFilters.transmission) queryParams.append('transmission', initialFilters.transmission);
            if (initialFilters.couleur) queryParams.append('couleur', initialFilters.couleur);
            if (initialFilters.etat) queryParams.append('etat', initialFilters.etat);
            if (initialFilters.prix_min) queryParams.append('prix_min', initialFilters.prix_min.toString());
            if (initialFilters.prix_max) queryParams.append('prix_max', initialFilters.prix_max.toString());
            if (initialFilters.annee_min) queryParams.append('annee_min', initialFilters.annee_min.toString());
            if (initialFilters.annee_max) queryParams.append('annee_max', initialFilters.annee_max.toString());
            if (initialFilters.km_max) queryParams.append('km_max', initialFilters.km_max.toString());
            if (initialFilters.gps_lat) queryParams.append('gps_lat', initialFilters.gps_lat.toString());
            if (initialFilters.gps_lon) queryParams.append('gps_lon', initialFilters.gps_lon.toString());
            if (initialFilters.rayon_km) queryParams.append('rayon_km', initialFilters.rayon_km.toString());
            queryParams.append('sort', currentSort);
            queryParams.append('page', pageNum.toString());
            queryParams.append('limit', '20');

            const response = await apiGet<SearchResponse>(`/api/auto/search?${queryParams.toString()}`);
            const backendData = response?.data as any;

            if (backendData && backendData.products) {
                const newProducts = backendData.products as AutoProduct[];
                if (append) {
                    setResults(prev => [...prev, ...newProducts]);
                } else {
                    setResults(newProducts);
                }
                setTotal(backendData.total || 0);
                setHasMore(newProducts.length >= 20);
                setPage(pageNum);
            } else {
                if (!append) {
                    setResults([]);
                    setTotal(0);
                }
                setHasMore(false);
            }
        } catch (error: any) {
            console.error('[AutoResults] Erreur:', error);
            if (!append) {
                Alert.alert('Erreur', 'Impossible de charger les résultats');
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [initialFilters, currentSort]);

    useEffect(() => {
        loadResults(0, false);
    }, [loadResults]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadResults(0, false);
    };

    const handleLoadMore = () => {
        if (!loadingMore && hasMore && !loading) {
            loadResults(page + 1, true);
        }
    };

    const handleSortChange = (sortKey: string) => {
        hapticPress();
        setCurrentSort(sortKey);
        setShowSortMenu(false);
        setPage(0);
        // loadResults will be called by the useEffect on currentSort change
    };

    const formatPrice = (price: number | null, devise: string) => {
        if (!price || price === 0) return 'Prix sur demande';
        return `${price.toLocaleString('fr-FR')} ${devise}`;
    };

    const formatKm = (km: number | null) => {
        if (!km) return null;
        if (km >= 1000) return `${(km / 1000).toFixed(0)}k km`;
        return `${km} km`;
    };

    // Active filters as chips
    const activeFiltersList = Object.entries(initialFilters)
        .filter(([key, val]) => val && key !== 'sort' && key !== 'gps_lat' && key !== 'gps_lon' && key !== 'rayon_km')
        .map(([key, val]) => {
            const labels: Record<string, string> = {
                q: 'Recherche', marque: 'Marque', type_vehicule: 'Type', carburant: 'Carburant',
                transmission: 'Transmission', couleur: 'Couleur', etat: 'État',
                prix_min: 'Prix min', prix_max: 'Prix max', annee_min: 'Depuis', annee_max: "Jusqu'à",
                km_max: 'Km max', ville: 'Ville', quartier: 'Quartier',
            };
            return { key, label: labels[key] || key, value: String(val) };
        });

    const renderVehicleCard = ({ item }: { item: AutoProduct }) => {
        const hasImage = item.images && item.images.length > 0;
        const displayTitle = item.nom || [item.marque, item.modele].filter(Boolean).join(' ') || 'Véhicule';
        const specs = [
            item.annee ? `${item.annee}` : null,
            formatKm(item.kilometrage),
            item.carburant,
            item.transmission,
        ].filter(Boolean);

        return (
            <TouchableOpacity
                style={styles.vehicleCard}
                onPress={() => navigation.navigate('ServiceDetail' as never, { serviceId: item.service_id } as never)}
                activeOpacity={0.7}
            >
                {/* Image */}
                <View style={styles.imageContainer}>
                    {hasImage ? (
                        <Image
                            source={{ uri: item.images[0] }}
                            style={styles.vehicleImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.noImageContainer}>
                            <SafeIcon name="car" size={36} color="#CBD5E1" type="lucide" />
                            <Text style={styles.noImageText}>Pas de photo</Text>
                        </View>
                    )}
                    {/* Badge état */}
                    {item.etat && (
                        <View style={[styles.etatBadge, item.etat.toLowerCase().includes('neuf') ? styles.etatNeuf : styles.etatOccasion]}>
                            <Text style={styles.etatText}>{item.etat}</Text>
                        </View>
                    )}
                    {/* Badge distance */}
                    {item.distance_km != null && item.distance_km > 0 && (
                        <View style={styles.distanceBadge}>
                            <SafeIcon name="navigation" size={10} color="#FFFFFF" type="lucide" />
                            <Text style={styles.distanceText}>{item.distance_km.toFixed(1)} km</Text>
                        </View>
                    )}
                    {/* Image count badge */}
                    {item.images.length > 1 && (
                        <View style={styles.imageCountBadge}>
                            <SafeIcon name="camera" size={10} color="#FFFFFF" type="lucide" />
                            <Text style={styles.imageCountText}>{item.images.length}</Text>
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                    <Text style={styles.vehicleTitle} numberOfLines={2}>{displayTitle}</Text>

                    {/* Specs row */}
                    {specs.length > 0 && (
                        <View style={styles.specsRow}>
                            {specs.map((spec, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <Text style={styles.specSep}>·</Text>}
                                    <Text style={styles.specText}>{spec}</Text>
                                </React.Fragment>
                            ))}
                        </View>
                    )}

                    {/* Couleur */}
                    {item.couleur && (
                        <View style={styles.detailRow}>
                            <SafeIcon name="palette" size={12} color="#94A3B8" type="lucide" />
                            <Text style={styles.detailText}>{item.couleur}</Text>
                        </View>
                    )}

                    {/* Location */}
                    {(item.ville || item.quartier) && (
                        <View style={styles.detailRow}>
                            <SafeIcon name="map-pin" size={12} color="#94A3B8" type="lucide" />
                            <Text style={styles.detailText} numberOfLines={1}>
                                {[item.quartier, item.ville].filter(Boolean).join(', ')}
                            </Text>
                        </View>
                    )}

                    {/* Bottom: Price + Vendeur */}
                    <View style={styles.cardBottom}>
                        <Text style={styles.priceText}>{formatPrice(item.prix, item.devise)}</Text>
                        {item.vendeur_nom && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (item.vendeur_user_id) {
                                        (navigation as any).navigate('PrestataireBoutique', {
                                            userId: item.vendeur_user_id,
                                            user_id: item.vendeur_user_id,
                                            prestataireName: item.vendeur_nom,
                                            name: item.vendeur_nom,
                                        });
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={styles.vendeurRow}>
                                    <SafeIcon name="store" size={10} color="#6366F1" />
                                    <Text style={styles.vendeurText} numberOfLines={1}>{item.vendeur_nom}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* ✅ Section avis/commentaires pour éviter les fraudes */}
                    <TouchableOpacity
                        style={styles.reviewsToggle}
                        onPress={() => {
                            hapticPress();
                            setExpandedComments(prev => {
                                const next = new Set(prev);
                                if (next.has(item.product_id)) next.delete(item.product_id);
                                else next.add(item.product_id);
                                return next;
                            });
                        }}
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="star" size={14} color="#F59E0B" />
                        <Text style={styles.reviewsToggleText}>
                            {expandedComments.has(item.product_id) ? 'Masquer les avis' : 'Voir les avis & commentaires'}
                        </Text>
                        <SafeIcon
                            name={expandedComments.has(item.product_id) ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color="#94A3B8"
                        />
                    </TouchableOpacity>

                    {expandedComments.has(item.product_id) && (
                        <View style={styles.commentsContainer}>
                            <ProductCommentsSection
                                serviceId={item.service_id}
                                productIndex={item.product_index}
                                serviceTitle={item.nom}
                                onOpenChat={(userId, userName, userAvatar) => {
                                    if (!user) {
                                        Alert.alert('Connexion requise', 'Veuillez vous connecter pour discuter', [
                                            { text: t('common.cancel'), style: 'cancel' },
                                            { text: t('common.login'), onPress: () => (navigation as any).navigate('Login') },
                                        ]);
                                        return;
                                    }
                                    (navigation as any).navigate('ServiceDetail', {
                                        serviceId: item.service_id,
                                        openChat: true,
                                    });
                                }}
                                mode="inline"
                                compact={true}
                                displayLimit={3}
                            />
                        </View>
                    )}

                    {/* ✅ Boutons de communication vendeur */}
                    <View style={styles.actionButtonsRow}>
                        {/* Chat in-app */}
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleChat(item)}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="message-circle" size={16} color={ACCENT_LIGHT} />
                            <Text style={styles.actionBtnText}>Chat</Text>
                        </TouchableOpacity>

                        {/* WhatsApp */}
                        {item.vendeur_whatsapp && (
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.actionBtnWhatsapp]}
                                onPress={() => handleWhatsApp(item)}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="message-circle" size={16} color="#25D366" />
                                <Text style={[styles.actionBtnText, { color: '#25D366' }]}>WhatsApp</Text>
                            </TouchableOpacity>
                        )}

                        {/* Appeler */}
                        {item.vendeur_telephone && (
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => handleCall(item)}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="phone" size={16} color="#3B82F6" />
                                <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Appeler</Text>
                            </TouchableOpacity>
                        )}

                        {/* Partager */}
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleShare(item)}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="share" size={16} color="#8B5CF6" />
                            <Text style={[styles.actionBtnText, { color: '#8B5CF6' }]}>Partager</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // ===== Communication handlers =====

    const handleChat = useCallback((item: AutoProduct) => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour contacter le vendeur', [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.login'), onPress: () => (navigation as any).navigate('Login') },
            ]);
            return;
        }
        // Naviguer vers le service detail avec ouverture chat
        (navigation as any).navigate('ServiceDetail', {
            serviceId: item.service_id,
            openChat: true,
        });
    }, [user, navigation]);

    const handleWhatsApp = useCallback(async (item: AutoProduct) => {
        if (!item.vendeur_whatsapp) return;
        try {
            const phoneNumber = item.vendeur_whatsapp.replace(/\s+/g, '');
            const message = `Bonjour, je suis intéressé par votre véhicule "${item.nom}"${item.prix ? ` à ${item.prix.toLocaleString('fr-FR')} ${item.devise}` : ''}. Est-il toujours disponible ?`;
            const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
            const canOpen = await Linking.canOpenURL(whatsappUrl);
            if (canOpen) {
                await Linking.openURL(whatsappUrl);
                // Notification au vendeur
                if (user && item.vendeur_user_id) {
                    apiPost('/api/notifications', {
                        user_id: item.vendeur_user_id,
                        title: `📱 ${user.name} vous contacte sur WhatsApp`,
                        message: `Au sujet de: ${item.nom}`,
                        type: 'whatsapp_contact',
                        priority: 'high',
                    }).catch(() => { });
                }
            } else {
                Alert.alert('Erreur', "WhatsApp n'est pas installé sur cet appareil");
            }
        } catch (error) {
            console.error('[AutoResults] Erreur WhatsApp:', error);
            Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp");
        }
    }, [user]);

    const handleCall = useCallback(async (item: AutoProduct) => {
        if (!item.vendeur_telephone) return;
        try {
            const phoneNumber = item.vendeur_telephone.replace(/\s+/g, '');
            const telUrl = `tel:${phoneNumber}`;
            const canOpen = await Linking.canOpenURL(telUrl);
            if (canOpen) {
                await Linking.openURL(telUrl);
                // Notification au vendeur
                if (user && item.vendeur_user_id) {
                    apiPost('/api/notifications', {
                        user_id: item.vendeur_user_id,
                        title: `📞 ${user.name} souhaite vous appeler`,
                        message: `Au sujet de: ${item.nom}`,
                        type: 'phone_call',
                        priority: 'high',
                    }).catch(() => { });
                }
            } else {
                Alert.alert('Erreur', "Impossible d'ouvrir le téléphone");
            }
        } catch (error) {
            console.error('[AutoResults] Erreur appel:', error);
        }
    }, [user]);

    const handleShare = useCallback(async (item: AutoProduct) => {
        try {
            const productName = item.nom || 'Véhicule';
            const specs = [item.marque, item.modele, item.annee ? `${item.annee}` : null, item.carburant].filter(Boolean).join(' · ');
            const priceStr = item.prix ? `${item.prix.toLocaleString('fr-FR')} ${item.devise}` : 'Prix sur demande';
            const smartLink = generateSmartShareLink(item.product_index, item.service_id);
            const message = `🚗 ${productName}\n${specs ? `📋 ${specs}\n` : ''}💰 ${priceStr}\n\n${smartLink}`;

            await Share.share({
                message,
                title: productName,
                url: smartLink,
            });
        } catch (error) {
            console.error('[AutoResults] Erreur partage:', error);
        }
    }, []);

    const currentSortLabel = SORT_OPTIONS.find(s => s.key === currentSort)?.label || 'Récent';

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.title}>Résultats</Text>
                    <Text style={styles.subtitle}>
                        {loading ? 'Recherche...' : `${total} véhicule${total > 1 ? 's' : ''}`}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => { hapticPress(); setShowSortMenu(!showSortMenu); }} style={styles.sortButton}>
                    <SafeIcon name="sliders" size={20} color={ACCENT_COLOR} type="lucide" />
                </TouchableOpacity>
            </View>

            {/* Sort menu dropdown */}
            {showSortMenu && (
                <View style={styles.sortMenu}>
                    {SORT_OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt.key}
                            style={[styles.sortOption, currentSort === opt.key && styles.sortOptionActive]}
                            onPress={() => handleSortChange(opt.key)}
                        >
                            <SafeIcon name={opt.icon} size={16} color={currentSort === opt.key ? ACCENT_LIGHT : '#64748B'} type="lucide" />
                            <Text style={[styles.sortOptionText, currentSort === opt.key && styles.sortOptionTextActive]}>
                                {opt.label}
                            </Text>
                            {currentSort === opt.key && (
                                <SafeIcon name="check" size={16} color={ACCENT_LIGHT} type="lucide" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Active filters chips */}
            {activeFiltersList.length > 0 && (
                <View style={styles.activeFiltersContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
                        {activeFiltersList.map(f => (
                            <View key={f.key} style={styles.activeChip}>
                                <Text style={styles.activeChipLabel}>{f.label}:</Text>
                                <Text style={styles.activeChipValue}>{f.value}</Text>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.editFiltersChip} onPress={() => navigation.goBack()}>
                            <SafeIcon name="edit-2" size={12} color={ACCENT_LIGHT} type="lucide" />
                            <Text style={styles.editFiltersText}>Modifier</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}

            {/* Sort indicator */}
            <View style={styles.sortIndicator}>
                <Text style={styles.sortIndicatorText}>Tri: {currentSortLabel}</Text>
            </View>

            {/* Content */}
            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={ACCENT_LIGHT} />
                    <Text style={styles.loadingText}>Recherche de véhicules...</Text>
                </View>
            ) : results.length === 0 ? (
                <View style={styles.centerContainer}>
                    <View style={styles.emptyIcon}>
                        <SafeIcon name="car" size={48} color="#CBD5E1" type="lucide" />
                    </View>
                    <Text style={styles.emptyTitle}>Aucun véhicule trouvé</Text>
                    <Text style={styles.emptyText}>
                        Essayez d'élargir vos critères de recherche ou de modifier les filtres.
                    </Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
                        <SafeIcon name="sliders" size={18} color="#FFFFFF" type="lucide" />
                        <Text style={styles.retryText}>Modifier les filtres</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.viewAllButton} onPress={() => {
                        hapticPress();
                        // Reload with no filters
                        setResults([]);
                        setTotal(0);
                        setPage(0);
                        const queryParams = new URLSearchParams();
                        queryParams.append('sort', currentSort);
                        queryParams.append('page', '0');
                        queryParams.append('limit', '20');
                        apiGet<SearchResponse>(`/api/auto/search?${queryParams.toString()}`).then(resp => {
                            const bd = resp?.data as any;
                            if (bd?.products) {
                                setResults(bd.products);
                                setTotal(bd.total || 0);
                            }
                        }).catch(() => { });
                    }}>
                        <Text style={styles.viewAllText}>Voir tous les véhicules</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={results}
                    renderItem={renderVehicleCard}
                    keyExtractor={(item) => `${item.service_id}-${item.product_index}`}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[ACCENT_LIGHT]} />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.loadingMoreContainer}>
                                <ActivityIndicator size="small" color={ACCENT_LIGHT} />
                                <Text style={styles.loadingMoreText}>Chargement...</Text>
                            </View>
                        ) : !hasMore && results.length > 0 ? (
                            <Text style={styles.endText}>Tous les résultats affichés</Text>
                        ) : null
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    },
    backButton: { padding: 4, marginRight: 8 },
    headerCenter: { flex: 1 },
    title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    subtitle: { fontSize: 13, color: '#64748B', marginTop: 1 },
    sortButton: {
        width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9',
        justifyContent: 'center', alignItems: 'center',
    },
    sortMenu: {
        backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
        paddingHorizontal: 16, paddingVertical: 8,
    },
    sortOption: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    },
    sortOptionActive: {},
    sortOptionText: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
    sortOptionTextActive: { color: ACCENT_LIGHT, fontWeight: '600' },
    activeFiltersContainer: {
        backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
        paddingVertical: 8,
    },
    activeFiltersScroll: { paddingHorizontal: 16, gap: 8 },
    activeChip: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4,
    },
    activeChipLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
    activeChipValue: { fontSize: 12, color: ACCENT_COLOR, fontWeight: '600' },
    editFiltersChip: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4,
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    editFiltersText: { fontSize: 12, color: ACCENT_LIGHT, fontWeight: '600' },
    sortIndicator: {
        paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#F8FAFC',
    },
    sortIndicatorText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    loadingText: { marginTop: 12, fontSize: 15, color: '#64748B' },
    emptyIcon: {
        width: 80, height: 80, borderRadius: 20, backgroundColor: '#F1F5F9',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
    emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 280 },
    retryButton: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 24, paddingVertical: 14, backgroundColor: ACCENT_COLOR, borderRadius: 12,
    },
    retryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
    viewAllButton: { marginTop: 12, paddingVertical: 10 },
    viewAllText: { fontSize: 14, color: ACCENT_LIGHT, fontWeight: '600' },
    listContent: { padding: 16 },
    vehicleCard: {
        backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
        shadowRadius: 6, elevation: 2, overflow: 'hidden',
    },
    imageContainer: {
        width: '100%', height: 180, backgroundColor: '#F1F5F9', position: 'relative',
    },
    vehicleImage: { width: '100%', height: '100%' },
    noImageContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9',
    },
    noImageText: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
    etatBadge: {
        position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 6,
    },
    etatNeuf: { backgroundColor: '#059669' },
    etatOccasion: { backgroundColor: '#D97706' },
    etatText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase' },
    distanceBadge: {
        position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 6, gap: 4,
    },
    distanceText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
    imageCountBadge: {
        position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 6, gap: 4,
    },
    imageCountText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
    cardInfo: { padding: 14 },
    vehicleTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
    specsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 },
    specText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    specSep: { fontSize: 13, color: '#CBD5E1', marginHorizontal: 6 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    detailText: { fontSize: 12, color: '#64748B' },
    cardBottom: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    },
    priceText: { fontSize: 17, fontWeight: '800', color: ACCENT_COLOR },
    vendeurRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    vendeurText: { fontSize: 12, color: '#6366F1', maxWidth: 120, fontWeight: '500' },
    actionButtonsRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
        paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9',
    },
    actionBtnWhatsapp: { backgroundColor: '#F0FFF4' },
    actionBtnText: { fontSize: 11, fontWeight: '600', color: ACCENT_LIGHT },
    reviewsToggle: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    },
    reviewsToggleText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    commentsContainer: {
        marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    },
    loadingMoreContainer: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, gap: 8,
    },
    loadingMoreText: { fontSize: 13, color: '#64748B' },
    endText: { textAlign: 'center', fontSize: 13, color: '#94A3B8', padding: 16 },
});

export default AutoServicesResultsScreen;
