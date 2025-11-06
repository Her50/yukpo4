/**
 * ResultatBesoinScreen v3.0 - Version optimale (2025-11-02)
 * Recherche progressive + Filtrage intelligent + Tri proximité/prix
 * Sauvegarde originale : ResultatBesoinScreen.backup.tsx
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeCard } from '../components/NativeDesign';
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

type SortOption = 'pertinence' | 'proximite' | 'prix_asc' | 'prix_desc';
type FilterCategory = 'all' | 'with_stock' | 'with_variants' | 'nearby';

const ResultatBesoinScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { location } = useLocation();

  // États recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<CombinationSuggestion[]>([]);
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

  // ✅ CORRECTION 2025-11-05 : Fonction de recherche stable avec useCallback
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
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
        const response = await apiPost('/api/autocomplete/search-products', {
          query: query,
          limit: 10,
        });

        if (response.success && response.data) {
          setSuggestions(response.data as CombinationSuggestion[]);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error('[ResultatBesoinScreen] Erreur suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []); // ✅ Fonction stable sans dependencies

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

  // Sélectionner suggestion
  const selectSuggestion = async (suggestion: CombinationSuggestion) => {
    try {
      console.log('[ResultatBesoinScreen] 🎯 Suggestion sélectionnée:', suggestion);

      // ✅ PROTECTION: Vérifier que suggestion.full_vector existe
      if (!suggestion || !Array.isArray(suggestion.full_vector)) {
        console.error('[ResultatBesoinScreen] ❌ Suggestion invalide ou full_vector manquant');
        return;
      }

      setSearchQuery(suggestion.full_vector.join(', '));
      setFilters(suggestion.full_vector);
      setShowSuggestions(false);
      await searchFinal(suggestion.full_vector);
    } catch (error) {
      console.error('[ResultatBesoinScreen] ❌ Crash selectSuggestion:', error);
    }
  };

  // ✅ CORRECTION 2025-11-04 : Utiliser /api/search/direct (recherche globale)
  const searchFinal = async (finalFilters: string[]) => {
    console.log('[ResultatBesoinScreen] 🔍 searchFinal appelé avec:', finalFilters);

    if (!finalFilters || !Array.isArray(finalFilters) || finalFilters.length === 0) {
      console.warn('[ResultatBesoinScreen] ⚠️ Filtres vides ou invalides, abandon de la recherche');
      return;
    }

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

      console.log('[ResultatBesoinScreen] 📤 Envoi requête API:', payload);

      // ✅ Utiliser la recherche globale (même que HomeScreen)
      const response = await apiPost('/api/search/direct', payload);

      console.log('[ResultatBesoinScreen] 📥 Réponse API reçue:', response);

      if ((response as any).resultats?.resultats) {
        const results = (response as any).resultats.resultats as Product[];
        console.log('[ResultatBesoinScreen] ✅ Résultats trouvés:', results.length);
        setResults(results);
      } else if (response.data) {
        const results = response.data as Product[];
        console.log('[ResultatBesoinScreen] ✅ Résultats trouvés (data):', results.length);
        setResults(results);
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

        const response = await apiPost('/api/search/direct', payload);

        if ((response as any).resultats?.resultats) {
          setResults((response as any).resultats.resultats as Product[]);
        } else if (response.data) {
          setResults(response.data as Product[]);
        } else {
          setResults([]);
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <SafeIcon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recherche</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <SafeIcon name="sliders" size={20} color={modernColors.primary} />
        </TouchableOpacity>
      </View>

      {/* ✅ NOUVEAU : Barre de recherche LINÉAIRE avec bouton à droite */}
      <View style={styles.searchSection}>
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              try {
                console.log('[ResultatBesoinScreen] 🔍 Recherche déclenchée (Enter), query:', searchQuery, 'filters:', filters);
                if (searchQuery.trim()) {
                  setShowSuggestions(false);
                  searchFinal(filters);
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
                  searchFinal(filters);
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
              <Text style={styles.suggestionsTitle}>💡 Suggestions ({suggestions.length})</Text>
              <ScrollView style={styles.suggestionsList}>
                {(suggestions || []).map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionCard}
                    onPress={() => selectSuggestion(suggestion)}
                  >
                    <NativeCard>
                      {/* Vecteur produit */}
                      <View style={styles.vectorChips}>
                        {(suggestion?.product_vector || []).map((char, idx) => (
                          <View key={idx} style={styles.productChip}>
                            <Text style={styles.productChipText}>{char}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Localisation */}
                      {suggestion.chosen_location && (
                        <View style={styles.locationRow}>
                          <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                          <Text style={styles.locationText}>{suggestion.chosen_location}</Text>
                        </View>
                      )}

                      {/* Stats */}
                      <View style={styles.statsRow}>
                        <Text style={styles.statsText}>
                          📊 {suggestion.usage_count}× utilisé
                        </Text>
                        {suggestion.has_variant && suggestion.variant_dimension && (
                          <Text style={styles.statsText}>
                            • {suggestion.variant_dimension}
                          </Text>
                        )}
                        {suggestion.prix && (
                          <Text style={styles.priceText}>
                            {suggestion.prix.toLocaleString()} {suggestion.devise || 'XAF'}
                          </Text>
                        )}
                      </View>

                      {/* Bouton */}
                      <View style={styles.selectButton}>
                        <SafeIcon name="check-circle" size={16} color="#FFF" />
                        <Text style={styles.selectButtonText}>Sélectionner</Text>
                      </View>
                    </NativeCard>
                  </TouchableOpacity>
                ))}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
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
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionCard: {
    marginBottom: 12,
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
    gap: 12,
    marginBottom: 12,
  },
  statsText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: modernColors.primary,
    marginLeft: 'auto',
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
});

export default ResultatBesoinScreen;
