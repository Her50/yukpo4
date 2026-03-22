// @ts-nocheck
// Version basée sur le commit 462f361 (il y a 8-10 jours) - stable mais avec corrections de crash
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, Dimensions, Modal, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BreadcrumbItem, Breadcrumbs } from '../components/Breadcrumbs';
import { BulkActionsBar } from '../components/BulkActionsBar';
import GlobalDeliveryConfigModal from '../components/delivery/GlobalDeliveryConfigModal';
import { ErrorBoundaryWithRetry } from '../components/ErrorBoundaryWithRetry';
import ProductGalleryModal from '../components/ProductGalleryModal';
import ProductVideoCreationModal from '../components/ProductVideoCreationModal';
import SafeIcon from '../components/SafeIcon';
import { NativeButton } from '../components/SafeNativeDesign';
import { SafeNativeView } from '../components/SafeNativeView';
import ServiceCardModern from '../components/ServiceCardModern';
import ServiceProductSelector from '../components/ServiceProductSelector';
import ServiceTeamManager from '../components/ServiceTeamManager';
import { SidebarNavigation } from '../components/SidebarNavigation';
import { SkeletonCard, SkeletonStats } from '../components/SkeletonLoader';
import { StatsCard } from '../components/StatsCard';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useDeviceType } from '../hooks/useDeviceType';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { productsService } from '../services/productsService';
import { modernColors } from '../theme/modernTheme';
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
  console.log('[MesServicesScreen] 🚀 Démarrage version 462f361 corrigée');
  
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const deviceType = useDeviceType();
  const { isLandscape } = useDeviceOrientation();
  
  // ✅ CORRECTION: Utiliser Alert au lieu de toaster pour éviter les crashes
  const toaster = {
    error: (message: string) => Alert.alert('Erreur', message),
    success: (message: string) => Alert.alert('Succès', message),
    info: (message: string) => Alert.alert('Info', message),
    warning: (message: string) => Alert.alert('Attention', message),
  };
  
  // ✅ CORRECTION: Utiliser fallback simple pour éviter les crashes de i18n
  const t = (key: string, params?: Record<string, string | number>) => {
    // Fallback simple - retourne la clé ou une valeur par défaut
    const fallbacks: Record<string, string> = {
      'mesServices.insufficientBalance': 'Solde insuffisant',
      'mesServices.reactivationCost': 'Coût de réactivation: {{cost}} FCFA\nVotre solde: {{balance}} FCFA',
      'mesServices.votreSolde': 'Votre solde: {{balance}} FCFA',
      'mesServices.veuillezRecharger': 'Veuillez recharger votre compte',
      'mesServices.deleteTitle': 'Supprimer le service',
      'mesServices.deleteConfirm': 'Êtes-vous sûr de vouloir supprimer "{{title}}" ?\nCette action est irréversible.',
      'mesServices.productRequired': 'Produit requis',
      'mesServices.noProductForVideo': 'Aucun produit disponible pour la vidéo',
      'mesServices.promotionTitle': 'Promotion du service',
      'mesServices.promotionQuestion': 'Créer une promotion pour "{{title}}" ?',
      'message.error': 'Erreur',
      'mesServices.cannotOpenFlashPromo': 'Impossible d\'ouvrir la création de flash promotion',
      'mesServices.cannotOpenPromotion': 'Impossible d\'ouvrir la gestion des promotions',
    };
    
    let result = fallbacks[key] || key;
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        result = result.replace(`{{${param}}}`, String(value));
      });
    }
    return result;
  };
  
  console.log('[MesServicesScreen] ✅ Hooks initialisés avec fallbacks');
  
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');
  const [optimisticStates, setOptimisticStates] = useState<Map<string, any>>(new Map());
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productSelectorMode, setProductSelectorMode] = useState<'team' | 'delivery' | 'flash-promo' | null>(null);
  const [productsForSelection, setProductsForSelection] = useState<Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }>>([]);
  const [showGlobalMenu, setShowGlobalMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showGlobalDeliveryConfig, setShowGlobalDeliveryConfig] = useState(false);
  const [selectedProductsForDelivery, setSelectedProductsForDelivery] = useState<Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }>>([]);
  const [showVideoCreationModal, setShowVideoCreationModal] = useState(false);
  const [productsForVideoCreation, setProductsForVideoCreation] = useState<ManagedProduct[]>([]);
  const [selectedServiceForVideo, setSelectedServiceForVideo] = useState<Service | null>(null);
  const [rawServices, setRawServices] = useState<any[]>([]);
  const [showProductGallery, setShowProductGallery] = useState(false);

  const parseProduct = useCallback((product: any, index: number, service: any, serviceId: string, serviceTitre: string): Service | null => {
    try {
      let productTitle = '';
      let productDescription = '';

      if (typeof product === 'string' && product.trim()) {
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

  const extractProduits = useCallback((service: any): any[] => {
    const serviceData = service.data || service;

    if (serviceData?.produits?.valeur) {
      const valeur = serviceData.produits.valeur;
      if (Array.isArray(valeur) && valeur.length > 0) {
        const filtered = valeur.filter((v: any) => v !== null && v !== undefined && v !== '');
        if (filtered.length > 0) {
          logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits.valeur:', filtered.length);
          return filtered;
        }
      }
    }

    if (Array.isArray(serviceData?.produits) && serviceData.produits.length > 0) {
      logger.log('[MesServicesScreen] ✅ Produits trouvés dans produits (array):', serviceData.produits.length);
      return serviceData.produits;
    }

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

    if (Array.isArray(service.produits) && service.produits.length > 0) {
      logger.log('[MesServicesScreen] ✅ Produits trouvés dans service.produits:', service.produits.length);
      return service.produits;
    }

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
    console.log('[MesServicesScreen] 🔍 Début chargement services version 462f361');
    
    if (!user) {
      console.warn('[MesServicesScreen] ⚠️ Utilisateur non connecté');
      Alert.alert('Erreur', 'Veuillez vous reconnecter');
      navigation.navigate('Login');
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      if (!isRefresh) {
        const cached = await CacheManager.get<Service[]>(cacheKey, 5 * 60 * 1000);
        if (cached) {
          logger.log('[MesServicesScreen] ✅ Données chargées depuis le cache');
          setServices(cached);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const response = await apiGet('/api/prestataire/services');

      logger.log('[MesServicesScreen] 🔍 Réponse API:', {
        ok: response.ok,
        status: response.status,
        success: response.success
      });

      if (response.success) {
        let data = response.data;

        if (!Array.isArray(data)) {
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

        const servicesArray = Array.isArray(data) ? data : [];
        setRawServices(servicesArray);

        const allProducts: Service[] = [];

        if (Array.isArray(data)) {
          const productPromises = data.map(async (service: any) => {
            const serviceId = service.id;
            const serviceTitre = service.data?.titre_service?.valeur ||
              service.data?.titre?.valeur ||
              service.titre ||
              'Service sans titre';

            try {
              const products = await productsService.getProductsByService(serviceId);

              return products.map((product, index) => {
                const parsed = parseProduct(product.product_data, product.product_index, service, serviceId.toString(), serviceTitre);
                if (parsed) {
                  parsed.product_id = product.id;
                  parsed.product_name = product.product_name;
                  parsed.product_type = product.product_type;
                  parsed.product_price = product.product_price;
                }
                return parsed;
              }).filter((p): p is Service => p !== null);
            } catch (error) {
              logger.warn('[MesServicesScreen] ⚠️ Erreur récupération produits depuis API, fallback extractProduits:', error);
              const produits = extractProduits(service);
              if (produits && produits.length > 0) {
                return produits.map((product: any, index: number) => {
                  const parsed = parseProduct(product, index, service, serviceId.toString(), serviceTitre);
                  return parsed;
                }).filter((p): p is Service => p !== null);
              }
              return [];
            }
          });

          const productsArrays = await Promise.all(productPromises);
          productsArrays.forEach(products => {
            products.forEach(product => {
              if (product) {
                allProducts.push(product);
              }
            });
          });
        }

        allProducts.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        logger.log('[MesServicesScreen] ✅ Produits extraits:', allProducts.length);

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
  }, [user, navigation, parseProduct, extractProduits]);

  useEffect(() => {
    console.log('[MesServicesScreen] 🚀 Montage version 462f361');
    loadServices().catch(error => {
      console.error('[MesServicesScreen] Erreur loadServices:', error);
    });
    return undefined;
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadServices(true);
    }, [])
  );

  useEffect(() => {
    if (!DeviceEventEmitter || typeof DeviceEventEmitter.addListener !== 'function') {
      console.warn('[MesServicesScreen] DeviceEventEmitter.addListener non disponible');
      return undefined;
    }

    const subscription1 = DeviceEventEmitter.addListener('service:refresh', () => {
      logger.log('[MesServicesScreen] 🔄 Événement service:refresh reçu');
      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      CacheManager.remove(cacheKey);
      if (typeof loadServices === 'function') {
        loadServices(true);
      }
    });

    const subscription2 = DeviceEventEmitter.addListener('product:created', () => {
      logger.log('[MesServicesScreen] 🔄 Événement product:created reçu');
      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      CacheManager.remove(cacheKey);
      if (typeof loadServices === 'function') {
        loadServices(true);
      }
    });

    const subscription3 = DeviceEventEmitter.addListener('product:updated', () => {
      logger.log('[MesServicesScreen] 🔄 Événement product:updated reçu');
      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      CacheManager.remove(cacheKey);
      if (typeof loadServices === 'function') {
        loadServices(true);
      }
    });

    return () => {
      if (subscription1 && typeof subscription1.remove === 'function') {
        subscription1.remove();
      }
      if (subscription2 && typeof subscription2.remove === 'function') {
        subscription2.remove();
      }
      if (subscription3 && typeof subscription3.remove === 'function') {
        subscription3.remove();
      }
    };
  }, []); // ✅ CORRECTION : Pas de dépendances cycliques

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

  const handleAddProduct = useCallback(async (serviceId?: number | string) => {
    try {
      if (serviceId) {
        logger.log('[MesServicesScreen] handleAddProduct - ServiceId fourni:', serviceId);
        (navigation as any).navigate('AjouterProduitSimple', {
          serviceId: typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId,
          mode: 'create'
        });
        return;
      }

      if ((!rawServices || rawServices.length === 0) && !loading) {
        logger.log('[MesServicesScreen] handleAddProduct - rawServices vide, rechargement...');
        await loadServices(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      let foundServiceId: number | undefined;

      if (rawServices && rawServices.length > 0) {
        const activeService = rawServices.find((s: any) => s.is_active !== false && s.actif !== false) || rawServices[0];

        if (activeService && activeService.id) {
          foundServiceId = typeof activeService.id === 'string' ? parseInt(activeService.id, 10) : activeService.id;
          logger.log('[MesServicesScreen] handleAddProduct - Service existant trouvé (rawServices):', foundServiceId);
        }
      }

      if (!foundServiceId && services && services.length > 0) {
        const firstProduct = services[0];
        const serviceId = firstProduct.service_id || firstProduct.data?.serviceId || firstProduct.id?.split('_')[0];

        if (serviceId) {
          foundServiceId = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;
          logger.log('[MesServicesScreen] handleAddProduct - Service existant trouvé (services parsés):', foundServiceId);
        }
      }

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

      if (foundServiceId) {
        logger.log('[MesServicesScreen] handleAddProduct - Navigation vers AjouterProduitSimple avec serviceId:', foundServiceId);
        (navigation as any).navigate('AjouterProduitSimple', {
          serviceId: foundServiceId,
          mode: 'create'
        });
        return;
      }

      logger.log('[MesServicesScreen] handleAddProduct - Aucun service trouvé, création nouveau service');
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'create',
        focusProduct: true
      });
    } catch (error) {
      logger.error('[MesServicesScreen] Erreur handleAddProduct:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir le formulaire d\'ajout de produit');
    }
  }, [rawServices, services, navigation, loading]); // ✅ CORRECTION : Pas de loadServices

  // Fonctions de gestion des services
  const handleEditService = (service: any) => {
    try {
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
        fromMesServices: true
      });
    } catch (error) {
      logger.error('Erreur navigation modification:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la modification du service');
    }
  };

  const handleViewService = (service: any) => {
    try {
      (navigation as any).navigate('FormulaireYukpoIntelligent', {
        mode: 'view',
        serviceId: service.id,
        serviceData: service.data,
        suggestion: {
          data: service.data || {},
          intention: service.intention || 'creation_service',
          confidence: service.confidence || 0.8
        },
        type: 'visualisation_service',
        readonly: true,
        fromMesServices: true
      });
    } catch (error) {
      logger.error('Erreur navigation visualisation:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la visualisation du service');
    }
  };

  const handleShareService = async (service: any) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }
    try {
      const titre = service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.title || 'Service Yukpo';
      const description = service.data?.description?.valeur || service.description || 'Découvrez ce service sur Yukpo';
      const prix = service.data?.prix?.valeur || service.prix;
      const localisation = service.data?.localisation?.valeur || service.localisation;

      const serviceUrl = `https://yukpo-backend-376093909298.europe-west1.run.app/service/${service.id}`;

      let shareText = `🛍️ ${titre}\n\n${description}`;

      if (prix) {
        shareText += `\n💰 Prix: ${prix} FCFA`;
      }

      if (localisation) {
        shareText += `\n📍 Localisation: ${localisation}`;
      }

      shareText += `\n\n🔗 Voir ce service sur Yukpo :\n📱 ${serviceUrl}`;

      const result = await Share.share({
        message: shareText,
        title: titre,
        url: serviceUrl
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
      const currentStatus = service.status === 'active';
      const newStatus = !currentStatus;

      const previousState = { ...service };
      setOptimisticStates(prev => new Map(prev).set(service.id, previousState));

      setServices(prevServices =>
        prevServices.map(s =>
          s.id === service.id
            ? { ...s, status: newStatus ? 'active' : 'inactive' }
            : s
        )
      );

      if (!currentStatus) {
        const balanceResponse = await apiGet('/api/users/balance');
        const balanceData = (balanceResponse?.data || balanceResponse) as any;

        if (balanceResponse.success) {
          const currentBalance = balanceData?.tokens_balance || 0;
          const activationCost = 1000;

          if (currentBalance < activationCost) {
            setServices(prevServices =>
              prevServices.map(s =>
                s.id === service.id ? previousState : s
              )
            );
            setOptimisticStates(prev => {
              const newMap = new Map(prev);
              newMap.delete(service.id);
              return newMap;
            });

            Alert.alert(
              t('mesServices.insufficientBalance'),
              `${t('mesServices.reactivationCost', { cost: activationCost.toLocaleString(), balance: currentBalance.toLocaleString() })}\n${t('mesServices.veuillezRecharger')}`,
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
            const newBalance = currentBalance - activationCost;
            Alert.alert('Succès', `Service réactivé ! Coût: ${activationCost} FCFA (Solde: ${newBalance} FCFA)`);
            loadServices(true);
          } else {
            setServices(prevServices =>
              prevServices.map(s =>
                s.id === service.id ? previousState : s
              )
            );
            setOptimisticStates(prev => {
              const newMap = new Map(prev);
              newMap.delete(service.id);
              return newMap;
            });
            Alert.alert('Erreur', 'Erreur lors de la réactivation');
          }
        }
      }
    } catch (error) {
      logger.error('Erreur toggle status:', error);
      Alert.alert('Erreur', 'Impossible de changer le statut du service');
    }
  };

  const handleDeleteService = async (service: any) => {
    Alert.alert(
      t('mesServices.deleteTitle'),
      t('mesServices.deleteConfirm', { title: service.title }),
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
              logger.error('Erreur suppression service:', error);
              Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression');
            }
          }
        }
      ]
    );
  };

  const filteredServices = useMemo(() => {
    if (filter === 'tous') return services;
    return services.filter(service => service.status === filter);
  }, [services, filter]);

  console.log('[MesServicesScreen] 🎨 Rendu version 462f361 - Loading:', loading, 'Services:', services.length);

  if (loading) {
    return (
      <SafeNativeView style={styles.container}>
        <View style={styles.center}>
          <Text>Chargement de vos services...</Text>
        </View>
      </SafeNativeView>
    );
  }

  return (
    <SafeNativeView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Services</Text>
        <Text style={styles.subtitle}>{filteredServices.length} service(s)</Text>
      </View>

      <View style={styles.filterContainer}>
        {(['tous', 'actif', 'inactif'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filter === status && styles.filterButtonActive
            ]}
            onPress={() => setFilter(status)}
          >
            <Text style={[
              styles.filterButtonText,
              filter === status && styles.filterButtonTextActive
            ]}>
              {status === 'tous' ? 'Tous' : status === 'actif' ? 'Actifs' : 'Inactifs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredServices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {filter === 'tous' ? 'Aucun service trouvé' : `Aucun service ${filter}`}
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddProduct()}
            >
              <Text style={styles.addButtonText}>Ajouter un service</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredServices.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(service.status) }
                ]}>
                  <Text style={styles.statusText}>{getStatusText(service.status)}</Text>
                </View>
              </View>
              
              <Text style={styles.serviceDescription}>{service.description}</Text>
              
              <View style={styles.serviceActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleViewService(service)}
                >
                  <Text style={styles.actionButtonText}>Voir</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEditService(service)}
                >
                  <Text style={styles.actionButtonText}>Modifier</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleShareService(service)}
                >
                  <Text style={styles.actionButtonText}>Partager</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    service.status === 'active' ? styles.deactivateButton : styles.activateButton
                  ]}
                  onPress={() => handleToggleServiceStatus(service)}
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

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => handleAddProduct()}
      >
        <Text style={styles.floatingButtonText}>+</Text>
      </TouchableOpacity>
    </SafeNativeView>
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
  filterContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
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
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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

console.log('[MesServicesScreen] ✅ Version 462f361 corrigée chargée avec succès');

export default MesServicesScreen;
