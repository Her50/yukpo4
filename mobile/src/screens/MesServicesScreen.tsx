// @ts-nocheck
// Design moderne inspiré du frontend
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Dimensions, Modal, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeButton, NativeCard } from '../components/NativeDesign';
import ProductVideoCreationModal from '../components/ProductVideoCreationModal';
import SafeIcon from '../components/SafeIcon';
import ServiceCardModern from '../components/ServiceCardModern';
import ServiceProductSelector from '../components/ServiceProductSelector';
import ServiceTeamManager from '../components/ServiceTeamManager';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { modernColors, modernStyles } from '../theme/modernTheme';
import { ManagedProduct } from '../types/ManagedProduct';
import { GeneratedVideoResponse } from '../types/VideoGeneration';
import { CacheManager, createCacheKey } from '../utils/cache';
import { logger } from '../utils/logger';
import { navigateToVideoWizard } from '../utils/videoNavigation';

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
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productsForSelection, setProductsForSelection] = useState<Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }>>([]);
  // ✅ NOUVEAU: État pour le menu global
  const [showGlobalMenu, setShowGlobalMenu] = useState(false);
  // ✅ NOUVEAU: États pour le modal de création de vidéo
  const [showVideoCreationModal, setShowVideoCreationModal] = useState(false);
  const [productsForVideoCreation, setProductsForVideoCreation] = useState<ManagedProduct[]>([]);
  const [selectedServiceForVideo, setSelectedServiceForVideo] = useState<Service | null>(null);
  // ✅ NOUVEAU: État pour stocker les services bruts (pour détecter si service existe)
  const [rawServices, setRawServices] = useState<any[]>([]);

  // ✅ OPTIMISATION: Fonction pour parser un produit (extrait pour réutilisabilité)
  const parseProduct = useCallback((product: any, index: number, service: any, serviceId: string, serviceTitre: string): Service | null => {
    try {
      let productTitle = '';
      let productDescription = '';

      if (typeof product === 'string') {
        const parts = product.split(',').map(p => p.trim());
        productTitle = parts[0] || `Produit ${index + 1}`;

        if (parts.length >= 3) {
          let lastNumericIndex = -1;
          for (let i = parts.length - 1; i >= 0; i--) {
            if (/^\d+/.test(parts[i])) {
              lastNumericIndex = i;
              break;
            }
          }
          if (lastNumericIndex > 2) {
            productDescription = parts.slice(2, lastNumericIndex).join(', ').trim();
          } else if (parts.length >= 3) {
            productDescription = parts[2] || 'Aucune description';
          } else {
            productDescription = parts[1] || 'Aucune description';
          }
        } else if (parts.length === 2) {
          productDescription = parts[1] || 'Aucune description';
        } else {
          productDescription = 'Aucune description';
        }
      } else if (product && typeof product === 'object') {
        productTitle = product.nom ||
          product.data?.nom ||
          product.titre ||
          product.title ||
          product.data?.nom_produit ||
          product.nom_produit ||
          (typeof product.nom_produit === 'object' && product.nom_produit?.valeur) ||
          (typeof product.nom_produit === 'string' && product.nom_produit) ||
          (typeof product.data?.nom_produit === 'object' && product.data?.nom_produit?.valeur) ||
          (typeof product.data?.nom_produit === 'string' && product.data?.nom_produit) ||
          `Produit ${index + 1}`;
        productDescription = product.description ||
          product.desc ||
          product.description_produit ||
          (typeof product.description_produit === 'object' && product.description_produit?.valeur) ||
          (typeof product.description_produit === 'string' && product.description_produit) ||
          'Aucune description';
      } else {
        productTitle = `Produit ${index + 1}`;
        productDescription = 'Aucune description';
      }

      const productIndex = typeof product.product_index === 'number' ? product.product_index : index;

      return {
        id: `${serviceId}_${productIndex}`,
        title: productTitle,
        description: productDescription,
        status: (() => {
          if (product.is_active !== undefined) return product.is_active ? 'active' : 'inactive';
          if (service.actif !== undefined) return service.actif ? 'active' : 'inactive';
          if (service.is_active !== undefined) return service.is_active ? 'active' : 'inactive';
          return 'active';
        })(),
        createdAt: product.created_at || service.created_at || service.createdAt || new Date().toISOString(),
        views: product.views || service.views || 0,
        interactions: product.interactions || service.interactions || 0,
        user_id: service.user_id?.toString() || '',
        data: {
          ...product,
          serviceId: serviceId,
          serviceTitre: serviceTitre,
          product_index: productIndex,
          service_data: service.data
        },
        service_id: serviceId,
        product_index: productIndex,
        service_title: serviceTitre
      };
    } catch (error) {
      logger.error('[MesServicesScreen] Erreur parsing produit:', error);
      return null;
    }
  }, []);

  // ✅ OPTIMISATION: Fonction pour extraire les produits d'un service
  const extractProduits = useCallback((service: any): any[] => {
    if (service.data?.produits?.valeur && Array.isArray(service.data.produits.valeur)) {
      return service.data.produits.valeur;
    } else if (Array.isArray(service.data?.produits)) {
      return service.data.produits;
    } else if (service.data?.produits && typeof service.data.produits === 'object') {
      const produitsObj = service.data.produits;
      if (Array.isArray(produitsObj.items)) {
        return produitsObj.items;
      } else if (Array.isArray(produitsObj.list)) {
        return produitsObj.list;
      }
    }
    return [];
  }, []);

  const loadServices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // ✅ OPTIMISATION: Vérifier le cache avant de faire l'appel API
      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      if (!isRefresh) {
        const cached = await CacheManager.get<Service[]>(cacheKey, 5 * 60 * 1000); // 5 minutes
        if (cached) {
          logger.log('[MesServicesScreen] ✅ Données chargées depuis le cache');
          setServices(cached);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      // ✅ CORRIGÉ: Utilise apiGet
      const response = await apiGet('/api/prestataire/services');

      logger.log('[MesServicesScreen] 🔍 Réponse API:', {
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

        logger.log('[MesServicesScreen] 📦 Services reçus:', {
          isArray: Array.isArray(data),
          count: Array.isArray(data) ? data.length : 0,
          type: typeof data
        });

        // ✅ NOUVEAU: Stocker les services bruts pour la détection lors de l'ajout de produit
        const servicesArray = Array.isArray(data) ? data : [];
        setRawServices(servicesArray);

        // ✅ OPTIMISATION: Utiliser useMemo pour parser les produits (plus efficace)
        const allProducts: Service[] = [];

        if (Array.isArray(data)) {
          data.forEach((service: any) => {
            const serviceId = service.id?.toString() || String(service.id) || '';
            const serviceTitre = service.data?.titre_service?.valeur ||
              service.data?.titre?.valeur ||
              service.titre ||
              'Service sans titre';

            // ✅ OPTIMISATION: Utiliser la fonction extractProduits
            const produits = extractProduits(service);

            if (produits && produits.length > 0) {
              produits.forEach((product: any, index: number) => {
                const parsed = parseProduct(product, index, service, serviceId, serviceTitre);
                if (parsed) {
                  allProducts.push(parsed);
                }
              });
            }
          });
        }

        // Trier les produits du plus récent au plus ancien
        allProducts.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        logger.log('[MesServicesScreen] ✅ Produits extraits:', allProducts.length);

        // ✅ OPTIMISATION: Sauvegarder dans le cache
        await CacheManager.set(cacheKey, allProducts);

        setServices(allProducts);
      } else {
        logger.error('[MesServicesScreen] ❌ Erreur API ou pas de données:', {
          success: response.success,
          error: response.error
        });
        setServices([]);
      }
    } catch (error) {
      logger.error('Erreur chargement produits:', error);
      Alert.alert('Erreur', 'Impossible de charger vos produits');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, parseProduct, extractProduits]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useFocusEffect(
    useCallback(() => {
      loadServices(true);
    }, [loadServices])
  );

  useEffect(() => {
    // Écouter les événements de création/modification de service/produit
    const subscription1 = DeviceEventEmitter.addListener('service:refresh', () => {
      logger.log('[MesServicesScreen] 🔄 Événement service:refresh reçu');
      // ✅ OPTIMISATION: Invalider le cache avant de recharger
      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      CacheManager.remove(cacheKey);
      loadServices(true);
    });

    // ✅ NOUVEAU: Écouter les événements de création de produit
    const subscription2 = DeviceEventEmitter.addListener('product:created', () => {
      logger.log('[MesServicesScreen] 🔄 Événement product:created reçu');
      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      CacheManager.remove(cacheKey);
      loadServices(true);
    });

    const subscription3 = DeviceEventEmitter.addListener('product:updated', () => {
      logger.log('[MesServicesScreen] 🔄 Événement product:updated reçu');
      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      CacheManager.remove(cacheKey);
      loadServices(true);
    });

    return () => {
      subscription1.remove();
      subscription2.remove();
      subscription3.remove();
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

  // ✅ NOUVEAU: Fonction pour gérer l'ajout de produit (détecte si service existe)
  const handleAddProduct = useCallback((serviceId?: number | string) => {
    try {
      // Si un serviceId est fourni, naviguer directement vers AjouterProduitSimple
      if (serviceId) {
        logger.log('[MesServicesScreen] handleAddProduct - ServiceId fourni:', serviceId);
        (navigation as any).navigate('AjouterProduitSimple', {
          serviceId: typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId,
          mode: 'create'
        });
        return;
      }

      // Sinon, vérifier s'il y a des services existants
      // ✅ AMÉLIORATION 2025-11-28: Vérifier d'abord rawServices (services bruts), puis services (produits parsés)
      let foundServiceId: number | undefined;

      // 1. Vérifier rawServices d'abord (services bruts de l'API)
      if (rawServices && rawServices.length > 0) {
        const activeService = rawServices.find((s: any) => s.is_active !== false && s.actif !== false) || rawServices[0];

        if (activeService && activeService.id) {
          foundServiceId = typeof activeService.id === 'string' ? parseInt(activeService.id, 10) : activeService.id;
          logger.log('[MesServicesScreen] handleAddProduct - Service existant trouvé (rawServices):', foundServiceId);
        }
      }

      // 2. Si rawServices est vide mais services (produits) existe, extraire le serviceId depuis le premier produit
      if (!foundServiceId && services && services.length > 0) {
        const firstProduct = services[0];
        const serviceId = firstProduct.service_id || firstProduct.data?.serviceId || firstProduct.id?.split('_')[0];

        if (serviceId) {
          foundServiceId = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;
          logger.log('[MesServicesScreen] handleAddProduct - Service existant trouvé (services parsés):', foundServiceId);
        }
      }

      // 3. Si un service a été trouvé, naviguer vers AjouterProduitSimple
      if (foundServiceId) {
        (navigation as any).navigate('AjouterProduitSimple', {
          serviceId: foundServiceId,
          mode: 'create'
        });
        return;
      }

      // Aucun service existant, naviguer vers FormulaireYukpoIntelligent pour créer service + produit
      logger.log('[MesServicesScreen] handleAddProduct - Aucun service trouvé, création nouveau service');
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'create',
        focusProduct: true
      });
    } catch (error) {
      logger.error('[MesServicesScreen] Erreur handleAddProduct:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir le formulaire d\'ajout de produit');
    }
  }, [rawServices, services, navigation]);

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
      logger.error('Erreur navigation modification:', error);
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
      logger.error('Erreur navigation visualisation:', error);
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
        logger.log('[MesServicesScreen] Service partagé:', serviceUrl);
        Alert.alert('Succès', 'Service partagé avec succès !');
      }
    } catch (error) {
      logger.error('Erreur lors du partage:', error);
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
        logger.error('[MesServicesScreen] Erreur API toggle status:', response.status, errorText);
        Alert.alert('Erreur', `Impossible de changer le statut (Code: ${response.status})`);
      }
    } catch (error: any) {
      logger.error('[MesServicesScreen] Erreur toggle status:', error);
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
              logger.error('Erreur suppression:', error);
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

  const handleCreateVideo = (productItem: any) => {
    // ✅ CORRECTION: productItem est en fait un produit (car services contient les produits)
    // Il faut regrouper tous les produits du même service_id
    const serviceId = productItem.service_id || productItem.data?.serviceId || productItem.id?.split('_')[0];

    logger.log('[MesServicesScreen] handleCreateVideo - Service ID:', serviceId, 'Produit:', productItem.id);

    // Regrouper tous les produits du même service
    const produitsDuService = services.filter((s: Service) => {
      const sServiceId = s.service_id || s.data?.serviceId || s.id?.split('_')[0];
      return sServiceId === serviceId;
    });

    logger.log('[MesServicesScreen] handleCreateVideo - Produits du service trouvés:', produitsDuService.length);

    if (produitsDuService.length === 0) {
      Alert.alert(
        'Produit requis',
        'Aucun produit trouvé pour ce service. Créez d\'abord un produit pour pouvoir créer une vidéo.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Créer un produit',
            onPress: () => {
              handleAddProduct(serviceId);
            }
          }
        ]
      );
      return;
    }

    // Convertir les produits en ManagedProduct pour le modal
    const managedProducts: ManagedProduct[] = produitsDuService.map((product: any) => ({
      id: product.id || `prod_${product.product_index || 0}`,
      serviceId: serviceId.toString(),
      product_index: product.product_index || product.data?.product_index || 0,
      nom: product.nom || product.data?.nom || product.data?.nom_produit || product.nom_produit || product.title || product.data?.title || 'Produit',
      description: product.description || product.data?.description || '',
      prix: product.data?.prix || product.prix || product.price,
      devise: product.data?.devise || product.devise || product.currency || 'XAF',
      type: product.data?.type || product.type || product.categorie || 'produit',
      serviceTitre: product.service_title || product.data?.serviceTitre || product.title || `Service #${serviceId}`,
      ...product.data,
      ...product
    }));

    // Si un seul produit → Navigation directe
    if (managedProducts.length === 1) {
      const product = managedProducts[0];
      navigateToVideoWizard(navigation, {
        serviceId: Number(serviceId),
        productIndex: product.product_index || 0,
        productName: product.nom || 'Produit'
      });
      return;
    }

    // Plusieurs produits → Afficher le modal ProductVideoCreationModal
    setSelectedServiceForVideo(productItem);
    setProductsForVideoCreation(managedProducts);
    setShowVideoCreationModal(true);
  };

  const handleVideoCreationSuccess = async (result: GeneratedVideoResponse) => {
    logger.log('[MesServicesScreen] ✅ Vidéo créée avec succès:', result);
    setShowVideoCreationModal(false);
    setProductsForVideoCreation([]);
    setSelectedServiceForVideo(null);
    Alert.alert('✅ Succès', 'Votre vidéo a été créée avec succès !');
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
              logger.error('Erreur navigation promotion:', error);
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
              logger.error('Erreur navigation promotion:', error);
              Alert.alert('Erreur', 'Impossible d\'ouvrir la gestion des promotions');
            }
          }
        }
      ]
    );
  };

  // Filtrer les services selon le filtre sélectionné
  const filteredServices = Array.isArray(services) ? services.filter((service) => {
    if (filter === 'tous') return true;
    if (filter === 'actif') return service.status === 'active';
    if (filter === 'inactif') return service.status === 'inactive';
    return true;
  }) : [];

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
              <Text style={styles.title}>Mes Produits</Text>
              <Text style={styles.subtitle}>{services.length} produit{services.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.headerActions}>
              {/* Bouton Vidéo */}
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => (navigation as any).navigate('Video')}
              >
                <SafeIcon name="video" size={20} color="#fff" />
              </TouchableOpacity>

              {/* ✅ NOUVEAU : Bouton participation Black Friday (entre vidéo et menu) */}
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => (navigation as any).navigate('GlobalPromoSubmission')}
              >
                <SafeIcon name="dollar-sign" size={20} color="#fff" />
              </TouchableOpacity>

              {/* ✅ Menu global avec actions (après vidéo et Black Friday) */}
              <TouchableOpacity
                style={[styles.headerButton, styles.menuButton]}
                onPress={() => setShowGlobalMenu(!showGlobalMenu)}
              >
                <SafeIcon name="more-vertical" size={20} color="#fff" />
              </TouchableOpacity>

              {/* Bouton Paramètres */}
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => (navigation as any).navigate('Settings')}
              >
                <SafeIcon name="settings" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ✅ NOUVEAU: Menu global déroulant */}
        {showGlobalMenu && (
          <View style={styles.globalMenu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                // Ouvrir le gestionnaire d'équipe global
                setSelectedService(null);
                setShowTeamManager(true);
              }}
            >
              <SafeIcon name="users" size={18} color="#6366F1" />
              <Text style={styles.menuItemText}>Membres</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                handleAddProduct();
              }}
            >
              <SafeIcon name="plus-circle" size={18} color="#10B981" />
              <Text style={styles.menuItemText}>Créer produit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                (navigation as any).navigate('AnalyticsDashboard');
              }}
            >
              <SafeIcon name="bar-chart-3" size={18} color="#3B82F6" />
              <Text style={styles.menuItemText}>Statistiques</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                (navigation as any).navigate('CreatePublicite');
              }}
            >
              <SafeIcon name="megaphone" size={18} color="#EC4899" />
              <Text style={styles.menuItemText}>Publicité</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                onRefresh();
              }}
            >
              <SafeIcon name="refresh-cw" size={18} color="#6B7280" />
              <Text style={styles.menuItemText}>Actualiser</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* Overlay pour fermer le menu quand on clique ailleurs */}
      {showGlobalMenu && (
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowGlobalMenu(false)}
        />
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ✅ NOUVEAU: Cartes de statistiques */}
        <View style={styles.statsContainer}>
          <NativeCard style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
              {services.length}
            </Text>
            <Text style={styles.statLabel}>Produits</Text>
          </NativeCard>

          <NativeCard style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>
              {services.filter(s => s.status === 'active').length}
            </Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </NativeCard>

          <NativeCard style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#F97316' }]}>
              {services.filter(s => s.status === 'inactive').length}
            </Text>
            <Text style={styles.statLabel}>En pause</Text>
          </NativeCard>

          <NativeCard style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#6366F1' }]}>
              {(() => {
                const categories = new Set<string>();
                services.forEach(s => {
                  const cat = s.data?.category?.valeur ||
                    s.data?.categorie?.valeur ||
                    s.data?.type ||
                    null;
                  if (cat) categories.add(cat);
                });
                return categories.size;
              })()}
            </Text>
            <Text style={styles.statLabel}>Catégories</Text>
          </NativeCard>
        </View>

        {/* ✅ AMÉLIORÉ: Filtres avec design moderne */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScrollView}
          contentContainerStyle={styles.filtersContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'tous' && styles.filterChipActive
            ]}
            onPress={() => setFilter('tous')}
          >
            <SafeIcon
              name="package"
              size={16}
              color={filter === 'tous' ? '#fff' : '#6366F1'}
            />
            <Text style={[
              styles.filterChipText,
              filter === 'tous' && styles.filterChipTextActive
            ]}>
              Tous ({services.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'actif' && styles.filterChipActive
            ]}
            onPress={() => setFilter('actif')}
          >
            <SafeIcon
              name="check-circle"
              size={16}
              color={filter === 'actif' ? '#fff' : '#10B981'}
            />
            <Text style={[
              styles.filterChipText,
              filter === 'actif' && styles.filterChipTextActive
            ]}>
              Actifs ({services.filter(s => s.status === 'active').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              filter === 'inactif' && styles.filterChipActive
            ]}
            onPress={() => setFilter('inactif')}
          >
            <SafeIcon
              name="pause-circle"
              size={16}
              color={filter === 'inactif' ? '#fff' : '#F97316'}
            />
            <Text style={[
              styles.filterChipText,
              filter === 'inactif' && styles.filterChipTextActive
            ]}>
              Inactifs ({services.filter(s => s.status === 'inactive').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterChip}
            onPress={() => {
              // TODO: Implémenter le filtre par catégorie
              Alert.alert('Filtre catégories', 'Fonctionnalité à venir');
            }}
          >
            <SafeIcon name="tag" size={16} color="#8B5CF6" />
            <Text style={styles.filterChipText}>
              Toutes catégories
            </Text>
          </TouchableOpacity>
        </ScrollView>

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
              title="➕ Créer un nouveau produit"
              onPress={() => handleAddProduct()}
              variant="primary"
              size="medium"
              style={styles.createButton}
            />
          </View>
        ) : (
          <View style={styles.servicesContainer}>
            {Array.isArray(filteredServices) && filteredServices.length > 0 ? filteredServices.map((service) => (
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
                onCreateVideo={handleCreateVideo}  // ✅ NOUVEAU
              />
            )) : null}
          </View>
        )}

        {/* Boutons de navigation */}
        <View style={styles.footerContainer}>
          <NativeButton
            title="📊 Analytics Dashboard"
            onPress={() => (navigation as any).navigate('AnalyticsDashboard')}
            variant="primary"
            size="large"
            style={styles.analyticsFooterButton}
          />
          <NativeButton
            title="📦 Gérer mes produits"
            onPress={() => navigation.navigate('MesProduits' as never)}
            variant="outline"
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
      {showTeamManager && (
        <Modal
          visible={showTeamManager}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowTeamManager(false)}
        >
          <ServiceTeamManager
            serviceId={selectedService ? selectedService.id.toString() : undefined}
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

      {/* ✅ NOUVEAU: Sélecteur de produit pour création vidéo */}
      <ServiceProductSelector
        visible={showProductSelector}
        products={productsForSelection}
        onSelect={(product) => {
          navigateToVideoWizard(navigation, product);
          setShowProductSelector(false);
          setProductsForSelection([]);
        }}
        onClose={() => {
          setShowProductSelector(false);
          setProductsForSelection([]);
        }}
      />

      {/* ✅ NOUVEAU: Modal de création de vidéo avec produits */}
      {showVideoCreationModal && productsForVideoCreation.length > 0 && (
        <ProductVideoCreationModal
          visible={showVideoCreationModal}
          primaryProduct={productsForVideoCreation[0]}
          products={productsForVideoCreation}
          onClose={() => {
            setShowVideoCreationModal(false);
            setProductsForVideoCreation([]);
            setSelectedServiceForVideo(null);
          }}
          onSuccess={handleVideoCreationSuccess}
        />
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
  analyticsButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)', // Indigo pour Analytics
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
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  globalMenu: {
    position: 'absolute',
    top: 90,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 180,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
  filtersScrollView: {
    marginBottom: 20,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#fff',
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
  analyticsFooterButton: {
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  productsButton: {
    alignSelf: 'stretch',
  },
  homeButton: {
    alignSelf: 'center',
  },
});

export default MesServicesScreen;




