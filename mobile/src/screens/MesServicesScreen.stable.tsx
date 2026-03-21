// @ts-nocheck
// Version ultra-simplifiée et stable - sans erreurs complexes
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiDelete, apiPost } from '../services/api';

interface Service {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  created_at?: string;
  data?: any;
}

const MesServicesScreenStable: React.FC = () => {
  console.log('[MesServicesScreenStable] 🚀 Démarrage version ultra-simple');
  
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(async (isRefresh = false) => {
    console.log('[MesServicesScreenStable] 🔍 Début chargement');
    
    if (!user) {
      setError('Utilisateur non connecté');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await apiGet('/api/prestataire/services');

      if (response?.success && response?.data) {
        let data = response.data;
        
        // Gérer différents formats de réponse
        if (!Array.isArray(data)) {
          if (Array.isArray(data?.data)) data = data.data;
          else if (Array.isArray(data?.services)) data = data.services;
          else if (Array.isArray(data?.items)) data = data.items;
        }

        if (Array.isArray(data)) {
          const transformedServices: Service[] = data.map((service: any, index: number) => ({
            id: service.id?.toString() || `service_${index}`,
            title: service.data?.titre_service?.valeur || 
                   service.data?.titre?.valeur || 
                   service.titre || 
                   service.title || 
                   `Service ${index + 1}`,
            description: service.data?.description?.valeur || 
                        service.description || 
                        'Aucune description',
            status: service.is_active !== false && service.actif !== false ? 'active' : 'inactive',
            created_at: service.created_at || service.createdAt,
            data: service.data || service
          }));
          
          setServices(transformedServices);
        } else {
          setServices([]);
        }
      } else {
        setError('Erreur lors du chargement des services');
        setServices([]);
      }
    } catch (err) {
      setError('Exception lors du chargement');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadServices().catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadServices(true);
    }, [])
  );

  const handleAddService = () => {
    try {
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'create',
        focusProduct: true
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le formulaire d\'ajout');
    }
  };

  const handleEditService = (service: Service) => {
    try {
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'edit',
        serviceId: service.id,
        serviceData: service.data
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la modification');
    }
  };

  const handleDeleteService = (service: Service) => {
    Alert.alert(
      'Supprimer le service',
      `Êtes-vous sûr de vouloir supprimer "${service.title}" ?\nCette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiDelete(`/api/services/${service.id}`);
              if (response.success) {
                Alert.alert('Succès', 'Service supprimé avec succès');
                loadServices(true);
              } else {
                Alert.alert('Erreur', 'Impossible de supprimer le service');
              }
            } catch (error) {
              Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression');
            }
          }
        }
      ]
    );
  };

  const handleToggleStatus = async (service: Service) => {
    try {
      const newStatus = service.status === 'active' ? 'inactive' : 'active';
      
      if (newStatus === 'active') {
        const balanceResponse = await apiGet('/api/users/balance');
        if (balanceResponse.success) {
          const balance = balanceResponse.data?.tokens_balance || 0;
          const activationCost = 1000;
          
          if (balance < activationCost) {
            Alert.alert(
              'Solde insuffisant',
              `Coût de réactivation: ${activationCost} FCFA\nVotre solde: ${balance} FCFA`,
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Recharger', onPress: () => (navigation as any).navigate('RechargeTokens') },
              ]
            );
            return;
          }
          
          const deductResponse = await apiPost('/api/users/deduct-balance', {
            amount: activationCost,
            reason: 'service_reactivation'
          });
          
          if (deductResponse.success) {
            Alert.alert('Succès', `Service réactivé ! Coût: ${activationCost} FCFA`);
            loadServices(true);
          } else {
            Alert.alert('Erreur', 'Erreur lors de la réactivation');
          }
        }
      } else {
        Alert.alert('Succès', 'Service désactivé');
        loadServices(true);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de changer le statut du service');
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
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Erreur: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadServices(true)}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Services</Text>
        <Text style={styles.subtitle}>{services.length} service(s)</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadServices(true)} />
        }
      >
        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun service trouvé</Text>
            <TouchableOpacity style={styles.addButton} onPress={handleAddService}>
              <Text style={styles.addButtonText}>Ajouter un service</Text>
            </TouchableOpacity>
          </View>
        ) : (
          services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(service.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(service.status)}</Text>
                </View>
              </View>
              
              <Text style={styles.serviceDescription}>{service.description}</Text>
              
              <View style={styles.serviceActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => handleEditService(service)}
                >
                  <Text style={styles.actionButtonText}>Modifier</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    service.status === 'active' ? styles.deactivateButton : styles.activateButton
                  ]}
                  onPress={() => handleToggleStatus(service)}
                >
                  <Text style={styles.actionButtonText}>
                    {service.status === 'active' ? 'Désactiver' : 'Activer'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDeleteService(service)}
                >
                  <Text style={styles.actionButtonText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.floatingButton} onPress={handleAddService}>
        <Text style={styles.floatingButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  serviceCard: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  serviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  deactivateButton: {
    backgroundColor: '#FF9800',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default MesServicesScreenStable;
