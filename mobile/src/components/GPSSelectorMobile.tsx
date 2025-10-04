import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, Dimensions, Platform } from 'react-native';
import { TextInput } from 'react-native-paper';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { theme } from '../theme/theme';

const { width, height } = Dimensions.get('window');

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
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: currentLocation?.latitude || 4.0483, // Douala par défaut
    longitude: currentLocation?.longitude || 9.7043,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionGranted(true);
      } else {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        setPermissionGranted(newStatus === 'granted');
      }
    } catch (error) {
      console.error('Erreur vérification permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    if (!permissionGranted) {
      Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à votre position');
      return;
    }

    try {
      setLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
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
        'Position actuelle';

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
      console.error('Erreur géolocalisation:', error);
      Alert.alert('Erreur', 'Impossible d\'obtenir votre position');
    } finally {
      setLoading(false);
    }
  };

  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const results = await Location.geocodeAsync(query, { useGoogleMaps: true });
      
      const formattedResults = await Promise.all(
        results.slice(0, 5).map(async (result) => {
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: result.latitude,
            longitude: result.longitude
          });

          const addressData = reverseGeocode[0];
          const fullAddress = addressData ?
            `${addressData.street || ''} ${addressData.streetNumber || ''}, ${addressData.city || ''}, ${addressData.region || ''}`.trim() :
            `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`;

          return {
            latitude: result.latitude,
            longitude: result.longitude,
            address: fullAddress,
            city: addressData?.city,
            region: addressData?.region
          };
        })
      );

      setSuggestions(formattedResults);
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

  // Gestion de la sélection sur la carte
  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    
    try {
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
      console.error('Erreur géocodage inverse:', error);
      // Utiliser les coordonnées même sans adresse
      const locationData: LocationData = {
        latitude,
        longitude,
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
      };
      onLocationSelect(locationData);
      onClose();
    }
  };

  // Mettre à jour la région de la carte quand la position actuelle change
  useEffect(() => {
    if (currentLocation) {
      setMapRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  }, [currentLocation]);

  // Suggestions de recherche populaires (dynamiques)
  const getPopularSuggestions = () => {
    return [
      'Douala, Cameroun',
      'Yaoundé, Cameroun',
      'Bafoussam, Cameroun',
      'Bamenda, Cameroun',
      'Garoua, Cameroun',
      'Maroua, Cameroun',
      'Ngaoundéré, Cameroun',
      'Bertoua, Cameroun',
      'Ebolowa, Cameroun',
      'Kribi, Cameroun'
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
          <TouchableOpacity 
            onPress={() => setShowMap(!showMap)} 
            style={styles.mapToggleButton}
          >
            <Text style={styles.mapToggleText}>{showMap ? '📋' : '🗺️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Carte interactive */}
        {showMap ? (
          <View style={styles.mapContainer}>
            <Text style={styles.mapInstructions}>
              🎯 Appuyez sur la carte pour sélectionner un lieu précis
            </Text>
            <MapView
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={styles.map}
              region={mapRegion}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
              showsScale={true}
              mapType="standard"
            >
              {selectedLocation && (
                <Marker
                  coordinate={selectedLocation}
                  title="Lieu sélectionné"
                  description="Appuyez pour confirmer"
                />
              )}
              {currentLocation && (
                <Marker
                  coordinate={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude
                  }}
                  title="Ma position"
                  description="Position actuelle"
                  pinColor="blue"
                />
              )}
            </MapView>
          </View>
        ) : (
          <>
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
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>Utiliser ma position actuelle</Text>
              <Text style={styles.locationSubtitle}>
                {currentLocation?.address || 'Appuyez pour détecter votre position'}
              </Text>
            </View>
            {loading && <Text style={styles.loadingText}>Chargement...</Text>}
          </TouchableOpacity>
        </View>

        {/* Suggestions de recherche */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {searchText ? 'Résultats de recherche' : 'Suggestions populaires'}
          </Text>
          {searchText && suggestions.length === 0 && !loading && (
            <Text style={styles.noResults}>Aucun résultat trouvé</Text>
          )}
          <ScrollView style={styles.suggestionsList} showsVerticalScrollIndicator={false}>
            {(searchText ? suggestions : getPopularSuggestions().map((name) => ({
              address: name,
              city: name.split(',')[0]
            }))).map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => {
                  if (searchText) {
                    selectLocation(suggestion);
                  } else {
                    setSearchText(suggestion.address);
                    searchLocation(suggestion.address);
                  }
                }}
              >
                <Text style={styles.suggestionIcon}>📍</Text>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionTitle}>
                    {suggestion.city || suggestion.address}
                  </Text>
                  {suggestion.address && suggestion.city && (
                    <Text style={styles.suggestionSubtitle}>{suggestion.address}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        </>
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
    fontSize: 24,
    color: theme.colors.text,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  placeholder: {
    width: 40,
  },
  mapToggleButton: {
    padding: 8,
  },
  mapToggleText: {
    fontSize: 20,
    color: theme.colors.text,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  mapInstructions: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    zIndex: 1,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: 'white',
  },
  section: {
    padding: 16,
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
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  locationSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  loadingText: {
    fontSize: 12,
    color: theme.colors.primary,
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  suggestionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  suggestionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  noResults: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GPSSelectorMobile;