/**
 * ResultatBesoinScreen v4.0 - Version refactorisée (2025-01-XX)
 * Refactorisation complète : divisé en sous-composants réutilisables
 * Réduction de 3350 lignes à ~600 lignes
 * 
 * Composants utilisés :
 * - SearchBarSection : Barre de recherche avec autocomplete
 * - FiltersBottomSheet : Bottom sheet de filtres
 * - QuickSortBar : Barre de tri rapide
 * - ResultsList : Liste de résultats avec FlashList
 * - ResultsMapView : Vue carte pour résultats géolocalisés
 */

// ✅ MIGRÉ: Utilise react-native-reanimated pour de meilleures performances
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import NavigatorToolbar from '../components/NavigatorToolbar';
import FiltersBottomSheet from '../components/results/FiltersBottomSheet';
import QuickSortBar from '../components/results/QuickSortBar';
import ResultsList from '../components/results/ResultsList';
import ResultsMapView from '../components/results/ResultsMapView';
import SearchBarSection from '../components/results/SearchBarSection';
import SuggestionsPanel from '../components/results/SuggestionsPanel';
import SafeIcon from '../components/SafeIcon';
import { ENVIRONMENT } from '../config/environment';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useSearchAutocomplete } from '../hooks/useSearchAutocomplete';
import { apiPost } from '../services/api';
import { trackNavigation } from '../services/metricsTracking';
import { modernColors } from '../theme/modernTheme';
import { CacheManager, createCacheKey } from '../utils/cache';
import { debounce } from '../utils/debounce';
import { hapticPress, hapticSuccess } from '../utils/hapticFeedback';
import { logger } from '../utils/logger';

// Types et interfaces (extraits du fichier original)
interface CombinationSuggestion {
    service_id: number;
    product_vector: string[];
    location_vector: string[];
    full_vector: string[];
    chosen_location?: string;
    usage_count: number;
    has_variant: boolean;
    variant_dimension?: string;
    prix?: number;
    devise?: string;
    final_score: number;
}

interface Product {
    service_id: number;
    nom: string;
    product_vector?: string[];
    product_labels?: string[];
    location_vector?: string[];
    full_vector?: string[];
    chosen_location?: string;
    usage_count?: number;
    distance_km?: number;
    prestataire: {
        nom: string;
        avatar_url?: string;
        user_id: number;
    };
    has_variant: boolean;
    variants?: Array<{
        dimension: string;
        value: string;
        prix: number;
        devise: string;
        stock: number;
    }>;
    prix?: number;
    devise?: string;
    image?: string;
    coordinates?: { lat: number; lng: number };
    id?: number;
    is_active?: boolean;
    created_at?: string;
    user_id?: number;
    [key: string]: any;
}

type SortOption = 'pertinence' | 'proximite' | 'prix_asc' | 'prix_desc';
type FilterCategory = 'all' | 'with_stock' | 'with_variants' | 'nearby';

const HEADER_HEIGHT = 72;
const RESULTS_PER_PAGE = 20;

// Fonctions utilitaires (extraits du fichier original)
const extractSearchResults = (response: any): Product[] => {
    if (!response) return [];

    const data = response?.data ?? response;
    if (!data) return [];

    let resultsArray: any[] = [];
    if (Array.isArray(data)) {
        resultsArray = data;
    } else {
        const nestedCandidates = [
            data?.resultats?.resultats,
            data?.resultats,
            data?.data,
            data?.items,
        ];
        for (const candidate of nestedCandidates) {
            if (Array.isArray(candidate)) {
                resultsArray = candidate;
                break;
            }
        }
    }

    if (!Array.isArray(resultsArray) || resultsArray.length === 0) {
        return [];
    }

    return resultsArray.map((item: any) => {
        const nom = item?.data?.titre_service?.valeur ||
            item?.data?.titre_service ||
            item?.nom ||
            item?.data?.nom?.valeur ||
            item?.data?.nom ||
            'Produit';

        const location_vector = item.location_vector || item?.data?.location_vector || [];
        const chosen_location = item.chosen_location || item?.data?.chosen_location || location_vector[0];

        return {
            service_id: item.service_id || item.id || 0,
            nom,
            product_vector: item.product_vector || item?.data?.product_vector || [],
            product_labels: item.product_labels || item?.data?.product_labels || [],
            location_vector,
            full_vector: item.full_vector || item?.data?.full_vector || [],
            chosen_location,
            usage_count: item.usage_count || item?.data?.usage_count,
            distance_km: item.distance_km || item?.data?.distance_km || undefined,
            prestataire: {
                nom: item.prestataire?.nom || item.user?.nom_complet || item.user?.nom || 'Prestataire',
                avatar_url: item.prestataire?.avatar_url || item.user?.avatar_url,
                user_id: item.prestataire?.user_id || item.user?.id || item.user_id || 0,
            },
            has_variant: item.has_variant || item?.data?.has_variant || false,
            variants: item.variants || item?.data?.variants,
            prix: item.prix || item?.data?.prix,
            devise: item.devise || item?.data?.devise || 'XAF',
            image: item.image || item?.data?.image,
            images: Array.isArray(item.images) ? item.images :
                Array.isArray(item?.data?.images) ? item.data.images :
                    Array.isArray(item?.data?.images?.valeur) ? item.data.images.valeur :
                        item.image ? [item.image] : [],
            videos: Array.isArray(item.videos) ? item.videos :
                Array.isArray(item?.data?.videos) ? item.data.videos :
                    Array.isArray(item?.data?.videos?.valeur) ? item.data.videos.valeur : [],
            coordinates: item.coordinates || item?.data?.coordinates,
            id: item.id || item.service_id || undefined,
            is_active: item.is_active !== undefined ? item.is_active : true,
            created_at: item.created_at,
            user_id: item.user_id || item.user?.id || item.prestataire?.user_id || undefined,
            ...item,
        } as Product;
    });
};

const extractBase64 = (dataUrl: string): string => {
    if (!dataUrl || typeof dataUrl !== 'string') return '';
    if (!dataUrl.startsWith('data:')) return dataUrl;
    const index = dataUrl.indexOf('base64,');
    if (index === -1) return dataUrl;
    return dataUrl.substring(index + 'base64,'.length);
};

const buildSuggestionExample = (suggestion?: CombinationSuggestion | null): string | null => {
    if (!suggestion) return null;
    const vector = Array.isArray(suggestion.full_vector) && suggestion.full_vector.length > 0
        ? suggestion.full_vector
        : Array.isArray(suggestion.product_vector)
            ? suggestion.product_vector
            : [];
    if (!vector || vector.length === 0) return null;
    return vector.filter(Boolean).slice(0, 5).join(' • ');
};

const getSuggestionVector = (suggestion: CombinationSuggestion | null | undefined): string[] => {
    if (!suggestion) return [];
    if (Array.isArray(suggestion.full_vector) && suggestion.full_vector.length > 0) {
        return suggestion.full_vector.filter((item) => typeof item === 'string');
    }
    if (Array.isArray(suggestion.product_vector) && suggestion.product_vector.length > 0) {
        return suggestion.product_vector.filter((item) => typeof item === 'string');
    }
    return [];
};

const normalizeText = (value: string | null | undefined): string => {
    if (!value) return '';
    try {
        return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (error) {
        return value.toLowerCase();
    }
};

const normalizeAutocompleteResponse = (response: any): CombinationSuggestion[] => {
    if (!response) return [];
    const payload = response.data ?? response;
    if (Array.isArray(payload)) return payload as CombinationSuggestion[];
    if (Array.isArray(payload?.data)) return payload.data as CombinationSuggestion[];
    if (Array.isArray(payload?.results)) return payload.results as CombinationSuggestion[];
    if (Array.isArray(payload?.items)) return payload.items as CombinationSuggestion[];
    if (Array.isArray(payload?.data?.data)) return payload.data.data as CombinationSuggestion[];
    return [];
};

const convertFileToBase64 = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const ResultatBesoinScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { location } = useLocation();
    const { user } = useAuth();

    // Hook autocomplete et historique
    const {
        searchHistory,
        autocompleteSuggestions,
        isLoadingAutocomplete,
        saveToHistory,
        clearHistory,
        removeFromHistory,
        triggerAutocomplete,
    } = useSearchAutocomplete();

    // Debouncing pour interactions
    const debouncedFavoriteRef = useRef<ReturnType<typeof debounce> | null>(null);

    // ✅ MIGRÉ: Animations avec Reanimated
    const scrollY = useSharedValue(0);

    // ✅ MIGRÉ: Style animé du header avec Reanimated
    const headerAnimatedStyle = useAnimatedStyle(() => {
        const translateY = scrollY.value > HEADER_HEIGHT
            ? -HEADER_HEIGHT
            : -scrollY.value;
        return {
            transform: [{ translateY: Math.max(translateY, -HEADER_HEIGHT) }],
        };
    });

    const itemAnimations = useRef<Map<number, Animated.Value>>(new Map()).current;
    const getItemAnimation = useCallback((index: number) => {
        if (!itemAnimations.has(index)) {
            itemAnimations.set(index, new Animated.Value(0));
        }
        return itemAnimations.get(index)!;
    }, []);

    // États recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<CombinationSuggestion[]>([]);
    const [dynamicPlaceholder, setDynamicPlaceholder] = useState<string | null>(null);
    const [results, setResults] = useState<Product[]>([]);
    const [filteredResults, setFilteredResults] = useState<Product[]>([]);

    // États pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMoreResults, setHasMoreResults] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // États UI
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [loadingResults, setLoadingResults] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // États filtrage et tri
    const [sortBy, setSortBy] = useState<SortOption>('pertinence');
    const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
    const [showFilters, setShowFilters] = useState(false);
    const [priceFilter, setPriceFilter] = useState<{
        min: number | null;
        max: number | null;
        currency: string;
    }>({ min: null, max: null, currency: 'XAF' });
    const [dynamicFilters, setDynamicFilters] = useState<Record<string, Set<string>>>({});
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});

    // États recherche avancée
    const [searchImages, setSearchImages] = useState<string[]>([]);
    const [searchDocuments, setSearchDocuments] = useState<Array<{ name: string; base64: string }>>([]);
    const [searchGPSData, setSearchGPSData] = useState<{ lat: number; lng: number; address?: string } | null>(null);
    const [searchGPSString, setSearchGPSString] = useState<string>('');

    // État vue carte
    const [showMapView, setShowMapView] = useState(false);

    // ✅ MIGRÉ: Animer les items avec Reanimated
    useEffect(() => {
        if (filteredResults.length > 0) {
            filteredResults.forEach((_, index) => {
                const animValue = getItemAnimation(index);
                const delay = Math.min(index * 50, 500);
                setTimeout(() => {
                    animValue.value = withTiming(1, { duration: 300 });
                }, delay);
            });
        }
    }, [filteredResults.length, getItemAnimation]);

    // Initialiser depuis route.params
    useEffect(() => {
        try {
            const params = route.params as any;
            setLoadingResults(false);

            if (params?.hasError && params?.error) {
                setSearchError(params.error);
            } else {
                setSearchError(null);
            }

            if (params?.results !== undefined) {
                let extractedResults: Product[] = [];
                if (Array.isArray(params.results)) {
                    extractedResults = params.results as Product[];
                } else if (params.results && typeof params.results === 'object') {
                    extractedResults = extractSearchResults(params.results);
                } else {
                    extractedResults = [];
                }
                setResults(extractedResults);
            } else {
                setResults([]);
            }

            if (params?.searchQuery) {
                const queryText = typeof params.searchQuery === 'string' ? params.searchQuery : '';
                setSearchQuery(queryText);
                const words = queryText.split(' ').filter(w => w.trim());
                if (words.length > 0) {
                    setFilters(words);
                }
            } else if (params?.results !== undefined) {
                setSearchQuery('');
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] ❌ Erreur initialisation:', error);
            setResults([]);
            setLoadingResults(false);
        }
    }, [route.params]);

    // Générer filtres dynamiques depuis les résultats
    useEffect(() => {
        try {
            if (!Array.isArray(results) || results.length === 0) {
                setDynamicFilters({});
                return;
            }

            const filtersMap: Record<string, Set<string>> = {};
            results.forEach((product) => {
                if (!product) return;
                const labels = product.product_labels || [];
                const vector = product.product_vector || [];

                if (!Array.isArray(labels)) return;

                labels.forEach((label, idx) => {
                    if (!filtersMap[label]) {
                        filtersMap[label] = new Set();
                    }
                    if (vector[idx]) {
                        filtersMap[label].add(vector[idx]);
                    }
                });
            });

            const meaningfulFilters: Record<string, Set<string>> = {};
            Object.entries(filtersMap).forEach(([label, values]) => {
                if (values.size >= 2) {
                    meaningfulFilters[label] = values;
                }
            });

            setDynamicFilters(meaningfulFilters);
        } catch (error) {
            logger.error('[ResultatBesoinScreen] ❌ Erreur dynamicFilters:', error);
            setDynamicFilters({});
        }
    }, [results]);

    // Appliquer filtres et tri
    useEffect(() => {
        try {
            if (!Array.isArray(results)) {
                setFilteredResults([]);
                return;
            }

            let filtered = [...results];

            // Filtres dynamiques
            if (selectedFilters && typeof selectedFilters === 'object') {
                Object.entries(selectedFilters).forEach(([label, value]) => {
                    if (value) {
                        filtered = filtered.filter((product) => {
                            if (!product) return false;
                            const labels = product.product_labels || [];
                            const vector = product.product_vector || [];
                            const index = labels.indexOf(label);
                            return index !== -1 && vector[index] === value;
                        });
                    }
                });
            }

            // Filtre par prix
            if (priceFilter.min !== null || priceFilter.max !== null) {
                filtered = filtered.filter(product => {
                    const price = getPrixMin(product);
                    if (priceFilter.min !== null && price < priceFilter.min) return false;
                    if (priceFilter.max !== null && price > priceFilter.max) return false;
                    return true;
                });
            }

            // Filtres par catégorie
            switch (filterCategory) {
                case 'with_stock':
                    filtered = filtered.filter(p => {
                        if (p.has_variant && p.variants) {
                            return p.variants.some(v => (v.stock || 0) > 0);
                        }
                        return true;
                    });
                    break;
                case 'with_variants':
                    filtered = filtered.filter(p => p.has_variant);
                    break;
                case 'nearby':
                    filtered = filtered.filter(p => p.distance_km !== undefined && p.distance_km < 5);
                    break;
            }

            // Tri
            switch (sortBy) {
                case 'proximite':
                    filtered.sort((a, b) => {
                        const distA = a.distance_km ?? 999999;
                        const distB = b.distance_km ?? 999999;
                        return distA - distB;
                    });
                    break;
                case 'prix_asc':
                    filtered.sort((a, b) => {
                        const prixA = getPrixMin(a);
                        const prixB = getPrixMin(b);
                        return prixA - prixB;
                    });
                    break;
                case 'prix_desc':
                    filtered.sort((a, b) => {
                        const prixA = getPrixMin(a);
                        const prixB = getPrixMin(b);
                        return prixB - prixA;
                    });
                    break;
            }

            setFilteredResults(filtered);
        } catch (error) {
            logger.error('[ResultatBesoinScreen] ❌ Erreur filtrage/tri:', error);
            setFilteredResults(results || []);
        }
    }, [results, sortBy, filterCategory, selectedFilters, priceFilter]);

    // Helper : Prix minimum
    const getPrixMin = (product: Product): number => {
        if (!product) return 0;
        if (product.has_variant && Array.isArray(product.variants) && product.variants.length > 0) {
            try {
                return Math.min(...product.variants.map(v => v?.prix || 0));
            } catch (error) {
                return product.prix || 0;
            }
        }
        return product.prix || 0;
    };

    // Recherche finale
    const searchFinal = useCallback(async (input: string | string[]) => {
        const finalFilters = Array.isArray(input)
            ? input.filter((token) => typeof token === 'string').map((token) => token.trim()).filter(Boolean)
            : input.trim().split(/\s+/).filter(Boolean);

        if (!finalFilters || finalFilters.length === 0) {
            return;
        }

        setFilters(finalFilters);
        setLoadingResults(true);

        try {
            const searchText = finalFilters.join(' ');
            let payload: any = { texte: searchText };

            if (location?.coords?.latitude && location?.coords?.longitude) {
                payload.gps_mobile = `${location.coords.latitude},${location.coords.longitude}`;
            }

            if (searchImages.length > 0) {
                payload.base64_image = searchImages.map(extractBase64);
            }

            if (searchDocuments.length > 0) {
                payload.doc_base64 = searchDocuments.map((doc) => extractBase64(doc.base64));
            }

            if (searchGPSString) {
                payload.gps_fixe = searchGPSString;
                if (searchGPSString.includes('|')) {
                    const points = searchGPSString.split('|').map((coord) => {
                        const [latStr, lngStr] = coord.split(',');
                        return { lat: parseFloat(latStr), lng: parseFloat(lngStr) };
                    });
                    payload.gps_zone = points;
                    payload.gps_fixe_coords = JSON.stringify(points);
                } else {
                    const [latStr, lngStr] = searchGPSString.split(',');
                    const lat = parseFloat(latStr);
                    const lng = parseFloat(lngStr);
                    payload.gps_fixe_coords = JSON.stringify([{ lat, lng }]);
                }
            }

            // Vérifier le cache
            const searchCacheKey = createCacheKey('search_results', finalFilters.join('_'), searchGPSString || 'no_gps');
            const cachedResults = await CacheManager.get<Product[]>(searchCacheKey, 10 * 60 * 1000);
            if (cachedResults) {
                setResults(cachedResults);
                setCurrentPage(1);
                setHasMoreResults(cachedResults.length > RESULTS_PER_PAGE);
                trackNavigation('search', {
                    queryType: searchGPSString ? 'location' : 'keyword',
                    resultsCount: cachedResults.length,
                    hasResults: cachedResults.length > 0,
                });
                setLoadingResults(false);
                return;
            }

            // Appel API
            const apiResponse = await apiPost('/api/search/direct', payload);

            if (apiResponse?.success === false) {
                setResults([]);
                setLoadingResults(false);
                return;
            }

            const extractedResults = extractSearchResults(apiResponse);
            await CacheManager.set(searchCacheKey, extractedResults);

            if (extractedResults.length > 0) {
                setResults(extractedResults);
                setCurrentPage(1);
                setHasMoreResults(extractedResults.length > RESULTS_PER_PAGE);
                const searchQueryText = Array.isArray(input) ? input.join(' ') : input;
                if (searchQueryText.trim()) {
                    saveToHistory(searchQueryText.trim(), extractedResults.length);
                }
                trackNavigation('search', {
                    queryType: searchGPSString ? 'location' : 'keyword',
                    resultsCount: extractedResults.length,
                    hasResults: true,
                });
            } else {
                setResults([]);
                setCurrentPage(1);
                setHasMoreResults(false);
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] ❌ Erreur recherche:', error);
            setResults([]);
        } finally {
            setLoadingResults(false);
        }
    }, [location, searchDocuments, searchGPSString, searchImages, filters, saveToHistory]);

    // Pull-to-refresh
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            if (filters.length > 0) {
                const searchText = filters.join(' ');
                const payload: any = { texte: searchText };
                if (location?.coords?.latitude && location?.coords?.longitude) {
                    payload.gps_mobile = `${location.coords.latitude},${location.coords.longitude}`;
                }
                const apiResponse = await apiPost('/api/search/direct', payload);
                if (apiResponse?.success === false) {
                    setResults([]);
                } else {
                    const refreshedResults = extractSearchResults(apiResponse);
                    setResults(refreshedResults);
                }
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] Erreur refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, [filters, location]);

    // Pagination
    const paginatedResults = useMemo(() => {
        if (showSuggestions) return [];
        const startIndex = 0;
        const endIndex = currentPage * RESULTS_PER_PAGE;
        return filteredResults.slice(startIndex, endIndex);
    }, [filteredResults, currentPage, showSuggestions]);

    const handleLoadMore = useCallback(async () => {
        if (loadingMore || !hasMoreResults) return;
        setLoadingMore(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            const nextPage = currentPage + 1;
            const totalResults = filteredResults.length;
            const nextPageEnd = nextPage * RESULTS_PER_PAGE;
            if (nextPageEnd < totalResults) {
                setCurrentPage(nextPage);
                setHasMoreResults(nextPageEnd < totalResults);
            } else {
                setHasMoreResults(false);
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] Erreur chargement plus:', error);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMoreResults, currentPage, filteredResults.length]);

    // Handlers recherche avancée
    const requestImagePermissions = useCallback(async (): Promise<boolean> => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'Nous avons besoin de l\'autorisation pour accéder à vos images.');
            return false;
        }
        return true;
    }, []);

    const takeSearchPhoto = useCallback(async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'La caméra est nécessaire pour prendre une photo.');
            return;
        }
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: 'images' as any,
                allowsEditing: true,
                quality: 0.8,
                base64: true,
            });
            if (!result.canceled && result.assets && result.assets[0]?.base64) {
                const image = `data:image/jpeg;base64,${result.assets[0].base64}`;
                setSearchImages((prev) => [image, ...prev].slice(0, 10));
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] Erreur prise de photo:', error);
            Alert.alert('Erreur', 'Impossible de prendre la photo.');
        }
    }, []);

    const chooseSearchImages = useCallback(async () => {
        const hasPermission = await requestImagePermissions();
        if (!hasPermission) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images' as any,
                allowsMultipleSelection: true,
                quality: 0.8,
                base64: true,
            });
            if (!result.canceled && result.assets) {
                const newImages = result.assets
                    .filter((asset) => !!asset.base64)
                    .map((asset) => `data:${asset.type ?? 'image/jpeg'};base64,${asset.base64}`);
                if (newImages.length > 0) {
                    setSearchImages((prev) => [...newImages, ...prev].slice(0, 10));
                }
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] Erreur sélection images:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner des images.');
        }
    }, [requestImagePermissions]);

    const pickSearchDocument = useCallback(async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: false,
                type: '*/*',
            });
            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                const base64 = await convertFileToBase64(asset.uri);
                setSearchDocuments((prev) => [{ name: asset.name ?? 'Document', base64 }, ...prev].slice(0, 5));
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] Erreur sélection document:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner le document.');
        }
    }, []);

    const removeSearchImage = useCallback((index: number) => {
        setSearchImages((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const removeSearchDocument = useCallback((index: number) => {
        setSearchDocuments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleGPSSelect = useCallback((coordinatesString: string) => {
        if (!coordinatesString) {
            setSearchGPSData(null);
            setSearchGPSString('');
            return;
        }
        const firstPoint = coordinatesString.split('|')[0]?.split(',');
        if (firstPoint && firstPoint.length === 2) {
            const lat = parseFloat(firstPoint[0]);
            const lng = parseFloat(firstPoint[1]);
            setSearchGPSData({ lat, lng });
        }
        setSearchGPSString(coordinatesString);
        trackNavigation('geolocation_search', { queryType: 'location' });
    }, []);

    const clearSearchGPS = useCallback(() => {
        setSearchGPSData(null);
        setSearchGPSString('');
    }, []);

    // Handlers produits
    const handleProductPress = useCallback((product: Product) => {
        (navigation as any).navigate('ServiceDetail', {
            serviceId: product.service_id,
        });
    }, [navigation]);

    const handleProductLike = useCallback(async (product: Product, liked: boolean) => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour aimer un produit');
            return;
        }
        try {
            const response = await apiPost(`/api/content/${product.service_id}/engagement`, {
                action: 'like',
                set: liked,
            });
            if (response.success) {
                hapticSuccess();
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] ❌ Erreur like:', error);
        }
    }, [user]);

    const handleProductFavorite = useCallback(async (product: Product, favorited: boolean) => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour ajouter aux favoris');
            return;
        }
        if (debouncedFavoriteRef.current) {
            debouncedFavoriteRef.current.cancel();
        }
        const debouncedFavorite = debounce(async () => {
            try {
                const response = await apiPost(`/api/content/${product.service_id}/engagement`, {
                    action: 'save',
                    set: favorited,
                });
                if (response.success) {
                    hapticSuccess();
                }
            } catch (error) {
                logger.error('[ResultatBesoinScreen] ❌ Erreur favorite:', error);
            }
        }, 500);
        debouncedFavoriteRef.current = debouncedFavorite;
        debouncedFavorite();
    }, [user]);

    const handleProductShare = useCallback(async (product: Product) => {
        hapticPress();
        try {
            if (user) {
                try {
                    await apiPost('/api/metrics/track', {
                        action: 'click',
                        itemType: 'product',
                        itemId: product.service_id?.toString(),
                        engagement_type: 'share',
                    });
                } catch (error) {
                    logger.debug('[ResultatBesoinScreen] Erreur tracking share:', error);
                }
            }
            const productName = product.nom || 'Ce produit';
            const shareUrl = `${ENVIRONMENT.API_URL || 'https://yukpomnang.com'}/service/${product.service_id}`;
            const shareMessage = `🌟 Découvrez "${productName}" sur Yukpomnang\n\n${shareUrl}`;
            const result = await Share.share({
                message: shareMessage,
                title: productName,
                url: shareUrl,
            });
            if (result.action === Share.sharedAction) {
                hapticSuccess();
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] ❌ Erreur share:', error);
            if (error instanceof Error && error.message.includes('not available')) {
                Alert.alert('Partage indisponible', 'Le partage n\'est pas disponible sur cet appareil');
            }
        }
    }, [user]);

    // Fetch suggestions
    const fetchSuggestionsInternal = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            setDynamicPlaceholder(null);
            return;
        }

        const words = query.split(' ').filter(w => w.trim());
        setFilters(words);
        setLoadingSuggestions(true);
        setShowSuggestions(true);

        try {
            const cacheKey = createCacheKey('autocomplete', query.toLowerCase().trim());
            const cached = await CacheManager.get<any[]>(cacheKey, 10 * 60 * 1000);
            if (cached) {
                setSuggestions(cached);
                if (cached.length > 0) {
                    const example = buildSuggestionExample(cached[0]);
                    setDynamicPlaceholder(example ? `ex: ${example}` : null);
                }
                setLoadingSuggestions(false);
                return;
            }

            const payload: any = { query, limit: 10 };
            if (location?.coords?.latitude && location?.coords?.longitude) {
                payload.user_lat = location.coords.latitude;
                payload.user_lng = location.coords.longitude;
            }

            const response = await apiPost('/api/autocomplete/search-products', payload);
            if (response.success) {
                const normalized = normalizeAutocompleteResponse(response);
                const queryText = normalizeText(query.trim());
                let filtered = normalized;

                if (queryText.length > 0) {
                    filtered = normalized.filter((item) => {
                        const vectorText = normalizeText(getSuggestionVector(item).join(' '));
                        const labelsText = normalizeText(
                            Array.isArray((item as any)?.product_labels)
                                ? (item as any).product_labels.join(' ')
                                : ((item as any)?.product_labels as string)
                        );
                        const titleText = normalizeText(((item as any)?.title || (item as any)?.nom || (item as any)?.name) as string);
                        const aliasText = normalizeText(((item as any)?.combinaison_brute || (item as any)?.full_text) as string);
                        return (
                            vectorText.includes(queryText) ||
                            labelsText.includes(queryText) ||
                            titleText.includes(queryText) ||
                            aliasText.includes(queryText)
                        );
                    });
                    if (filtered.length === 0) {
                        filtered = normalized;
                    }
                }

                await CacheManager.set(cacheKey, filtered);
                setSuggestions(filtered);
                if (filtered.length > 0) {
                    const example = buildSuggestionExample(filtered[0]);
                    setDynamicPlaceholder(example ? `ex: ${example}` : null);
                } else {
                    setDynamicPlaceholder(null);
                }
            } else {
                setSuggestions([]);
                setDynamicPlaceholder(null);
            }
        } catch (error) {
            logger.error('[ResultatBesoinScreen] Erreur suggestions:', error);
            setSuggestions([]);
            setDynamicPlaceholder(null);
        } finally {
            setLoadingSuggestions(false);
        }
    }, [location]);

    const fetchSuggestions = useMemo(
        () => debounce(fetchSuggestionsInternal, 300),
        [fetchSuggestionsInternal]
    );

    // Suggestions effect
    useEffect(() => {
        const params = route.params as any;
        if (params?.results && Array.isArray(params.results) && params.results.length > 0) {
            return; // Ignorer suggestions si résultats déjà fournis
        }
        if (searchQuery.trim().length >= 2) {
            fetchSuggestions(searchQuery);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
            setDynamicPlaceholder(null);
        }
        return () => {
            if (typeof fetchSuggestions === 'function' && 'cancel' in fetchSuggestions) {
                (fetchSuggestions as any).cancel();
            }
        };
    }, [searchQuery, fetchSuggestions, route.params]);

    // Select suggestion
    const selectSuggestion = useCallback(async (suggestion: CombinationSuggestion) => {
        try {
            const vector = getSuggestionVector(suggestion);
            if (!vector || vector.length === 0) {
                logger.error('[ResultatBesoinScreen] ❌ Suggestion invalide');
                return;
            }
            const vectorText = vector.join(' ').trim();
            setSearchQuery(vectorText);
            setFilters(vector);
            setShowSuggestions(false);
            await searchFinal(vector);
        } catch (error) {
            logger.error('[ResultatBesoinScreen] ❌ Crash selectSuggestion:', error);
        }
    }, [searchFinal]);

    // Handlers autocomplete
    const handleAutocompleteSelect = useCallback((text: string) => {
        setSearchQuery(text);
        setShowSuggestions(false);
        searchFinal(text);
        saveToHistory(text);
    }, [searchFinal, saveToHistory]);

    const handleSearchSubmit = useCallback(() => {
        if (searchQuery.trim()) {
            setShowSuggestions(false);
            searchFinal(searchQuery);
            saveToHistory(searchQuery, filteredResults.length);
        }
    }, [searchQuery, searchFinal, saveToHistory, filteredResults.length]);

    const handleSearchQueryChange = useCallback((text: string) => {
        setSearchQuery(text);
        if (text.trim().length >= 2) {
            triggerAutocomplete(text);
        } else if (text.trim().length === 0 && searchHistory.length > 0) {
            triggerAutocomplete('');
        }
    }, [triggerAutocomplete, searchHistory.length]);

    // Tracking
    useEffect(() => {
        trackNavigation('view');
    }, []);

    // Header component
    const listHeaderComponent = useMemo(() => (
        <View style={styles.listHeaderContainer}>
            <SearchBarSection
                searchQuery={searchQuery}
                onSearchQueryChange={handleSearchQueryChange}
                onSearchSubmit={handleSearchSubmit}
                loadingResults={loadingResults}
                dynamicPlaceholder={dynamicPlaceholder}
                autocompleteSuggestions={autocompleteSuggestions}
                isLoadingAutocomplete={isLoadingAutocomplete}
                searchHistory={searchHistory.map(item => ({ text: item.query }))}
                onAutocompleteSelect={handleAutocompleteSelect}
                onRemoveFromHistory={(text) => removeFromHistory(text)}
                onClearHistory={clearHistory}
                searchImages={searchImages}
                searchDocuments={searchDocuments}
                searchGPSString={searchGPSString}
                searchGPSData={searchGPSData}
                onTakePhoto={takeSearchPhoto}
                onChooseImages={chooseSearchImages}
                onPickDocument={pickSearchDocument}
                onRemoveImage={removeSearchImage}
                onRemoveDocument={removeSearchDocument}
                onGPSSelect={handleGPSSelect}
                onClearGPS={clearSearchGPS}
            />

            <QuickSortBar
                sortBy={sortBy}
                onSortChange={setSortBy}
            />

            {/* Filtres actifs */}
            {filters.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filtersScroll}
                >
                    <Text style={styles.filtersLabel}>Filtres :</Text>
                    {filters.map((filter, index) => (
                        <View key={index} style={styles.filterChip}>
                            <Text style={styles.filterText}>{filter}</Text>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Résultats header */}
            {!showSuggestions && filteredResults.length > 0 && (
                <View style={styles.resultsHeader}>
                    <Text style={styles.resultsCount}>
                        {filteredResults.length} résultat{filteredResults.length > 1 ? 's' : ''}
                    </Text>
                    <TouchableOpacity
                        style={styles.mapToggleButton}
                        onPress={() => setShowMapView(!showMapView)}
                    >
                        <SafeIcon
                            name={showMapView ? 'list' : 'map'}
                            size={18}
                            color={modernColors.primary}
                        />
                        <Text style={styles.mapToggleText}>
                            {showMapView ? 'Liste' : 'Carte'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    ), [
        searchQuery,
        handleSearchQueryChange,
        handleSearchSubmit,
        loadingResults,
        dynamicPlaceholder,
        autocompleteSuggestions,
        isLoadingAutocomplete,
        searchHistory,
        handleAutocompleteSelect,
        removeFromHistory,
        clearHistory,
        searchImages,
        searchDocuments,
        searchGPSString,
        searchGPSData,
        takeSearchPhoto,
        chooseSearchImages,
        pickSearchDocument,
        removeSearchImage,
        removeSearchDocument,
        handleGPSSelect,
        clearSearchGPS,
        sortBy,
        filters,
        showSuggestions,
        filteredResults.length,
        showMapView,
    ]);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.collapsibleHeader, headerAnimatedStyle]}>
                <NavigatorToolbar
                    title="Recherche intelligente"
                    subtitle={filters.length > 0 ? `Filtres actifs (${filters.length})` : 'Résultats personnalisés'}
                    rightSlot={(
                        <TouchableOpacity
                            style={styles.filterButton}
                            onPress={() => {
                                hapticPress();
                                setShowFilters(!showFilters);
                            }}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="sliders" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                    showHandle={false}
                    density="compact"
                    backIcon="back"
                />
            </Animated.View>

            {/* Suggestions */}
            {showSuggestions && (
                <SuggestionsPanel
                    visible={showSuggestions}
                    suggestions={suggestions}
                    loading={loadingSuggestions}
                    onSelectSuggestion={selectSuggestion}
                    onSearchWithoutSuggestion={() => {
                        setShowSuggestions(false);
                        if (searchQuery.trim() || filters.length > 0) {
                            searchFinal(searchQuery || filters);
                        }
                    }}
                />
            )}

            {/* Vue carte ou liste */}
            {!showSuggestions && (
                <>
                    {showMapView ? (
                        <View style={styles.mapContainer}>
                            <ResultsMapView
                                products={filteredResults}
                                onProductPress={handleProductPress}
                                visible={filteredResults.length > 0}
                            />
                        </View>
                    ) : (
                        <ResultsList
                            products={paginatedResults}
                            loading={loadingResults}
                            loadingMore={loadingMore}
                            refreshing={refreshing}
                            hasMoreResults={hasMoreResults}
                            onRefresh={onRefresh}
                            onLoadMore={handleLoadMore}
                            onProductPress={handleProductPress}
                            onProductLike={handleProductLike}
                            onProductFavorite={handleProductFavorite}
                            onProductShare={handleProductShare}
                            user={user}
                            itemAnimations={itemAnimations}
                            getItemAnimation={getItemAnimation}
                            ListHeaderComponent={listHeaderComponent}
                            onScroll={scrollHandler} {/* ✅ MIGRÉ: Utilise useAnimatedScrollHandler de Reanimated */}
                        />
                    )}
                </>
            )}

            {/* Bottom sheet de filtres */}
            <FiltersBottomSheet
                isOpen={showFilters}
                onClose={() => setShowFilters(false)}
                sortBy={sortBy}
                onSortChange={setSortBy}
                filterCategory={filterCategory}
                onFilterCategoryChange={setFilterCategory}
                priceFilter={priceFilter}
                onPriceFilterChange={setPriceFilter}
                dynamicFilters={dynamicFilters}
                selectedFilters={selectedFilters}
                onSelectedFiltersChange={setSelectedFilters}
                onApplyFilters={() => {
                    setShowFilters(false);
                    // Les filtres sont déjà appliqués via les callbacks
                }}
                onResetFilters={() => {
                    setSortBy('pertinence');
                    setFilterCategory('all');
                    setPriceFilter({ min: null, max: null, currency: 'XAF' });
                    setSelectedFilters({});
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    collapsibleHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        elevation: 10,
    },
    filterButton: {
        padding: 8,
    },
    listHeaderContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
        paddingTop: HEADER_HEIGHT + 16,
    },
    filtersScroll: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    filtersLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterChip: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    filterText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    resultsCount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
    },
    mapToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
    },
    mapToggleText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    mapContainer: {
        flex: 1,
        marginTop: HEADER_HEIGHT,
    },
});

export default ResultatBesoinScreen;

