import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServiceCard from '../components/ServiceCard';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';

interface Service {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  views: number;
  interactions: number;
  user_id: string;
  data?: any;
  score?: number;
  [key: string]: any;
}

const MesServicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      // Charger les services réels depuis l'API
      const response = await fetch('/api/services/user', {
        headers: {
          'Authorization': `Bearer ${await AsyncStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      } else {
        // Si pas de services, afficher une liste vide
        setServices([]);
      }
    } catch (error) {
      console.error('Erreur chargement services:', error);
      Alert.alert('Erreur', 'Impossible de charger vos services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'inactive': return '#9E9E9E';
      case 'pending': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'inactive': return 'Inactif';
      case 'pending': return 'En attente';
      default: return 'Inconnu';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Chargement de vos services...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Title style={styles.title}>Mes Services</Title>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateService' as never)}
          >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addButtonText}>Nouveau</Text>
          </TouchableOpacity>
        </View>

        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color="#9E9E9E" />
            <Text style={styles.emptyTitle}>Aucun service</Text>
            <Text style={styles.emptyText}>
              Vous n'avez pas encore créé de service. Créez votre premier service pour commencer.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateService' as never)}
              style={styles.createButton}
            >
              <Text>Créer un service</Text>
            </TouchableOpacity>
          </View>
        ) : (
          services.map((service) => (
            <View key={service.id} style={styles.serviceContainer}>
              <ServiceCard
                service={{
                  id: service.id,
                  titre: service.title,
                  description: service.description,
                  user_id: service.user_id || user?.id?.toString() || 'unknown',
                  data: service.data,
                  score: service.score,
                  created_at: service.createdAt,
                  ...service
                }}
                prestataire={{
                  id: user?.id?.toString() || 'unknown',
                  name: user?.nom_complet || user?.name || 'Vous',
                  email: user?.email || '',
                  isOnline: true,
                }}
                isOnline={true}
                onContact={(service) => {
                  // Pour un prestataire, cela pourrait ouvrir les statistiques de contact
                  Alert.alert('Statistiques', `Voir les statistiques de contact pour: ${service.titre}`);
                }}
                onChat={(service) => {
                  // Pour un prestataire, cela pourrait ouvrir l'historique des conversations
                  Alert.alert('Conversations', `Voir l'historique des conversations pour: ${service.titre}`);
                }}
                onGallery={(service) => {
                  // Ouvrir la galerie du service
                  Alert.alert('Galerie', `Voir la galerie du service: ${service.titre}`);
                }}
                onFavorite={(service) => {
                  // Pour un prestataire, cela pourrait être "Marquer comme favori" ou "Promouvoir"
                  Alert.alert('Promotion', `Promouvoir le service: ${service.titre}`);
                }}
                onShare={(service) => {
                  // Partager le service
                  Alert.alert('Partage', `Partager le service: ${service.titre}`);
                }}
                showActions={false} // Désactiver les actions par défaut
              />

              {/* Actions spécifiques pour les prestataires */}
              <View style={styles.prestataireActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => {
                    Alert.alert('Modifier', `Modifier le service: ${service.title}`);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Modifier</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.viewButton]}
                  onPress={() => {
                    Alert.alert('Voir', `Voir le service: ${service.title}`);
                  }}
                >
                  <Ionicons name="eye-outline" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Voir</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.shareButton]}
                  onPress={() => {
                    Alert.alert('Partager', `Partager le service: ${service.title}`);
                  }}
                >
                  <Ionicons name="share-outline" size={16} color="white" />
                  <Text style={styles.actionButtonText}>Partager</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, service.status === 'active' ? styles.deactivateButton : styles.activateButton]}
                  onPress={() => {
                    const newStatus = service.status === 'active' ? 'inactive' : 'active';
                    Alert.alert(
                      newStatus === 'active' ? 'Activer' : 'Désactiver',
                      `Voulez-vous ${newStatus === 'active' ? 'activer' : 'désactiver'} ce service ?`,
                      [
                        { text: 'Annuler', style: 'cancel' },
                        {
                          text: newStatus === 'active' ? 'Activer' : 'Désactiver',
                          onPress: () => {
                            // Ici vous feriez l'appel API pour changer le statut
                            Alert.alert('Succès', `Service ${newStatus === 'active' ? 'activé' : 'désactivé'}`);
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons
                    name={service.status === 'active' ? 'pause-outline' : 'play-outline'}
                    size={16}
                    color="white"
                  />
                  <Text style={styles.actionButtonText}>
                    {service.status === 'active' ? 'Désactiver' : 'Activer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
  },
  serviceContainer: {
    marginBottom: 16,
  },
  prestataireActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginHorizontal: 2,
    borderRadius: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  editButton: {
    backgroundColor: '#17a2b8',
  },
  viewButton: {
    backgroundColor: '#6c757d',
  },
  shareButton: {
    backgroundColor: '#007bff',
  },
  activateButton: {
    backgroundColor: '#28a745',
  },
  deactivateButton: {
    backgroundColor: '#dc3545',
  },
  serviceCard: {
    marginBottom: 16,
    elevation: 2,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  serviceDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  serviceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  serviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});

export default MesServicesScreen;



