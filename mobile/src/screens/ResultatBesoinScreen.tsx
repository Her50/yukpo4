/**
 * ResultatBesoinScreen v3.0 - Version optimale (2025-11-02)
 * Recherche progressive + Filtrage intelligent + Tri proximité/prix
 * Sauvegarde originale : ResultatBesoinScreen.backup.tsx
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ModernGPSModal from '../components/ModernGPSModal';
import NavigatorToolbar from '../components/NavigatorToolbar';
import ProductCard from '../components/ProductCard';
import SafeIcon from '../components/SafeIcon';
// ✅ NOUVEAU 2025-11-26 : Composants spécialisés
import AgenceVoyageResultCard from '../components/specialized/AgenceVoyageResultCard';
import CovoiturageResultCard from '../components/specialized/CovoiturageResultCard';
import HopitalResultCard from '../components/specialized/HopitalResultCard';
import LaboratoireResultCard from '../components/specialized/LaboratoireResultCard';
import PharmacieResultCard from '../components/specialized/PharmacieResultCard';
import TaxiResultCard from '../components/specialized/TaxiResultCard';
import { useLocation } from '../contexts/LocationContext';
import { apiPost } from '../services/api';
import { trackNavigation } from '../services/metricsTracking';
import { modernColors } from '../theme/modernTheme';

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
  product_vector: string[];         // Vecteur caractéristiques produit
  product_labels?: string[];        // ✅ NOUVEAU : Labels dimensions
  location_vector: string[];        // Vecteur lieu bidirectionnel
  full_vector?: string[];           // ✅ NOUVEAU : Vecteur complet (produit + lieu)
  chosen_location?: string;         // Lieu choisi
  usage_count?: number;             // ✅ NOUVEAU : Popularité (recherches client)
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
}

const buildSuggestionExample = (suggestion?: CombinationSuggestion | null): string | null => {
  if (!suggestion) {
    return null;
  }

  const vector = Array.isArray(suggestion.full_vector) && suggestion.full_vector.length > 0
    ? suggestion.full_vector
    : Array.isArray(suggestion.product_vector)
      ? suggestion.product_vector
      : [];

  if (!vector || vector.length === 0) {
    return null;
  }

  return vector.filter(Boolean).slice(0, 5).join(' • ');
};

const getSuggestionVector = (suggestion: CombinationSuggestion | null | undefined): string[] => {
  if (!suggestion) {
    return [];
  }

  if (Array.isArray(suggestion.full_vector) && suggestion.full_vector.length > 0) {
    return suggestion.full_vector.filter((item) => typeof item === 'string');
  }

  if (Array.isArray(suggestion.product_vector) && suggestion.product_vector.length > 0) {
    return suggestion.product_vector.filter((item) => typeof item === 'string');
  }

  return [];
};

const normalizeText = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  try {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  } catch (error) {
    return value.toLowerCase();
  }
};

type SortOption = 'pertinence' | 'proximite' | 'prix_asc' | 'prix_desc';
type FilterCategory = 'all' | 'with_stock' | 'with_variants' | 'nearby';

const HEADER_HEIGHT = 72;

const extractSearchResults = (response: any): Product[] => {
  if (!response) {
    return [];
  }

  const data = response?.data ?? response;

  if (!data) {
    return [];
  }

  // Extraire le tableau de résultats
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

  // ✅ Transformer les résultats enrichis en format Product
  return resultsArray.map((item: any) => {
    // Extraire le nom du produit depuis data
    const nom = item?.data?.titre_service?.valeur ||
      item?.data?.titre_service ||
      item?.nom ||
      item?.data?.nom?.valeur ||
      item?.data?.nom ||
      'Produit';

    // Extraire location_vector et chosen_location (priorité aux données enrichies)
    const location_vector = item.location_vector ||
      item?.data?.location_vector ||
      [];
    const chosen_location = item.chosen_location ||
      item?.data?.chosen_location ||
      location_vector[0]; // Utiliser le premier élément si chosen_location n'est pas disponible

    // Construire l'objet Product avec les données enrichies
    const product: Product = {
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
        nom: item.prestataire?.nom ||
          item.user?.nom_complet ||
          item.user?.nom ||
          'Prestataire',
        avatar_url: item.prestataire?.avatar_url ||
          item.user?.avatar_url,
        user_id: item.prestataire?.user_id ||
          item.user?.id ||
          item.user_id ||
          0,
      },
      has_variant: item.has_variant || item?.data?.has_variant || false,
      variants: item.variants || item?.data?.variants,
      prix: item.prix || item?.data?.prix,
      devise: item.devise || item?.data?.devise || 'XAF',
      image: item.image || item?.data?.image,
      coordinates: item.coordinates || item?.data?.coordinates,
      // ✅ Ajouter les données brutes pour ProductCard (avec priorité aux données enrichies)
      chosen_location, // S'assurer que chosen_location est au niveau racine
      location_vector, // S'assurer que location_vector est au niveau racine
      ...item,
    };

    // ✅ DEBUG: Logger la distance pour vérifier qu'elle est bien présente
    if (product.distance_km !== undefined) {
      console.log(`[ResultatBesoinScreen] ✅ Distance trouvée pour service ${product.service_id}: ${product.distance_km}km`);
    } else {
      console.warn(`[ResultatBesoinScreen] ⚠️ Pas de distance pour service ${product.service_id}`, {
        hasDistanceKm: !!item.distance_km,
        hasDataDistanceKm: !!item?.data?.distance_km,
        itemKeys: Object.keys(item),
      });
    }

    return product;
  });
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

const extractBase64 = (dataUrl: string): string => {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return '';
  }
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  const index = dataUrl.indexOf('base64,');
  if (index === -1) {
    return dataUrl;
  }
  return dataUrl.substring(index + 'base64,'.length);
};

const ResultatBesoinScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { location } = useLocation();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslate = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  // États recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<CombinationSuggestion[]>([]);
  const [dynamicPlaceholder, setDynamicPlaceholder] = useState<string | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const [filteredResults, setFilteredResults] = useState<Product[]>([]);

  // États UI
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // ✅ NOUVEAU : Pull-to-refresh
  const [showSearchActions, setShowSearchActions] = useState(false);

  // États filtrage et tri
  const [sortBy, setSortBy] = useState<SortOption>('pertinence');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ✅ NOUVEAU : Filtre par prix (de mobile2)
  const [priceFilter, setPriceFilter] = useState<{
    min: number | null;
    max: number | null;
    currency: string;
  }>({ min: null, max: null, currency: 'XAF' });
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  // ✅ NOUVEAU : Filtres intelligents dynamiques basés sur product_labels
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, Set<string>>>({});
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});

  // ✅ NOUVEAU : Médias et GPS pour la recherche avancée
  const [searchImages, setSearchImages] = useState<string[]>([]);
  const [searchDocuments, setSearchDocuments] = useState<Array<{ name: string; base64: string }>>([]);
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [searchGPSData, setSearchGPSData] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [searchGPSString, setSearchGPSString] = useState<string>('');
  const handleSearchAction = useCallback((action: () => void) => {
    setShowSearchActions(false);
    requestAnimationFrame(() => {
      action();
    });
  }, []);

  const normalizeAutocompleteResponse = (response: any): CombinationSuggestion[] => {
    if (!response) {
      return [];
    }

    const payload = response.data ?? response;

    if (Array.isArray(payload)) {
      return payload as CombinationSuggestion[];
    }

    if (Array.isArray(payload?.data)) {
      return payload.data as CombinationSuggestion[];
    }

    if (Array.isArray(payload?.results)) {
      return payload.results as CombinationSuggestion[];
    }

    if (Array.isArray(payload?.items)) {
      return payload.items as CombinationSuggestion[];
    }

    if (Array.isArray(payload?.data?.data)) {
      return payload.data.data as CombinationSuggestion[];
    }

    return [];
  };

  const requestImagePermissions = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de l’autorisation pour accéder à vos images.');
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        const image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSearchImages((prev) => [image, ...prev].slice(0, 10));
      }
    } catch (error) {
      console.error('[ResultatBesoinScreen] Erreur prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
    }
  }, []);

  const chooseSearchImages = useCallback(async () => {
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      console.error('[ResultatBesoinScreen] Erreur sélection images:', error);
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
      console.error('[ResultatBesoinScreen] Erreur sélection document:', error);
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
      setShowGPSModal(false);
      return;
    }

    const firstPoint = coordinatesString.split('|')[0]?.split(',');
    if (firstPoint && firstPoint.length === 2) {
      const lat = parseFloat(firstPoint[0]);
      const lng = parseFloat(firstPoint[1]);
      setSearchGPSData({ lat, lng });
    }

    setSearchGPSString(coordinatesString);
    setShowGPSModal(false);
    // ✅ Tracking métriques : Recherche géolocalisée
    trackNavigation('geolocation_search', {
      queryType: 'location',
    });
  }, []);

  const clearSearchGPS = useCallback(() => {
    setSearchGPSData(null);
    setSearchGPSString('');
  }, []);

  // ✅ CORRECTION 2025-11-06 : Fonction de recherche stable avec GPS proximité
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setDynamicPlaceholder(null);
      return;
    }

    const words = query.split(' ').filter(w => w.trim());
    setFilters(words);

    if (query.length >= 2) {
      setLoadingSuggestions(true);
      setShowSuggestions(true);

      try {
        // ✅ CORRECTION : Utiliser autocomplete_characteristics (VRAIS produits clients)
        // PAS autocomplete_combinations (qui est pour prestataires)
        const payload: any = {
          query: query,
          limit: 10,
        };

        // ✅ NOUVEAU 2025-11-06: Ajouter coordonnées GPS si disponibles pour tri par proximité
        if (location?.coords?.latitude && location?.coords?.longitude) {
          payload.user_lat = location.coords.latitude;
          payload.user_lng = location.coords.longitude;
          console.log('[ResultatBesoinScreen] 📍 GPS inclus dans suggestions:', {
            lat: payload.user_lat,
            lng: payload.user_lng
          });
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
        console.error('[ResultatBesoinScreen] Erreur suggestions:', error);
        setSuggestions([]);
        setDynamicPlaceholder(null);
      } finally {
        setLoadingSuggestions(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setDynamicPlaceholder(null);
    }
  }, [location]); // ✅ CORRECTION: Ajouter location aux dependencies

  // ✅ Tracking métriques : Vue de l'écran
  useEffect(() => {
    trackNavigation('view');
  }, []);

  // ✅ NOUVEAU : Initialiser les résultats depuis les paramètres de route (quand on vient de HomeScreen)
  useEffect(() => {
    try {
      const params = route.params as any;
      if (!params) {
        return;
      }

      console.log('[ResultatBesoinScreen] 📥 Paramètres de route reçus:', {
        hasResults: !!params.results,
        resultsCount: Array.isArray(params.results) ? params.results.length : 0,
        hasSearchQuery: !!params.searchQuery,
        searchQuery: params.searchQuery,
        type: params.type
      });

      // Initialiser les résultats si fournis
      if (params.results) {
        let extractedResults: Product[] = [];

        // Si c'est déjà un tableau, l'utiliser directement
        if (Array.isArray(params.results)) {
          extractedResults = params.results as Product[];
          console.log('[ResultatBesoinScreen] ✅ Résultats déjà en tableau:', extractedResults.length);
        } else {
          // Sinon, utiliser extractSearchResults pour parser la structure
          extractedResults = extractSearchResults(params.results);
          console.log('[ResultatBesoinScreen] ✅ Résultats extraits depuis structure:', extractedResults.length);
        }

        if (extractedResults.length > 0) {
          setResults(extractedResults);
          console.log('[ResultatBesoinScreen] ✅ Résultats initialisés:', extractedResults.length);
        } else {
          console.warn('[ResultatBesoinScreen] ⚠️ Aucun résultat valide trouvé dans route.params');
        }

        // Initialiser les filtres depuis la requête de recherche
        if (params.searchQuery) {
          const queryText = typeof params.searchQuery === 'string' ? params.searchQuery : '';
          setSearchQuery(queryText);
          const words = queryText.split(' ').filter(w => w.trim());
          if (words.length > 0) {
            setFilters(words);
          }
        }
      }
    } catch (error) {
      console.error('[ResultatBesoinScreen] ❌ Erreur initialisation depuis route.params:', error);
    }
  }, [route.params]); // ✅ Exécuter une seule fois au montage ou quand les params changent

  // ✅ CORRECTION 2025-11-04 : Suggestions depuis autocomplete_characteristics (VRAIS produits)
  useEffect(() => {
    try {
      // ✅ PROTECTION: Vérifier que fetchSuggestions existe
      if (typeof fetchSuggestions !== 'function') {
        console.error('[ResultatBesoinScreen] ❌ fetchSuggestions n\'est pas une fonction');
        return;
      }

      // Ne pas chercher des suggestions si on a déjà des résultats depuis route.params
      const params = route.params as any;
      if (params?.results && Array.isArray(params.results) && params.results.length > 0) {
        console.log('[ResultatBesoinScreen] ⏭️ Ignorer suggestions car résultats déjà fournis');
        return;
      }

      const debounce = setTimeout(() => {
        fetchSuggestions(searchQuery);
      }, 300);

      return () => clearTimeout(debounce);
    } catch (error) {
      console.error('[ResultatBesoinScreen] ❌ Erreur dans useEffect fetchSuggestions:', error);
    }
  }, [searchQuery, fetchSuggestions, route.params]); // ✅ Ajouter route.params aux dependencies

  // ✅ NOUVEAU : Générer filtres dynamiques depuis les résultats
  useEffect(() => {
    try {
      // ✅ PROTECTION: Vérifier que results est un array valide
      if (!Array.isArray(results) || results.length === 0) {
        setDynamicFilters({});
        return;
      }

      // Extraire tous les labels et valeurs uniques
      const filtersMap: Record<string, Set<string>> = {};

      results.forEach((product) => {
        if (!product) return; // ✅ Protection produit null/undefined

        const labels = product.product_labels || [];
        const vector = product.product_vector || [];

        // ✅ PROTECTION: Vérifier que labels est un array avec forEach
        if (!Array.isArray(labels)) {
          console.warn('[ResultatBesoinScreen] ⚠️ product_labels n\'est pas un array:', product);
          return;
        }

        labels.forEach((label, idx) => {
          if (!filtersMap[label]) {
            filtersMap[label] = new Set();
          }
          if (vector[idx]) {
            filtersMap[label].add(vector[idx]);
          }
        });
      });

      // Garder seulement les dimensions avec au moins 2 valeurs différentes
      const meaningfulFilters: Record<string, Set<string>> = {};
      Object.entries(filtersMap).forEach(([label, values]) => {
        if (values.size >= 2) {
          meaningfulFilters[label] = values;
        }
      });

      setDynamicFilters(meaningfulFilters);
      console.log('[ResultatBesoinScreen] Filtres dynamiques générés:', Object.keys(meaningfulFilters));
    } catch (error) {
      console.error('[ResultatBesoinScreen] ❌ Erreur dans useEffect dynamicFilters:', error);
      setDynamicFilters({});
    }
  }, [results]);

  // ✅ Appliquer filtres et tri
  useEffect(() => {
    try {
      // ✅ PROTECTION: Vérifier que results est un array valide
      if (!Array.isArray(results)) {
        console.error('[ResultatBesoinScreen] ❌ results n\'est pas un array');
        setFilteredResults([]);
        return;
      }

      // ✅ Tracking métriques : Filtre appliqué
      if (filterCategory !== 'all' || Object.keys(selectedFilters).length > 0 || priceFilter.min !== null || priceFilter.max !== null) {
        trackNavigation('filter', {
          filterType: filterCategory === 'nearby' ? 'location' : filterCategory === 'with_stock' ? 'category' : 'price',
        });
      }

      let filtered = [...results];

      // ✅ NOUVEAU : Appliquer filtres dynamiques
      if (selectedFilters && typeof selectedFilters === 'object') {
        Object.entries(selectedFilters).forEach(([label, value]) => {
          if (value) {
            filtered = filtered.filter((product) => {
              if (!product) return false; // ✅ Protection produit null/undefined
              const labels = product.product_labels || [];
              const vector = product.product_vector || [];
              const index = labels.indexOf(label);
              return index !== -1 && vector[index] === value;
            });
          }
        });
      }

      // ✅ NOUVEAU : Filtre par prix (de mobile2)
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
        // 'pertinence' : pas de tri (déjà trié par backend)
      }

      setFilteredResults(filtered);
    } catch (error) {
      console.error('[ResultatBesoinScreen] ❌ Erreur dans useEffect filtrage/tri:', error);
      setFilteredResults(results || []); // Fallback aux résultats bruts
    }
  }, [results, sortBy, filterCategory, selectedFilters, priceFilter]); // ✅ Ajout priceFilter

  // Helper : Prix minimum
  const getPrixMin = (product: Product): number => {
    // ✅ PROTECTION: Vérifier que product existe
    if (!product) return 0;

    if (product.has_variant && Array.isArray(product.variants) && product.variants.length > 0) {
      try {
        return Math.min(...product.variants.map(v => v?.prix || 0));
      } catch (error) {
        console.warn('[ResultatBesoinScreen] ⚠️ Erreur getPrixMin variants:', error);
        return product.prix || 0;
      }
    }
    return product.prix || 0;
  };

  // ✅ CORRECTION 2025-11-04 : Utiliser /api/search/direct (recherche globale)
  const searchFinal = useCallback(async (input: string | string[]) => {
    const finalFilters = Array.isArray(input)
      ? input.filter((token) => typeof token === 'string').map((token) => token.trim()).filter(Boolean)
      : input.trim().split(/\s+/).filter(Boolean);

    console.log('[ResultatBesoinScreen] 🔍 searchFinal appelé avec:', finalFilters);

    if (!finalFilters || finalFilters.length === 0) {
      console.warn('[ResultatBesoinScreen] ⚠️ Filtres vides ou invalides, abandon de la recherche');
      return;
    }

    setFilters(finalFilters);
    setLoadingResults(true);

    try {
      // Construire le texte de recherche depuis le vecteur
      const searchText = finalFilters.join(' ');
      console.log('[ResultatBesoinScreen] 🔍 Recherche avec texte:', searchText);

      const payload: any = {
        texte: searchText,  // "Nike Air Max 42 Douala"
      };

      // Ajouter localisation utilisateur si disponible
      if (location?.coords?.latitude && location?.coords?.longitude) {
        payload.gps_mobile = `${location.coords.latitude},${location.coords.longitude}`;
        console.log('[ResultatBesoinScreen] 📍 Position ajoutée:', payload.gps_mobile);
      } else {
        console.warn('[ResultatBesoinScreen] ⚠️ GPS non disponible:', {
          hasLocation: !!location,
          hasCoords: !!location?.coords,
          latitude: location?.coords?.latitude,
          longitude: location?.coords?.longitude,
        });
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

      console.log('[ResultatBesoinScreen] 📤 Envoi requête API:', payload);

      // ✅ Utiliser la recherche globale (même que HomeScreen)
      const apiResponse = await apiPost('/api/search/direct', payload);

      console.log('[ResultatBesoinScreen] 📥 Réponse API reçue:', apiResponse);

      if (apiResponse?.success === false) {
        console.warn('[ResultatBesoinScreen] ⚠️ Recherche échouée:', apiResponse?.error);
        setResults([]);
        return;
      }

      const extractedResults = extractSearchResults(apiResponse);

      if (extractedResults.length > 0) {
        console.log('[ResultatBesoinScreen] ✅ Résultats trouvés:', extractedResults.length);
        setResults(extractedResults);
        // ✅ Tracking métriques : Recherche avec résultats
        trackNavigation('search', {
          queryType: searchGPSString ? 'location' : 'keyword',
          resultsCount: extractedResults.length,
          hasResults: true,
        });
      } else {
        console.log('[ResultatBesoinScreen] ⚠️ Aucun résultat trouvé');
        setResults([]);
        // ✅ Tracking métriques : Recherche sans résultats
        trackNavigation('search', {
          queryType: searchGPSString ? 'location' : 'keyword',
          hasResults: false,
        });
      }
    } catch (error: any) {
      console.error('[ResultatBesoinScreen] ❌ Erreur recherche:', error);
      console.error('[ResultatBesoinScreen] ❌ Stack trace:', error?.stack);
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  }, [location, searchDocuments, searchGPSString, searchImages]);

  // Sélectionner suggestion
  const selectSuggestion = useCallback(async (suggestion: CombinationSuggestion) => {
    try {
      console.log('[ResultatBesoinScreen] 🎯 Suggestion sélectionnée:', suggestion);

      const vector = getSuggestionVector(suggestion);
      if (!vector || vector.length === 0) {
        console.error('[ResultatBesoinScreen] ❌ Suggestion invalide ou vecteur manquant');
        return;
      }

      const vectorText = vector.join(' ').trim();
      setSearchQuery(vectorText);
      setFilters(vector);
      setShowSuggestions(false);
      await searchFinal(vector);
    } catch (error) {
      console.error('[ResultatBesoinScreen] ❌ Crash selectSuggestion:', error);
    }
  }, [searchFinal]);

  // Handler ChatInput (identique HomeScreen)
  const handleChatSubmit = async (input: any) => {
    const queryText = typeof input === 'string' ? input : input?.text || '';
    setSearchQuery(queryText);
    // Le useEffect se chargera de lancer la recherche
  };

  // ✅ NOUVEAU : Pull-to-Refresh - Recharger les résultats
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Recharger les résultats actuels
      if (filters.length > 0) {
        const searchText = filters.join(' ');
        const payload: any = { texte: searchText };

        if (location?.coords?.latitude && location?.coords?.longitude) {
          payload.gps_mobile = `${location.coords.latitude},${location.coords.longitude}`;
        }

        const apiResponse = await apiPost('/api/search/direct', payload);

        if (apiResponse?.success === false) {
          console.warn('[ResultatBesoinScreen] ⚠️ Refresh recherche échoué:', apiResponse?.error);
          setResults([]);
        } else {
          const refreshedResults = extractSearchResults(apiResponse);
          setResults(refreshedResults);
        }
      }
    } catch (error) {
      console.error('[ResultatBesoinScreen] Erreur refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [filters, location]);

  const renderSuggestions = useCallback(() => {
    if (!showSuggestions) {
      return null;
    }

    if (suggestions.length > 0) {
      return (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionsHeader}>
            <View style={styles.suggestionsHeaderLeft}>
              <SafeIcon name="sparkles" size={18} color={modernColors.primary} />
              <Text style={styles.suggestionsTitle}>Caractéristiques recommandées</Text>
              <Text style={styles.suggestionsCount}>({suggestions.length})</Text>
            </View>
            <TouchableOpacity
              style={styles.manualSearchButton}
              onPress={() => {
                try {
                  setShowSuggestions(false);
                  searchFinal(searchQuery || filters);
                } catch (error) {
                  console.error('[ResultatBesoinScreen] ❌ Crash recherche manuelle:', error);
                }
              }}
            >
              <SafeIcon name="search" size={16} color={modernColors.primary} />
              <Text style={styles.manualSearchText}>Rechercher sans suggestion</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={suggestions}
            keyExtractor={(_, index) => `suggestion-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsList}
            contentContainerStyle={styles.suggestionsContent}
            renderItem={({ item, index }) => {
              const chips = getSuggestionVector(item).slice(0, 6);
              const priceText = typeof item?.prix === 'number'
                ? `${Math.round(item.prix).toLocaleString()} ${item?.devise || 'XAF'}`
                : null;

              return (
                <TouchableOpacity
                  key={`suggestion-card-${index}`}
                  style={styles.suggestionCard}
                  onPress={() => selectSuggestion(item)}
                >
                  <View style={styles.suggestionCardHeader}>
                    <View style={styles.suggestionCardHeaderLeft}>
                      <SafeIcon name="layers" size={16} color={modernColors.primary} />
                      <Text style={styles.suggestionCardTitle}>Proposition {index + 1}</Text>
                    </View>
                    {item?.usage_count ? (
                      <View style={styles.suggestionUsagePill}>
                        <SafeIcon name="flame" size={14} color="#EA580C" />
                        <Text style={styles.suggestionUsageText}>
                          {item.usage_count}× recherché
                        </Text>
                      </View>
                    ) : priceText ? (
                      <Text style={styles.priceText}>{priceText}</Text>
                    ) : null}
                  </View>

                  <View style={styles.vectorChips}>
                    {chips.map((chip, chipIndex) => (
                      <View key={`${chip}-${chipIndex}`} style={styles.productChip}>
                        <Text style={styles.productChipText} numberOfLines={1}>
                          {chip}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.statsRow}>
                    {item.chosen_location && (
                      <View style={styles.locationRow}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                        <Text style={styles.locationText}>{item.chosen_location}</Text>
                      </View>
                    )}
                    {item.has_variant && item.variant_dimension ? (
                      <Text style={styles.statsText}>⚙️ {item.variant_dimension}</Text>
                    ) : item.usage_count ? (
                      <Text style={styles.statsText}>👥 {item.usage_count} recherche(s)</Text>
                    ) : null}
                  </View>

                  <View style={styles.selectButton}>
                    <SafeIcon name="check-circle" size={16} color={modernColors.primary} />
                    <Text style={styles.selectButtonText}>Utiliser cette suggestion</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.noSuggestionsContainer}>
        <Text style={styles.noSuggestionsText}>Aucune suggestion</Text>
        <TouchableOpacity
          style={styles.manualSearchButton}
          onPress={() => {
            try {
              setShowSuggestions(false);
              searchFinal(searchQuery || filters);
            } catch (error) {
              console.error('[ResultatBesoinScreen] ❌ Crash recherche quand même:', error);
            }
          }}
        >
          <SafeIcon name="search" size={16} color={modernColors.primary} />
          <Text style={styles.manualSearchText}>Rechercher quand même</Text>
        </TouchableOpacity>
      </View>
    );
  }, [filters, searchFinal, searchQuery, selectSuggestion, setShowSuggestions, showSuggestions, suggestions]);

  const listHeaderComponent = useMemo(() => (
    <View style={styles.listHeaderContainer}>
      <View style={styles.searchSection}>
        <View style={styles.searchBarContainer}>
          <View style={styles.searchInputWrapper}>
            <SafeIcon name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder={dynamicPlaceholder || 'Rechercher un produit...'}
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={() => {
                try {
                  if (searchQuery.trim()) {
                    setShowSuggestions(false);
                    searchFinal(searchQuery);
                  }
                } catch (error) {
                  console.error('[ResultatBesoinScreen] ❌ Crash onSubmitEditing:', error);
                }
              }}
            />
            <TouchableOpacity
              style={styles.searchActionsButton}
              onPress={() => setShowSearchActions(true)}
              accessibilityRole="button"
              accessibilityLabel="Afficher les outils de recherche avancée"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <SafeIcon name="more-horizontal" size={18} color={modernColors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.searchButton, loadingResults && styles.searchButtonDisabled]}
            onPress={() => {
              try {
                if (searchQuery.trim()) {
                  setShowSuggestions(false);
                  searchFinal(searchQuery);
                }
              } catch (error) {
                console.error('[ResultatBesoinScreen] ❌ Crash onPress:', error);
              }
            }}
            disabled={loadingResults}
          >
            {loadingResults ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <SafeIcon name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {(searchImages.length > 0 || searchDocuments.length > 0 || !!searchGPSString) && (
          <View style={styles.searchAttachmentsContainer}>
            {searchImages.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.searchImagesPreview}
              >
                {searchImages.map((uri, index) => (
                  <View key={`search-image-${index}`} style={styles.searchImageWrapper}>
                    <Image source={{ uri }} style={styles.searchImage} />
                    <TouchableOpacity
                      style={styles.attachmentRemoveButton}
                      onPress={() => removeSearchImage(index)}
                    >
                      <Text style={styles.attachmentRemoveIcon}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {searchDocuments.length > 0 && (
              <View style={styles.searchDocumentsList}>
                {searchDocuments.map((doc, index) => (
                  <View key={`search-doc-${index}`} style={styles.searchDocumentItem}>
                    <SafeIcon name="file-text" size={14} color={modernColors.primary} />
                    <Text style={styles.searchDocumentName} numberOfLines={1}>
                      {doc.name}
                    </Text>
                    <TouchableOpacity onPress={() => removeSearchDocument(index)}>
                      <Text style={styles.attachmentRemoveIcon}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {!!searchGPSString && (
              <View style={styles.searchGPSBadge}>
                <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                <Text style={styles.searchGPSLabel} numberOfLines={1}>
                  {searchGPSString.includes('|')
                    ? `${searchGPSString.split('|').length} points GPS`
                    : searchGPSData
                      ? `${searchGPSData.lat.toFixed(4)}, ${searchGPSData.lng.toFixed(4)}`
                      : searchGPSString}
                </Text>
                <TouchableOpacity onPress={clearSearchGPS}>
                  <Text style={styles.attachmentRemoveIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.quickSortRow}>
        <TouchableOpacity
          style={[styles.quickSortPill, sortBy === 'pertinence' && styles.quickSortPillActive]}
          onPress={() => setSortBy('pertinence')}
        >
          <SafeIcon
            name="zap"
            size={16}
            color={sortBy === 'pertinence' ? '#FFFFFF' : modernColors.primary}
          />
          <Text style={[styles.quickSortText, sortBy === 'pertinence' && styles.quickSortTextActive]}>
            Pertinence
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickSortPill, sortBy === 'proximite' && styles.quickSortPillActive]}
          onPress={() => setSortBy('proximite')}
        >
          <SafeIcon
            name="map-pin"
            size={16}
            color={sortBy === 'proximite' ? '#FFFFFF' : modernColors.primary}
          />
          <Text style={[styles.quickSortText, sortBy === 'proximite' && styles.quickSortTextActive]}>
            Proximité
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickSortPill, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.quickSortPillActive]}
          onPress={() => {
            if (sortBy === 'prix_asc') {
              setSortBy('prix_desc');
            } else if (sortBy === 'prix_desc') {
              setSortBy('pertinence');
            } else {
              setSortBy('prix_asc');
            }
          }}
        >
          <SafeIcon
            name={sortBy === 'prix_desc' ? 'arrow-down' : 'arrow-up'}
            size={16}
            color={(sortBy === 'prix_asc' || sortBy === 'prix_desc') ? '#FFFFFF' : modernColors.primary}
          />
          <Text style={[styles.quickSortText, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.quickSortTextActive]}>
            Prix {sortBy === 'prix_desc' ? '↓' : sortBy === 'prix_asc' ? '↑' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>📊 Trier par</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[styles.filterOption, sortBy === 'pertinence' && styles.filterOptionActive]}
                onPress={() => setSortBy('pertinence')}
              >
                <Text style={[styles.filterOptionText, sortBy === 'pertinence' && styles.filterOptionTextActive]}>Pertinence</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterOption, sortBy === 'proximite' && styles.filterOptionActive]}
                onPress={() => setSortBy('proximite')}
              >
                <Text style={[styles.filterOptionText, sortBy === 'proximite' && styles.filterOptionTextActive]}>Proximité</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterOption, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.filterOptionActive]}
                onPress={() => {
                  if (sortBy === 'prix_asc') {
                    setSortBy('prix_desc');
                  } else if (sortBy === 'prix_desc') {
                    setSortBy('pertinence');
                  } else {
                    setSortBy('prix_asc');
                  }
                }}
              >
                <Text style={[styles.filterOptionText, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.filterOptionTextActive]}>
                  Prix
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.filterHint}>Sélectionnez un ordre de tri pour affiner votre recherche.</Text>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>🎯 Catégories rapides</Text>
            <View style={styles.filterOptions}>
              {([
                { key: 'all' as FilterCategory, label: 'Tous' },
                { key: 'with_stock' as FilterCategory, label: 'En stock' },
                { key: 'with_variants' as FilterCategory, label: 'Variantes' },
                { key: 'nearby' as FilterCategory, label: 'Proche' },
              ]).map((category) => {
                const isActive = filterCategory === category.key;
                return (
                  <TouchableOpacity
                    key={category.key}
                    style={[styles.filterOption, isActive && styles.filterOptionActive]}
                    onPress={() => setFilterCategory(category.key)}
                  >
                    <Text style={[styles.filterOptionText, isActive && styles.filterOptionTextActive]}>{category.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.priceFilterContainer}>
            <Text style={styles.filterGroupTitle}>💵 Filtre de prix</Text>
            <View style={styles.priceFilterRow}>
              <TextInput
                style={styles.priceFilterInput}
                placeholder="Min"
                keyboardType="numeric"
                value={priceFilter.min !== null ? String(priceFilter.min) : ''}
                onChangeText={(text) => {
                  const sanitized = text.replace(/[^0-9]/g, '');
                  setPriceFilter((prev) => ({
                    ...prev,
                    min: sanitized ? parseInt(sanitized, 10) : null,
                  }));
                }}
              />
              <Text style={styles.priceFilterSeparator}>—</Text>
              <TextInput
                style={styles.priceFilterInput}
                placeholder="Max"
                keyboardType="numeric"
                value={priceFilter.max !== null ? String(priceFilter.max) : ''}
                onChangeText={(text) => {
                  const sanitized = text.replace(/[^0-9]/g, '');
                  setPriceFilter((prev) => ({
                    ...prev,
                    max: sanitized ? parseInt(sanitized, 10) : null,
                  }));
                }}
              />
            </View>
            <View style={styles.priceFilterActions}>
              <TouchableOpacity
                style={styles.priceFilterReset}
                onPress={() => setPriceFilter({ min: null, max: null, currency: priceFilter.currency })}
              >
                <Text style={styles.priceFilterResetText}>Réinitialiser</Text>
              </TouchableOpacity>
              <Text style={styles.priceFilterInfo}>Devise: {priceFilter.currency}</Text>
            </View>
          </View>

          {Object.entries(dynamicFilters).map(([label, values]) => (
            <View key={label} style={styles.dynamicFilterSection}>
              <View style={styles.filterGroupHeader}>
                <Text style={styles.dynamicFilterLabel}>{label}</Text>
                {selectedFilters[label] && (
                  <TouchableOpacity
                    onPress={() => setSelectedFilters((prev) => {
                      const next = { ...prev };
                      delete next[label];
                      return next;
                    })}
                  >
                    <Text style={styles.filterHint}>Effacer</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.dynamicFilterOptions}>
                {Array.from(values).map((value) => {
                  const isActive = selectedFilters[label] === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[styles.dynamicFilterChip, isActive && styles.dynamicFilterChipActive]}
                      onPress={() => setSelectedFilters((prev) => {
                        const next = { ...prev };
                        if (isActive) {
                          delete next[label];
                        } else {
                          next[label] = value;
                        }
                        return next;
                      })}
                    >
                      <Text style={[styles.dynamicFilterChipText, isActive && styles.dynamicFilterChipTextActive]}>
                        {value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

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

      {!showSuggestions && filteredResults.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredResults.length} résultat{filteredResults.length > 1 ? 's' : ''}
          </Text>
          {sortBy !== 'pertinence' && (
            <Text style={styles.sortInfo}>
              Trié par : {
                sortBy === 'proximite' ? '📍 Proximité' :
                  sortBy === 'prix_asc' ? '💰 Prix ↑' :
                    '💎 Prix ↓'
              }
            </Text>
          )}
        </View>
      )}

      {showSuggestions && renderSuggestions()}
    </View>
  ), [
    chooseSearchImages,
    clearSearchGPS,
    dynamicFilters,
    dynamicPlaceholder,
    filterCategory,
    filteredResults.length,
    filters,
    loadingResults,
    loadingSuggestions,
    pickSearchDocument,
    priceFilter,
    removeSearchDocument,
    removeSearchImage,
    renderSuggestions,
    searchDocuments,
    searchGPSData,
    searchGPSString,
    searchImages,
    searchQuery,
    searchFinal,
    selectedFilters,
    setFilterCategory,
    setSelectedFilters,
    setShowSuggestions,
    setPriceFilter,
    showFilters,
    showSuggestions,
    sortBy,
    takeSearchPhoto,
  ]);

  const renderListFooter = useCallback(() => {
    if (loadingResults) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={modernColors.primary} />
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        </View>
      );
    }
    return <View style={{ height: 16 }} />;
  }, [loadingResults]);

  const renderEmptyComponent = useCallback(() => {
    if (showSuggestions || loadingResults) {
      return null;
    }

    if (searchQuery.length > 0) {
      return (
        <View style={styles.emptyState}>
          <SafeIcon name="package-x" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Aucun résultat</Text>
          <Text style={styles.emptyText}>
            Essayez avec d'autres mots-clés ou ajustez les filtres
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <SafeIcon name="search" size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Recherchez un produit</Text>
        <Text style={styles.emptyText}>
          Décrivez ce que vous cherchez en langage naturel
        </Text>
      </View>
    );
  }, [loadingResults, searchQuery.length, showSuggestions]);

  const listData = showSuggestions ? [] : filteredResults;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.collapsibleHeader, { transform: [{ translateY: headerTranslate }] }]}>
        <NavigatorToolbar
          title="Recherche intelligente"
          subtitle={filters.length > 0 ? `Filtres actifs (${filters.length})` : 'Résultats personnalisés'}
          rightSlot={(
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(!showFilters)}
            >
              <SafeIcon name="sliders" size={20} color={modernColors.primary} />
            </TouchableOpacity>
          )}
          showHandle={false}
          density="compact"
          backIcon="back"
        />
      </Animated.View>

      <Animated.FlatList
        data={listData}
        keyExtractor={(item) => `${item.service_id}`}
        renderItem={({ item }) => {
          // ✅ NOUVEAU 2025-11-26 : Détecter le type de résultat et utiliser le composant spécialisé
          const searchMethod = (item as any).search_method || '';
          const data = item.data || {};
          const type = data.type || (item as any).type || '';

          // Détecter le type spécialisé
          if (searchMethod.includes('specialized_pharmacy') || type === 'pharmacie') {
            return (
              <PharmacieResultCard
                pharmacy={{
                  id: item.service_id,
                  service_id: item.service_id,
                  nom: data.titre_service?.valeur || item.nom || '',
                  adresse: data.adresse,
                  quartier: data.quartier,
                  ville: data.ville,
                  telephone: data.telephone,
                  whatsapp: data.whatsapp,
                  is_on_duty_now: data.is_on_duty_now,
                  distance_km: item.distance_km,
                  services: data.services,
                }}
                onPress={() => {
                  trackNavigation('click', {
                    itemType: 'pharmacy',
                    itemId: item.service_id?.toString(),
                  });
                  (navigation as any).navigate('ServiceDetail', {
                    serviceId: item.service_id,
                  });
                }}
              />
            );
          }

          if (searchMethod.includes('specialized_hospital') || type === 'hopital_clinique') {
            return (
              <HopitalResultCard
                hospital={{
                  id: item.service_id,
                  service_id: item.service_id,
                  nom: data.titre_service?.valeur || item.nom || '',
                  type_etablissement: data.type_etablissement,
                  adresse: data.adresse,
                  quartier: data.quartier,
                  ville: data.ville,
                  telephone: data.telephone,
                  whatsapp: data.whatsapp,
                  is_available_now: data.is_available_now,
                  distance_km: item.distance_km,
                  prestations_medicales: data.prestations_medicales,
                  urgences_disponible: data.urgences_disponible,
                }}
                onPress={() => {
                  trackNavigation('click', {
                    itemType: 'hospital',
                    itemId: item.service_id?.toString(),
                  });
                  (navigation as any).navigate('ServiceDetail', {
                    serviceId: item.service_id,
                  });
                }}
              />
            );
          }

          if (searchMethod.includes('specialized_laboratory') || type === 'laboratoire_imagerie') {
            return (
              <LaboratoireResultCard
                laboratory={{
                  id: item.service_id,
                  service_id: item.service_id,
                  nom: data.titre_service?.valeur || item.nom || '',
                  type_laboratoire: data.type_laboratoire,
                  quartier: data.quartier,
                  ville: data.ville,
                  telephone: data.telephone,
                  whatsapp: data.whatsapp,
                  is_available_now: data.is_available_now,
                  distance_km: item.distance_km,
                  analyses_disponibles: data.analyses_disponibles,
                  imagerie_disponible: data.imagerie_disponible,
                }}
                onPress={() => {
                  trackNavigation('click', {
                    itemType: 'laboratory',
                    itemId: item.service_id?.toString(),
                  });
                  (navigation as any).navigate('ServiceDetail', {
                    serviceId: item.service_id,
                  });
                }}
              />
            );
          }

          if (searchMethod.includes('specialized_travel_agency') || type === 'agence_voyage') {
            // ✅ NOUVEAU : Détecter les tickets bus dans les résultats
            const busTickets = (item as any).bus_tickets || (item as any).tickets || null;

            return (
              <AgenceVoyageResultCard
                agency={{
                  id: item.service_id,
                  service_id: item.service_id,
                  nom_agence: data.titre_service?.valeur || item.nom || '',
                  quartier: data.quartier,
                  ville: data.ville,
                  telephone: data.telephone,
                  whatsapp: data.whatsapp,
                  peut_emettre_tickets_bus: data.peut_emettre_tickets_bus,
                  distance_km: item.distance_km,
                  services_voyage: data.services_voyage,
                  compagnies_bus: data.compagnies_bus,
                }}
                busTickets={busTickets}
                onPress={() => {
                  trackNavigation('click', {
                    itemType: 'travel_agency',
                    itemId: item.service_id?.toString(),
                  });
                  (navigation as any).navigate('ServiceDetail', {
                    serviceId: item.service_id,
                  });
                }}
              />
            );
          }

          // ✅ NOUVEAU : Détecter les résultats de recherche de tickets bus directement
          if (searchMethod.includes('bus_tickets') || type === 'bus_ticket') {
            const busTickets = Array.isArray(item) ? item : [item];
            const agencyData = (item as any).agency || {};

            return (
              <AgenceVoyageResultCard
                agency={{
                  id: agencyData.agency_id || item.service_id,
                  service_id: agencyData.agency_service_id || item.service_id,
                  nom_agence: agencyData.agency_nom || data.titre_service?.valeur || item.nom || '',
                  quartier: agencyData.agency_quartier || data.quartier,
                  ville: agencyData.agency_ville || data.ville,
                  telephone: agencyData.agency_telephone || data.telephone,
                  whatsapp: agencyData.agency_whatsapp || data.whatsapp,
                  peut_emettre_tickets_bus: true,
                  distance_km: (item as any).distance_km || item.distance_km,
                }}
                busTickets={busTickets.map((ticket: any) => ({
                  product_id: ticket.product_id || ticket.id,
                  product_name: ticket.product_name || ticket.name,
                  bus_model_name: ticket.bus_model_name,
                  total_seats: ticket.total_seats,
                  available_seats: ticket.available_seats || 0,
                  reserved_seats: ticket.reserved_seats || 0,
                  bus_number: ticket.bus_number,
                  departure_city: ticket.departure_city,
                  arrival_city: ticket.arrival_city,
                  departure_date: ticket.departure_date,
                  departure_time: ticket.departure_time,
                  ticket_price: ticket.ticket_price || ticket.price,
                  currency: ticket.currency || 'XAF',
                  distance_km: ticket.distance_km,
                }))}
                onPress={() => {
                  trackNavigation('click', {
                    itemType: 'bus_ticket',
                    itemId: item.service_id?.toString(),
                  });
                  (navigation as any).navigate('ServiceDetail', {
                    serviceId: item.service_id,
                  });
                }}
              />
            );
          }

          if (searchMethod.includes('specialized_covoiturage') || type === 'covoiturage') {
            return (
              <CovoiturageResultCard
                covoiturage={{
                  id: item.service_id,
                  service_id: item.service_id,
                  depart: data.depart || '',
                  destination: data.destination || '',
                  date_depart: data.date_depart || '',
                  heure_depart: data.heure_depart || '',
                  nombre_places: data.nombre_places || 4,
                  places_disponibles: data.places_disponibles || 0,
                  prix_par_place: data.prix_par_place || 0,
                  devise: data.devise || 'XAF',
                  distance_km: item.distance_km,
                }}
                onPress={() => {
                  trackNavigation('click', {
                    itemType: 'covoiturage',
                    itemId: item.service_id?.toString(),
                  });
                  (navigation as any).navigate('ServiceDetail', {
                    serviceId: item.service_id,
                  });
                }}
              />
            );
          }

          if (searchMethod.includes('specialized_taxi') || type === 'taxi_ville') {
            return (
              <TaxiResultCard
                taxi={{
                  id: item.service_id,
                  service_id: item.service_id,
                  nom_chauffeur: data.titre_service?.valeur || data.nom_chauffeur,
                  telephone: data.telephone || '',
                  whatsapp: data.whatsapp,
                  zone_intervention: data.zone_intervention,
                  is_available_now: data.is_available_now,
                  is_on_duty: data.is_on_duty,
                  distance_km: item.distance_km,
                }}
                onPress={() => {
                  trackNavigation('click', {
                    itemType: 'taxi',
                    itemId: item.service_id?.toString(),
                  });
                  (navigation as any).navigate('ServiceDetail', {
                    serviceId: item.service_id,
                  });
                }}
              />
            );
          }

          // Par défaut, utiliser ProductCard pour les résultats généraux
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                trackNavigation('click', {
                  itemType: 'product',
                  itemId: item.service_id?.toString(),
                });
              }}
            >
              <ProductCard
                product={item}
                service={{
                  ...item,
                  data: item.data || {},
                  user: item.user || null,
                  prestataire: item.prestataire || null,
                } as any}
              />
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={listHeaderComponent}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderEmptyComponent}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[modernColors.primary]}
            tintColor={modernColors.primary}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (event: any) => {
              // ✅ Tracking métriques : Scroll (avec throttling via scrollEventThrottle)
              // Le scroll est déjà throttlé à 16ms, on track seulement les scrolls significatifs
              const scrollY = event.nativeEvent.contentOffset.y;
              if (scrollY > 0 && scrollY % 500 < 16) { // Track tous les 500px
                trackNavigation('view', {}); // Utiliser 'view' pour scroll
              }
            }
          }
        )}
        scrollEventThrottle={16}
      />

      <Modal
        visible={showSearchActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSearchActions(false)}
      >
        <View style={styles.searchActionsModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowSearchActions(false)}
          />
          <View style={styles.searchActionsPopoverWrapper}>
            <View style={styles.searchActionsPopover}>
              <TouchableOpacity
                style={styles.searchActionsChip}
                onPress={() => handleSearchAction(() => setShowGPSModal(true))}
              >
                <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
                <Text style={styles.searchActionsChipLabel}>Localisation</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchActionsChip}
                onPress={() => handleSearchAction(takeSearchPhoto)}
              >
                <SafeIcon name="camera" size={18} color={modernColors.primary} />
                <Text style={styles.searchActionsChipLabel}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchActionsChip}
                onPress={() => handleSearchAction(chooseSearchImages)}
              >
                <SafeIcon name="image" size={18} color={modernColors.primary} />
                <Text style={styles.searchActionsChipLabel}>Galerie</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchActionsChip}
                onPress={() => handleSearchAction(pickSearchDocument)}
              >
                <SafeIcon name="file-text" size={18} color={modernColors.primary} />
                <Text style={styles.searchActionsChipLabel}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ModernGPSModal
        visible={showGPSModal}
        onClose={() => setShowGPSModal(false)}
        onSelect={handleGPSSelect}
        currentLocation={searchGPSData || undefined}
        title="Sélection de localisation GPS"
        allowZoneSelection
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
  searchSection: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: '#111827',
  },
  searchActionsButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchAttachmentsContainer: {
    marginTop: 12,
    gap: 12,
  },
  searchImagesPreview: {
    gap: 12,
    paddingVertical: 4,
  },
  searchImageWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchImage: {
    width: '100%',
    height: '100%',
  },
  attachmentRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#111827',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentRemoveIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchDocumentsList: {
    gap: 8,
  },
  searchDocumentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchDocumentName: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '500',
  },
  searchGPSBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFEFF',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  searchGPSLabel: {
    fontSize: 12,
    color: '#0F172A',
    maxWidth: 200,
  },
  searchActionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingHorizontal: 24,
  },
  searchActionsPopoverWrapper: {
    maxWidth: 320,
    width: '100%',
    alignItems: 'flex-end',
  },
  searchActionsPopover: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchActionsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchActionsChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
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
  filtersPanel: {
    backgroundColor: '#FFF',
    padding: 16,
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterGroup: {
    gap: 12,
  },
  filterGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  filterHint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: -8,
  },
  dynamicFilterSection: {
    gap: 8,
    marginTop: 8,
  },
  dynamicFilterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  dynamicFilterOptions: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  dynamicFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
  },
  dynamicFilterChipActive: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  dynamicFilterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  dynamicFilterChipTextActive: {
    color: '#FFF',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: modernColors.primary,
    backgroundColor: '#FFF',
  },
  filterOptionActive: {
    backgroundColor: modernColors.primary,
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: modernColors.primary,
  },
  filterOptionTextActive: {
    color: '#FFF',
  },
  suggestionsContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  suggestionsCount: {
    fontSize: 14,
    fontWeight: '700',
    color: modernColors.primary,
  },
  closeSuggestions: {
    fontSize: 20,
    color: '#6B7280',
  },
  suggestionsList: {
    maxHeight: 280,
  },
  suggestionsContent: {
    paddingBottom: 12,
  },
  suggestionCard: {
    marginBottom: 12,
  },
  suggestionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggestionUsagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1E6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  suggestionUsageText: {
    fontSize: 12,
    color: modernColors.accent,
    fontWeight: '600',
  },
  vectorChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  productChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: modernColors.primary,
  },
  productChipText: {
    fontSize: 13,
    color: modernColors.primary,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statsText: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: modernColors.primary,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: modernColors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  selectButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  manualSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: modernColors.primary,
    borderRadius: 12,
    borderStyle: 'dashed',
    marginTop: 16,
  },
  manualSearchText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.primary,
  },
  noSuggestionsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSuggestionsText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  sortInfo: {
    fontSize: 12,
    color: '#6B7280',
  },
  resultsList: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  // ✅ NOUVEAU : Styles pour filtre par prix (de mobile2)
  filterGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceFilterContainer: {
    marginTop: 12,
  },
  priceFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  priceFilterInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    color: '#0F172A',
  },
  priceFilterSeparator: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  priceFilterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  priceFilterReset: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  priceFilterResetText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  priceFilterApply: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: modernColors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  priceFilterApplyText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  priceFilterInfo: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // ✅ NOUVEAU : Styles pour les raccourcis de tri
  quickSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  quickSortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  quickSortPillActive: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  quickSortText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  quickSortTextActive: {
    color: '#FFFFFF',
  },
  listHeaderContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  listContent: {
    paddingTop: HEADER_HEIGHT + 16,
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
});

export default ResultatBesoinScreen;
