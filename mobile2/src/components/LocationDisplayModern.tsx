import { MapPin } from 'phosphor-react-native';
import React, { useEffect, useState } from 'react';
import ReactNative from 'react-native';
import { theme } from '../theme/theme';

const { Alert, StyleSheet, Text, TouchableOpacity, View } = ReactNative;

interface Service {
  id: string;
  data?: any;
  user_id: string;
  distance?: number;
}

interface ServiceCreatorInfo {
  id: string;
  name: string;
  location?: string;
  coordinates?: string;
}

interface LocationDisplayModernProps {
  service: Service;
  serviceCreatorInfo?: ServiceCreatorInfo;
  compact?: boolean;
  customStyle?: any;
}

/**
 * Composant pour afficher la localisation d'un service de manière moderne
 * Simule le comportement du frontend LocationDisplayModern
 */
export const LocationDisplayModern: React.FC<LocationDisplayModernProps> = ({
  service,
  serviceCreatorInfo,
  compact = false,
  customStyle
}) => {
  const [locationText, setLocationText] = useState<string>('');
  const [locationType, setLocationType] = useState<'gps' | 'address' | 'distance' | 'unknown'>('unknown');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const determineLocation = () => {
      setIsLoading(true);

      // Priorité 1: Coordonnées GPS fixes du service
      const gpsFixe = service.data?.gps_fixe;
      if (gpsFixe && gpsFixe !== 'Non spécifié') {
        setLocationText(gpsFixe);
        setLocationType('gps');
        setIsLoading(false);
        return;
      }

      // Priorité 2: Adresse du service
      const adresse = service.data?.adresse;
      if (adresse && adresse !== 'Non spécifié') {
        setLocationText(adresse);
        setLocationType('address');
        setIsLoading(false);
        return;
      }

      // Priorité 3: Distance calculée
      if (service.distance !== undefined) {
        const distanceText = service.distance < 1
          ? `${Math.round(service.distance * 1000)}m`
          : `${service.distance.toFixed(1)}km`;
        setLocationText(`À ${distanceText} de votre position`);
        setLocationType('distance');
        setIsLoading(false);
        return;
      }

      // Priorité 4: Localisation du créateur
      if (serviceCreatorInfo?.location) {
        setLocationText(serviceCreatorInfo.location);
        setLocationType('address');
        setIsLoading(false);
        return;
      }

      // Fallback: Localisation non disponible
      setLocationText('Localisation non disponible');
      setLocationType('unknown');
      setIsLoading(false);
    };

    determineLocation();
  }, [service, serviceCreatorInfo]);

  const handleLocationPress = () => {
    if (locationType === 'gps') {
      // Ouvrir la carte avec les coordonnées GPS
      Alert.alert(
        'Localisation GPS',
        `Coordonnées: ${locationText}\n\nVoulez-vous ouvrir dans l'application de cartes ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ouvrir', onPress: () => {
              // Ici on pourrait ouvrir l'app de cartes native
              console.log('Ouverture de la carte avec:', locationText);
            }
          }
        ]
      );
    } else if (locationType === 'distance') {
      Alert.alert(
        'Distance',
        `Le service est situé à ${locationText} de votre position actuelle.`
      );
    }
  };

  const getLocationIcon = () => {
    switch (locationType) {
      case 'gps':
        return <MapPin size={16} color={theme.colors.primary} weight="fill" />;
      case 'address':
        return <MapPin size={16} color={theme.colors.primary} weight="fill" />;
      case 'distance':
        return <MapPin size={16} color={theme.colors.primary} weight="fill" />;
      default:
        return <MapPin size={16} color="#9E9E9E" weight="regular" />;
    }
  };

  const getLocationColor = () => {
    switch (locationType) {
      case 'gps':
        return theme.colors.primary;
      case 'address':
        return '#4CAF50';
      case 'distance':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer, customStyle]}>
        <View style={styles.loadingContainer}>
          <MapPin size={16} color="#E0E0E0" />
          <Text style={styles.loadingText}>Localisation en cours...</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.compactContainer,
        { borderLeftColor: getLocationColor() },
        customStyle
      ]}
      onPress={handleLocationPress}
      disabled={locationType === 'unknown'}
    >
      <View style={styles.header}>
        {getLocationIcon()}
        <Text style={[styles.title, { color: getLocationColor() }]}>
          {compact ? 'Localisation' : '📍 Localisation du service'}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={[
          styles.locationText,
          locationType === 'unknown' && styles.locationTextUnavailable
        ]}>
          {locationText}
        </Text>

        {locationType === 'gps' && (
          <Text style={styles.locationHint}>
            Tap pour ouvrir dans l'app de cartes
          </Text>
        )}

        {locationType === 'distance' && (
          <Text style={styles.locationHint}>
            Distance calculée depuis votre position
          </Text>
        )}

        {serviceCreatorInfo && (
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorLabel}>Créateur:</Text>
            <Text style={styles.creatorName}>{serviceCreatorInfo.name}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    marginVertical: 4,
  },
  compactContainer: {
    padding: 8,
    marginVertical: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#9E9E9E',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    marginLeft: 22,
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 16,
    marginBottom: 4,
  },
  locationTextUnavailable: {
    color: '#9E9E9E',
    fontStyle: 'italic',
  },
  locationHint: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  creatorLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginRight: 4,
  },
  creatorName: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '500',
  },
});

export default LocationDisplayModern;

