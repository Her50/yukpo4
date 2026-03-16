import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import LocationSelector, { LocationObject } from './LocationSelector';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface GoogleBusinessModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectBusiness: (businessData: any) => void;
}

const GoogleBusinessModal: React.FC<GoogleBusinessModalProps> = ({
  visible,
  onClose,
  onSelectBusiness,
}) => {
      const { t } = useLanguageSafe();
const [hasGoogleBusiness, setHasGoogleBusiness] = useState<boolean | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationObject | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // ✅ Récupérer les détails complets du business depuis LocationObject
  const handleSelectBusiness = useCallback(async (location: LocationObject) => {
    if (!location.place_id) {
      Alert.alert(
        'Erreur',
        t('googleBusinessModal.ceLieuNeContientPasDidentifiantGooglePlaces')
      );
      return;
    }

    setLoadingDetails(true);
    try {
      const response = await apiGet('/api/places/google-business-details', {
        params: { place_id: location.place_id },
      });

      if (response.success && (response.data as any)?.data) {
        const businessData = (response.data as any).data;
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
      setSelectedLocation(null);
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
                  <Text style={styles.buttonText}>{t('googleBusiness.ouiJaiUnGoogleBusiness')}</Text>
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
                <Text style={styles.title}>{t('googleBusiness.rechercherVotreBusiness')}</Text>
              </View>

              <Text style={styles.subtitle}>
                Tapez le nom de votre boutique ou prestation pour la trouver sur Google
              </Text>

              {/* ✅ CORRIGÉ: Utilisation de LocationSelector pour l'autocomplete Google Places */}
              <LocationSelector
                value={selectedLocation || ''}
                onSelect={(location: LocationObject) => {
                  console.log('[GoogleBusinessModal] Lieu sélectionné:', location);
                  setSelectedLocation(location);

                  // Si le lieu a un place_id, récupérer automatiquement les détails
                  if (location.place_id) {
                    handleSelectBusiness(location);
                  }
                }}
                placeholder={t('googleBusiness.exRestaurantLeGourmetDouala')}
                scope="establishment"
                style={styles.locationSelector}
                enrichWithBackend={true}
              />

              {loadingDetails && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={modernColors.primary} />
                  <Text style={styles.loadingText}>{t('googleBusiness.recuperationDesInformations')}</Text>
                </View>
              )}

              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>{t('googleBusiness.passerCetteEtape')}</Text>
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
  locationSelector: {
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
    color: modernColors.textSecondary,
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

