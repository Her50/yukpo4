// ✅ Écran Immobilier MODERNE - Refonte complète avec UX de niveau mondial
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import IntelligentChat from '../../components/IntelligentChat';
import IntelligentChatFab from '../../components/IntelligentChatFab';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import ImmobilierResultCard from '../../components/specialized/ImmobilierResultCard';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useAIWithFallback } from '../../hooks/useAIWithFallback';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { immobilierService, PropertySearchFilters, RealEstateProperty } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

const FAVORITES_KEY = '@immobilier_favorites';

type ViewMode = 'list' | 'grid';
type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'date_desc' | 'superficie_desc';

const ImmobilierHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    // ✅ NOUVEAU: Détection automatique de devise depuis GPS
    const detectedCurrency = useCurrencyDetection();

    // ✅ NOUVEAU: Récupérer les paramètres de route pour filtres initiaux (hôtel/meublé)
    const routeParams = (route.params as any) || {};
    const initialFilter = routeParams.initialFilter || {};

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [properties, setProperties] = useState<RealEstateProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);

    // ✅ NOUVEAU: Hook IA avec fallback 3 niveaux
    const { estimatePropertyPrice } = useAIWithFallback();

    // États UI
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [sortBy, setSortBy] = useState<SortOption>('relevance');
    const [showFilters, setShowFilters] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [showChat, setShowChat] = useState(false);

    // Favoris persistés dans AsyncStorage
    const [favorites, setFavorites] = useState<Set<string>>(new Set());

    // Charger les favoris serveur + local fallback au démarrage
    useEffect(() => {
        (async () => {
            try {
                // Essayer d'abord le serveur
                const serverResponse = await immobilierService.getMyFavorites();
                if (serverResponse.success && Array.isArray((serverResponse as any).data)) {
                    const ids = ((serverResponse as any).data as RealEstateProperty[]).map(p => p.id.toString());
                    setFavorites(new Set(ids));
                    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
                    return;
                }
            } catch (e) { /* fallback local */ }
            // Fallback local
            try {
                const stored = await AsyncStorage.getItem(FAVORITES_KEY);
                if (stored) setFavorites(new Set(JSON.parse(stored)));
            } catch (e) { console.warn('[Immobilier] Favoris load error:', e); }
        })();
    }, []);

    // Sauvegarder les favoris localement à chaque changement
    useEffect(() => {
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])).catch(() => { });
    }, [favorites]);

    // ✅ NOUVEAU: Modal simulation prêt
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [loanProperty, setLoanProperty] = useState<RealEstateProperty | null>(null);
    const [loanDuration, setLoanDuration] = useState('20');
    const [loanRate, setLoanRate] = useState('5.5');

    // États de filtres - ✅ NOUVEAU: Initialiser avec les filtres de route si présents
    const [filters, setFilters] = useState<PropertySearchFilters>({
        max_distance_km: 50,
        ...initialFilter, // ✅ Appliquer les filtres initiaux (ex: type_bien: 'hotel' ou 'meuble')
    });
    const [activeFiltersCount, setActiveFiltersCount] = useState(0);

    // Types de biens et statuts - ✅ ALIGNÉS avec ImmobilierFormScreen
    // Valeurs backend : 'maison', 'appartement', 'terrain', 'bureau', 'local_commercial', 'hotel', 'meuble'
    const typesBiens = [
        { value: 'maison', label: 'Maison' },
        { value: 'appartement', label: 'Appartement' },
        { value: 'terrain', label: 'Terrain' },
        { value: 'bureau', label: 'Bureau' },
        { value: 'local_commercial', label: 'Local commercial' },
        { value: 'hotel', label: 'Hôtel' },
        { value: 'meuble', label: 'Meublé / Location meublée' },
    ];
    // Valeurs backend : 'vente', 'location', 'les_deux'
    const statuts = [
        { value: 'vente', label: 'À vendre' },
        { value: 'location', label: 'À louer' },
        { value: 'les_deux', label: 'Vente et location' },
    ];
    const standings = ['Économique', 'Standard', 'Bon standing', 'Haut standing', 'Luxe / Prestige'];

    const sortOptions: { value: SortOption; label: string; icon: string }[] = [
        { value: 'relevance', label: 'Pertinence', icon: 'star' },
        { value: 'price_asc', label: 'Prix croissant', icon: 'arrow-up' },
        { value: 'price_desc', label: 'Prix décroissant', icon: 'arrow-down' },
        { value: 'date_desc', label: 'Plus récents', icon: 'clock' },
        { value: 'superficie_desc', label: 'Plus grand', icon: 'maximize' },
    ];

    // Quick filters (recherches rapides)
    const quickFilters = [
        { id: 'vente', label: 'À vendre', icon: 'tag', statut: 'À vendre' },
        { id: 'location', label: 'À louer', icon: 'key', statut: 'À louer (bail)' },
        { id: 'proche', label: 'Proche de moi', icon: 'map-pin', distance: 10 },
        { id: 'recent', label: 'Nouveautés', icon: 'clock' },
    ];

    // Initialiser avec localisation GPS
    useEffect(() => {
        if (location?.coords) {
            setFilters(prev => ({
                ...prev,
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            }));
        }
    }, [location]);

    // Compter les filtres actifs
    useEffect(() => {
        let count = 0;
        if (filters.type_bien) count++;
        if (filters.statut) count++;
        if (filters.prix_min || filters.prix_max) count++;
        if (filters.superficie_min || filters.superficie_max) count++;
        if (filters.nb_chambres_min) count++;
        if (filters.standing) count++;
        if (filters.ville) count++;
        if (filters.quartier) count++;
        setActiveFiltersCount(count);
    }, [filters]);

    // Charger les biens
    const loadProperties = useCallback(async (page: number = 1, reset: boolean = false) => {
        try {
            if (reset) {
                setLoading(true);
                setError(null);
            }

            const searchFilters: PropertySearchFilters = {
                ...filters,
                page,
                limit: 20,
            };

            // Ajouter recherche textuelle si présente
            if (searchQuery.trim()) {
                // Le backend peut gérer la recherche textuelle via ville/quartier
                // Pour l'instant, on utilise ville comme fallback
                if (!searchFilters.ville && !searchFilters.quartier) {
                    searchFilters.ville = searchQuery.trim();
                }
            }

            const response = await immobilierService.searchProperties(searchFilters);

            if (response.success && response.data) {
                let newProperties = response.data as any;

                // Tri côté client (le backend trie par date_desc par défaut)
                if (sortBy !== 'relevance') {
                    newProperties = [...newProperties].sort((a, b) => {
                        switch (sortBy) {
                            case 'price_asc':
                                const priceA = a.prix_vente || a.prix_location_mensuel || 0;
                                const priceB = b.prix_vente || b.prix_location_mensuel || 0;
                                return priceA - priceB;
                            case 'price_desc':
                                const priceA2 = a.prix_vente || a.prix_location_mensuel || 0;
                                const priceB2 = b.prix_vente || b.prix_location_mensuel || 0;
                                return priceB2 - priceA2;
                            case 'superficie_desc':
                                const superficieA = a.superficie_m2 || 0;
                                const superficieB = b.superficie_m2 || 0;
                                return superficieB - superficieA;
                            default:
                                return 0;
                        }
                    });
                }

                if (reset) {
                    setProperties(newProperties);
                } else {
                    setProperties(prev => [...prev, ...newProperties]);
                }

                setHasMore(newProperties.length === 20);
                setTotalResults(prev => reset ? newProperties.length : prev + newProperties.length);
            } else {
                if (reset) {
                    setError('Aucun bien trouvé');
                    setProperties([]);
                }
                setHasMore(false);
            }
        } catch (err: any) {
            console.error('[ImmobilierHomeScreen] Erreur chargement:', err);
            if (reset) {
                setError(err.message || 'Erreur lors du chargement');
                setProperties([]);
            }
            setHasMore(false);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters, searchQuery]);

    // Charger au montage et lors des changements de filtres
    useEffect(() => {
        setCurrentPage(1);
        loadProperties(1, true);
    }, [filters, sortBy]);

    const handleRefresh = () => {
        setRefreshing(true);
        setCurrentPage(1);
        loadProperties(1, true);
    };

    const handleLoadMore = () => {
        if (!loading && hasMore && !refreshing) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            loadProperties(nextPage, false);
        }
    };

    const handlePropertyPress = (property: RealEstateProperty) => {
        hapticPress();
        (navigation as any).navigate('ImmobilierDetails', {
            propertyId: property.id,
        });
    };

    // Toggle favori avec sync serveur
    const handleToggleFavorite = (property: RealEstateProperty) => {
        hapticPress();
        const id = property.id.toString();
        const isFav = favorites.has(id);
        // Optimistic update
        setFavorites(prev => {
            const next = new Set(prev);
            isFav ? next.delete(id) : next.add(id);
            return next;
        });
        // Sync serveur en arrière-plan
        if (isFav) {
            immobilierService.removeFromFavorites(property.id).catch(() => { });
        } else {
            immobilierService.addToFavorites(property.id).catch(() => { });
        }
    };

    // Track view quand l'utilisateur ouvre un bien
    const handlePropertyPressWithTracking = (property: RealEstateProperty) => {
        immobilierService.trackPropertyView(property.id, undefined, undefined, 'search').catch(() => { });
        handlePropertyPress(property);
    };

    // Partager un bien
    const handleShareProperty = async (property: RealEstateProperty) => {
        hapticPress();
        try {
            const resp = await immobilierService.shareProperty(property.id, 'link');
            if ((resp as any).success && (resp as any).share_url) {
                const { Share } = require('react-native');
                await Share.share({
                    message: `${property.titre} - ${property.ville || ''}\n${(resp as any).share_url}`,
                    url: (resp as any).share_url,
                });
            }
        } catch (e) { console.warn('[Immobilier] Share error:', e); }
    };

    // Réserver une visite
    const handleBookVisit = async (property: RealEstateProperty) => {
        hapticPress();
        Alert.alert(
            'Réserver une visite',
            `Voulez-vous réserver une visite pour "${property.titre}" ?`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.reserve'),
                    onPress: async () => {
                        try {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const dateStr = tomorrow.toISOString().split('T')[0];
                            const resp = await immobilierService.bookVisit(property.id, dateStr, '10:00', 'en_personne');
                            if ((resp as any).success) {
                                Alert.alert('Succès', 'Visite réservée ! Vous serez contacté pour confirmation.');
                            } else {
                                Alert.alert('Erreur', 'Impossible de réserver la visite.');
                            }
                        } catch (e) {
                            Alert.alert('Erreur', 'Service momentanément indisponible.');
                        }
                    },
                },
            ]
        );
    };

    // ✅ NOUVEAU: Simulation prêt immobilier
    const handleLoanSimulation = (property: RealEstateProperty) => {
        hapticPress();
        setLoanProperty(property);
        setShowLoanModal(true);
    };

    const calculateLoan = () => {
        if (!loanProperty) return null;
        const price = loanProperty.prix_vente || loanProperty.prix_location_mensuel || 0;
        if (!price) return null;
        const apport = Math.round(price * 0.1); // 10% apport
        const montant = price - apport;
        const duration = parseInt(loanDuration) || 20;
        const rate = parseFloat(loanRate) || 5.5;
        const monthlyRate = rate / 100 / 12;
        const nbMonths = duration * 12;
        const mensualite = montant * (monthlyRate * Math.pow(1 + monthlyRate, nbMonths)) / (Math.pow(1 + monthlyRate, nbMonths) - 1);
        const coutTotal = mensualite * nbMonths;
        return {
            prix: price,
            apport,
            montant,
            mensualite: Math.round(mensualite),
            coutTotal: Math.round(coutTotal),
            interets: Math.round(coutTotal - montant),
            duration,
            rate,
        };
    };

    // ✅ NOUVEAU: Estimation prix IA (fallback 3 niveaux)
    const handleAIPriceEstimate = async (property: RealEstateProperty) => {
        hapticPress();
        const result = await estimatePropertyPrice(
            property.type_bien || 'maison',
            property.superficie_m2 || 100,
            property.nb_chambres || 2,
            (property as any).standing || 'standard',
            property.quartier || '',
            property.ville || 'douala',
        );
        if (result.success && result.data) {
            const est = result.data;
            const source = result.source === 'local' ? ' (estimation locale)' : '';
            Alert.alert(
                `Estimation IA${source}`,
                `Prix estimé: ${est.estimated_price?.toLocaleString() || '?'} FCFA\n` +
                `Fourchette: ${(est.price_range_min || 0).toLocaleString()} - ${(est.price_range_max || 0).toLocaleString()} FCFA\n` +
                `Prix/m²: ${est.price_per_m2?.toLocaleString() || '?'} FCFA\n\n` +
                `${est.reasoning || ''}`,
                [{ text: 'OK' }]
            );
        } else {
            Alert.alert('Indisponible', 'L\'estimation IA n\'est pas disponible pour ce bien.');
        }
    };

    const handleQuickFilter = (filter: typeof quickFilters[0]) => {
        hapticPress();
        const newFilters: PropertySearchFilters = { ...filters };

        if (filter.statut) {
            newFilters.statut = filter.statut;
        }
        if (filter.distance) {
            newFilters.max_distance_km = filter.distance;
        }
        if (filter.id === 'recent') {
            setSortBy('date_desc');
        }

        setFilters(newFilters);
        setCurrentPage(1);
    };

    const handleFilterChange = (key: keyof PropertySearchFilters, value: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const clearFilters = () => {
        hapticPress();
        setFilters({
            max_distance_km: 50,
            lat: location?.coords?.latitude,
            lng: location?.coords?.longitude,
        });
        setSearchQuery('');
        setCurrentPage(1);
    };

    const handleSearch = () => {
        hapticPress();
        setCurrentPage(1);
        loadProperties(1, true);
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec recherche */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#1E40AF', '#3B82F6']}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>
                                {filters.type_bien === 'hotel'
                                    ? 'Hôtels'
                                    : filters.type_bien === 'meuble'
                                        ? 'Meublés / Locations meublées'
                                        : 'Immobilier'}
                            </Text>
                            {totalResults > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {totalResults} bien{totalResults > 1 ? 's' : ''} trouvé{totalResults > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                        {/* ✅ NOUVEAU: Bouton pour créer un bien immobilier (accessible à tous les utilisateurs) */}
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                (navigation as any).navigate('ImmobilierForm', {
                                    mode: 'create',
                                });
                            }}
                            style={styles.createButton}
                        >
                            <SafeIcon name="plus" size={20} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                setShowFilters(!showFilters);
                            }}
                            style={styles.filterButton}
                        >
                            <SafeIcon
                                name="sliders-h"
                                size={22}
                                color="#FFFFFF"
                                type="lucide"
                            />
                            {activeFiltersCount > 0 && (
                                <View style={styles.filterBadge}>
                                    <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche */}
                    <View style={styles.searchContainer}>
                        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher un bien, quartier, ville..."
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                                returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        handleSearch();
                                    }}
                                    style={styles.clearButton}
                                >
                                    <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                </TouchableOpacity>
                            )}
                            {/* ✅ CORRIGÉ: Bouton de recherche à droite */}
                            <TouchableOpacity
                                style={styles.searchButton}
                                onPress={handleSearch}
                                disabled={loading}
                                activeOpacity={0.7}
                            >
                                <SafeIcon
                                    name="search"
                                    size={18}
                                    color={loading ? "#9CA3AF" : "#1E40AF"}
                                    type="lucide"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>

                {/* Quick filters */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickFiltersContainer}
                    style={styles.quickFiltersScroll}
                >
                    {quickFilters.map((filter) => (
                        <TouchableOpacity
                            key={filter.id}
                            style={styles.quickFilterChip}
                            onPress={() => handleQuickFilter(filter)}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name={filter.icon} size={16} color="#1E40AF" type="lucide" />
                            <Text style={styles.quickFilterText}>{filter.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Barre d'actions (tri et vue) */}
                <View style={styles.actionsBar}>
                    <TouchableOpacity
                        style={styles.sortButton}
                        onPress={() => {
                            hapticPress();
                            setShowSortModal(true);
                        }}
                    >
                        <SafeIcon name="arrow-up-down" size={18} color="#6B7280" type="lucide" />
                        <Text style={styles.sortButtonText}>
                            {sortOptions.find(o => o.value === sortBy)?.label || 'Trier'}
                        </Text>
                    </TouchableOpacity>
                    <View style={styles.viewToggle}>
                        <TouchableOpacity
                            style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
                            onPress={() => {
                                hapticPress();
                                setViewMode('list');
                            }}
                        >
                            <SafeIcon
                                name="list"
                                size={18}
                                color={viewMode === 'list' ? '#1E40AF' : '#9CA3AF'}
                                type="lucide"
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.viewButton, viewMode === 'grid' && styles.viewButtonActive]}
                            onPress={() => {
                                hapticPress();
                                setViewMode('grid');
                            }}
                        >
                            <SafeIcon
                                name="grid"
                                size={18}
                                color={viewMode === 'grid' ? '#1E40AF' : '#9CA3AF'}
                                type="lucide"
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Liste des biens */}
            {loading && properties.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Recherche de biens...</Text>
                </View>
            ) : error && properties.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="home" size={64} color="#9CA3AF" />
                    <Text style={styles.errorText}>{error}</Text>
                    <Text style={styles.errorSubtext}>
                        Essayez de modifier vos critères de recherche
                    </Text>
                    {activeFiltersCount > 0 && (
                        <TouchableOpacity
                            style={styles.clearFiltersButton}
                            onPress={clearFilters}
                        >
                            <Text style={styles.clearFiltersText}>Réinitialiser les filtres</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <FlatList
                    data={properties}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <View style={viewMode === 'grid' ? styles.gridItem : undefined}>
                            <ImmobilierResultCard
                                property={item}
                                onPress={() => handlePropertyPressWithTracking(item)}
                            />
                            {/* Boutons d'action rapide */}
                            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4, gap: 6 }}>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: favorites.has(item.id.toString()) ? '#FEF2F2' : '#F9FAFB', borderRadius: 8, paddingVertical: 7, borderWidth: 1, borderColor: favorites.has(item.id.toString()) ? '#FCA5A5' : '#E5E7EB' }}
                                    onPress={() => handleToggleFavorite(item)}
                                >
                                    <SafeIcon name="heart" size={14} color={favorites.has(item.id.toString()) ? '#EF4444' : '#9CA3AF'} type="lucide" />
                                    <Text style={{ marginLeft: 4, fontSize: 11, color: favorites.has(item.id.toString()) ? '#EF4444' : '#6B7280' }}>Favori</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 7, borderWidth: 1, borderColor: '#BFDBFE' }}
                                    onPress={() => handleAIPriceEstimate(item)}
                                >
                                    <SafeIcon name="bar-chart-2" size={14} color="#3B82F6" type="lucide" />
                                    <Text style={{ marginLeft: 4, fontSize: 11, color: '#3B82F6' }}>Estimer</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED', borderRadius: 8, paddingVertical: 7, borderWidth: 1, borderColor: '#FED7AA' }}
                                    onPress={() => handleBookVisit(item)}
                                >
                                    <SafeIcon name="calendar" size={14} color="#F97316" type="lucide" />
                                    <Text style={{ marginLeft: 4, fontSize: 11, color: '#F97316' }}>Visite</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, paddingVertical: 7, borderWidth: 1, borderColor: '#E5E7EB' }}
                                    onPress={() => handleShareProperty(item)}
                                >
                                    <SafeIcon name="share" size={14} color="#6B7280" type="lucide" />
                                    <Text style={{ marginLeft: 4, fontSize: 11, color: '#6B7280' }}>Partager</Text>
                                </TouchableOpacity>
                            </View>
                            {item.prix_vente && (
                                <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', borderRadius: 8, paddingVertical: 7, borderWidth: 1, borderColor: '#A7F3D0' }}
                                        onPress={() => handleLoanSimulation(item)}
                                    >
                                        <SafeIcon name="calculator" size={14} color="#10B981" type="lucide" />
                                        <Text style={{ marginLeft: 4, fontSize: 11, color: '#10B981' }}>Simuler prêt</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}
                    numColumns={viewMode === 'grid' ? 2 : 1}
                    contentContainerStyle={[
                        styles.listContent,
                        viewMode === 'grid' && styles.gridContent,
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={[modernColors.primary]}
                        />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loading && properties.length > 0 ? (
                            <View style={styles.footerLoader}>
                                <ActivityIndicator size="small" color={modernColors.primary} />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="home" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>Aucun bien trouvé</Text>
                            <Text style={styles.emptySubtext}>
                                Essayez de modifier vos critères de recherche
                            </Text>
                            {activeFiltersCount > 0 && (
                                <TouchableOpacity
                                    style={styles.clearFiltersButton}
                                    onPress={clearFilters}
                                >
                                    <Text style={styles.clearFiltersText}>Réinitialiser les filtres</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* Modal de filtres avancés */}
            <FiltersModal
                visible={showFilters}
                onClose={() => setShowFilters(false)}
                filters={filters}
                onFiltersChange={setFilters}
                typesBiens={typesBiens}
                statuts={statuts}
                standings={standings}
                location={location}
                detectedCurrency={detectedCurrency}
            />

            {/* Modal de tri */}
            <SortModal
                visible={showSortModal}
                onClose={() => setShowSortModal(false)}
                sortBy={sortBy}
                onSortChange={setSortBy}
                sortOptions={sortOptions}
            />

            {/* ✅ NOUVEAU: Modal simulation prêt immobilier */}
            <Modal visible={showLoanModal} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Simulation de prêt</Text>
                            <TouchableOpacity onPress={() => setShowLoanModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        {loanProperty && (
                            <View style={{ backgroundColor: '#F0F9FF', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E40AF' }}>
                                    {loanProperty.type_bien} - {loanProperty.ville}
                                </Text>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 4 }}>
                                    {(loanProperty.prix_vente || 0).toLocaleString()} FCFA
                                </Text>
                            </View>
                        )}

                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Durée (années)</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                            {['10', '15', '20', '25'].map(d => (
                                <TouchableOpacity
                                    key={d}
                                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: loanDuration === d ? '#1E40AF' : '#F3F4F6' }}
                                    onPress={() => setLoanDuration(d)}
                                >
                                    <Text style={{ fontWeight: '600', color: loanDuration === d ? '#FFFFFF' : '#374151' }}>{d} ans</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Taux annuel (%)</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                            {['4.5', '5.5', '6.5', '7.5'].map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: loanRate === r ? '#1E40AF' : '#F3F4F6' }}
                                    onPress={() => setLoanRate(r)}
                                >
                                    <Text style={{ fontWeight: '600', color: loanRate === r ? '#FFFFFF' : '#374151' }}>{r}%</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {(() => {
                            const loan = calculateLoan();
                            if (!loan) return <Text style={{ color: '#9CA3AF', textAlign: 'center' }}>Prix non disponible</Text>;
                            return (
                                <View style={{ backgroundColor: '#ECFDF5', borderRadius: 12, padding: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={{ color: '#6B7280' }}>Apport (10%)</Text>
                                        <Text style={{ fontWeight: '600', color: '#111827' }}>{loan.apport.toLocaleString()} FCFA</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={{ color: '#6B7280' }}>Montant emprunté</Text>
                                        <Text style={{ fontWeight: '600', color: '#111827' }}>{loan.montant.toLocaleString()} FCFA</Text>
                                    </View>
                                    <View style={{ height: 1, backgroundColor: '#D1FAE5', marginVertical: 8 }} />
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text style={{ color: '#059669', fontWeight: '700', fontSize: 16 }}>Mensualité</Text>
                                        <Text style={{ fontWeight: '700', fontSize: 18, color: '#059669' }}>{loan.mensualite.toLocaleString()} FCFA</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={{ color: '#6B7280', fontSize: 12 }}>Coût total du crédit</Text>
                                        <Text style={{ fontSize: 12, color: '#6B7280' }}>{loan.coutTotal.toLocaleString()} FCFA</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#6B7280', fontSize: 12 }}>Intérêts totaux</Text>
                                        <Text style={{ fontSize: 12, color: '#EF4444' }}>{loan.interets.toLocaleString()} FCFA</Text>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                </View>
            </Modal>
            {/* Intelligent Chat FAB */}
            <IntelligentChatFab
                onPress={() => setShowChat(true)}
                visible={!showChat && !showFilters && !showSortModal && !showLoanModal}
                screenName="ImmobilierHome"
            />
            <IntelligentChat
                visible={showChat}
                onClose={() => setShowChat(false)}
                screenContext={{
                    screenName: 'ImmobilierHome',
                    screenType: 'specialized',
                    serviceData: {
                        nom: t('immobilierHome.immobilier') || 'Immobilier',
                        description: `${totalResults} ${t('immobilierHome.biensTrouves') || 'biens trouvés'}`,
                    },
                }}
            />
        </SafeNativeView>
    );
};

// Modal de filtres avancés
interface FiltersModalProps {
    visible: boolean;
    onClose: () => void;
    filters: PropertySearchFilters;
    onFiltersChange: (filters: PropertySearchFilters) => void;
    typesBiens: Array<{ value: string; label: string }>;
    statuts: Array<{ value: string; label: string }>;
    standings: string[];
    location: any;
    detectedCurrency?: string; // ✅ Ajout pour éviter les erreurs de référence
}

const FiltersModal: React.FC<FiltersModalProps> = ({
    visible,
    onClose,
    filters,
    onFiltersChange,
    typesBiens,
    statuts,
    standings,
    location,
    detectedCurrency = 'XAF', // ✅ Valeur par défaut pour éviter les erreurs
}) => {
    const [localFilters, setLocalFilters] = useState<PropertySearchFilters>(filters);
    const [prixMin, setPrixMin] = useState(filters.prix_min?.toString() || '');
    const [prixMax, setPrixMax] = useState(filters.prix_max?.toString() || '');
    const [superficieMin, setSuperficieMin] = useState(filters.superficie_min?.toString() || '');
    const [superficieMax, setSuperficieMax] = useState(filters.superficie_max?.toString() || '');
    const [nbChambres, setNbChambres] = useState(filters.nb_chambres_min?.toString() || '');

    useEffect(() => {
        if (visible) {
            setLocalFilters(filters);
            setPrixMin(filters.prix_min?.toString() || '');
            setPrixMax(filters.prix_max?.toString() || '');
            setSuperficieMin(filters.superficie_min?.toString() || '');
            setSuperficieMax(filters.superficie_max?.toString() || '');
            setNbChambres(filters.nb_chambres_min?.toString() || '');
        }
    }, [visible, filters]);

    const applyFilters = () => {
        const newFilters: PropertySearchFilters = {
            ...localFilters,
            prix_min: prixMin ? parseFloat(prixMin) : undefined,
            prix_max: prixMax ? parseFloat(prixMax) : undefined,
            superficie_min: superficieMin ? parseFloat(superficieMin) : undefined,
            superficie_max: superficieMax ? parseFloat(superficieMax) : undefined,
            nb_chambres_min: nbChambres ? parseInt(nbChambres) : undefined,
            lat: location?.coords?.latitude,
            lng: location?.coords?.longitude,
        };
        onFiltersChange(newFilters);
        onClose();
    };

    const clearAll = () => {
        const cleared: PropertySearchFilters = {
            max_distance_km: 50,
            lat: location?.coords?.latitude,
            lng: location?.coords?.longitude,
        };
        setLocalFilters(cleared);
        setPrixMin('');
        setPrixMax('');
        setSuperficieMin('');
        setSuperficieMax('');
        setNbChambres('');
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Filtres</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {/* Type de bien */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Type de bien</Text>
                            <View style={styles.filterChips}>
                                {typesBiens.map((type) => (
                                    <TouchableOpacity
                                        key={type.value}
                                        style={[
                                            styles.filterChip,
                                            localFilters.type_bien === type.value && styles.filterChipActive,
                                        ]}
                                        onPress={() => {
                                            hapticPress();
                                            setLocalFilters(prev => ({
                                                ...prev,
                                                type_bien: prev.type_bien === type.value ? undefined : type.value,
                                            }));
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                localFilters.type_bien === type.value && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Statut */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Statut</Text>
                            <View style={styles.filterChips}>
                                {statuts.map((statut) => (
                                    <TouchableOpacity
                                        key={statut.value}
                                        style={[
                                            styles.filterChip,
                                            localFilters.statut === statut.value && styles.filterChipActive,
                                        ]}
                                        onPress={() => {
                                            hapticPress();
                                            setLocalFilters(prev => ({
                                                ...prev,
                                                statut: prev.statut === statut.value ? undefined : statut.value,
                                            }));
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                localFilters.statut === statut.value && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {statut.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Prix */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Prix ({detectedCurrency})</Text>
                            <View style={styles.rangeInputs}>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Min"
                                    value={prixMin}
                                    onChangeText={setPrixMin}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.rangeSeparator}>-</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Max"
                                    value={prixMax}
                                    onChangeText={setPrixMax}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Superficie */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Superficie (m²)</Text>
                            <View style={styles.rangeInputs}>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Min"
                                    value={superficieMin}
                                    onChangeText={setSuperficieMin}
                                    keyboardType="numeric"
                                />
                                <Text style={styles.rangeSeparator}>-</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    placeholder="Max"
                                    value={superficieMax}
                                    onChangeText={setSuperficieMax}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Chambres */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Nombre de chambres (min)</Text>
                            <TextInput
                                style={styles.singleInput}
                                placeholder="Ex: 2"
                                value={nbChambres}
                                onChangeText={setNbChambres}
                                keyboardType="numeric"
                            />
                        </View>

                        {/* Standing */}
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Standing</Text>
                            <View style={styles.filterChips}>
                                {standings.map((standing) => (
                                    <TouchableOpacity
                                        key={standing}
                                        style={[
                                            styles.filterChip,
                                            localFilters.standing === standing && styles.filterChipActive,
                                        ]}
                                        onPress={() => {
                                            hapticPress();
                                            setLocalFilters(prev => ({
                                                ...prev,
                                                standing: prev.standing === standing ? undefined : standing,
                                            }));
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.filterChipText,
                                                localFilters.standing === standing && styles.filterChipTextActive,
                                            ]}
                                        >
                                            {standing}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Distance */}
                        {location?.coords && (
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Distance maximum (km)</Text>
                                <TextInput
                                    style={styles.singleInput}
                                    placeholder="Ex: 50"
                                    value={localFilters.max_distance_km?.toString() || '50'}
                                    onChangeText={(text) => {
                                        const value = text ? parseFloat(text) : 50;
                                        setLocalFilters(prev => ({
                                            ...prev,
                                            max_distance_km: value,
                                        }));
                                    }}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={clearAll}
                        >
                            <Text style={styles.clearButtonText}>Tout effacer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={applyFilters}
                        >
                            <Text style={styles.applyButtonText}>Appliquer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// Modal de tri
interface SortModalProps {
    visible: boolean;
    onClose: () => void;
    sortBy: SortOption;
    onSortChange: (sort: SortOption) => void;
    sortOptions: { value: SortOption; label: string; icon: string }[];
}

const SortModal: React.FC<SortModalProps> = ({
    visible,
    onClose,
    sortBy,
    onSortChange,
    sortOptions,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.sortModalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.sortModalContent}>
                    {sortOptions.map((option) => (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.sortOption,
                                sortBy === option.value && styles.sortOptionActive,
                            ]}
                            onPress={() => {
                                hapticPress();
                                onSortChange(option.value);
                                onClose();
                            }}
                        >
                            <SafeIcon
                                name={option.icon}
                                size={20}
                                color={sortBy === option.value ? '#1E40AF' : '#6B7280'}
                                type="lucide"
                            />
                            <Text
                                style={[
                                    styles.sortOptionText,
                                    sortBy === option.value && styles.sortOptionTextActive,
                                ]}
                            >
                                {option.label}
                            </Text>
                            {sortBy === option.value && (
                                <SafeIcon name="check" size={20} color="#1E40AF" type="lucide" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitleContainer: {
        flex: 1,
    },
    createButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 2,
    },
    filterButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    filterBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    searchContainer: {
        marginTop: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    searchBarFocused: {
        borderColor: '#3B82F6',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    clearButton: {
        padding: 4,
    },
    searchButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickFiltersScroll: {
        maxHeight: 60,
    },
    quickFiltersContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    quickFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
        marginRight: 8,
    },
    quickFilterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E40AF',
    },
    actionsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sortButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 2,
        gap: 2,
    },
    viewButton: {
        width: 36,
        height: 36,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewButtonActive: {
        backgroundColor: '#FFFFFF',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    errorSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    clearFiltersButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    clearFiltersText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    gridContent: {
        padding: 8,
    },
    gridItem: {
        flex: 1,
        margin: 4,
    },
    footerLoader: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: 24,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        padding: 20,
    },
    filterSection: {
        marginBottom: 24,
    },
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    filterChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
    },
    filterChipActive: {
        backgroundColor: '#1E40AF',
        borderColor: '#1E40AF',
    },
    filterChipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    rangeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rangeInput: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    rangeSeparator: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    singleInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    clearFilterButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    clearButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#1E40AF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Sort modal
    sortModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sortModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 8,
        minWidth: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    sortOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
        borderRadius: 8,
    },
    sortOptionActive: {
        backgroundColor: '#EFF6FF',
    },
    sortOptionText: {
        flex: 1,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    sortOptionTextActive: {
        color: '#1E40AF',
        fontWeight: '600',
    },
});

export default ImmobilierHomeScreen;
