import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { theme } from '../theme/theme';

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  region?: string;
}

interface GPSSelectorMobileProps {
  onLocationSelect: (location: LocationData) => void;
  currentLocation?: LocationData | null;
  visible: boolean;
  onClose: () => void;
}

const GPSSelectorMobile: React.FC<GPSSelectorMobileProps> = ({
  onLocationSelect,
  currentLocation,
  visible,
  onClose
}) => {
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionGranted(status === 'granted');
    } catch (error) {
      console.error('Erreur permission GPS:', error);
    }
  };

  const getCurrentLocation = async () => {
    if (!permissionGranted) {
      Alert.alert(
        'Permission requise',
        'Veuillez autoriser l\'accès à la localisation pour utiliser cette fonctionnalité.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Paramètres', onPress: () => Location.requestForegroundPermissionsAsync() }
        ]
      );
      return;
    }

    try {
      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const { latitude, longitude } = location.coords;

      // Géocodage inverse pour obtenir l'adresse
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      const addressData = reverseGeocode[0];
      const address = addressData ?
        `${addressData.street || ''} ${addressData.streetNumber || ''}, ${addressData.city || ''}, ${addressData.region || ''}`.trim() :
        `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      const locationData: LocationData = {
        latitude,
        longitude,
        address,
        city: addressData?.city,
        region: addressData?.region
      };

      onLocationSelect(locationData);
      onClose();
    } catch (error) {
      console.error('Erreur localisation:', error);
      Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
    } finally {
      setLoading(false);
    }
  };

  const searchLocation = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);

      // Utiliser l'API de géocodage d'Expo pour obtenir des résultats détaillés
      const results = await Location.geocodeAsync(query);

      const formattedSuggestions = results.map((result, index) => {
        // Essayer d'obtenir plus d'informations via géocodage inverse
        return {
          id: index,
          latitude: result.latitude,
          longitude: result.longitude,
          address: `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`,
          city: 'Recherche en cours...'
        };
      });

      setSuggestions(formattedSuggestions);

      // Enrichir les suggestions avec des informations détaillées
      const enrichedSuggestions = await Promise.all(
        formattedSuggestions.map(async (suggestion, index) => {
          try {
            const reverseGeocode = await Location.reverseGeocodeAsync({
              latitude: suggestion.latitude,
              longitude: suggestion.longitude
            });

            const addressData = reverseGeocode[0];
            if (addressData) {
              const address = [
                addressData.street,
                addressData.streetNumber,
                addressData.city,
                addressData.region,
                addressData.country
              ].filter(Boolean).join(', ');

              return {
                ...suggestion,
                address: address || suggestion.address,
                city: addressData.city || 'Ville inconnue',
                region: addressData.region || '',
                country: addressData.country || ''
              };
            }
          } catch (error) {
            console.log('Erreur géocodage inverse:', error);
          }
          return suggestion;
        })
      );

      setSuggestions(enrichedSuggestions);
    } catch (error) {
      console.error('Erreur recherche:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const selectLocation = (suggestion: any) => {
    const locationData: LocationData = {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      address: suggestion.address,
      city: suggestion.city
    };

    onLocationSelect(locationData);
    onClose();
  };

  // Suggestions de recherche populaires (dynamiques)
  const getPopularSuggestions = () => {
    return [
      'Douala, Cameroun',
      'Yaoundé, Cameroun',
      'Garoua, Cameroun',
      'Bamenda, Cameroun',
      'Bafoussam, Cameroun',
      'Kribi, Cameroun',
      'Limbe, Cameroun',
      'Nkongsamba, Cameroun'
    ];
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sélectionner une zone</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Recherche */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une ville ou une adresse..."
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);
              searchLocation(text);
            }}
            left={<TextInput.Icon icon="magnify" />}
            right={loading ? <TextInput.Icon icon="loading" /> : null}
          />
        </View>

        {/* Position actuelle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Position actuelle</Text>
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={getCurrentLocation}
            disabled={loading}
          >
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.currentLocationText}>
              {loading ? 'Localisation en cours...' : 'Utiliser ma position actuelle'}
            </Text>
          </TouchableOpacity>

          {currentLocation && (
            <View style={styles.currentLocationInfo}>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.currentLocationAddress}>
                {currentLocation.address || `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`}
              </Text>
            </View>
          )}
        </View>

        {/* Suggestions populaires */}
        {searchText.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recherches populaires</Text>
            <View style={styles.popularSuggestionsContainer}>
              {getPopularSuggestions().map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.popularSuggestionButton}
                  onPress={() => {
                    setSearchText(suggestion);
                    searchLocation(suggestion);
                  }}
                >
                  <Text style={styles.popularSuggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Suggestions de recherche */}
        {(suggestions.length > 0 || loading) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {loading ? 'Recherche en cours...' : 'Résultats de recherche'}
            </Text>
            {loading && suggestions.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>🔍 Recherche de lieux...</Text>
              </View>
            ) : (
              <ScrollView style={styles.suggestionsContainer}>
                {suggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion.id}
                    style={styles.suggestionItem}
                    onPress={() => selectLocation(suggestion)}
                  >
                    <Text style={styles.suggestionIcon}>📍</Text>
                    <View style={styles.suggestionInfo}>
                      <Text style={styles.suggestionAddress}>{suggestion.address}</Text>
                      {suggestion.city && suggestion.city !== 'Recherche en cours...' && (
                        <Text style={styles.suggestionCity}>
                          {suggestion.city}
                          {suggestion.region && `, ${suggestion.region}`}
                          {suggestion.country && `, ${suggestion.country}`}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    padding: 8,
  },
  closeIcon: {
    fontSize: 20,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: 'white',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  locationIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  currentLocationText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  currentLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
  },
  checkIcon: {
    fontSize: 16,
    color: '#4CAF50',
    marginRight: 8,
  },
  currentLocationAddress: {
    fontSize: 14,
    color: '#4CAF50',
    flex: 1,
  },
  popularSuggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  popularSuggestionButton: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  popularSuggestionText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  suggestionsContainer: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suggestionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionAddress: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  suggestionCity: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default GPSSelectorMobile;