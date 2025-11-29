// @ts-nocheck
// Design moderne inspiré du frontend
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Dimensions, Modal, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GlobalDeliveryConfigModal from '../components/delivery/GlobalDeliveryConfigModal';
import { NativeButton, NativeCard } from '../components/NativeDesign';
import ProductGalleryModal from '../components/ProductGalleryModal';
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
import { extractProductName, extractServiceName } from '../utils/displayHelpers';
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
  // ✅ États pour gestion d'équipe globale (depuis menu)
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productSelectorMode, setProductSelectorMode] = useState<'team' | 'delivery' | null>(null); // Mode du sélecteur
  const [productsForSelection, setProductsForSelection] = useState<Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }>>([]);
  // ✅ État pour le menu global
  const [showGlobalMenu, setShowGlobalMenu] = useState(false);
  // ✅ NOUVEAU: États pour configuration globale de livraison
  const [showGlobalDeliveryConfig, setShowGlobalDeliveryConfig] = useState(false);
  const [selectedProductsForDelivery, setSelectedProductsForDelivery] = useState<Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }>>([]);
  // ✅ NOUVEAU: États pour le modal de création de vidéo
  const [showVideoCreationModal, setShowVideoCreationModal] = useState(false);
  const [productsForVideoCreation, setProductsForVideoCreation] = useState<ManagedProduct[]>([]);
  const [selectedServiceForVideo, setSelectedServiceForVideo] = useState<Service | null>(null);
  // ✅ NOUVEAU: État pour stocker les services bruts (pour détecter si service existe)
  const [rawServices, setRawServices] = useState<any[]>([]);
  // ✅ NOUVEAU: État pour la galerie de produits
  const [showProductGallery, setShowProductGallery] = useState(false);

  // ✅ OPTIMISATION: Fonction pour parser un produit (extrait pour réutilisabilité)
  const parseProduct = useCallback((product: any, index: number, service: any, serviceId: string, serviceTitre: string): Service | null => {
    try {
      let productTitle = '';
      let productDescription = '';

      if (typeof product === 'string' && product.trim()) {
        // ✅ CORRECTION: S'assurer que product est une string valide avant split
        const parts = product.split(',').map((p: string) => (p || '').trim()).filter((p: string) => p.length > 0);
        productTitle = (parts && parts.length > 0 && parts[0]) ? parts[0] : `Produit ${index + 1}`;

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

  // ✅ CORRECTION 2025-11-28: Fonction pour extraire les produits d'un service (tous formats)
  const extractProduits = useCallback((service: any): any[] => {
    // ✅ CORRECTION: Vérifier d'abord si service.data existe
    const serviceData = service.data || service;

    // ✅ CORRECTION: Format 1 - produits.valeur (tableau de strings ou objets)
    if (serviceData?.produits?.valeur) {
      const valeur = serviceData.produits.valeur;
      if (Array.isArray(valeur) && valeur.length > 0) {
        // ✅ CORRECTION: Filtrer les valeurs vides
        const filtered = valeur.filter((v: any) => v !== null && v !== undefined && v !== '');
        if (filtered.length > 0) {
          logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits.valeur:', filtered.length);
          return filtered;
        }
      }
    }

    // ✅ CORRECTION: Format 2 - produits directement un tableau
    if (Array.isArray(serviceData?.produits) && serviceData.produits.length > 0) {
      logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits (array):', serviceData.produits.length);
      return serviceData.produits;
    }

    // ✅ CORRECTION: Format 3 - produits.items ou produits.list
    if (serviceData?.produits && typeof serviceData.produits === 'object') {
      const produitsObj = serviceData.produits;
      if (Array.isArray(produitsObj.items) && produitsObj.items.length > 0) {
        logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits.items:', produitsObj.items.length);
        return produitsObj.items;
      } else if (Array.isArray(produitsObj.list) && produitsObj.list.length > 0) {
        logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits.list:', produitsObj.list.length);
        return produitsObj.list;
      }
    }

    // ✅ CORRECTION: Format 4 - produits dans le service brut (sans data)
    if (Array.isArray(service.produits) && service.produits.length > 0) {
      logger.log('[MesServicesScreen] ✅ Produits trouvés dans service.produits:', service.produits.length);
      return service.produits;
    }

    // ✅ CORRECTION: Format 5 - Vérifier si produits est une string (à parser)
    if (typeof serviceData?.produits === 'string' && serviceData.produits.trim().length > 0) {
      try {
        const parsed = JSON.parse(serviceData.produits);
        if (Array.isArray(parsed) && parsed.length > 0) {
          logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits (JSON string):', parsed.length);
          return parsed;
        } else if (parsed.valeur && Array.isArray(parsed.valeur) && parsed.valeur.length > 0) {
          logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits (JSON string avec valeur):', parsed.valeur.length);
          return parsed.valeur;
        }
      } catch (e) {
        // Ce n'est pas du JSON, peut-être une string simple avec séparateur
        // ✅ CORRECTION: Vérifier que serviceData.produits est une string avant split
        if (typeof serviceData.produits === 'string' && serviceData.produits.trim()) {
          const parts = serviceData.produits.split(',').map((p: string) => (p || '').trim()).filter((p: string) => p.length > 0);
          if (parts && parts.length > 0) {
            logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits (string séparée):', parts.length);
            return parts;
          }
        }
      }
    }

    logger.warn('[MesServicesScreen] ⚠️ Aucun produit trouvé dans le service:', {
      hasData: !!serviceData,
      hasProduits: !!serviceData?.produits,
      produitsType: typeof serviceData?.produits,
      produitsKeys: serviceData?.produits && typeof serviceData.produits === 'object' ? Object.keys(serviceData.produits) : []
    });

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

        // ✅ IMPORTANT: On extrait et affiche les PRODUITS (pas les services)
        // Chaque produit est parsé depuis les services de l'utilisateur
        const allProducts: Service[] = []; // Note: Type Service mais contient des produits

        if (Array.isArray(data)) {
          data.forEach((service: any) => {
            const serviceId = service.id?.toString() || String(service.id) || '';
            const serviceTitre = service.data?.titre_service?.valeur ||
              service.data?.titre?.valeur ||
              service.titre ||
              'Service sans titre';

            // ✅ Extraire les produits depuis le service
            const produits = extractProduits(service);

            if (produits && produits.length > 0) {
              produits.forEach((product: any, index: number) => {
                // ✅ Parser chaque produit (l'ID sera "serviceId_productIndex")
                const parsed = parseProduct(product, index, service, serviceId, serviceTitre);
                if (parsed) {
                  allProducts.push(parsed); // ✅ Ajouter le produit à la liste
                }
              });
            }
          });
        }

        // ✅ Trier les produits du plus récent au plus ancien
        allProducts.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        logger.log('[MesServicesScreen] ✅ Produits extraits:', allProducts.length);

        // ✅ OPTIMISATION: Sauvegarder dans le cache
        await CacheManager.set(cacheKey, allProducts);

        // ✅ IMPORTANT: allProducts contient les PRODUITS de l'utilisateur (pas les services)
        // On les stocke dans "services" pour compatibilité avec le reste du code
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
  const handleAddProduct = useCallback(async (serviceId?: number | string) => {
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

      // ✅ CORRECTION: Si rawServices est vide ou en cours de chargement, recharger les services d'abord
      if ((!rawServices || rawServices.length === 0) && !loading) {
        logger.log('[MesServicesScreen] handleAddProduct - rawServices vide, rechargement des services...');
        await loadServices(true);
        // Attendre un peu pour que setRawServices soit effectif
        await new Promise(resolve => setTimeout(resolve, 100));
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

      // ✅ CORRECTION: Si toujours pas de service trouvé, faire un appel API direct pour vérifier
      if (!foundServiceId) {
        logger.log('[MesServicesScreen] handleAddProduct - Aucun service dans l\'état, vérification API directe...');
        try {
          const directResponse = await apiGet('/api/prestataire/services');
          if (directResponse.success && Array.isArray(directResponse.data) && directResponse.data.length > 0) {
            const directData = Array.isArray(directResponse.data) ? directResponse.data :
              (directResponse.data?.data || directResponse.data?.services || []);
            if (directData.length > 0) {
              const firstService = directData[0];
              foundServiceId = typeof firstService.id === 'string' ? parseInt(firstService.id, 10) : firstService.id;
              logger.log('[MesServicesScreen] handleAddProduct - Service trouvé via API directe:', foundServiceId);
            }
          }
        } catch (apiError) {
          logger.error('[MesServicesScreen] handleAddProduct - Erreur vérification API directe:', apiError);
        }
      }

      // 3. Si un service a été trouvé, naviguer vers AjouterProduitSimple
      if (foundServiceId) {
        logger.log('[MesServicesScreen] handleAddProduct - Navigation vers AjouterProduitSimple avec serviceId:', foundServiceId);
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
  }, [rawServices, services, navigation, loading, loadServices]);

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

  // ✅ Handler pour gérer l'équipe du SERVICE qui contient le produit
  // Note: "service" est en fait un PRODUIT (affiche les produits dans MesServices)
  // Il faut extraire le serviceId du service qui contient ce produit
  const handleManageTeam = (product: Service) => {
    // ✅ CORRECTION CRITIQUE: product est un produit affiché dans MesServices
    // L'ID du produit est au format "serviceId_productIndex" (ex: "123_0")
    // Il faut extraire le serviceId du SERVICE qui contient ce produit
    const realServiceId = product.service_id ||
      product.data?.serviceId ||
      (typeof product.id === 'string' && product.id.includes('_')
        ? product.id.split('_')[0]
        : product.id);

    // Créer un objet avec le serviceId du SERVICE pour ServiceTeamManager
    // ServiceTeamManager gère l'équipe du SERVICE, pas du produit
    const serviceForTeam = {
      ...product,
      id: realServiceId, // ✅ Utiliser le serviceId du SERVICE parent
      service_id: realServiceId
    };

    setSelectedService(serviceForTeam);
    setShowTeamManager(true);
  };

  // ✅ Fonction pour préparer la liste des produits pour le sélecteur
  const prepareProductsForSelector = useCallback((): Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }> => {
    const productsList: Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }> = [];

    services.forEach((product: Service) => {
      const serviceId = product.service_id || product.data?.serviceId || (typeof product.id === 'string' && product.id.includes('_') ? parseInt(product.id.split('_')[0], 10) : parseInt(String(product.id), 10));
      const productIndex = product.product_index ?? product.data?.product_index ?? 0;
      // ✅ CORRECTION: Utiliser extractProductName et extractServiceName pour une extraction correcte
      const productName = extractProductName(product, 'Produit sans nom');
      const serviceName = extractServiceName(product, 'Service sans titre');

      if (serviceId && !isNaN(serviceId)) {
        productsList.push({
          serviceId: typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId,
          productIndex: typeof productIndex === 'number' ? productIndex : parseInt(String(productIndex), 10),
          productName: String(productName),
          serviceName: String(serviceName)
        });
      }
    });

    return productsList;
  }, [services]);

  const handleCreateVideo = (productItem: any) => {
    // ✅ CORRECTION: productItem est en fait un produit (car services contient les produits)
    // Il faut regrouper tous les produits du même service_id
    const serviceId = productItem.service_id || productItem.data?.serviceId || productItem.id?.split('_')[0];

    logger.log('[MesServicesScreen] handleCreateVideo - Service ID:', serviceId, 'Produit:', productItem.id);

    // ✅ CORRECTION: S'assurer que services est un tableau avant filter
    if (!Array.isArray(services)) {
      Alert.alert('Erreur', 'Impossible de créer une vidéo : données de services invalides');
      return;
    }

    // Regrouper tous les produits du même service
    const produitsDuService = services.filter((s: Service) => {
      if (!s) return false; // ✅ PROTECTION: Ignorer les services null/undefined
      const sServiceId = s.service_id || s.data?.serviceId || (typeof s.id === 'string' && s.id.includes('_') ? s.id.split('_')[0] : s.id);
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

    // ✅ CORRECTION: S'assurer que produitsDuService est un tableau avant map
    if (!Array.isArray(produitsDuService) || produitsDuService.length === 0) {
      Alert.alert('Erreur', 'Aucun produit trouvé pour ce service');
      return;
    }

    // Convertir les produits en ManagedProduct pour le modal
    const managedProducts: ManagedProduct[] = produitsDuService.filter((p: any) => p != null).map((product: any) => ({
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
        productName: extractProductName(product, 'Produit')
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
  // ✅ CORRECTION: S'assurer que services est un tableau et filtrer uniquement les services valides
  const filteredServices = Array.isArray(services)
    ? services.filter((service) => {
      // ✅ PROTECTION: Ignorer les services null/undefined
      if (!service) return false;

      if (filter === 'tous') return true;
      if (filter === 'actif') return service.status === 'active';
      if (filter === 'inactif') return service.status === 'inactive';
      return true;
    })
    : [];

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

              {/* ✅ BOUTON GALERIE PRODUITS - Maintenant visible */}
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowProductGallery(true)}
                accessibilityLabel="Galerie Médias Produits"
              >
                <SafeIcon name="image" size={20} color="#fff" />
              </TouchableOpacity>

              {/* ✅ Menu global avec actions (contient les autres options) */}
              <TouchableOpacity
                style={[styles.headerButton, styles.menuButton]}
                onPress={() => setShowGlobalMenu(!showGlobalMenu)}
              >
                <SafeIcon name="more-vertical" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ✅ Menu global déroulant */}
        {showGlobalMenu && (
          <View style={styles.globalMenu}>
            {/* ✅ NOUVEAU: Galerie Médias Produits - Déplacé ici pour être visible */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                setShowProductGallery(true);
              }}
            >
              <SafeIcon name="image" size={18} color="#10B981" />
              <Text style={styles.menuItemText}>Galerie Médias</Text>
            </TouchableOpacity>

            {/* ✅ NOUVEAU: Configuration de livraison globale */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                // ✅ Préparer la liste des produits et ouvrir le sélecteur
                const productsList = prepareProductsForSelector();
                if (productsList.length === 0) {
                  Alert.alert('Aucun produit', 'Vous devez d\'abord créer des produits avant de configurer la livraison.');
                  return;
                }
                setProductsForSelection(productsList);
                setProductSelectorMode('delivery');
                setShowProductSelector(true);
              }}
            >
              <SafeIcon name="truck" size={18} color="#10B981" />
              <Text style={styles.menuItemText}>Configuration livraison</Text>
            </TouchableOpacity>

            {/* ✅ Bouton Membres existant - amélioré pour sélection produits/services */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                // ✅ Préparer la liste des produits et ouvrir le sélecteur
                const productsList = prepareProductsForSelector();
                if (productsList.length === 0) {
                  Alert.alert('Aucun produit', 'Vous devez d\'abord créer des produits avant de gérer l\'équipe.');
                  return;
                }
                setProductsForSelection(productsList);
                setProductSelectorMode('team');
                setShowProductSelector(true);
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

            {/* ✅ NOUVEAU: Mes Vidéos */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                try {
                  const parent = (navigation as any).getParent();
                  if (parent) {
                    parent.navigate('VideoFeed');
                  } else {
                    (navigation as any).navigate('VideoFeed');
                  }
                } catch (error) {
                  logger.error('Erreur navigation vers VideoFeed:', error);
                  Alert.alert('Erreur', 'Impossible d\'ouvrir Mes Vidéos');
                }
              }}
            >
              <SafeIcon name="video" size={18} color="#EC4899" />
              <Text style={styles.menuItemText}>Mes Vidéos</Text>
            </TouchableOpacity>

            {/* ✅ NOUVEAU: Participation Black Friday */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                (navigation as any).navigate('GlobalPromoSubmission');
              }}
            >
              <SafeIcon name="dollar-sign" size={18} color="#F59E0B" />
              <Text style={styles.menuItemText}>Black Friday</Text>
            </TouchableOpacity>

            {/* ✅ NOUVEAU: Analytiques Vidéos */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                try {
                  const parent = (navigation as any).getParent();
                  if (parent) {
                    parent.navigate('VideoAnalytics');
                  } else {
                    (navigation as any).navigate('VideoAnalytics');
                  }
                } catch (error) {
                  logger.error('Erreur navigation vers VideoAnalytics:', error);
                  Alert.alert('Erreur', 'Impossible d\'ouvrir Analytiques Vidéos');
                }
              }}
            >
              <SafeIcon name="bar-chart" size={18} color="#8B5CF6" />
              <Text style={styles.menuItemText}>Analytiques Vidéos</Text>
            </TouchableOpacity>

            {/* ✅ Bouton Paramètres */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowGlobalMenu(false);
                (navigation as any).navigate('Settings');
              }}
            >
              <SafeIcon name="settings" size={18} color="#6B7280" />
              <Text style={styles.menuItemText}>Paramètres</Text>
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
              {String(Array.isArray(services) ? services.filter(s => s && s.status === 'active').length : 0)}
            </Text>
            <Text style={styles.statLabel}>Actifs</Text>
          </NativeCard>

          <NativeCard style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#F97316' }]}>
              {String(Array.isArray(services) ? services.filter(s => s && s.status === 'inactive').length : 0)}
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
              Actifs ({Array.isArray(services) ? services.filter(s => s && s.status === 'active').length : 0})
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
              Inactifs ({Array.isArray(services) ? services.filter(s => s && s.status === 'inactive').length : 0})
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
            {Array.isArray(filteredServices) && filteredServices.length > 0 ? filteredServices.filter(service => service != null).map((service) => (
              <ServiceCardModern
                key={service?.id || `service-${Math.random()}`}
                service={service}
                onEdit={handleEditService}
                onView={handleViewService}
                onShare={handleShareService}
                onToggleStatus={handleToggleServiceStatus}
                onDelete={handleDeleteService}
                onPromotion={handlePromotionService}
                onViewProducts={() => navigation.navigate('MesProduits' as never)}
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
            serviceId={selectedService ? (selectedService.id?.toString() || selectedService.service_id?.toString() || undefined) : undefined}
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

      {/* ✅ Sélecteur de produit - Mode multiple pour livraison/équipe ou unique pour vidéo */}
      <ServiceProductSelector
        visible={showProductSelector}
        products={productsForSelection}
        allowMultiple={productSelectorMode !== null} // ✅ Mode multiple pour livraison/équipe
        onSelect={(product) => {
          // ✅ Mode unique (vidéo)
          if (!productSelectorMode) {
            navigateToVideoWizard(navigation, product);
          }
          setShowProductSelector(false);
          setProductsForSelection([]);
          setProductSelectorMode(null);
        }}
        onSelectMultiple={(selectedProducts) => {
          // ✅ Mode multiple (livraison ou équipe)
          if (productSelectorMode === 'delivery') {
            // ✅ Stocker les produits sélectionnés complets et ouvrir le modal de configuration livraison
            setSelectedProductsForDelivery(selectedProducts);
            setShowGlobalDeliveryConfig(true);
          } else if (productSelectorMode === 'team') {
            // ✅ CORRECTION: Vérifier que selectedProducts est un tableau valide
            if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
              Alert.alert('Erreur', 'Aucun produit sélectionné');
              setShowProductSelector(false);
              setProductSelectorMode(null);
              return;
            }
            // Extraire les serviceIds uniques et ouvrir le gestionnaire d'équipe
            const validProducts = selectedProducts.filter(p => p && p.serviceId != null);
            const uniqueServiceIds = [...new Set(validProducts.map(p => String(p.serviceId || '')))].filter(id => id);
            if (uniqueServiceIds.length === 1) {
              // Un seul service : ouvrir avec ce serviceId
              setSelectedService({ id: uniqueServiceIds[0], service_id: uniqueServiceIds[0] } as Service);
            } else {
              // Plusieurs services : ouvrir en mode global (tous services)
              setSelectedService(null);
            }
            setShowTeamManager(true);
          }
          setShowProductSelector(false);
          setProductsForSelection([]);
          setProductSelectorMode(null);
        }}
        onClose={() => {
          setShowProductSelector(false);
          setProductsForSelection([]);
          setProductSelectorMode(null);
        }}
      />

      {/* ✅ NOUVEAU: Modal de configuration de livraison globale */}
      <GlobalDeliveryConfigModal
        visible={showGlobalDeliveryConfig}
        selectedProducts={selectedProductsForDelivery}
        onClose={() => {
          setShowGlobalDeliveryConfig(false);
          setSelectedProductsForDelivery([]);
        }}
        onSuccess={() => {
          setShowGlobalDeliveryConfig(false);
          setSelectedProductsForDelivery([]);
          loadServices(true); // Recharger les produits après configuration
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

      {/* ✅ NOUVEAU : Modal de galerie produits */}
      <ProductGalleryModal
        visible={showProductGallery}
        services={services}
        onClose={() => setShowProductGallery(false)}
      />
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
    flexWrap: 'wrap', // ✅ AJOUTÉ: Permet le retour à la ligne si nécessaire
    gap: 8, // ✅ AJOUTÉ: Espacement entre les éléments
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
    gap: 8, // ✅ RÉDUIT: 12 → 8 pour économiser l'espace
    flexWrap: 'wrap', // ✅ AJOUTÉ: Permet le retour à la ligne si nécessaire
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10, // ✅ RÉDUIT: 12 → 10 pour économiser l'espace
    paddingVertical: 8,
    borderRadius: modernStyles.borderRadius.medium,
    gap: 4, // ✅ RÉDUIT: 6 → 4
    minWidth: 40, // ✅ AJOUTÉ: Largeur minimale pour garantir la visibilité
    minHeight: 40, // ✅ AJOUTÉ: Hauteur minimale pour garantir la visibilité
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




