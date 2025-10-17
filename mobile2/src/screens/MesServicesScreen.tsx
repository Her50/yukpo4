// Design moderne inspiré du frontend
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useEffect, useState } from 'react';
// @ts-ignore
import { ActivityIndicator, Alert, Dimensions, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// @ts-ignore
import { NativeButton, NativeCard } from '../components/NativeDesign';
// @ts-ignore
import SafeIcon from '../components/SafeIcon';
// @ts-ignore
import ServiceCardModern from '../components/ServiceCardModern';
// @ts-ignore
import { useAuth } from '../contexts/AuthContext';
import { modernColors, modernStyles } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

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
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem('auth_token');

      // Charger les services réels depuis l'API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com'}/api/prestataire/services`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Trier les services du plus récent au plus ancien
        const servicesTries = data.sort((a: any, b: any) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // Transformer les données pour correspondre à notre interface
        const transformedServices = servicesTries.map((service: any) => ({
          id: service.id.toString(),
          title: service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.titre || 'Service sans titre',
          description: service.data?.description?.valeur || service.description || 'Aucune description',
          status: service.is_active !== undefined ? (service.is_active ? 'active' : 'inactive') :
            service.actif !== undefined ? (service.actif ? 'active' : 'inactive') : 'inactive',
          createdAt: service.created_at,
          views: service.views || 0,
          interactions: service.interactions || 0,
          data: service.data,
          ...service
        }));
        setServices(transformedServices);
      } else {
        console.error('Erreur API:', response.status, response.statusText);
        setServices([]);
      }
    } catch (error) {
      console.error('Erreur chargement services:', error);
      Alert.alert('Erreur', 'Impossible de charger vos services');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadServices(true);
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

  // Fonctions de gestion des services
  const handleEditService = (service: any) => {
    try {
      // Navigation vers l'écran de modification avec les données du service
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'edit',
        serviceId: service.id,
        serviceData: service.data,
        suggestion: {
          data: service.data || {},
          intention: service.intention || 'creation_service',
          confidence: service.confidence || 0.8
        },
        type: 'modification_service',
        // Ajouter un flag pour indiquer qu'on vient de MesServices
        fromMesServices: true
      });
    } catch (error) {
      console.error('Erreur navigation modification:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la modification du service');
    }
  };

  const handleViewService = (service: any) => {
    try {
      // Navigation vers l'écran de visualisation en mode lecture seule
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'readonly',
        serviceId: service.id,
        serviceData: service.data,
        suggestion: {
          data: service.data || {},
          intention: service.intention || 'creation_service',
          confidence: service.confidence || 0.8
        },
        type: 'visualisation_service',
        // Ajouter un flag pour indiquer qu'on vient de MesServices
        fromMesServices: true
      });
    } catch (error) {
      console.error('Erreur navigation visualisation:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la visualisation du service');
    }
  };

  const handleShareService = async (service: any) => {
    try {
      // Implémentation du partage avec plus de détails
      const titre = service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.title || 'Service Yukpo';
      const description = service.data?.description?.valeur || service.description || 'Découvrez ce service sur Yukpo';
      const prix = service.data?.prix?.valeur || service.prix;
      const localisation = service.data?.localisation?.valeur || service.localisation;

      let shareText = `🌟 ${titre}\n\n${description}`;

      if (prix) {
        shareText += `\n💰 Prix: ${prix} FCFA`;
      }

      if (localisation) {
        shareText += `\n📍 Localisation: ${localisation}`;
      }

      shareText += `\n\n📱 Découvrez plus de services sur Yukpo !\n🌐 https://yukpomnang.com`;

      // Utiliser l'API de partage native React Native
      const result = await Share.share({
        message: shareText,
        title: titre,
        url: 'https://yukpomnang.com'
      });

      if (result.action === Share.sharedAction) {
        Alert.alert('Succès', 'Service partagé avec succès !');
      }
    } catch (error) {
      console.error('Erreur lors du partage:', error);
      Alert.alert('Erreur', 'Impossible de partager le service');
    }
  };

  const handleToggleServiceStatus = async (service: any) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const currentStatus = service.status === 'active';
      const newStatus = !currentStatus;

      // Si on réactive un service (passage de inactif à actif), facturer 1000 FCFA
      if (!currentStatus) {
        // Vérifier le solde avant la réactivation
        const balanceResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com'}/api/users/balance`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          const currentBalance = balanceData.tokens_balance;
          const activationCost = 1000; // 1000 FCFA pour réactivation

          if (currentBalance < activationCost) {
            Alert.alert(
              'Solde insuffisant',
              `Solde actuel: ${currentBalance} FCFA\nCoût de réactivation: ${activationCost} FCFA\n\nVeuillez recharger votre compte.`
            );
            return;
          }

          // Déduire le coût de réactivation
          const deductResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com'}/api/users/deduct-balance`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: activationCost,
              reason: 'service_reactivation'
            })
          });

          if (deductResponse.ok) {
            const newBalance = currentBalance - activationCost;

            // Déclencher un rafraîchissement du solde dans l'interface
            // Cela mettra à jour le solde affiché dans HomeScreen
            loadServices(true);

            Alert.alert(
              'Service réactivé !',
              `Coût: ${activationCost} FCFA\nNouveau solde: ${newBalance} FCFA`,
              [{ text: 'OK' }]
            );
          }
        }
      }

      // Procéder au changement de statut
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com'}/api/services/${service.id}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          actif: newStatus
        })
      });

      if (response.ok) {
        // Mettre à jour l'état local
        setServices(prevServices =>
          prevServices.map(s =>
            s.id === service.id
              ? { ...s, status: newStatus ? 'active' : 'inactive' }
              : s
          )
        );

        // Rafraîchir la liste des services
        loadServices(true);

        if (currentStatus) {
          Alert.alert('Succès', 'Service désactivé avec succès');
        } else {
          // Message déjà affiché plus haut pour la réactivation
        }
      } else {
        throw new Error('Erreur lors du changement de statut');
      }
    } catch (error) {
      console.error('Erreur toggle status:', error);
      Alert.alert('Erreur', 'Impossible de changer le statut du service');
    }
  };

  const handleDeleteService = async (service: any) => {
    // Confirmation avant suppression comme dans le frontend
    Alert.alert(
      'Supprimer le service',
      `Êtes-vous sûr de vouloir supprimer définitivement le service "${service.title}" ?\n\nCette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');

              const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com'}/api/services/${service.id}/delete`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (response.ok) {
                // Supprimer de l'état local
                setServices(prevServices => prevServices.filter(s => s.id !== service.id));

                // Déclencher un rafraîchissement pour mettre à jour l'interface
                loadServices(true);

                Alert.alert('Succès', 'Service supprimé avec succès');
              } else {
                throw new Error('Erreur lors de la suppression');
              }
            } catch (error) {
              console.error('Erreur suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le service');
            }
          }
        }
      ]
    );
  };

  const handlePromotionService = (service: any) => {
    const titre = service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.title || 'Service';

    // Afficher un modal de gestion des promotions comme dans le frontend
    Alert.alert(
      '🎉 Promotion du service',
      `Service: ${titre}\n\nQue souhaitez-vous faire ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Créer une promotion',
          onPress: () => {
            try {
              // Navigation vers l'écran de modification pour créer une promotion
              (navigation as any).navigate('FormulaireYukpoIntelligent', {
                mode: 'edit',
                serviceId: service.id,
                serviceData: service.data,
                suggestion: {
                  data: service.data || {},
                  intention: service.intention || 'creation_service',
                  confidence: service.confidence || 0.8
                },
                type: 'modification_service',
                focusPromotion: true, // Focus sur la section promotion
                fromMesServices: true
              });
            } catch (error) {
              console.error('Erreur navigation promotion:', error);
              Alert.alert('Erreur', 'Impossible d\'ouvrir la gestion des promotions');
            }
          }
        },
        {
          text: 'Modifier la promotion',
          onPress: () => {
            try {
              // Navigation vers l'écran de modification pour modifier la promotion
              (navigation as any).navigate('FormulaireYukpoIntelligent', {
                mode: 'edit',
                serviceId: service.id,
                serviceData: service.data,
                suggestion: {
                  data: service.data || {},
                  intention: service.intention || 'creation_service',
                  confidence: service.confidence || 0.8
                },
                type: 'modification_service',
                focusPromotion: true,
                fromMesServices: true
              });
            } catch (error) {
              console.error('Erreur navigation promotion:', error);
              Alert.alert('Erreur', 'Impossible d\'ouvrir la gestion des promotions');
            }
          }
        }
      ]
    );
  };

  // Filtrer les services selon le filtre sélectionné
  const filteredServices = services.filter((service) => {
    if (filter === 'tous') return true;
    if (filter === 'actif') return service.status === 'active';
    if (filter === 'inactif') return service.status === 'inactive';
    return true;
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={modernColors.primaryGradient}
          style={styles.loadingContainer}
        >
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Chargement de vos services...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header moderne avec gradient */}
      <LinearGradient
        colors={modernColors.primaryGradient}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.logoContainer}>
              <SafeIcon name="briefcase" size={24} color="#fff" />
              <Text style={styles.title}>Mes services Yukpo</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => navigation.navigate('Home' as never)}
              >
                <SafeIcon name="home" size={20} color="#fff" />
                <Text style={styles.headerButtonText}>Accueil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={onRefresh}
                disabled={refreshing}
              >
                <SafeIcon name="refresh" size={20} color="#fff" />
                <Text style={styles.headerButtonText}>Actualiser</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Bandeau d'information */}
        <NativeCard style={styles.infoBanner}>
          <Text style={styles.infoText}>
            Vous avez <Text style={styles.infoBold}>{services.length}</Text> service(s) créé(s)
            {refreshing && (
              <Text style={styles.refreshingText}> 🔄 Actualisation en cours...</Text>
            )}
          </Text>
        </NativeCard>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <NativeButton
            title={`📋 Tous (${services.length})`}
            onPress={() => setFilter('tous')}
            variant={filter === 'tous' ? 'primary' : 'outline'}
            size="small"
            style={styles.filterButton}
          />
          <NativeButton
            title={`✅ Actifs (${services.filter(s => s.status === 'active').length})`}
            onPress={() => setFilter('actif')}
            variant={filter === 'actif' ? 'primary' : 'outline'}
            size="small"
            style={styles.filterButton}
          />
          <NativeButton
            title={`🚫 Inactifs (${services.filter(s => s.status === 'inactive').length})`}
            onPress={() => setFilter('inactif')}
            variant={filter === 'inactif' ? 'primary' : 'outline'}
            size="small"
            style={styles.filterButton}
          />
        </View>

        {/* Liste des services */}
        {filteredServices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <SafeIcon name="briefcase" size={64} color={modernColors.textSecondary} />
            <Text style={styles.emptyTitle}>
              {filter === 'tous' ? 'Aucun service créé' : `Aucun service ${filter}`}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'tous'
                ? 'Créez votre premier service pour commencer à proposer vos services.'
                : `Aucun service ${filter} pour le moment.`
              }
            </Text>
            <NativeButton
              title="➕ Créer un nouveau service"
              onPress={() => navigation.navigate('CreateService' as never)}
              variant="primary"
              size="medium"
              style={styles.createButton}
            />
          </View>
        ) : (
          <View style={styles.servicesContainer}>
            {filteredServices.map((service) => (
              <ServiceCardModern
                key={service.id}
                service={service}
                onEdit={handleEditService}
                onView={handleViewService}
                onShare={handleShareService}
                onToggleStatus={handleToggleServiceStatus}
                onDelete={handleDeleteService}
                onPromotion={handlePromotionService}
              />
            ))}
          </View>
        )}

        {/* Bouton de retour à l'accueil */}
        <View style={styles.footerContainer}>
          <NativeButton
            title="🏠 Retour à l'accueil"
            onPress={() => navigation.navigate('Home' as never)}
            variant="outline"
            size="large"
            style={styles.homeButton}
          />
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
  },
  loadingContent: {
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: modernStyles.borderRadius.medium,
    gap: 6,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  infoBanner: {
    backgroundColor: modernColors.info + '20',
    borderColor: modernColors.info + '40',
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 16,
    color: modernColors.info,
    textAlign: 'center',
    fontWeight: '500',
  },
  infoBold: {
    fontWeight: 'bold',
  },
  refreshingText: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    flex: 1,
  },
  servicesContainer: {
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: modernColors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  createButton: {
    marginTop: 10,
  },
  footerContainer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
  },
  homeButton: {
    alignSelf: 'center',
  },
});

export default MesServicesScreen;



