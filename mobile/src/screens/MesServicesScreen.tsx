// @ts-nocheck
// Design moderne inspiré du frontend - Version améliorée UX niveau géant
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
import { SkeletonLoader } from '../components/SkeletonLoader';
import { StatsCard } from '../components/StatsCard';
import { useToaster } from '../components/ToasterProvider';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
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
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguageSafe();
  const { colors } = useTheme(); // ✅ NOUVEAU: Support thème
  const toaster = useToaster(); // ✅ NOUVEAU: Toast notifications au lieu de Alert
  const deviceType = useDeviceType(); // ✅ NOUVEAU: Responsive design
  const { isLandscape } = useDeviceOrientation(); // ✅ NOUVEAU: Orientation
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');
  // ✅ NOUVEAU: Optimistic updates - stocker l'état original pour rollback
  const [optimisticStates, setOptimisticStates] = useState<Map<string, any>>(new Map());
  // ✅ États pour gestion d'équipe globale (depuis menu)
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productSelectorMode, setProductSelectorMode] = useState<'team' | 'delivery' | 'flash-promo' | null>(null); // Mode du sélecteur
  const [productsForSelection, setProductsForSelection] = useState<Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }>>([]);
  // ✅ État pour le menu global (remplacé par Sidebar)
  const [showGlobalMenu, setShowGlobalMenu] = useState(false);
  // ✅ NOUVEAU: Sidebar navigation
  const [showSidebar, setShowSidebar] = useState(false);
  // ✅ NOUVEAU: Bulk Actions - sélection multiple
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
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
            productDescription = parts[2] || t('mesServices.noDescription');
          } else {
            productDescription = parts[1] || t('mesServices.noDescription');
          }
        } else if (parts.length === 2) {
          productDescription = parts[1] || t('mesServices.noDescription');
        } else {
          productDescription = t('mesServices.noDescription');
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
          t('mesServices.noDescription');
      } else {
        productTitle = `Produit ${index + 1}`;
        productDescription = t('mesServices.noDescription');
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

        // ✅ PHASE 4: On extrait et affiche les PRODUITS depuis l'API service_products
        // Chaque produit est récupéré depuis la table service_products
        const allProducts: Service[] = []; // Note: Type Service mais contient des produits

        if (Array.isArray(data)) {
          // ✅ PHASE 4: Récupérer les produits depuis l'API pour chaque service
          const productPromises = data.map(async (service: any) => {
            const serviceId = service.id;
            const serviceTitre = service.data?.titre_service?.valeur ||
              service.data?.titre?.valeur ||
              service.titre ||
              'Service sans titre';

            try {
              // ✅ PHASE 4: Récupérer les produits depuis l'API
              const products = await productsService.getProductsByService(serviceId);

              return products.map((product, index) => {
                // ✅ Parser chaque produit depuis l'API
                const parsed = parseProduct(product.product_data, product.product_index, service, serviceId.toString(), serviceTitre);
                if (parsed) {
                  // ✅ Ajouter les métadonnées de service_products
                  parsed.product_id = product.id;
                  parsed.product_name = product.product_name;
                  parsed.product_type = product.product_type;
                  parsed.product_price = product.product_price;
                }
                return parsed;
              }).filter((p): p is Service => p !== null);
            } catch (error) {
              logger.warn('[MesServicesScreen] ⚠️ Erreur récupération produits depuis API, fallback extractProduits:', error);
              // ✅ FALLBACK: Utiliser extractProduits si l'API échoue (compatibilité)
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

          // ✅ Attendre tous les appels API en parallèle
          const productsArrays = await Promise.all(productPromises);
          productsArrays.forEach(products => {
            products.forEach(product => {
              if (product) {
                allProducts.push(product);
              }
            });
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
      toaster.error('Impossible de charger vos produits');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, parseProduct, extractProduits]);

  useEffect(() => {
    // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
    loadServices().catch(error => {
      console.error('[MesServicesScreen] Erreur loadServices:', error);
    });
    // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
    return undefined;
  }, [loadServices]);

  useFocusEffect(
    useCallback(() => {
      loadServices(true);
    }, [loadServices])
  );

  useEffect(() => {
    // ✅ SÉCURITÉ: Vérifier que DeviceEventEmitter existe
    if (!DeviceEventEmitter || typeof DeviceEventEmitter.addListener !== 'function') {
      console.warn('[MesServicesScreen] DeviceEventEmitter.addListener non disponible');
      return undefined; // ✅ CRITIQUE: Retourner explicitement undefined
    }

    // Écouter les événements de création/modification de service/produit
    const subscription1 = DeviceEventEmitter.addListener('service:refresh', () => {
      logger.log('[MesServicesScreen] 🔄 Événement service:refresh reçu');
      // ✅ OPTIMISATION: Invalider le cache avant de recharger
      const cacheKey = createCacheKey('mes_services', user?.id || 'anonymous');
      CacheManager.remove(cacheKey);
      if (typeof loadServices === 'function') {
        loadServices(true);
      }
    });

    // ✅ NOUVEAU: Écouter les événements de création de produit
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
      // ✅ SÉCURITÉ: Vérifier que les subscriptions existent avant de les nettoyer
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
      case 'active': return t('mesServices.statusActive');
      case 'inactive': return t('mesServices.statusInactive');
      case 'pending': return t('mesServices.statusPending');
      default: return t('mesServices.statusUnknown');
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
      toaster.error(t('mesServices.cannotOpenForm'));
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
      toaster.error(t('mesServices.cannotOpenEdit'));
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
      toaster.error(t('mesServices.cannotOpenView'));
    }
  };

  const handleShareService = async (service: any) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) { }
    try {
      // Implémentation du partage avec deep linking
      const titre = service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.title || 'Service Yukpo';
      const description = service.data?.description?.valeur || service.description || 'Découvrez ce service sur Yukpo';
      const prix = service.data?.prix?.valeur || service.prix;
      const localisation = service.data?.localisation?.valeur || service.localisation;

      // ✅ CORRIGÉ: Utiliser l'URL du backend Cloud Run qui sert la route /service/:id
      const serviceUrl = `https://yukpo-backend-376093909298.europe-west1.run.app/service/${service.id}`;

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
        toaster.success(t('mesServices.serviceShared'));
      }
    } catch (error) {
      logger.error('Erreur lors du partage:', error);
      toaster.error(t('mesServices.cannotShare'));
    }
  };

  const handleToggleServiceStatus = async (service: any) => {
    try {
      const currentStatus = service.status === 'active';
      const newStatus = !currentStatus;

      // ✅ OPTIMISTIC UPDATE: Mettre à jour l'UI immédiatement
      const previousState = { ...service };
      setOptimisticStates(prev => new Map(prev).set(service.id, previousState));

      setServices(prevServices =>
        prevServices.map(s =>
          s.id === service.id
            ? { ...s, status: newStatus ? 'active' : 'inactive' }
            : s
        )
      );

      // Si on réactive un service (passage de inactif à actif), facturer 1000 FCFA
      if (!currentStatus) {
        // ✅ CORRIGÉ: Vérifier le solde avec apiGet
        const balanceResponse = await apiGet('/api/users/balance');
        const balanceData = (balanceResponse?.data || balanceResponse) as any;

        if (balanceResponse.success) {
          const currentBalance = balanceData?.tokens_balance || 0;
          const activationCost = 1000; // 1000 FCFA pour réactivation

          if (currentBalance < activationCost) {
            // ✅ ROLLBACK optimistic update
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
              `💸 ${t('mesServices.insufficientBalance')}`,
              t('mesServices.reactivationCost', { cost: activationCost.toLocaleString(), balance: currentBalance.toLocaleString() }),
              [
                { text: t('mesServices.cancel'), style: 'cancel' },
                { text: t('mesServices.recharge'), onPress: () => (navigation as any).navigate('RechargeTokens') },
              ]
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
            toaster.success(t('mesServices.serviceReactivated', { cost: activationCost, balance: newBalance }));
            loadServices(true);
          } else {
            // Rollback
            setServices(prevServices =>
              prevServices.map(s =>
                s.id === service.id ? previousState : s
              )
            );
            toaster.error(t('mesServices.reactivationError'));
          }
        }
      }

      // ✅ CORRIGÉ: Changer le statut avec apiPatch
      const response = await apiPatch(`/api/services/${service.id}/toggle-status`, {
        actif: newStatus
      });

      if (response.success) {
        setOptimisticStates(prev => {
          const newMap = new Map(prev);
          newMap.delete(service.id);
          return newMap;
        });

        if (currentStatus) {
          toaster.success(t('mesServices.serviceDeactivated'));
        }
        // Rafraîchir la liste des services
        loadServices(true);
      } else {
        // ✅ ROLLBACK en cas d'erreur
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

        logger.error('[MesServicesScreen] Erreur API toggle status:', response.status);
        toaster.error(t('mesServices.cannotChangeStatus'));
      }
    } catch (error: any) {
      // ✅ ROLLBACK en cas d'exception
      const previousState = optimisticStates.get(service.id) || service;
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

      logger.error('[MesServicesScreen] Erreur toggle status:', error);
      toaster.error(error.message || t('mesServices.cannotChangeStatus'));
    }
  };

  const handleDeleteService = async (service: any) => {
    // Confirmation avant suppression comme dans le frontend
    Alert.alert(
      t('mesServices.deleteTitle'),
      t('mesServices.deleteConfirm', { title: service.title }),
      [
        { text: t('mesServices.cancel'), style: 'cancel' },
        {
          text: t('mesServices.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              // ✅ OPTIMISTIC UPDATE: Supprimer de l'UI immédiatement
              const previousState = [...services];
              setServices(prevServices => prevServices.filter(s => s.id !== service.id));

              // ✅ CORRIGÉ: Supprimer avec apiDelete
              const response = await apiDelete(`/api/services/${service.id}/delete`);
              const deleteData = (response?.data || response) as any;

              if (response.success) {
                toaster.success(t('mesServices.serviceDeleted'));
                // Déclencher un rafraîchissement pour mettre à jour l'interface
                loadServices(true);
              } else {
                // ✅ ROLLBACK optimistic update
                setServices(previousState);

                // ✅ NOUVEAU 2025-11-01: Objectif #4 - Blocage suppression si >= 2 produits
                const errorMsg = deleteData?.message || response.error || '';

                if (errorMsg.includes('2 or more products')) {
                  toaster.warning(t('mesServices.deleteBlockedMultiple'));
                } else {
                  throw new Error(errorMsg || 'Erreur lors de la suppression');
                }
              }
            } catch (error: any) {
              // ✅ ROLLBACK en cas d'erreur
              const previousState = optimisticStates.get(service.id);
              if (previousState) {
                setServices(prevServices => [...prevServices, previousState]);
              }

              logger.error('Erreur suppression:', error);
              // ✅ AMÉLIORATION: Message d'erreur plus précis avec Toast
              const message = error.response?.data?.message ||
                error.message ||
                t('mesServices.cannotDelete');
              toaster.error(message);
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
    // ✅ CORRECTION: productItem est un produit qui contient le service_id correct
    // Le service_id doit être extrait de manière fiable du produit
    let serviceId: string | number;

    // ✅ PRIORITÉ 1: Utiliser service_id direct du produit (le plus fiable)
    if (productItem.service_id) {
      serviceId = productItem.service_id;
    }
    // ✅ PRIORITÉ 2: Utiliser data.serviceId si disponible
    else if (productItem.data?.serviceId) {
      serviceId = productItem.data.serviceId;
    }
    // ✅ PRIORITÉ 3: Extraire depuis l'ID au format "serviceId_productIndex"
    else if (productItem.id && typeof productItem.id === 'string' && productItem.id.includes('_')) {
      const parts = productItem.id.split('_');
      if (parts.length >= 2) {
        serviceId = parts[0];
      } else {
        logger.error('[MesServicesScreen] ❌ Format ID produit invalide:', productItem.id);
        toaster.error(t('mesServices.cannotDetermineService'));
        return;
      }
    }
    // ✅ PRIORITÉ 4: Utiliser l'ID directement si c'est un nombre
    else if (productItem.id && !isNaN(Number(productItem.id))) {
      serviceId = productItem.id;
    }
    else {
      logger.error('[MesServicesScreen] ❌ Impossible d\'extraire serviceId du produit:', {
        product_id: productItem.id,
        service_id: productItem.service_id,
        data_serviceId: productItem.data?.serviceId
      });
      toaster.error(t('mesServices.cannotDetermineService'));
      return;
    }

    // ✅ S'assurer que serviceId est un nombre pour la cohérence
    const numericServiceId = Number(serviceId);
    if (!Number.isFinite(numericServiceId) || numericServiceId <= 0) {
      logger.error('[MesServicesScreen] ❌ serviceId invalide:', serviceId);
      toaster.error(t('mesServices.invalidService'));
      return;
    }

    logger.log('[MesServicesScreen] handleCreateVideo - Service ID:', numericServiceId, 'Produit:', productItem.id);

    // ✅ CORRECTION: S'assurer que services est un tableau avant filter
    if (!Array.isArray(services)) {
      toaster.error(t('mesServices.cannotCreateVideo'));
      return;
    }

    // Regrouper tous les produits du même service
    const produitsDuService = services.filter((s: Service) => {
      if (!s) return false; // ✅ PROTECTION: Ignorer les services null/undefined

      // ✅ CORRECTION: Utiliser la même logique robuste pour extraire le serviceId de chaque produit
      let sServiceId: string | number;

      // ✅ PRIORITÉ 1: Utiliser service_id direct du produit
      if (s.service_id) {
        sServiceId = s.service_id;
      }
      // ✅ PRIORITÉ 2: Utiliser data.serviceId si disponible
      else if (s.data?.serviceId) {
        sServiceId = s.data.serviceId;
      }
      // ✅ PRIORITÉ 3: Extraire depuis l'ID au format "serviceId_productIndex"
      else if (s.id && typeof s.id === 'string' && s.id.includes('_')) {
        const parts = s.id.split('_');
        if (parts.length >= 2) {
          sServiceId = parts[0];
        } else {
          return false; // ✅ Ignorer les produits avec un ID invalide
        }
      }
      // ✅ PRIORITÉ 4: Utiliser l'ID directement si c'est un nombre
      else if (s.id && !isNaN(Number(s.id))) {
        sServiceId = s.id;
      }
      else {
        return false; // ✅ Ignorer les produits sans serviceId identifiable
      }

      // ✅ Comparer les serviceId numériques pour la cohérence
      const numericSServiceId = Number(sServiceId);
      return numericSServiceId === numericServiceId;
    });

    logger.log('[MesServicesScreen] handleCreateVideo - Produits du service trouvés:', produitsDuService.length);

    if (produitsDuService.length === 0) {
      // Utiliser Alert pour confirmation avec actions multiples
      Alert.alert(
        t('mesServices.productRequired'),
        t('mesServices.noProductForVideo'),
        [
          { text: t('mesServices.cancel'), style: 'cancel' },
          {
            text: t('mesServices.createAProduct'),
            onPress: () => {
              handleAddProduct(numericServiceId);
            }
          }
        ]
      );
      return;
    }

    // ✅ CORRECTION: S'assurer que produitsDuService est un tableau avant map
    if (!Array.isArray(produitsDuService) || produitsDuService.length === 0) {
      toaster.error(t('mesServices.noProductFound'));
      return;
    }

    // Convertir les produits en ManagedProduct pour le modal
    const managedProducts: ManagedProduct[] = produitsDuService.filter((p: any) => p != null).map((product: any) => ({
      id: product.id || `prod_${product.product_index || 0}`,
      serviceId: numericServiceId.toString(),
      product_index: product.product_index || product.data?.product_index || 0,
      nom: product.nom || product.data?.nom || product.data?.nom_produit || product.nom_produit || product.title || product.data?.title || 'Produit',
      description: product.description || product.data?.description || '',
      prix: product.data?.prix || product.prix || product.price,
      devise: product.data?.devise || product.devise || product.currency || 'XAF',
      type: product.data?.type || product.type || product.categorie || 'produit',
      serviceTitre: product.service_title || product.data?.serviceTitre || product.title || `Service #${numericServiceId}`,
      ...product.data,
      ...product
    }));

    // Si un seul produit → Navigation directe
    if (managedProducts.length === 1) {
      const product = managedProducts[0];
      navigateToVideoWizard(navigation, {
        serviceId: numericServiceId,
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
    toaster.success(t('mesServices.videoCreated'));
  };

  const handlePromotionService = (service: any) => {
    const titre = service.data?.titre_service?.valeur || service.data?.titre?.valeur || service.title || 'Service';

    // Afficher un modal de gestion des promotions comme dans le frontend
    Alert.alert(
      `📢 ${t('mesServices.promotionTitle')}`,
      t('mesServices.promotionQuestion', { title: titre }),
      [
        { text: t('mesServices.cancel'), style: 'cancel' },
        {
          text: `⚡ ${t('mesServices.createFlashPromo')}`,
          onPress: () => {
            try {
              // Navigation vers l'écran de création de flash promotionnel
              (navigation as any).navigate('CreateFlashPromo', {
                serviceId: service.id,
                serviceData: service.data,
                serviceTitle: titre
              });
            } catch (error) {
              logger.error('Erreur navigation flash promo:', error);
              Alert.alert(t('message.error'), t('mesServices.cannotOpenFlashPromo'));
            }
          }
        },
        {
          text: `🎉 ${t('mesServices.createPromotion')}`,
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
              Alert.alert(t('message.error'), t('mesServices.cannotOpenPromotion'));
            }
          }
        },
        {
          text: t('mesServices.editPromotion'),
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
              Alert.alert(t('message.error'), t('mesServices.cannotOpenPromotion'));
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

  // ✅ NOUVEAU: Calculer les statistiques pour les cards visuelles
  const stats = useMemo(() => {
    const totalProducts = services.length;
    const activeProducts = services.filter(s => s && s.status === 'active').length;
    const inactiveProducts = services.filter(s => s && s.status === 'inactive').length;
    const totalViews = services.reduce((sum, s) => sum + (s.views || 0), 0);

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      totalViews,
    };
  }, [services]);

  // ✅ CORRIGÉ: Créer les styles dynamiquement avec le thème AVANT le early return loading
  const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

  if (loading && services.length === 0) {
    return (
      <View style={[dynamicStyles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={modernColors.primaryGradient}
          style={dynamicStyles.header}
        >
          <View style={dynamicStyles.headerContent}>
            <View style={dynamicStyles.headerTitleRow}>
              <View style={dynamicStyles.logoContainer}>
                <SafeIcon name="briefcase" size={18} color="#fff" />
                <View style={dynamicStyles.titleContainer}>
                  <Text style={dynamicStyles.title} numberOfLines={1} ellipsizeMode="tail">{t('mesServices.products')}</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
        <View style={dynamicStyles.scrollView}>
          <SkeletonLoader type="stats" count={4} />
          <SkeletonLoader type="card" count={3} />
        </View>
      </View>
    );
  }

  // ✅ NOUVEAU: Breadcrumbs navigation
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      {
        label: t('mesServices.home'),
        onPress: () => navigation.navigate('Home' as never),
      },
      {
        label: t('mesServices.products'),
      },
    ];
    return items;
  }, [navigation, t]);

  return (
    <ErrorBoundaryWithRetry
      maxRetries={3}
      retryDelay={2000}
      onRetry={() => {
        loadServices(true);
      }}
    >
      <SafeNativeView style={dynamicStyles.container}>
        {/* Header moderne avec gradient */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark || colors.primary]}
          style={dynamicStyles.header}
        >
          <View style={dynamicStyles.headerContent}>
            {/* ✅ CORRECTION: Titre "Produits" sur sa propre ligne, aligné à droite */}
            <View style={dynamicStyles.headerTitleRow}>
              <View style={dynamicStyles.logoContainer}>
                <SafeIcon name="briefcase" size={22} color="#fff" />
                <View style={dynamicStyles.titleContainer}>
                  <Text style={dynamicStyles.title} numberOfLines={1} ellipsizeMode="tail">Produits</Text>
                </View>
              </View>
            </View>
            {/* ✅ AMÉLIORÉ: Boutons d'action sur une ligne séparée, en dessous du titre */}
            <View style={dynamicStyles.headerActions}>
              {/* ✅ NOUVEAU: Bouton création vidéo */}
              <TouchableOpacity
                style={[dynamicStyles.headerButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                onPress={() => {
                  try {
                    (navigation as any).navigate('VideoCreationIntro');
                  } catch (error) {
                    logger.error('[MesServicesScreen] Erreur navigation vers VideoCreationIntro:', error);
                    toaster.error(t('mesServices.cannotCreateVideo'));
                  }
                }}
                accessibilityLabel={t('mesServices.createProduct')}
                accessibilityRole="button"
              >
                <SafeIcon name="plus" size={20} color="#fff" type="lucide" />
              </TouchableOpacity>
              {/* ✅ NOUVEAU: Configuration Flash Promo - Visible directement dans le header */}
              <TouchableOpacity
                style={[dynamicStyles.headerButton, { backgroundColor: 'rgba(245, 158, 11, 0.4)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.6)' }]}
                onPress={() => {
                  const productsList = prepareProductsForSelector();
                  if (productsList.length === 0) {
                    toaster.warning('Vous devez d\'abord créer des produits avant de créer un flash promo.');
                    return;
                  }
                  setProductsForSelection(productsList);
                  setProductSelectorMode('flash-promo');
                  setShowProductSelector(true);
                }}
                accessibilityLabel={t('mesServices.createFlash')}
                accessibilityRole="button"
              >
                <SafeIcon name="zap" size={20} color="#fff" type="lucide" />
              </TouchableOpacity>
              {/* ✅ NOUVEAU: Configuration de livraison dans l'en-tête */}
              <TouchableOpacity
                style={[dynamicStyles.headerButton, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}
                onPress={() => {
                  const productsList = prepareProductsForSelector();
                  if (productsList.length === 0) {
                    toaster.warning(t('mesServices.createProductsFirst'));
                    return;
                  }
                  setProductsForSelection(productsList);
                  setProductSelectorMode('delivery');
                  setShowProductSelector(true);
                }}
                accessibilityLabel="Configuration livraison"
                accessibilityRole="button"
              >
                <SafeIcon name="bike" size={18} color="#fff" />
              </TouchableOpacity>
              {filteredServices.length > 0 && (
                <TouchableOpacity
                  style={[dynamicStyles.headerButton, bulkMode && { backgroundColor: 'rgba(255, 255, 255, 0.4)' }]}
                  onPress={() => {
                    setBulkMode(!bulkMode);
                    if (bulkMode) {
                      setSelectedItems(new Set());
                    }
                  }}
                  accessibilityLabel={bulkMode ? "Désactiver sélection multiple" : "Activer sélection multiple"}
                  accessibilityRole="button"
                >
                  <SafeIcon name={bulkMode ? "check-square" : "square"} size={18} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[dynamicStyles.headerButton, dynamicStyles.menuButton]}
                onPress={() => setShowSidebar(true)}
                accessibilityLabel="Menu navigation"
                accessibilityRole="button"
              >
                <SafeIcon name="menu" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ✅ Menu global déroulant */}
          {showGlobalMenu && (
            <View style={dynamicStyles.globalMenu}>
              {/* ✅ NOUVEAU: Galerie Médias Produits - Déplacé ici pour être visible */}
              <TouchableOpacity
                style={[dynamicStyles.menuItem, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowGlobalMenu(false);
                  setShowProductGallery(true);
                }}
              >
                <SafeIcon name="image" size={18} color={colors.success} />
                <Text style={[dynamicStyles.menuItemText, { color: colors.success }]}>{t('mesServices.mediaGallery')}</Text>
              </TouchableOpacity>

              {/* ✅ Bouton Membres existant - amélioré pour sélection produits/services */}
              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowGlobalMenu(false);
                  // ✅ Préparer la liste des produits et ouvrir le sélecteur
                  const productsList = prepareProductsForSelector();
                  if (productsList.length === 0) {
                    toaster.warning(t('mesServices.createProductsFirstTeam'));
                    return;
                  }
                  setProductsForSelection(productsList);
                  setProductSelectorMode('team');
                  setShowProductSelector(true);
                }}
              >
                <SafeIcon name="users" size={18} color="#6366F1" />
                <Text style={dynamicStyles.menuItemText}>{t('mesServices.members')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowGlobalMenu(false);
                  handleAddProduct();
                }}
              >
                <SafeIcon name="plus-circle" size={18} color="#10B981" />
                <Text style={dynamicStyles.menuItemText}>{t('mesServices.createProduct')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowGlobalMenu(false);
                  (navigation as any).navigate('AnalyticsDashboard');
                }}
              >
                <SafeIcon name="tablet" size={18} color="#3B82F6" />
                <Text style={dynamicStyles.menuItemText}>{t('mesServices.statistics')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowGlobalMenu(false);
                  (navigation as any).navigate('PubliciteDashboard');
                }}
              >
                <SafeIcon name="megaphone" size={18} color="#8B5CF6" />
                <Text style={dynamicStyles.menuItemText}>{t('mesServices.myAds')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowGlobalMenu(false);
                  (navigation as any).navigate('CreatePublicite');
                }}
              >
                <SafeIcon name="plus-circle" size={18} color="#EC4899" />
                <Text style={dynamicStyles.menuItemText}>{t('mesServices.newAd')}</Text>
              </TouchableOpacity>

              {/* ✅ NOUVEAU: Créer Flash Promo - Sélection multiple de produits */}
              <TouchableOpacity
                style={[dynamicStyles.menuItem, { backgroundColor: '#FEF3C7', borderWidth: 2, borderColor: '#F59E0B' }]}
                onPress={() => {
                  setShowGlobalMenu(false);
                  // Préparer la liste des produits et ouvrir le sélecteur
                  const productsList = prepareProductsForSelector();
                  if (productsList.length === 0) {
                    toaster.warning(t('mesServices.createProductsFirstFlash'));
                    return;
                  }
                  setProductsForSelection(productsList);
                  setProductSelectorMode('flash-promo');
                  setShowProductSelector(true);
                }}
              >
                <Text style={{ fontSize: 18, marginRight: 8 }}>⚡</Text>
                <Text style={[dynamicStyles.menuItemText, { color: '#F59E0B', fontWeight: '700' }]}>{t('mesServices.createFlash')}</Text>
              </TouchableOpacity>

              {/* ✅ NOUVEAU: Voir Flash Promotionnels actifs */}
              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowGlobalMenu(false);
                  try {
                    (navigation as any).navigate('FlashPromosActive');
                  } catch (error) {
                    logger.error('Erreur navigation FlashPromosActive:', error);
                    toaster.error('Impossible d\'ouvrir les Flash Promotionnels');
                  }
                }}
              >
                <SafeIcon name="zap" size={18} color="#F59E0B" />
                <Text style={dynamicStyles.menuItemText}>{t('mesServices.viewActiveFlash')}</Text>
              </TouchableOpacity>

              {/* ✅ NOUVEAU: Mes Vidéos - Créées */}
              <TouchableOpacity
                style={[dynamicStyles.menuItem, { backgroundColor: colors.surfaceVariant }]}
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
                    toaster.error('Impossible d\'ouvrir Mes Vidéos');
                  }
                }}
              >
                <SafeIcon name="video" size={18} color={colors.primary} />
                <Text style={[dynamicStyles.menuItemText, { color: colors.primary }]}>{t('mesServices.myCreatedVideos')}</Text>
              </TouchableOpacity>

              {/* ✅ NOUVEAU: Démarrer un Live */}
              <TouchableOpacity
                style={[dynamicStyles.menuItem, { backgroundColor: '#FEF2F2' }]}
                onPress={() => (navigation as any).navigate('StartLive')}
              >
                <SafeIcon name="radio" size={18} color="#DC2626" />
                <Text style={[dynamicStyles.menuItemText, { color: '#DC2626' }]}>🎥 {t('mesServices.startLive')}</Text>
              </TouchableOpacity>

              {/* ✅ NOUVEAU: Analytiques Vidéos */}
              <TouchableOpacity
                style={[dynamicStyles.menuItem, { backgroundColor: colors.surfaceVariant }]}
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
                    toaster.error('Impossible d\'ouvrir Analytiques Vidéos');
                  }
                }}
              >
                <SafeIcon name="bar-chart" size={18} color={colors.primary} />
                <Text style={[dynamicStyles.menuItemText, { color: colors.primary }]}>{t('mesServices.videoAnalytics')}</Text>
              </TouchableOpacity>

              {/* ✅ Bouton Paramètres */}
              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowGlobalMenu(false);
                  (navigation as any).navigate('Settings');
                }}
              >
                <SafeIcon name="settings" size={18} color="#6B7280" />
                <Text style={dynamicStyles.menuItemText}>{t('mesServices.settings')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={dynamicStyles.menuItem}
                onPress={() => {
                  setShowGlobalMenu(false);
                  onRefresh();
                }}
              >
                <SafeIcon name="refresh-cw" size={18} color="#6B7280" />
                <Text style={dynamicStyles.menuItemText}>{t('mesServices.refresh')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* Overlay pour fermer le menu quand on clique ailleurs */}
        {showGlobalMenu && (
          <TouchableOpacity
            style={dynamicStyles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowGlobalMenu(false)}
          />
        )}

        {/* ✅ NOUVEAU: Breadcrumbs navigation */}
        <Breadcrumbs items={breadcrumbItems} />

        {/* ✅ NOUVEAU: Cards de statistiques visuelles (comme Shopify/Amazon) - Responsive */}
        <View style={dynamicStyles.statsSection}>
          {deviceType.isTablet ? (
            // ✅ NOUVEAU: Grid layout pour tablette (2 colonnes)
            <View style={dynamicStyles.statsGrid}>
              <View style={dynamicStyles.statsRow}>
                <StatsCard
                  icon="package"
                  value={stats.totalProducts}
                  label="Produits totaux"
                  gradient={modernColors.primaryGradient}
                  onPress={() => setFilter('tous')}
                />
                <StatsCard
                  icon="check-circle"
                  value={stats.activeProducts}
                  label="Actifs"
                  color={modernColors.success}
                  onPress={() => setFilter('actif')}
                />
              </View>
              <View style={dynamicStyles.statsRow}>
                <StatsCard
                  icon="pause-circle"
                  value={stats.inactiveProducts}
                  label="Inactifs"
                  color={modernColors.warning}
                  onPress={() => setFilter('inactif')}
                />
                {stats.totalViews > 0 && (
                  <StatsCard
                    icon="eye"
                    value={stats.totalViews.toLocaleString()}
                    label="Vues totales"
                    color={modernColors.secondary}
                  />
                )}
              </View>
            </View>
          ) : (
            // Mobile: Scroll horizontal
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={dynamicStyles.statsScrollContent}
            >
              <StatsCard
                icon="package"
                value={stats.totalProducts}
                label="Produits totaux"
                gradient={modernColors.primaryGradient}
                onPress={() => setFilter('tous')}
              />
              <StatsCard
                icon="check-circle"
                value={stats.activeProducts}
                label="Actifs"
                color={modernColors.success}
                onPress={() => setFilter('actif')}
              />
              <StatsCard
                icon="pause-circle"
                value={stats.inactiveProducts}
                label="Inactifs"
                color={modernColors.warning}
                onPress={() => setFilter('inactif')}
              />
              {stats.totalViews > 0 && (
                <StatsCard
                  icon="eye"
                  value={stats.totalViews.toLocaleString()}
                  label="Vues totales"
                  color={modernColors.secondary}
                />
              )}
            </ScrollView>
          )}
        </View>

        <View style={dynamicStyles.scrollView}>
          {/* ✅ OPTIMISÉ: Filtres sur une seule ligne avec scroll horizontal */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={dynamicStyles.filtersScrollView}
            contentContainerStyle={dynamicStyles.filtersContainer}
          >
            <TouchableOpacity
              style={[
                dynamicStyles.filterChip,
                filter === 'tous' && dynamicStyles.filterChipActive
              ]}
              onPress={() => setFilter('tous')}
            >
              <SafeIcon
                name="package"
                size={16}
                color={filter === 'tous' ? '#fff' : '#6366F1'}
              />
              <Text style={[
                dynamicStyles.filterChipText,
                filter === 'tous' && dynamicStyles.filterChipTextActive
              ]}>
                Tous ({services.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                dynamicStyles.filterChip,
                filter === 'actif' && dynamicStyles.filterChipActive
              ]}
              onPress={() => setFilter('actif')}
            >
              <SafeIcon
                name="check-circle"
                size={16}
                color={filter === 'actif' ? '#fff' : '#10B981'}
              />
              <Text style={[
                dynamicStyles.filterChipText,
                filter === 'actif' && dynamicStyles.filterChipTextActive
              ]}>
                Actifs ({Array.isArray(services) ? services.filter(s => s && s.status === 'active').length : 0})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                dynamicStyles.filterChip,
                filter === 'inactif' && dynamicStyles.filterChipActive
              ]}
              onPress={() => setFilter('inactif')}
            >
              <SafeIcon
                name="pause-circle"
                size={16}
                color={filter === 'inactif' ? '#fff' : '#F97316'}
              />
              <Text style={[
                dynamicStyles.filterChipText,
                filter === 'inactif' && dynamicStyles.filterChipTextActive
              ]}>
                Inactifs ({Array.isArray(services) ? services.filter(s => s && s.status === 'inactive').length : 0})
              </Text>
            </TouchableOpacity>

          </ScrollView>

          {/* ✅ AMÉLIORÉ: FlashList pour virtualisation (performance +50%) */}
          {filteredServices.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <SafeIcon name="briefcase" size={64} color={colors.textSecondary} />
              <Text style={dynamicStyles.emptyTitle}>
                {filter === 'tous' ? 'Aucun produit créé' : `Aucun produit ${filter}`}
              </Text>
              <Text style={dynamicStyles.emptyText}>
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
                style={dynamicStyles.createButton}
              />
            </View>
          ) : (
            <FlashList
              data={filteredServices.filter(service => service != null)}
              estimatedItemSize={200}
              numColumns={deviceType.isTablet ? deviceType.columns : 1}
              // ✅ NOUVEAU: Responsive design - Grid layout pour tablette/desktop
              columnWrapperStyle={deviceType.isTablet && deviceType.columns > 1 ? { gap: 16, paddingHorizontal: 16 } : undefined}
              renderItem={({ item: service }) => {
                const serviceId = service?.id?.toString() || '';
                const isSelected = selectedItems.has(serviceId);

                return (
                  <View style={[
                    { paddingBottom: 16 },
                    !deviceType.isTablet && { paddingHorizontal: 16 },
                    deviceType.isTablet && deviceType.columns > 1 && { flex: 1, marginHorizontal: 8 }
                  ]}>
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
                      bulkMode={bulkMode}
                      selected={isSelected}
                      onSelect={(id) => {
                        const newSelected = new Set(selectedItems);
                        if (newSelected.has(id.toString())) {
                          newSelected.delete(id.toString());
                        } else {
                          newSelected.add(id.toString());
                        }
                        setSelectedItems(newSelected);
                      }}
                    />
                  </View>
                );
              }}
              keyExtractor={(item) => item?.id?.toString() || `service-${Math.random()}`}
              contentContainerStyle={dynamicStyles.flashListContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListFooterComponent={
                <View style={dynamicStyles.footerContainer}>
                  <NativeButton
                    title="📊 Analytics Dashboard"
                    onPress={() => (navigation as any).navigate('AnalyticsDashboard')}
                    variant="primary"
                    size="large"
                    style={dynamicStyles.analyticsFooterButton}
                  />
                  <NativeButton
                    title="📦 Gérer mes produits"
                    onPress={() => navigation.navigate('MesProduits' as never)}
                    variant="outline"
                    size="large"
                    style={dynamicStyles.productsButton}
                  />
                  <NativeButton
                    title="🏠 Retour à l'accueil"
                    onPress={() => navigation.navigate('Home' as never)}
                    variant="outline"
                    size="large"
                    style={dynamicStyles.homeButton}
                  />
                </View>
              }
              ListEmptyComponent={
                <View style={dynamicStyles.emptyContainer}>
                  <SafeIcon name="briefcase" size={64} color={colors.textSecondary} />
                  <Text style={dynamicStyles.emptyTitle}>
                    {filter === 'tous' ? 'Aucun produit créé' : `Aucun produit ${filter}`}
                  </Text>
                  <NativeButton
                    title="➕ Créer un nouveau produit"
                    onPress={() => handleAddProduct()}
                    variant="primary"
                    size="medium"
                    style={dynamicStyles.createButton}
                  />
                </View>
              }
            />
          )}
        </View>

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
                toaster.success('Membre ajouté à l\'équipe avec succès');
                loadServices(true);
              }}
              onMemberRemoved={() => {
                toaster.success('Membre retiré de l\'équipe avec succès');
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
              // ✅ SÉCURISÉ: Normaliser les produits pour garantir que productName et serviceName sont des strings
              const normalizedProducts = (Array.isArray(selectedProducts) ? selectedProducts : []).map(product => ({
                serviceId: product?.serviceId || 0,
                productIndex: product?.productIndex ?? 0,
                productName: typeof product?.productName === 'string' ? product.productName.trim() :
                  (product?.productName && typeof product.productName === 'object' && 'valeur' in product.productName && typeof product.productName.valeur === 'string' ? product.productName.valeur.trim() :
                    String(product?.productName || 'Produit sans nom')),
                serviceName: typeof product?.serviceName === 'string' ? product.serviceName.trim() :
                  (product?.serviceName && typeof product.serviceName === 'object' && 'valeur' in product.serviceName && typeof product.serviceName.valeur === 'string' ? product.serviceName.valeur.trim() :
                    String(product?.serviceName || 'Service sans nom')),
              })).filter(p => p.serviceId > 0);

              // ✅ Stocker les produits sélectionnés normalisés et ouvrir le modal de configuration livraison
              setSelectedProductsForDelivery(normalizedProducts);
              setShowGlobalDeliveryConfig(true);
            } else if (productSelectorMode === 'flash-promo') {
              // ✅ NOUVEAU: Mode Flash Promo - Créer un flash promo pour plusieurs produits
              if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
                toaster.warning('Veuillez sélectionner au moins un produit pour créer un flash promo.');
                setShowProductSelector(false);
                setProductSelectorMode(null);
                return;
              }

              // Normaliser les produits sélectionnés
              const validProducts = selectedProducts.filter(p => p && p.serviceId != null && p.serviceId > 0);

              if (validProducts.length === 0) {
                toaster.warning('Aucun produit valide sélectionné.');
                setShowProductSelector(false);
                setProductSelectorMode(null);
                return;
              }

              // Si un seul produit, naviguer directement
              if (validProducts.length === 1) {
                const product = validProducts[0];
                try {
                  (navigation as any).navigate('CreateFlashPromo', {
                    serviceId: product.serviceId,
                    productIndex: product.productIndex,
                  });
                } catch (error) {
                  logger.error('Erreur navigation CreateFlashPromo:', error);
                  toaster.error('Impossible d\'ouvrir la création de flash promo');
                }
              } else {
                // Plusieurs produits : naviguer avec la liste des produits sélectionnés
                // Le CreateFlashPromo devra gérer la création multiple
                try {
                  (navigation as any).navigate('CreateFlashPromo', {
                    products: validProducts.map(p => ({
                      serviceId: p.serviceId,
                      productIndex: p.productIndex,
                      productName: p.productName,
                      serviceName: p.serviceName,
                    })),
                    multiple: true,
                  });
                } catch (error) {
                  logger.error('Erreur navigation CreateFlashPromo (multiple):', error);
                  toaster.error('Impossible d\'ouvrir la création de flash promo');
                }
              }

              setShowProductSelector(false);
              setProductsForSelection([]);
              setProductSelectorMode(null);
            } else if (productSelectorMode === 'team') {
              // ✅ CORRECTION: Vérifier que selectedProducts est un tableau valide
              if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
                toaster.warning('Aucun produit sélectionné');
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
            navigation={navigation} // ✅ AJOUTÉ: Navigation pour la redirection
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

        {/* ✅ NOUVEAU: Sidebar Navigation (remplace menu dropdown) */}
        <SidebarNavigation
          visible={showSidebar}
          onClose={() => setShowSidebar(false)}
          currentRoute="MesServices"
          items={[
            {
              id: 'create-product',
              label: 'Créer produit',
              icon: 'plus-circle',
              section: 'Actions',
              color: modernColors.success,
              onPress: () => handleAddProduct(),
            },
            {
              id: 'gallery',
              label: 'Galerie Médias',
              icon: 'image',
              section: 'Actions',
              color: modernColors.success,
              onPress: () => setShowProductGallery(true),
            },
            {
              id: 'team',
              label: 'Gérer équipe',
              icon: 'users',
              section: 'Actions',
              color: modernColors.primary,
              onPress: () => {
                const productsList = prepareProductsForSelector();
                if (productsList.length === 0) {
                  toaster.warning('Vous devez d\'abord créer des produits avant de gérer l\'équipe.');
                  return;
                }
                setProductsForSelection(productsList);
                setProductSelectorMode('team');
                setShowProductSelector(true);
              },
            },
            {
              id: 'analytics',
              label: 'Statistiques',
              icon: 'tablet',
              section: 'Analytics',
              color: '#3B82F6',
              onPress: () => (navigation as any).navigate('AnalyticsDashboard'),
            },
            {
              id: 'publicite-dashboard',
              label: 'Mes Publicités',
              icon: 'megaphone',
              section: 'Marketing',
              color: '#8B5CF6',
              onPress: () => (navigation as any).navigate('PubliciteDashboard'),
            },
            {
              id: 'publicite-create',
              label: 'Nouvelle Publicité',
              icon: 'plus-circle',
              section: 'Marketing',
              color: '#EC4899',
              onPress: () => (navigation as any).navigate('CreatePublicite'),
            },
            {
              id: 'videos',
              label: 'Mes Vidéos',
              icon: 'video',
              section: 'Contenu',
              color: modernColors.primary,
              onPress: () => {
                try {
                  const parent = (navigation as any).getParent();
                  if (parent) {
                    parent.navigate('VideoFeed');
                  } else {
                    (navigation as any).navigate('VideoFeed');
                  }
                } catch (error) {
                  toaster.error('Impossible d\'ouvrir Mes Vidéos');
                }
              },
            },
            {
              id: 'start-live',
              label: 'Démarrer un Live',
              icon: 'radio',
              section: 'Contenu',
              color: '#DC2626',
              onPress: () => (navigation as any).navigate('StartLive'),
            },
            {
              id: 'video-analytics',
              label: 'Analytiques Vidéos',
              icon: 'bar-chart',
              section: 'Contenu',
              color: modernColors.primary,
              onPress: () => {
                try {
                  const parent = (navigation as any).getParent();
                  if (parent) {
                    parent.navigate('VideoAnalytics');
                  } else {
                    (navigation as any).navigate('VideoAnalytics');
                  }
                } catch (error) {
                  toaster.error('Impossible d\'ouvrir Analytiques Vidéos');
                }
              },
            },
            {
              id: 'black-friday',
              label: 'Black Friday',
              icon: 'flame',
              section: 'Promotions',
              color: '#F59E0B',
              onPress: () => (navigation as any).navigate('GlobalPromoSubmission'),
            },
            {
              id: 'flash-promo',
              label: 'Flash Promo',
              icon: 'zap',
              section: 'Promotions',
              color: '#F59E0B',
              onPress: () => {
                // Préparer la liste des produits et ouvrir le sélecteur en mode multiple
                const productsList = prepareProductsForSelector();
                if (productsList.length === 0) {
                  toaster.warning('Vous devez d\'abord créer des produits avant de créer un flash promo.');
                  return;
                }
                setProductsForSelection(productsList);
                setProductSelectorMode('flash-promo');
                setShowProductSelector(true);
              },
            },
            {
              id: 'settings',
              label: 'Paramètres',
              icon: 'settings',
              section: 'Autres',
              color: '#6B7280',
              onPress: () => (navigation as any).navigate('Settings'),
            },
          ]}
        />

        {/* ✅ NOUVEAU: Bulk Actions Bar */}
        <BulkActionsBar
          visible={bulkMode && selectedItems.size > 0}
          selectedCount={selectedItems.size}
          totalCount={filteredServices.length}
          onSelectAll={() => {
            const allIds = new Set(filteredServices.map(s => s.id?.toString() || ''));
            setSelectedItems(allIds);
          }}
          onDeselectAll={() => setSelectedItems(new Set())}
          onClose={() => {
            setBulkMode(false);
            setSelectedItems(new Set());
          }}
          actions={[
            {
              id: 'activate',
              label: 'Activer',
              icon: 'play-circle',
              color: modernColors.success,
              onPress: async (selectedIds) => {
                const selectedCount = selectedItems.size;
                const promises = Array.from(selectedItems).map(id => {
                  const service = services.find(s => s.id?.toString() === id);
                  if (service && service.status !== 'active') {
                    return handleToggleServiceStatus(service);
                  }
                  return Promise.resolve();
                });
                await Promise.all(promises);
                setSelectedItems(new Set());
                toaster.success(`${selectedCount} produit(s) activé(s)`);
              },
            },
            {
              id: 'deactivate',
              label: 'Désactiver',
              icon: 'pause-circle',
              color: modernColors.warning,
              onPress: async (selectedIds) => {
                const selectedCount = selectedItems.size;
                const promises = Array.from(selectedItems).map(id => {
                  const service = services.find(s => s.id?.toString() === id);
                  if (service && service.status === 'active') {
                    return handleToggleServiceStatus(service);
                  }
                  return Promise.resolve();
                });
                await Promise.all(promises);
                setSelectedItems(new Set());
                toaster.success(`${selectedCount} produit(s) désactivé(s)`);
              },
            },
            {
              id: 'delete',
              label: 'Supprimer',
              icon: 'trash-2',
              color: modernColors.error,
              destructive: true,
              onPress: (selectedIds) => {
                const selectedCount = selectedItems.size;
                Alert.alert(
                  'Supprimer plusieurs produits',
                  `Êtes-vous sûr de vouloir supprimer ${selectedCount} produit(s) ?\n\nCette action est irréversible.`,
                  [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: async () => {
                        const promises = Array.from(selectedItems).map(id => {
                          const service = services.find(s => s.id?.toString() === id);
                          if (service) {
                            return handleDeleteService(service);
                          }
                          return Promise.resolve();
                        });
                        await Promise.all(promises);
                        setSelectedItems(new Set());
                        toaster.success(`${selectedCount} produit(s) supprimé(s)`);
                      },
                    },
                  ]
                );
              },
            },
          ]}
        />
      </SafeNativeView>
    </ErrorBoundaryWithRetry>
  );
};

// ✅ NOUVEAU: Fonction createStyles pour styles dynamiques avec thème
const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || modernColors.background,
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flexShrink: 0,
    numberOfLines: 1,
  },
  subtitleCompact: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 44,
    minHeight: 44,
  },
  analyticsButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  publiciteButton: {
    backgroundColor: 'rgba(236, 72, 153, 0.3)',
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
    backgroundColor: colors.surface || modernColors.surface,
    borderRadius: 12,
    padding: 8,
    shadowColor: colors.shadow || modernColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 220,
    maxWidth: 280,
    zIndex: 10000,
    borderWidth: 1,
    borderColor: colors.border || modernColors.border,
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
    color: colors.text || modernColors.text,
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
    backgroundColor: colors.background || modernColors.background,
  },
  // ✅ NOUVEAU: Styles pour les cards de statistiques
  statsSection: {
    backgroundColor: colors.background || modernColors.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statsScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  // ✅ NOUVEAU: Grid layout pour tablette
  statsGrid: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  // ✅ NOUVEAU: FlashList content style
  flashListContent: {
    padding: 16,
    paddingBottom: 120,
  },
  filtersScrollView: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface || modernColors.surface,
    borderWidth: 1,
    borderColor: colors.border || modernColors.border,
    gap: 6,
    minHeight: 36,
  },
  filterChipActive: {
    backgroundColor: colors.primary || modernColors.primary,
    borderColor: colors.primary || modernColors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary || modernColors.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  servicesContainer: {
    gap: 16,
  },
  // ✅ NOUVEAU: Styles pour FlashList
  flashListContent: {
    padding: 16,
    paddingBottom: 120,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text || modernColors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary || modernColors.textSecondary,
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
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border || modernColors.border,
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




