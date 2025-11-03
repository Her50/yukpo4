/**
 * ResultatBesoinScreen v3.0 - Version optimale (2025-11-02)
 * Recherche progressive + Filtrage intelligent + Tri proximité/prix
 * Sauvegarde originale : ResultatBesoinScreen.backup.tsx
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ChatInputMobile from '../components/ChatInputMobile';
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
  product_vector: string[];
  location_vector: string[];
  chosen_location?: string;
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
  
  // États filtrage et tri
  const [sortBy, setSortBy] = useState<SortOption>('pertinence');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ✅ Recherche progressive autocomplete
    useEffect(() => {
    const debounce = setTimeout(async () => {
      if (searchQuery.trim()) {
        const words = searchQuery.split(' ').filter(w => w.trim());
        setFilters(words);

        if (searchQuery.length >= 2) {
          setLoadingSuggestions(true);
          setShowSuggestions(true);

          try {
            const response = await apiPost('/api/combinations/search', {
              query: searchQuery,
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
                        } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // ✅ Appliquer filtres et tri
  useEffect(() => {
    let filtered = [...results];

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
  }, [results, sortBy, filterCategory]);

  // Helper : Prix minimum
  const getPrixMin = (product: Product): number => {
    if (product.has_variant && product.variants && product.variants.length > 0) {
      return Math.min(...product.variants.map(v => v.prix || 0));
    }
    return product.prix || 0;
  };

  // Sélectionner suggestion
  const selectSuggestion = async (suggestion: CombinationSuggestion) => {
    setSearchQuery(suggestion.full_vector.join(', '));
    setFilters(suggestion.full_vector);
    setShowSuggestions(false);
    await searchFinal(suggestion.full_vector);
  };

  // Recherche finale
  const searchFinal = async (finalFilters: string[]) => {
    setLoadingResults(true);

    try {
      const payload: any = {
        combination_vector: finalFilters,
      };

      // Ajouter localisation utilisateur si disponible
      if (location && typeof location === 'object') {
        const loc = location as any;
        if (loc.latitude && loc.longitude) {
          payload.user_location = {
            lat: loc.latitude,
            lng: loc.longitude,
          };
        }
      }

      const response = await apiPost('/api/search/by-autocomplete', payload);

      if (response.success && response.data) {
        setResults(response.data as Product[]);
                    } else {
        setResults([]);
                }
            } catch (error) {
            console.error('[ResultatBesoinScreen] Erreur recherche:', error);
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

      {/* Barre de recherche ChatInput (identique HomeScreen) */}
      <View style={styles.searchSection}>
        <ChatInputMobile
          onSubmit={handleChatSubmit}
          loading={loadingSuggestions || loadingResults}
          placeholder="Décrivez votre besoin..."
        />

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

      {/* Panneau Filtres & Tri */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          {/* Tri */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>📊 Trier par :</Text>
            <View style={styles.filterOptions}>
              {[
                { key: 'pertinence', label: '🎯 Pertinence', icon: 'zap' },
                { key: 'proximite', label: '📍 Proximité', icon: 'map-pin' },
                { key: 'prix_asc', label: '💰 Prix croissant', icon: 'arrow-up' },
                { key: 'prix_desc', label: '💎 Prix décroissant', icon: 'arrow-down' },
              ].map((option) => (
                                <TouchableOpacity
                  key={option.key}
                                    style={[
                    styles.filterOption,
                    sortBy === option.key && styles.filterOptionActive,
                                    ]}
                  onPress={() => setSortBy(option.key as SortOption)}
                                >
                  <SafeIcon
                    name={option.icon as any}
                    size={16}
                    color={sortBy === option.key ? '#FFF' : modernColors.primary}
                  />
                                    <Text
                                        style={[
                      styles.filterOptionText,
                      sortBy === option.key && styles.filterOptionTextActive,
                                        ]}
                                    >
                    {option.label}
                                    </Text>
                                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Filtres */}
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
                {suggestions.map((suggestion, index) => (
                                <TouchableOpacity
                    key={index}
                    style={styles.suggestionCard}
                    onPress={() => selectSuggestion(suggestion)}
                  >
                    <NativeCard>
                      {/* Vecteur produit */}
                      <View style={styles.vectorChips}>
                        {suggestion.product_vector.map((char, idx) => (
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
                  setShowSuggestions(false);
                  searchFinal(filters);
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
                  setShowSuggestions(false);
                  searchFinal(filters);
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
});

export default ResultatBesoinScreen;
