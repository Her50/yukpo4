/**
 * ResultatBesoinScreen v3.0 - Version optimale (2025-11-02)
 * Recherche progressive + Filtrage intelligent + Tri proximité/prix
 * Sauvegarde originale : ResultatBesoinScreen.backup.tsx
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ModernGPSModal from '../components/ModernGPSModal';
import { NativeCard } from '../components/NativeDesign';
import NavigatorToolbar from '../components/NavigatorToolbar';
import ProductCard from '../components/ProductCard';
import SafeIcon from '../components/SafeIcon';
import { useLocation } from '../contexts/LocationContext';
import { apiPost } from '../services/api';
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

const extractSearchResults = (response: any): Product[] => {
  if (!response) {
    return [];
  }

  const data = response?.data ?? response;

  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data as Product[];
  }

  const nestedCandidates = [
    data?.resultats?.resultats,
    data?.resultats,
    data?.data,
    data?.items,
  ];

  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      return candidate as Product[];
    }
  }

  return [];
};

const ResultatBesoinScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { location } = useLocation();

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

  const requestImagePermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de l’autorisation pour accéder à vos images.');
      return false;
    }
    return true;
  };

  const takeSearchPhoto = async () => {
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
  };

  const chooseSearchImages = async () => {
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

  const pickSearchDocument = async () => {
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
  };

  const removeSearchImage = (index: number) => {
    setSearchImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeSearchDocument = (index: number) => {
    setSearchDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGPSSelect = (coordinatesString: string) => {
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
  };

  const clearSearchGPS = () => {
    setSearchGPSData(null);
    setSearchGPSString('');
  };

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

  // ✅ CORRECTION 2025-11-04 : Suggestions depuis autocomplete_characteristics (VRAIS produits)
  useEffect(() => {
    try {
      // ✅ PROTECTION: Vérifier que fetchSuggestions existe
      if (typeof fetchSuggestions !== 'function') {
        console.error('[ResultatBesoinScreen] ❌ fetchSuggestions n\'est pas une fonction');
        return;
      }

      const debounce = setTimeout(() => {
        fetchSuggestions(searchQuery);
      }, 300);

      return () => clearTimeout(debounce);
    } catch (error) {
      console.error('[ResultatBesoinScreen] ❌ Erreur dans useEffect fetchSuggestions:', error);
    }
  }, [searchQuery, fetchSuggestions]); // ✅ CORRECTION: Ajouter fetchSuggestions aux dependencies

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

  const extractBase64 = (dataUrl: string): string => {
    if (!dataUrl) return dataUrl;
    if (!dataUrl.startsWith('data:')) return dataUrl;
    const index = dataUrl.indexOf('base64,');
    if (index === -1) return dataUrl;
    return dataUrl.substring(index + 7);
  };

  // Sélectionner suggestion
  const selectSuggestion = async (suggestion: CombinationSuggestion) => {
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
  };

  // ✅ CORRECTION 2025-11-04 : Utiliser /api/search/direct (recherche globale)
  const searchFinal = async (input: string | string[]) => {
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
      if (location && typeof location === 'object') {
        const loc = location as any;
        if (loc.latitude && loc.longitude) {
          payload.gps_mobile = `${loc.latitude},${loc.longitude}`;
          console.log('[ResultatBesoinScreen] 📍 Position ajoutée:', payload.gps_mobile);
        }
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
      } else {
        console.log('[ResultatBesoinScreen] ⚠️ Aucun résultat trouvé');
        setResults([]);
      }
    } catch (error: any) {
      console.error('[ResultatBesoinScreen] ❌ Erreur recherche:', error);
      console.error('[ResultatBesoinScreen] ❌ Stack trace:', error?.stack);
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

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

        if (location && typeof location === 'object') {
          const loc = location as any;
          if (loc.latitude && loc.longitude) {
            payload.gps_mobile = `${loc.latitude},${loc.longitude}`;
          }
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <NavigatorToolbar
        title="Recherche intelligente"
        subtitle={filters.category ? `Filtre: ${filters.category}` : 'Résultats personnalisés'}
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

      {/* ✅ NOUVEAU : Barre de recherche LINÉAIRE avec bouton à droite */}
      <View style={styles.searchSection}>
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={dynamicPlaceholder || 'Rechercher un produit...'}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              try {
                console.log('[ResultatBesoinScreen] 🔍 Recherche déclenchée (Enter), query:', searchQuery, 'filters:', filters);
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
            style={styles.searchButton}
            onPress={() => {
              try {
                console.log('[ResultatBesoinScreen] 🔍 Recherche déclenchée (Bouton), query:', searchQuery, 'filters:', filters);
                if (searchQuery.trim()) {
                  setShowSuggestions(false);
                  searchFinal(searchQuery);
                }
              } catch (error) {
                console.error('[ResultatBesoinScreen] ❌ Crash onPress:', error);
              }
            }}
            disabled={loadingSuggestions || loadingResults}
          >
            {loadingSuggestions || loadingResults ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <SafeIcon name="send" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchActionsRow}>
          <TouchableOpacity
            style={styles.searchActionButton}
            onPress={() => setShowGPSModal(true)}
          >
            <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
            <Text style={styles.searchActionLabel}>GPS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.searchActionButton}
            onPress={takeSearchPhoto}
          >
            <SafeIcon name="camera" size={18} color={modernColors.primary} />
            <Text style={styles.searchActionLabel}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.searchActionButton}
            onPress={chooseSearchImages}
          >
            <SafeIcon name="image" size={18} color={modernColors.primary} />
            <Text style={styles.searchActionLabel}>Images</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.searchActionButton}
            onPress={pickSearchDocument}
          >
            <SafeIcon name="file" size={18} color={modernColors.primary} />
            <Text style={styles.searchActionLabel}>Fichier</Text>
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

        {/* Raccourcis de tri visibles en permanence */}
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
            <Text
              style={[styles.quickSortText, sortBy === 'pertinence' && styles.quickSortTextActive]}
            >
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
            <Text
              style={[styles.quickSortText, sortBy === 'proximite' && styles.quickSortTextActive]}
            >
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
            <Text
              style={[styles.quickSortText, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.quickSortTextActive]}
            >
              Prix {sortBy === 'prix_desc' ? '↓' : sortBy === 'prix_asc' ? '↑' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filtres actifs */}
        {filters.length > 0 && !showSuggestions && (
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
      </View>

      {/* ✅ SUPPRIMÉ TEMPORAIREMENT : ResultsHeader pour identifier le crash
      {!showSuggestions && filteredResults.length > 0 && (
        <ResultsHeader
          title="Produits correspondants"
          resultsCount={filteredResults.length}
          onGeolocationPress={() => {
            // Trier par proximité
            setSortBy('proximite');
          }}
          onPriceFilterPress={() => {
            // Toggle filtre prix
            setShowFilters(!showFilters);
          }}
          onSortPress={() => {
            // Toggle panel de tri
            setShowFilters(!showFilters);
          }}
          sortBy={
            sortBy === 'pertinence' ? 'pertinence' :
            sortBy === 'proximite' ? 'proximité' :
            sortBy === 'prix_asc' ? 'prix croissant' :
            sortBy === 'prix_desc' ? 'prix décroissant' :
            'pertinence'
          }
        />
      )}
      */}

      {/* Panneau Filtres & Tri */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          {/* ✅ NOUVEAU : Tri optimisé (prix en toggle) */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>📊 Trier par :</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  sortBy === 'pertinence' && styles.filterOptionActive,
                ]}
                onPress={() => setSortBy('pertinence')}
              >
                <SafeIcon
                  name="zap"
                  size={16}
                  color={sortBy === 'pertinence' ? '#FFF' : modernColors.primary}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    sortBy === 'pertinence' && styles.filterOptionTextActive,
                  ]}
                >
                  🎯 Pertinence
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  sortBy === 'proximite' && styles.filterOptionActive,
                ]}
                onPress={() => setSortBy('proximite')}
              >
                <SafeIcon
                  name="map-pin"
                  size={16}
                  color={sortBy === 'proximite' ? '#FFF' : modernColors.primary}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    sortBy === 'proximite' && styles.filterOptionTextActive,
                  ]}
                >
                  📍 Proximité
                </Text>
              </TouchableOpacity>

              {/* ✅ Prix avec toggle croissant/décroissant */}
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.filterOptionActive,
                ]}
                onPress={() => {
                  // Toggle entre croissant et décroissant
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
                  color={(sortBy === 'prix_asc' || sortBy === 'prix_desc') ? '#FFF' : modernColors.primary}
                />
                <Text
                  style={[
                    styles.filterOptionText,
                    (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.filterOptionTextActive,
                  ]}
                >
                  💰 Prix {sortBy === 'prix_desc' ? '↓' : '↑'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ✅ NOUVEAU : Filtre par prix (de mobile2) */}
          <View style={styles.filterGroup}>
            <TouchableOpacity
              style={styles.filterGroupHeader}
              onPress={() => setShowPriceFilter(!showPriceFilter)}
            >
              <Text style={styles.filterGroupTitle}>💰 Filtrer par prix</Text>
              <SafeIcon
                name={showPriceFilter ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={modernColors.primary}
              />
            </TouchableOpacity>

            {showPriceFilter && (
              <View style={styles.priceFilterContainer}>
                <View style={styles.priceFilterRow}>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceLabel}>Prix min</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={priceFilter.min?.toString() || ''}
                      onChangeText={(text) => setPriceFilter(prev => ({
                        ...prev,
                        min: text ? parseFloat(text) : null
                      }))}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceLabel}>Prix max</Text>
                    <TextInput
                      style={styles.priceInput}
                      value={priceFilter.max?.toString() || ''}
                      onChangeText={(text) => setPriceFilter(prev => ({
                        ...prev,
                        max: text ? parseFloat(text) : null
                      }))}
                      placeholder="100000"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.priceFilterActions}>
                  <TouchableOpacity
                    style={styles.priceFilterReset}
                    onPress={() => setPriceFilter({ min: null, max: null, currency: 'XAF' })}
                  >
                    <Text style={styles.priceFilterResetText}>Réinitialiser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.priceFilterApply}
                    onPress={() => setShowPriceFilter(false)}
                  >
                    <Text style={styles.priceFilterApplyText}>Appliquer</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.priceFilterInfo}>
                  {filteredResults.length} résultat{filteredResults.length > 1 ? 's' : ''} trouvé{filteredResults.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Filtres catégories */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>🔍 Filtrer :</Text>
            <View style={styles.filterOptions}>
              {[
                { key: 'all', label: 'Tous' },
                { key: 'with_stock', label: 'En stock' },
                { key: 'with_variants', label: 'Avec variations' },
                { key: 'nearby', label: 'À proximité (<5km)' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterOption,
                    filterCategory === option.key && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilterCategory(option.key as FilterCategory)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterCategory === option.key && styles.filterOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ✅ NOUVEAU : Filtres intelligents dynamiques basés sur product_labels */}
          {dynamicFilters && Object.keys(dynamicFilters).length > 0 && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>🎯 Filtres intelligents :</Text>
              <Text style={styles.filterHint}>
                Basés sur les produits trouvés
              </Text>

              {Object.entries(dynamicFilters || {}).map(([label, valuesSet]) => {
                const values = valuesSet ? Array.from(valuesSet) : [];
                return (
                  <View key={label} style={styles.dynamicFilterSection}>
                    <Text style={styles.dynamicFilterLabel}>
                      {label.charAt(0).toUpperCase() + label.slice(1)} :
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.dynamicFilterOptions}
                    >
                      {/* Option "Tous" pour désélectionner */}
                      <TouchableOpacity
                        style={[
                          styles.dynamicFilterChip,
                          !selectedFilters[label] && styles.dynamicFilterChipActive,
                        ]}
                        onPress={() => {
                          setSelectedFilters(prev => {
                            const updated = { ...prev };
                            delete updated[label];
                            return updated;
                          });
                        }}
                      >
                        <Text
                          style={[
                            styles.dynamicFilterChipText,
                            !selectedFilters[label] && styles.dynamicFilterChipTextActive,
                          ]}
                        >
                          Tous
                        </Text>
                      </TouchableOpacity>

                      {values.map((value) => (
                        <TouchableOpacity
                          key={value}
                          style={[
                            styles.dynamicFilterChip,
                            selectedFilters[label] === value && styles.dynamicFilterChipActive,
                          ]}
                          onPress={() => {
                            setSelectedFilters(prev => ({
                              ...prev,
                              [label]: prev[label] === value ? '' : value,
                            }));
                          }}
                        >
                          <Text
                            style={[
                              styles.dynamicFilterChipText,
                              selectedFilters[label] === value && styles.dynamicFilterChipTextActive,
                            ]}
                          >
                            {value}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Suggestions vecteurs */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {loadingSuggestions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={modernColors.primary} />
              <Text style={styles.loadingText}>Recherche...</Text>
            </View>
          ) : suggestions.length > 0 ? (
            <>
              <View style={styles.suggestionsHeader}>
                <View style={styles.suggestionsHeaderLeft}>
                  <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                  <Text style={styles.suggestionsTitle}>Caractéristiques recommandées</Text>
                  <Text style={styles.suggestionsCount}>({suggestions.length})</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                  <Text style={styles.closeSuggestions}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.suggestionsList}
                contentContainerStyle={styles.suggestionsContent}
                nestedScrollEnabled
              >
                {(suggestions || []).map((suggestion, index) => {
                  const chips = getSuggestionVector(suggestion).slice(0, 6);
                  const priceText = typeof suggestion?.prix === 'number'
                    ? `${Math.round(suggestion.prix).toLocaleString()} ${suggestion?.devise || 'XAF'}`
                    : null;
                  const accentColor = modernColors?.accent ?? '#F97316';

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionCard}
                      onPress={() => selectSuggestion(suggestion)}
                    >
                      <NativeCard>
                        <View style={styles.suggestionCardHeader}>
                          <View style={styles.suggestionCardHeaderLeft}>
                            <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                            <Text style={styles.suggestionCardTitle}>Proposition {index + 1}</Text>
                          </View>

                          {suggestion?.usage_count ? (
                            <View style={styles.suggestionUsagePill}>
                              <SafeIcon name="users" size={12} color={accentColor} />
                              <Text style={styles.suggestionUsageText}>
                                {suggestion.usage_count}× recherché
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.vectorChips}>
                          {chips.map((chip, idx) => (
                            <View key={`${chip}-${idx}`} style={styles.productChip}>
                              <Text style={styles.productChipText}>{chip}</Text>
                            </View>
                          ))}
                        </View>

                        {suggestion.chosen_location && (
                          <View style={styles.locationRow}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                            <Text style={styles.locationText}>{suggestion.chosen_location}</Text>
                          </View>
                        )}

                        <View style={styles.statsRow}>
                          {suggestion.has_variant && suggestion.variant_dimension ? (
                            <Text style={styles.statsText}>⚙️ {suggestion.variant_dimension}</Text>
                          ) : null}
                          {priceText ? (
                            <Text style={styles.priceText}>{priceText}</Text>
                          ) : null}
                        </View>

                        <View style={styles.selectButton}>
                          <SafeIcon name="check-circle" size={16} color="#FFF" />
                          <Text style={styles.selectButtonText}>Utiliser cette suggestion</Text>
                        </View>
                      </NativeCard>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.manualSearchButton}
                onPress={() => {
                  try {
                    console.log('[ResultatBesoinScreen] 🔍 Recherche manuelle sans suggestion, filters:', filters);
                    setShowSuggestions(false);
                    searchFinal(filters);
                  } catch (error) {
                    console.error('[ResultatBesoinScreen] ❌ Crash recherche manuelle:', error);
                  }
                }}
              >
                <SafeIcon name="search" size={16} color={modernColors.primary} />
                <Text style={styles.manualSearchText}>
                  Rechercher sans suggestion
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noSuggestionsContainer}>
              <Text style={styles.noSuggestionsText}>Aucune suggestion</Text>
              <TouchableOpacity
                style={styles.manualSearchButton}
                onPress={() => {
                  try {
                    console.log('[ResultatBesoinScreen] 🔍 Recherche quand même, filters:', filters);
                    setShowSuggestions(false);
                    searchFinal(filters);
                  } catch (error) {
                    console.error('[ResultatBesoinScreen] ❌ Crash recherche quand même:', error);
                  }
                }}
              >
                <SafeIcon name="search" size={16} color={modernColors.primary} />
                <Text style={styles.manualSearchText}>Rechercher quand même</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Résultats */}
      {!showSuggestions && (
        <View style={styles.resultsContainer}>
          {/* Header résultats */}
          {filteredResults.length > 0 && (
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

          {loadingResults ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={modernColors.primary} />
              <Text style={styles.loadingText}>Recherche en cours...</Text>
            </View>
          ) : filteredResults.length > 0 ? (
            <FlatList
              data={filteredResults}
              keyExtractor={(item) => `${item.service_id}`}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[modernColors.primary]}
                  tintColor={modernColors.primary}
                />
              }
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  service={item as any}
                />
              )}
              contentContainerStyle={styles.resultsList}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />
          ) : searchQuery.length > 0 ? (
            <View style={styles.emptyState}>
              <SafeIcon name="package-x" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucun résultat</Text>
              <Text style={styles.emptyText}>
                Essayez avec d'autres mots-clés ou ajustez les filtres
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <SafeIcon name="search" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Recherchez un produit</Text>
              <Text style={styles.emptyText}>
                Décrivez ce que vous cherchez en langage naturel
              </Text>
            </View>
          )}
        </View>
      )}

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
  filterButton: {
    padding: 8,
  },
  searchSection: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  quickSortPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5F5',
  },
  quickSortPillActive: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  quickSortText: {
    fontSize: 13,
    fontWeight: '600',
    color: modernColors.primary,
  },
  quickSortTextActive: {
    color: '#FFFFFF',
  },
  searchActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  searchActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    gap: 6,
  },
  searchActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: modernColors.primary,
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    gap: 12,
  },
  priceFilterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  priceFilterActions: {
    flexDirection: 'row',
    gap: 12,
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
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
});

export default ResultatBesoinScreen;
