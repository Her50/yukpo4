/**
 * ResultatBesoinScreen v2.0 - Version simplifiée et moderne (2025-11-02)
 * Recherche progressive avec suggestions vecteurs autocomplete
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from '../components/SafeIcon';
import { NativeCard } from '../components/NativeDesign';
import ProductCard from '../components/ProductCard';

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
}

const ResultatBesoinScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // États
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<CombinationSuggestion[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Recherche progressive autocomplete
  useEffect(() => {
    const debounce = setTimeout(async () => {
      if (searchText.trim()) {
        const words = searchText.split(' ').filter(w => w.trim());
        setFilters(words);

        // Afficher suggestions si plus de 2 caractères
        if (searchText.length >= 2) {
          setLoadingSuggestions(true);
          setShowSuggestions(true);

          try {
            const response = await apiPost('/api/autocomplete/search-combinations', {
              filters: words,
              limit: 10,
            });

            if (response.success && response.data) {
              setSuggestions(response.data);
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
  }, [searchText]);

  // Sélectionner une suggestion
  const selectSuggestion = async (suggestion: CombinationSuggestion) => {
    // Mettre vecteur complet dans barre recherche
    setSearchText(suggestion.full_vector.join(', '));
    setFilters(suggestion.full_vector);
    setShowSuggestions(false);

    // Lancer recherche finale
    await searchFinal(suggestion.full_vector);
  };

  // Recherche finale dans services
  const searchFinal = async (finalFilters: string[]) => {
    setLoadingResults(true);

    try {
      const response = await apiPost('/api/search/by-autocomplete', {
        combination_vector: finalFilters,
      });

      if (response.success && response.data) {
        setResults(response.data);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('[ResultatBesoinScreen] Erreur recherche finale:', error);
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  // Recherche manuelle (sans suggestion)
  const handleManualSearch = () => {
    setShowSuggestions(false);
    if (filters.length > 0) {
      searchFinal(filters);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recherche de produits</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit ou service..."
            placeholderTextColor={modernColors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchText('');
              setSuggestions([]);
              setResults([]);
            }}>
              <SafeIcon name="x-circle" size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtres actifs */}
        {filters.length > 0 && !showSuggestions && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            {filters.map((filter, index) => (
              <View key={index} style={styles.filterChip}>
                <Text style={styles.filterText}>{filter}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

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
              <Text style={styles.suggestionsTitle}>💡 Produits complets correspondants</Text>
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
                          📊 {suggestion.usage_count} fois utilisé
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

                      {/* Bouton sélection */}
                      <View style={styles.selectButton}>
                        <SafeIcon name="check-circle" size={16} color="#FFF" />
                        <Text style={styles.selectButtonText}>Sélectionner ce produit</Text>
                      </View>
                    </NativeCard>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Bouton recherche manuelle */}
              <TouchableOpacity
                style={styles.manualSearchButton}
                onPress={handleManualSearch}
              >
                <SafeIcon name="search" size={16} color={modernColors.primary} />
                <Text style={styles.manualSearchText}>
                  Rechercher sans suggestion
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noSuggestionsContainer}>
              <Text style={styles.noSuggestionsText}>
                Aucune suggestion trouvée
              </Text>
              <TouchableOpacity
                style={styles.manualSearchButton}
                onPress={handleManualSearch}
              >
                <SafeIcon name="search" size={16} color={modernColors.primary} />
                <Text style={styles.manualSearchText}>
                  Rechercher quand même
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Résultats */}
      {!showSuggestions && (
        <View style={styles.resultsContainer}>
          {loadingResults ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={modernColors.primary} />
              <Text style={styles.loadingText}>Recherche en cours...</Text>
            </View>
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => `${item.service_id}`}
              renderItem={({ item }) => <ProductCard product={item} />}
              contentContainerStyle={styles.resultsList}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />
          ) : searchText.length > 0 ? (
            <View style={styles.emptyState}>
              <SafeIcon name="package-x" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucun résultat</Text>
              <Text style={styles.emptyText}>
                Essayez avec d'autres mots-clés
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <SafeIcon name="search" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Recherchez un produit</Text>
              <Text style={styles.emptyText}>
                Tapez pour voir des suggestions
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
  searchSection: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  filtersScroll: {
    gap: 8,
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

