import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { NativeCard, NativeButton } from './NativeDesign';
import SafeIcon from './SafeIcon';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface GoogleBusinessModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectBusiness: (businessData: any) => void;
}

interface PlaceResult {
  description: string;
  place_id?: string;
  types?: string[];
}

const GoogleBusinessModal: React.FC<GoogleBusinessModalProps> = ({
  visible,
  onClose,
  onSelectBusiness,
}) => {
  const [hasGoogleBusiness, setHasGoogleBusiness] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // ✅ Recherche autocomplete Google Places
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }

    setLoading(true);
    try {
      // ✅ CORRECTION: Utiliser le bon format de paramètres pour l'API
      const response = await apiGet('/api/places/autocomplete', {
        params: {
          query: query.trim(),
          type: 'point', // ✅ CORRIGÉ: Utiliser 'point' qui correspond à 'establishment' dans le backend
        },
      });

      console.log('[GoogleBusinessModal] Réponse autocomplete:', response);

      // ✅ CORRECTION: Le backend retourne { success: true, data: [...], results: [...] }
      // apiCall retourne { success: true, data: { success: true, data: [...], results: [...] } }
      if (response.success && response.data) {
        const apiData = response.data as any;
        
        // ✅ CORRECTION: Vérifier d'abord apiData.results (format enrichi avec place_id)
        if (apiData.results && Array.isArray(apiData.results) && apiData.results.length > 0) {
          setAutocompleteResults(apiData.results);
          setShowAutocomplete(true);
        } 
        // ✅ CORRECTION: Sinon vérifier apiData.data (format simple array de strings)
        else if (apiData.data && Array.isArray(apiData.data) && apiData.data.length > 0) {
          // Convertir en format enrichi
          const enrichedResults: PlaceResult[] = apiData.data.map((desc: string) => ({
            description: desc,
            place_id: undefined,
            types: undefined,
          }));
          setAutocompleteResults(enrichedResults);
          setShowAutocomplete(true);
        } 
        // ✅ CORRECTION: Si apiData est directement un array (cas de compatibilité)
        else if (Array.isArray(apiData) && apiData.length > 0) {
          const enrichedResults: PlaceResult[] = apiData.map((desc: string) => ({
            description: desc,
            place_id: undefined,
            types: undefined,
          }));
          setAutocompleteResults(enrichedResults);
          setShowAutocomplete(true);
        } else {
          console.warn('[GoogleBusinessModal] Aucun résultat trouvé dans la réponse:', apiData);
          setAutocompleteResults([]);
          setShowAutocomplete(false);
        }
      } else {
        console.warn('[GoogleBusinessModal] Réponse non réussie ou vide:', response);
        setAutocompleteResults([]);
        setShowAutocomplete(false);
      }
    } catch (error) {
      console.error('[GoogleBusinessModal] Erreur autocomplete:', error);
      setAutocompleteResults([]);
      setShowAutocomplete(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Récupérer les détails complets du business
  const handleSelectBusiness = useCallback(async (placeId: string, description: string) => {
    setLoadingDetails(true);
    try {
      const response = await apiGet('/api/places/google-business-details', {
        params: { place_id: placeId },
      });

      if (response.success && response.data?.data) {
        const businessData = response.data.data;
        onSelectBusiness(businessData);
        onClose();
      } else {
        Alert.alert(
          'Erreur',
          'Impossible de récupérer les détails de ce business. Veuillez réessayer.'
        );
      }
    } catch (error) {
      console.error('[GoogleBusinessModal] Erreur récupération détails:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la récupération des informations du business.'
      );
    } finally {
      setLoadingDetails(false);
    }
  }, [onSelectBusiness, onClose]);

  const handleSkip = () => {
    onClose();
  };

  const handleNo = () => {
    onClose();
  };

  // Réinitialiser l'état quand la modal se ferme
  React.useEffect(() => {
    if (!visible) {
      setHasGoogleBusiness(null);
      setSearchQuery('');
      setAutocompleteResults([]);
      setShowAutocomplete(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {hasGoogleBusiness === null ? (
            // ✅ Étape 1: Demander si l'utilisateur a un Google Business
            <View style={styles.content}>
              <Text style={styles.title}>
                🏢 Avez-vous votre boutique/prestation sur Google Business ?
              </Text>
              <Text style={styles.subtitle}>
                Si oui, nous pouvons récupérer automatiquement vos informations pour pré-remplir le formulaire.
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={() => setHasGoogleBusiness(true)}
                  activeOpacity={0.8}
                >
                  <SafeIcon name="Check" size={20} color="white" />
                  <Text style={styles.buttonText}>Oui, j'ai un Google Business</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={handleNo}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonTextSecondary}>Non, continuer sans</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : hasGoogleBusiness ? (
            // ✅ Étape 2: Recherche autocomplete du business
            <View style={styles.content}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setHasGoogleBusiness(null)} style={styles.backButton}>
                  <SafeIcon name="ArrowLeft" size={20} color={modernColors.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>Rechercher votre business</Text>
              </View>

              <Text style={styles.subtitle}>
                Tapez le nom de votre boutique ou prestation pour la trouver sur Google
              </Text>

              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Ex: Restaurant Le Gourmet, Douala"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    handleSearch(text);
                  }}
                  autoFocus
                />
                {loading && (
                  <ActivityIndicator
                    size="small"
                    color={modernColors.primary}
                    style={styles.loadingIndicator}
                  />
                )}
              </View>

              {/* ✅ Liste des résultats autocomplete */}
              {showAutocomplete && autocompleteResults.length > 0 && (
                <View style={styles.autocompleteContainer}>
                  <FlatList
                    data={autocompleteResults}
                    keyExtractor={(item, index) => item.place_id || `result-${index}`}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.autocompleteItem}
                        onPress={() => {
                          if (item.place_id) {
                            handleSelectBusiness(item.place_id, item.description);
                          }
                        }}
                        disabled={loadingDetails}
                      >
                        <SafeIcon name="MapPin" size={16} color={modernColors.primary} />
                        <Text style={styles.autocompleteText} numberOfLines={2}>
                          {item.description}
                        </Text>
                        {loadingDetails && (
                          <ActivityIndicator size="small" color={modernColors.primary} />
                        )}
                      </TouchableOpacity>
                    )}
                    style={styles.autocompleteList}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
              )}

              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>Passer cette étape</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
  },
  content: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: modernColors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  buttonPrimary: {
    backgroundColor: modernColors.primary,
  },
  buttonSecondary: {
    backgroundColor: modernColors.secondary || '#F0F0F0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
    textAlign: 'center',
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.text,
    textAlign: 'center',
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: modernColors.text,
    backgroundColor: modernColors.surface,
  },
  loadingIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  autocompleteContainer: {
    maxHeight: 300,
    borderWidth: 1,
    borderColor: modernColors.border,
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  autocompleteList: {
    maxHeight: 300,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: modernColors.border,
    gap: 12,
  },
  autocompleteText: {
    flex: 1,
    fontSize: 14,
    color: modernColors.text,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textDecorationLine: 'underline',
  },
});

export default GoogleBusinessModal;

