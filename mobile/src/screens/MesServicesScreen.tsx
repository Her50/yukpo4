// @ts-nocheck
// Design moderne inspiré du frontend
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Dimensions, Modal, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeButton, NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import ServiceCardModern from '../components/ServiceCardModern';
import ServiceTeamManager from '../components/ServiceTeamManager';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
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
  // ✅ NOUVEAU : États pour gestion d'équipe
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const loadServices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem('auth_token');

      // ✅ CORRIGÉ: Utilise apiGet
      const response = await apiGet('/api/prestataire/services');

      console.log('[MesServicesScreen] 🔍 Réponse API:', {
        ok: response.ok,
        status: response.status,
        success: response.success
      });

      // ✅ CORRECTION: L'API retourne directement un tableau, apiGet l'enveloppe dans { success: true, data: [...] }
      if (response.success) {
        let data = response.data;

        // Si data est directement un tableau, l'utiliser
        // Sinon, vérifier si c'est dans une structure imbriquée
        if (!Array.isArray(data)) {
          // Essayer de trouver le tableau dans différentes structures possibles
          if (data && typeof data === 'object') {
            if (Array.isArray(data.data)) {
              data = data.data;
            } else if (Array.isArray(data.services)) {
              data = data.services;
            } else if (Array.isArray(data.items)) {
              data = data.items;
            }
          }
        }

        console.log('[MesServicesScreen] 📦 Services reçus:', {
          isArray: Array.isArray(data),
          count: Array.isArray(data) ? data.length : 0,
          type: typeof data,
          sample: Array.isArray(data) && data.length > 0 ? data[0] : null
        });

        // ✅ CORRECTION IMPORTANTE: Extraire les PRODUITS depuis les services, pas les services eux-mêmes
        const allProducts: Service[] = [];

        if (Array.isArray(data)) {
          data.forEach((service: any) => {
            const serviceId = service.id?.toString() || String(service.id) || '';
            const serviceTitre = service.data?.titre_service?.valeur ||
              service.data?.titre?.valeur ||
              service.titre ||
              'Service sans titre';

            // Extraire les produits depuis service.data.produits.valeur
            const produits = service.data?.produits?.valeur || service.data?.produits;

            if (produits && Array.isArray(produits)) {
              produits.forEach((product: any, index: number) => {
                const productIndex = typeof product.product_index === 'number' ? product.product_index : index;

                // Créer un "Service" pour chaque produit (pour compatibilité avec l'interface existante)
                allProducts.push({
                  id: `${serviceId}_${productIndex}`, // ID unique produit
                  title: product.nom ||
                    product.titre ||
                    product.title ||
                    product.nom_produit?.valeur ||
                    `Produit ${index + 1}`,
                  description: product.description ||
                    product.desc ||
                    product.description_produit?.valeur ||
                    'Aucune description',
                  status: (() => {
                    // Le statut du produit (is_active) ou du service
                    if (product.is_active !== undefined) {
                      return product.is_active ? 'active' : 'inactive';
                    }
                    if (service.actif !== undefined) {
                      return service.actif ? 'active' : 'inactive';
                    }
                    if (service.is_active !== undefined) {
                      return service.is_active ? 'active' : 'inactive';
                    }
                    return 'active';
                  })(),
                  createdAt: product.created_at ||
                    service.created_at ||
                    service.createdAt ||
                    new Date().toISOString(),
                  views: product.views || service.views || 0,
                  interactions: product.interactions || service.interactions || 0,
                  user_id: service.user_id?.toString() || '',
                  data: {
                    ...product,
                    serviceId: serviceId,
                    serviceTitre: serviceTitre,
                    product_index: productIndex,
                    // Conserver les données du service parent
                    service_data: service.data
                  },
                  // Métadonnées supplémentaires
                  service_id: serviceId,
                  product_index: productIndex,
                  service_title: serviceTitre
                });
              });
            } else {
              // Si le service n'a pas de produits, on peut l'afficher quand même (optionnel)
              console.log('[MesServicesScreen] ⚠️ Service sans produits:', serviceId, serviceTitre);
            }
          });
        }

        // Trier les produits du plus récent au plus ancien
        allProducts.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        console.log('[MesServicesScreen] ✅ Produits extraits:', allProducts.length);
        if (allProducts.length > 0) {
          console.log('[MesServicesScreen] 📋 Premier produit:', {
            id: allProducts[0].id,
            title: allProducts[0].title,
            status: allProducts[0].status,
            service_id: allProducts[0].service_id
          });
        }
        setServices(allProducts);
      } else {
        console.error('[MesServicesScreen] ❌ Erreur API ou pas de données:', {
          success: response.success,
          error: response.error,
          data: response.data
        });
        setServices([]);
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      Alert.alert('Erreur', 'Impossible de charger vos produits');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useFocusEffect(
    useCallback(() => {
      loadServices(true);
    }, [loadServices])
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('service:refresh', () => {
      loadServices(true);
    });

    return () => {
      subscription.remove();
    };
  }, [loadServices]);

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
        mode: 'view',  // ✅ CORRECTION : Utiliser 'view' au lieu de 'readonly'
        serviceId: service.id,
        serviceData: service.data,
        suggestion: {
          data: service.data || {},
          intention: service.intention || 'creation_service',
          confidence: service.confidence || 0.8
        },
        type: 'visualisation_service',
        readonly: true,  // ✅ Flag explicite pour mode lecture seule
        fromMesServices: true
      });
    } catch (error) {
      console.error('Erreur navigation visualisation:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la visualisation du service');
    }
  };

  const handleShareService = async (service: any) => {
    try {
      // Implémentation du partage avec deep linking
      const titre = service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.title || 'Service Yukpo';
      const description = service.data?.description?.valeur || service.description || 'Découvrez ce service sur Yukpo';
      const prix = service.data?.prix?.valeur || service.prix;
      const localisation = service.data?.localisation?.valeur || service.localisation;

      // ✅ AMÉLIORATION : Créer un lien deep link vers le service
      const serviceUrl = `https://yukpomnang.com/service/${service.id}`;

      let shareText = `🛍️ ${titre}\n\n${description}`;

      if (prix) {
        shareText += `\n💰 Prix: ${prix} FCFA`;
      }

      if (localisation) {
        shareText += `\n📍 Localisation: ${localisation}`;
      }

      shareText += `\n\n🔗 Voir ce service sur Yukpo :\n📱 ${serviceUrl}`;

      // Utiliser l'API de partage native React Native
      const result = await Share.share({
        message: shareText,
        title: titre,
        url: serviceUrl  // ✅ URL spécifique au service
      });

      if (result.action === Share.sharedAction) {
        console.log('[MesServicesScreen] Service partagé:', serviceUrl);
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
        // ✅ CORRIGÉ: Vérifier le solde avec apiGet
        const balanceResponse = await apiGet('/api/users/balance');

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

          // ✅ CORRIGÉ: Déduire le coût avec apiPost
          const deductResponse = await apiPost('/api/users/deduct-balance', {
            amount: activationCost,
            reason: 'service_reactivation'
          });

          if (deductResponse.success) {
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

      // ✅ CORRIGÉ: Changer le statut avec apiPatch
      const response = await apiPatch(`/api/services/${service.id}/toggle-status`, {
        actif: newStatus
      });

      if (response.success) {
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
        const errorText = await response.text();
        console.error('[MesServicesScreen] Erreur API toggle status:', response.status, errorText);
        Alert.alert('Erreur', `Impossible de changer le statut (Code: ${response.status})`);
      }
    } catch (error: any) {
      console.error('[MesServicesScreen] Erreur toggle status:', error);
      Alert.alert('Erreur', error.message || 'Impossible de changer le statut du service');
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

              // ✅ CORRIGÉ: Supprimer avec apiDelete
              const response = await apiDelete(`/api/services/${service.id}/delete`);

              if (response.ok) {
                // Supprimer de l'état local
                setServices(prevServices => prevServices.filter(s => s.id !== service.id));

                // Déclencher un rafraîchissement pour mettre à jour l'interface
                loadServices(true);

                Alert.alert('✅ Succès', 'Service supprimé avec succès');
              } else {
                // ✅ NOUVEAU 2025-11-01: Objectif #4 - Blocage suppression si >= 2 produits
                const errorData = await response.json().catch(() => ({}));

                if (response.status === 400 && errorData.message?.includes('2 or more products')) {
                  Alert.alert(
                    '⚠️ Suppression impossible',
                    `Ce service contient 2 produits ou plus.\n\nVous devez d'abord supprimer les produits individuellement avant de pouvoir supprimer le service.\n\n💡 Gardez au minimum 1 produit par service.`,
                    [{ text: 'OK' }]
                  );
                } else {
                  throw new Error(errorData.message || 'Erreur lors de la suppression');
                }
              }
            } catch (error: any) {
              console.error('Erreur suppression:', error);
              // ✅ AMÉLIORATION: Message d'erreur plus précis
              const message = error.response?.data?.message ||
                error.message ||
                'Impossible de supprimer le service. Vérifiez votre connexion.';
              Alert.alert('❌ Erreur', message);
            }
          }
        }
      ]
    );
  };

  // ✅ NOUVEAU : Handler pour gérer l'équipe d'un service
  const handleManageTeam = (service: Service) => {
    setSelectedService(service);
    setShowTeamManager(true);
  };

  const handlePromotionService = (service: any) => {
    const titre = service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.title || 'Service';

    // Afficher un modal de gestion des promotions comme dans le frontend
    Alert.alert(
      '📢 Promotion du service',
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
              <TouchableOpacity
                style={[styles.headerButton, styles.dashboardButton]}
                onPress={() => (navigation as any).navigate('Dashboard')}
              >
                <SafeIcon name="bar-chart" size={20} color="#fff" />
                <Text style={styles.headerButtonText}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, styles.publiciteButton]}
                onPress={() => (navigation as any).navigate('CreatePublicite')}
              >
                <SafeIcon name="megaphone" size={20} color="#fff" />
                <Text style={styles.headerButtonText}>Publicité</Text>
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
            Vous avez <Text style={styles.infoBold}>{services.length}</Text> produit(s) créé(s)
            {refreshing && (
              <Text style={styles.refreshingText}> 🔄 Actualisation en cours...</Text>
            )}
          </Text>
        </NativeCard>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <NativeButton
            title={`📦 Tous (${services.length})`}
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
            title={`⏸️ Inactifs (${services.filter(s => s.status === 'inactive').length})`}
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
              {filter === 'tous' ? 'Aucun produit créé' : `Aucun produit ${filter}`}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'tous'
                ? 'Créez votre premier produit pour commencer à proposer vos produits.'
                : `Aucun produit ${filter} pour le moment.`
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
                onViewProducts={() => navigation.navigate('MesProduits' as never)}
                onManageTeam={handleManageTeam}  // ✅ NOUVEAU
              />
            ))}
          </View>
        )}

        {/* Boutons de navigation */}
        <View style={styles.footerContainer}>
          <NativeButton
            title="📦 Gérer mes produits"
            onPress={() => navigation.navigate('MesProduits' as never)}
            variant="primary"
            size="large"
            style={styles.productsButton}
          />
          <NativeButton
            title="🏠 Retour à l'accueil"
            onPress={() => navigation.navigate('Home' as never)}
            variant="outline"
            size="large"
            style={styles.homeButton}
          />
        </View>
      </ScrollView>

      {/* ✅ NOUVEAU : Modal Gestion d'équipe */}
      {showTeamManager && selectedService && (
        <Modal
          visible={showTeamManager}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowTeamManager(false)}
        >
          <ServiceTeamManager
            serviceId={selectedService.id.toString()}
            onClose={() => {
              setShowTeamManager(false);
              setSelectedService(null);
            }}
            onMemberAdded={() => {
              Alert.alert('✅ Succès', 'Membre ajouté à l\'équipe avec succès');
              loadServices(true);
            }}
            onMemberRemoved={() => {
              Alert.alert('✅ Succès', 'Membre retiré de l\'équipe avec succès');
              loadServices(true);
            }}
          />
        </Modal>
      )}
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
  dashboardButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)', // Vert pour Dashboard
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  publiciteButton: {
    backgroundColor: 'rgba(236, 72, 153, 0.3)', // Rose pour Publicité
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    gap: 12,
  },
  productsButton: {
    alignSelf: 'stretch',
  },
  homeButton: {
    alignSelf: 'center',
  },
});

export default MesServicesScreen;




