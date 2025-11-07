// @ts-nocheck
/**
 * Écran pour afficher un service partagé via deep link
 * Gère l'authentification automatique et l'affichage du service
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { NativeButton } from '../components/NativeDesign';
import NavigatorToolbar from '../components/NavigatorToolbar';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const ServiceDetailSharedScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Récupérer l'ID du service depuis les paramètres de route
  const serviceId = (route.params as any)?.serviceId;

  useEffect(() => {
    if (serviceId) {
      loadServiceDetails();
    } else {
      setError('ID de service manquant');
      setLoading(false);
    }
  }, [serviceId]);

  const loadServiceDetails = async () => {
    try {
      setLoading(true);

      // ✅ CORRIGÉ: Charger les détails du service avec apiGet
      const response = await apiGet(`/api/services/${serviceId}`);

      if (!response.ok) {
        throw new Error(`Service non trouvé (${response.status})`);
      }

      const data = await response.json();
      setService(data);
      setError(null);
    } catch (err: any) {
      console.error('[ServiceDetailShared] Erreur chargement:', err);
      setError(err.message || 'Impossible de charger le service');
    } finally {
      setLoading(false);
    }
  };

  const handleContactService = () => {
    if (!user) {
      // Rediriger vers login avec retour vers ce service
      Alert.alert(
        'Connexion requise',
        'Vous devez vous connecter pour contacter ce prestataire',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Se connecter',
            onPress: () => {
              (navigation as any).navigate('Login', {
                returnTo: 'ServiceDetailShared',
                returnParams: { serviceId }
              });
            }
          }
        ]
      );
      return;
    }

    // Ouvrir le chat ou le formulaire de contact
    Alert.alert('Contact', 'Fonctionnalité de contact à implémenter');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={modernColors.primary} />
        <Text style={styles.loadingText}>Chargement du service...</Text>
      </View>
    );
  }

  if (error || !service) {
    return (
      <View style={styles.errorContainer}>
        <SafeIcon name="alert-circle" size={64} color={modernColors.error} />
        <Text style={styles.errorTitle}>Service introuvable</Text>
        <Text style={styles.errorMessage}>{error || 'Ce service n\'existe pas ou a été supprimé'}</Text>
        <NativeButton
          title="Retour à l'accueil"
          onPress={() => (navigation as any).navigate('Home')}
          variant="primary"
          style={styles.homeButton}
        />
      </View>
    );
  }

  const titre = service.data?.titre_service?.valeur || service.titre || 'Service';
  const description = service.data?.description?.valeur || service.description || '';
  const prix = service.data?.prix?.valeur || service.prix;
  const prestataireName = service.prestataire_name || service.user_name || 'Prestataire';

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[modernColors.primary, modernColors.primaryDark]}
        style={styles.header}
      >
        <NavigatorToolbar
          tone="dark"
          showHandle={false}
          title="Service partagé"
          subtitle="Via Yukpo"
          onClose={() => (navigation as any).navigate('Home')}
        />
      </LinearGradient>

      {/* Contenu */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.serviceCard}>
          <Text style={styles.serviceTitle}>{titre}</Text>
          <Text style={styles.serviceDescription}>{description}</Text>

          {prix && (
            <View style={styles.priceContainer}>
              <SafeIcon name="dollar-sign" size={20} color={modernColors.primary} />
              <Text style={styles.priceText}>{prix} FCFA</Text>
            </View>
          )}

          <View style={styles.prestataireContainer}>
            <SafeIcon name="user" size={16} color={modernColors.textSecondary} />
            <Text style={styles.prestataireText}>Par {prestataireName}</Text>
          </View>
        </View>

        {/* Boutons d'action */}
        <View style={styles.actionsContainer}>
          <NativeButton
            title="💬 Contacter le prestataire"
            onPress={handleContactService}
            variant="primary"
            size="large"
          />

          {!user && (
            <View style={styles.authPrompt}>
              <Text style={styles.authPromptText}>
                Connectez-vous pour accéder à toutes les fonctionnalités
              </Text>
              <NativeButton
                title="Se connecter"
                onPress={() => (navigation as any).navigate('Login', {
                  returnTo: 'ServiceDetailShared',
                  returnParams: { serviceId }
                })}
                variant="outline"
                size="medium"
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: modernColors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: modernColors.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: modernColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  homeButton: {
    minWidth: 200,
  },
  header: {
    paddingHorizontal: 0,
    paddingVertical: 16,
    paddingTop: 48,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: modernColors.text,
    marginBottom: 12,
  },
  serviceDescription: {
    fontSize: 14,
    color: modernColors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: modernColors.primaryLight,
    borderRadius: 8,
    gap: 8,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '600',
    color: modernColors.primary,
  },
  prestataireContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  prestataireText: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  actionsContainer: {
    gap: 16,
  },
  authPrompt: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  authPromptText: {
    fontSize: 14,
    color: '#78350F',
    textAlign: 'center',
  },
});

export default ServiceDetailSharedScreen;


