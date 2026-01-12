/**
 * ProductCard - Version reconstruite intégralement
 * Toutes fonctionnalités : vecteurs, variations, chat, distance, drapeau pays, réactions, livraison
 */

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { useLocation } from '../contexts/LocationContext';
import ChatModalMobile from './ChatModalMobile';
import { NativeButton, NativeCard } from './NativeDesign';
import ProductCommentsSection from './ProductCommentsSection';
import ProductMediaCarousel from './ProductMediaCarousel';
import SafeIcon from './SafeIcon';
import ServiceGalleryModal from './ServiceGalleryModal';
import OrderDeliveryModal from './delivery/OrderDeliveryModal';
import { productDeliveryService } from '../services/productDeliveryService';

const { width } = Dimensions.get('window');

interface ProductCardProps {
  product: any;
  service: any;
  prestataire?: any;
  userLocation?: { latitude: number; longitude: number } | null;
  onPress?: () => void;
  onChatPress?: () => void;
}

const REACTIONS = [
  { type: 'love', emoji: '❤️', label: 'J\'adore' },
  { type: 'like', emoji: '👍', label: 'J\'aime' },
  { type: 'wow', emoji: '😮', label: 'Impressionnant' },
  { type: 'interested', emoji: '🎯', label: 'Intéressant' },
  { type: 'thinking', emoji: '🤔', label: 'À réfléchir' },
  { type: 'disappointed', emoji: '😕', label: 'Déçu' },
];

const formatCompactNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null) {
    return '0';
  }

  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1);
    return `${value < 0 ? '-' : ''}${formatted}M`;
  }

  if (abs >= 1_000) {
    const formatted = (abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1);
    return `${value < 0 ? '-' : ''}${formatted}k`;
  }

  return `${value}`;
};

const splitWithFallback = (input: any, primary?: string): string[] => {
  if (!input || typeof input !== 'string') {
    return [];
  }

  const cleaned = input.trim();
  if (!cleaned) {
    return [];
  }

  const separators = [primary, ',', ';', '>', '|', ' / ']
    .filter((sep): sep is string => !!sep && typeof sep === 'string')
    .filter((sep, index, list) => list.indexOf(sep) === index);

  for (const separator of separators) {
    const parts = cleaned
      .split(separator)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length > 1) {
      return parts;
    }
  }

  return [cleaned];
};

const getCountryFlag = (country?: string): string => {
  const countryMap: Record<string, string> = {
    'Cameroun': '🇨🇲',
    'Cameroon': '🇨🇲',
    'Gabon': '🇬🇦',
    'Congo': '🇨🇬',
    'RDC': '🇨🇩',
    'Sénégal': '🇸🇳',
    'Senegal': '🇸🇳',
    'Côte d\'Ivoire': '🇨🇮',
    'Mali': '🇲🇱',
    'Burkina': '🇧🇫',
    'Niger': '🇳🇪',
    'Tchad': '🇹🇩',
    'Togo': '🇹🇬',
    'Bénin': '🇧🇯',
    'Guinée': '🇬🇳',
    'Madagascar': '🇲🇬',
    'France': '🇫🇷',
    'USA': '🇺🇸',
  };

  if (!country) return '🌍';

  for (const [key, flag] of Object.entries(countryMap)) {
    if (country.toLowerCase().includes(key.toLowerCase())) {
      return flag;
    }
  }

  return '🌍';
};

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)}sem`;
    return `Il y a ${Math.floor(diffDays / 30)}mois`;
  } catch {
    return '';
  }
};

const ProductCard: React.FC<ProductCardProps> = React.memo(({
  product,
  service,
  prestataire: prestataireFromProps,
  userLocation = null,
  onPress,
  onChatPress,
}) => {
  const navigation = useNavigation();
  // ✅ NOUVEAU: Utiliser useLocation pour calculer la distance si nécessaire
  const { location: contextLocation, calculateDistance: locationCalculateDistance } = useLocation();
  const effectiveUserLocation = userLocation || (contextLocation?.coords ? {
    latitude: contextLocation.coords.latitude,
    longitude: contextLocation.coords.longitude,
  } : null);
  
  const [imageError, setImageError] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [privateConversationId, setPrivateConversationId] = useState<string | null>(null);
  const [chatContext, setChatContext] = useState<{
    type: 'service' | 'private';
    targetUserId?: number;
    targetUserName?: string;
    targetAvatar?: string | null;
  } | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [reactions, setReactions] = useState<Record<string, { count: number; hasReacted: boolean }>>({});
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [hasDeliveryConfig, setHasDeliveryConfig] = useState<boolean | null>(null); // null = en cours de vérification

  // ✅ PHASE 4: Gérer les produits depuis l'API (type Product) ou JSONB (fallback)
  // Si le produit vient de l'API, utiliser product.product_data pour les données
  const productData = product.product_data || product;

  const productVector = Array.isArray(productData.product_vector)
    ? productData.product_vector
    : Array.isArray(productData.characteristic_vector)
      ? productData.characteristic_vector
      : typeof productData.product_vector === 'string'
        ? splitWithFallback(productData.product_vector, ',')
        : [];

  const rawLocationVector = productData.location_vector || productData.locationVector || productData.location?.vector;
  const locationVector = Array.isArray(rawLocationVector)
    ? rawLocationVector.filter(Boolean)
    : typeof rawLocationVector === 'string'
      ? splitWithFallback(rawLocationVector, ',')
      : [];

  // ✅ CORRIGÉ 2026-01-07: Éviter d'afficher "false" - filtrer les valeurs booléennes
  const chosenLocationRaw = productData.chosen_location ||
    locationVector[0] ||
    productData.adresse ||
    productData.address ||
    service?.data?.adresse?.valeur ||
    service?.data?.adresse_service?.valeur ||
    '';
  
  // ✅ Filtrer les valeurs booléennes et null/undefined
  const chosenLocation = (typeof chosenLocationRaw === 'string' && chosenLocationRaw !== 'false' && chosenLocationRaw.trim() !== '')
    ? chosenLocationRaw
    : (typeof chosenLocationRaw === 'string' && chosenLocationRaw !== 'false')
      ? chosenLocationRaw
      : '';

  const hasVariant = productData.has_variant || false;
  const variants = productData.variants || [];
  const rawPrestataire =
    prestataireFromProps ||
    productData.prestataire ||
    service?.prestataire ||
    {
      nom: service?.data?.nom_prestataire?.valeur ||
        service?.data?.prestataire_nom?.valeur ||
        service?.data?.contact_nom?.valeur ||
        service?.data?.nom_prestataire ||
        service?.data?.prestataire_nom ||
        productData?.prestataire_nom ||
        productData?.prestataire_name ||
        productData?.owner_name ||
        productData?.vendor_name ||
        'Prestataire',
      user_id: service?.user_id,
      avatar_url: service?.data?.photo_prestataire?.valeur,
    };

  const prestataireName =
    rawPrestataire?.nom ||
    rawPrestataire?.nom_complet ||
    rawPrestataire?.name ||
    rawPrestataire?.username ||
    rawPrestataire?.display_name ||
    productData.prestataire_nom ||
    productData.prestataire_name ||
    productData.prestataire?.nom ||
    productData.prestataire?.nom_complet ||
    productData.prestataire?.name ||
    service?.data?.nom_prestataire?.valeur ||
    service?.data?.prestataire_nom?.valeur ||
    service?.data?.contact_nom?.valeur ||
    service?.data?.nom?.valeur ||
    service?.data?.nom_entreprise?.valeur ||
    'Prestataire';

  const prestataireAvatar =
    rawPrestataire?.avatar_url ||
    rawPrestataire?.photo_profil ||
    rawPrestataire?.photo ||
    productData.prestataire_avatar ||
    productData.prestataire?.avatar_url ||
    productData.prestataire?.avatar ||
    service?.data?.photo_prestataire?.valeur ||
    service?.data?.photo_profil?.valeur;

  const prestataireUserId =
    rawPrestataire?.user_id ||
    productData.prestataire?.user_id ||
    service?.user_id ||
    service?.data?.user_id;

  const prestataire = {
    ...rawPrestataire,
    nom: prestataireName,
    nom_complet: prestataireName,
    avatar_url: prestataireAvatar,
    user_id: prestataireUserId,
  };

  const usageCount = productData.usage_count || 0;
  const isPopular = usageCount >= 5;
  const isTrending = usageCount >= 10;

  // ✅ PHASE 4: Extraire les images et vidéos depuis productData/service avec fallbacks multiples
  const images = Array.isArray(productData.images) ? productData.images 
    : Array.isArray(service?.images) ? service.images
    : Array.isArray(service?.data?.images?.valeur) ? service.data.images.valeur
    : Array.isArray(service?.data?.images) ? service.data.images
    : Array.isArray(productData.data?.images) ? productData.data.images
    : [];
  
  const videos = Array.isArray(productData.videos) ? productData.videos
    : Array.isArray(service?.videos) ? service.videos
    : Array.isArray(service?.data?.videos?.valeur) ? service.data.videos.valeur
    : Array.isArray(service?.data?.videos) ? service.data.videos
    : Array.isArray(productData.data?.videos) ? productData.data.videos
    : [];

  const selectedVariant = selectedVariantIndex !== null && variants[selectedVariantIndex]
    ? variants[selectedVariantIndex]
    : null;
  const variantImage = selectedVariant?.image || selectedVariant?.images?.[0];
  const hasMedia = (images?.length || 0) + (videos?.length || 0) > 0 || !!variantImage;

  // ✅ CORRIGÉ 2026-01-04: Vérifier aussi _serviceId ajouté par ResultatBesoinScreen
  const serviceId = product._serviceId || product.service_id || service?.id;
  const productIndex =
    typeof product.product_index === 'number'
      ? product.product_index
      : typeof product.index === 'number'
        ? product.index
        : 0;
  const resolvedProductId =
    product.product_id ||
    product.id ||
    (serviceId ? `${serviceId}_${productIndex}` : null);

  // ✅ CORRIGÉ 2026-01-07: Distinction stricte entre produits et prestations
  // Le bouton "Me livrer" ne doit s'afficher QUE pour les produits, jamais pour les prestations
  const serviceType = service?.data?.type?.valeur || service?.data?.type || service?.category || '';
  const productType = productData.type || productData.product_type || '';
  
  // ✅ Vérifier si c'est une prestation de service (ne doit PAS avoir le bouton "Me livrer")
  const isPrestation = 
    serviceType === 'prestation_service' ||
    serviceType === 'service' ||
    serviceType === 'service_prestation' ||
    productType === 'prestation_service' ||
    productType === 'service' ||
    productType === 'service_prestation' ||
    (service?.data?.titre_service?.valeur && !product.product_data && !productData.nom && !productData.name);
  
  // ✅ C'est un produit si :
  // 1. product.product_data existe (produit depuis service_products)
  // 2. OU le type n'est PAS une prestation ET il y a des données de produit (nom, prix, etc.)
  const isProduct = !isPrestation && (
    product.product_data !== undefined || // Produit depuis service_products
    (productData.nom || productData.name || productData.titre) || // A un nom de produit
    (productData.prix !== undefined || productData.price !== undefined) // A un prix
  );

  // ✅ NOUVEAU: Vérifier si le produit a une configuration de livraison automatique
  useEffect(() => {
    const checkDeliveryConfig = async () => {
      if (!isProduct || !serviceId || productIndex < 0) {
        setHasDeliveryConfig(false);
        return;
      }

      try {
        const config = await productDeliveryService.getDeliveryConfig(serviceId, productIndex);
        setHasDeliveryConfig(config?.is_configured === true);
      } catch (error) {
        console.error('[ProductCard] Erreur vérification config livraison:', error);
        setHasDeliveryConfig(false);
      }
    };

    checkDeliveryConfig();
  }, [isProduct, serviceId, productIndex]);

  // ✅ CORRIGÉ 2026-01-07: Conditions strictes pour l'affichage du bouton "Me livrer"
  // Le bouton s'affiche UNIQUEMENT pour les produits (jamais pour les prestations)
  // ET uniquement si le produit a une configuration de livraison automatique (is_configured = true)
  const deliveryEnabled = isProduct && // ✅ CRITIQUE: Uniquement pour les produits
    serviceId && // ✅ S'assurer qu'il y a un serviceId
    hasDeliveryConfig === true; // ✅ NOUVEAU: Vérifier que la configuration de livraison existe et est configurée

  const displayPrice = hasVariant && variants.length > 0
    ? Math.min(...variants.map((v: any) => v.prix || 0))
    : productData.prix || 0;

  const devise = productData.devise || variants[0]?.devise || 'XAF';

  // ✅ CORRIGÉ 2025-01-01: Mémoriser le calcul de distance pour éviter les recalculs à chaque render
  // ✅ CORRIGÉ 2026-01-04: Vérifier aussi dans product directement (pas seulement productData)
  // Dans ResultatBesoinScreen, distance et distance_km sont ajoutés directement dans product
  const distanceKm = useMemo(() => {
    const rawDistance = product.distance_km ?? product.distanceKm ?? product.distance 
      ?? productData.distance_km ?? productData.distanceKm ?? productData.distance ?? productData.distance_client;
    let calculatedDistance = typeof rawDistance === 'string'
      ? parseFloat(rawDistance)
      : typeof rawDistance === 'number'
        ? rawDistance
        : undefined;
    
    // ✅ NOUVEAU: Calculer la distance si elle n'est pas fournie et qu'on a les coordonnées GPS
    if ((calculatedDistance === undefined || !Number.isFinite(calculatedDistance)) && effectiveUserLocation && locationCalculateDistance) {
      // Extraire les coordonnées GPS du produit/service (priorité: _gps ajouté dans ResultatBesoinScreen, puis gps direct, puis service)
      // ✅ CORRIGÉ 2026-01-04: Vérifier aussi dans product directement (pas seulement productData)
      const productGPS = product._gps || productData._gps || product.gps || productData.gps || productData.gps_coords || productData.gps_fixe || service?.data?.gps_fixe?.valeur || service?.data?.gps?.valeur;
      
      if (productGPS) {
        let productLat: number | undefined;
        let productLon: number | undefined;
        
        // Parser le GPS (peut être string "lat,lng" ou object {lat, lng} ou {latitude, longitude})
        if (typeof productGPS === 'string') {
          const parts = productGPS.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            productLat = parseFloat(parts[0]);
            productLon = parseFloat(parts[1]);
          }
        } else if (typeof productGPS === 'object') {
          productLat = productGPS.lat ?? productGPS.latitude;
          productLon = productGPS.lng ?? productGPS.longitude;
        }
        
        // Calculer la distance si on a les deux coordonnées
        if (productLat !== undefined && productLon !== undefined && 
            Number.isFinite(productLat) && Number.isFinite(productLon)) {
          try {
            calculatedDistance = locationCalculateDistance(
              effectiveUserLocation.latitude,
              effectiveUserLocation.longitude,
              productLat,
              productLon
            );
          } catch (error) {
            console.warn('[ProductCard] Erreur calcul distance:', error);
          }
        }
      }
    }
    
    return calculatedDistance;
  }, [product.distance_km, product.distanceKm, product.distance, product._gps, product.gps, productData.distance_km, productData.distanceKm, productData.distance, productData.distance_client, productData._gps, productData.gps, productData.gps_coords, productData.gps_fixe, service?.data?.gps_fixe?.valeur, service?.data?.gps?.valeur, effectiveUserLocation, locationCalculateDistance]);
  
  const hasDistance = typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm >= 0;

  const pays = locationVector[locationVector.length - 1] ||
    productData.pays ||
    service?.data?.pays?.valeur;

  const countryFlag = getCountryFlag(pays);

  const commentServiceId = Number(productData._serviceId || product.service_id || service?.id || 0);
  const serviceTitleForComments =
    productData.nom ||
    productData.name ||
    productData.titre ||
    productData.title ||
    service?.data?.titre_service?.valeur ||
    service?.data?.nom ||
    'Produit';

  const isPrivateChat = chatContext?.type === 'private';
  const activeChatPeer = isPrivateChat && chatContext?.targetUserId
    ? {
      nom: chatContext.targetUserName || 'Utilisateur',
      nom_complet: chatContext.targetUserName || 'Utilisateur',
      user_id: chatContext.targetUserId,
      avatar_url: chatContext.targetAvatar || null,
    }
    : prestataire;

  const viewsCount =
    productData.views ??
    productData.vues ??
    productData.consultations ??
    service?.views ??
    usageCount ??
    0;

  const sharesCount =
    productData.shares ??
    productData.partages ??
    productData.share_count ??
    service?.shares ??
    0;

  const reviewsCount =
    productData.reviews ??
    productData.reviews_count ??
    productData.nb_avis ??
    service?.reviews_count ??
    0;

  const favoritesCount =
    productData.favoris ??
    productData.likes ??
    productData.favorites ??
    productData.saves ??
    productData.bookmarks ??
    0;

  const topStatsData = [
    { key: 'views', icon: 'eye', value: viewsCount, tint: '#4f46e5' },
    { key: 'shares', icon: 'share-2', value: sharesCount, tint: '#a855f7' },
    { key: 'reviews', icon: 'message-circle', value: reviewsCount, tint: '#f59e0b' },
    { key: 'favorites', icon: 'heart', value: favoritesCount, tint: '#ef4444' },
  ];

  // ✅ CORRIGÉ 2026-01-XX: Toujours utiliser onChatPress (méthode du parent, comme pour les services)
  // Cette méthode est plus complète car elle gère les notifications et le contexte au niveau parent
  const handleChatPress = () => {
    if (onChatPress) {
      onChatPress();
      return;
    }

    // Fallback: Si onChatPress n'est pas fourni, utiliser la méthode interne (compatibilité arrière)
    // Mais dans la plupart des cas, onChatPress devrait être fourni par le parent
    setChatContext({
      type: 'service',
      targetUserId: prestataire.user_id ? Number(prestataire.user_id) : undefined,
      targetUserName: prestataire.nom,
      targetAvatar: prestataire.avatar_url || null,
    });
    setPrivateConversationId(null);
  };

  const handleShare = async () => {
    try {
      const productName = productData.nom || service?.data?.nom_produit?.valeur || service?.data?.titre_service?.valeur || 'Produit';
      const productDesc = productData.description || service?.data?.description_produit?.valeur || service?.data?.description?.valeur || '';
      const price = displayPrice > 0 ? `${displayPrice.toLocaleString()} ${devise}` : '';
      const location = chosenLocation || '';

      const shareUrl = process.env.EXPO_PUBLIC_SHARE_URL
        ? `${process.env.EXPO_PUBLIC_SHARE_URL}/service/${product.service_id || service?.id}`
        : `https://yukpomnang.com/service/${product.service_id || service?.id}`;

      const shareMessage = `🛍️ ${productName}\n\n${productDesc ? `${productDesc}\n\n` : ''}${price ? `💰 Prix: ${price}\n` : ''}${location ? `📍 ${location}\n\n` : '\n'}🔗 Voir ce produit:\n${shareUrl}`;

      const result = await Share.share({
        message: shareMessage,
        title: productName,
      });

      if (result.action === Share.sharedAction) {
        console.log('[ProductCard] Produit partagé avec succès');
      }
    } catch (error) {
      console.error('[ProductCard] Erreur partage:', error);
      Alert.alert('Erreur', 'Impossible de partager le produit');
    }
  };

  const loadReactions = useCallback(async () => {
    if (!serviceId || !resolvedProductId) return;

    try {
      setLoadingReactions(true);
      const response = await apiGet(`/api/products/${serviceId}/${resolvedProductId}/reactions`);
      // ✅ CORRIGÉ: Vérifier que response existe et que response.data est un tableau
      if (response && response.success && response.data) {
        const reactionsMap: Record<string, { count: number; hasReacted: boolean }> = {};
        // ✅ CORRIGÉ: S'assurer que response.data est un tableau avant d'appeler forEach
        const reactionsArray = Array.isArray(response.data) ? response.data : [];
        reactionsArray.forEach((r: any) => {
          if (r && r.reaction_type) {
            reactionsMap[r.reaction_type] = {
              count: r.count || 0,
              hasReacted: r.has_reacted || false
            };
          }
        });
        setReactions(reactionsMap);
      }
    } catch (error) {
      console.error('[ProductCard] Erreur chargement réactions:', error);
      // ✅ CORRIGÉ: Initialiser avec un objet vide en cas d'erreur
      setReactions({});
    } finally {
      setLoadingReactions(false);
    }
  }, [resolvedProductId, serviceId]);

  useEffect(() => {
    loadReactions();
  }, [loadReactions]);

  const handleReaction = async (reactionType: string) => {
    if (!serviceId || !resolvedProductId) {
      Alert.alert(
        'Information manquante',
        'Impossible de réagir à ce produit pour le moment.'
      );
      return;
    }

    setPendingReaction(reactionType);

    try {
      const response = await apiPost(`/api/products/${serviceId}/${resolvedProductId}/react`, {
        reaction_type: reactionType
      });

      if (response.success) {
        await loadReactions();
      }
    } catch (error) {
      console.error('[ProductCard] Erreur réaction:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre réaction pour le moment.');
    } finally {
      setPendingReaction(null);
    }
  };

  const handleContactUser = async (userId: number, userName: string, userAvatar?: string | null) => {
    try {
      const checkResponse = await apiGet(`/api/conversations/private/${userId}`);

      let conversationId: string | null = null;

      if (checkResponse.success && checkResponse.data) {
        const data = checkResponse.data as { conversation_id?: string };
        conversationId = data.conversation_id || null;
      }

      if (!conversationId) {
        const createResponse = await apiPost('/api/conversations/create-private', {
          target_user_id: userId,
          context: 'product_review',
        });

        if (createResponse.success && createResponse.data) {
          const data = createResponse.data as { conversation_id?: string };
          conversationId = data.conversation_id || null;
        } else if (!createResponse.success) {
          throw new Error(createResponse.error || "Impossible de créer la conversation privée");
        }
      }

      if (conversationId) {
        setChatContext({
          type: 'private',
          targetUserId: userId,
          targetUserName: userName,
          targetAvatar: userAvatar ?? null,
        });
        setPrivateConversationId(conversationId);
        setShowChatModal(true);
      } else {
        Alert.alert('Information', "Impossible de créer une conversation privée pour le moment");
      }
    } catch (error) {
      console.error('[ProductCard] Erreur création conversation privée:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de contacter cet utilisateur');
    }
  };

  // ✅ CORRIGÉ 2026-01-XX: handleCloseChatModal n'est plus nécessaire car le chat modal est géré par le parent
  // Cette fonction est conservée pour compatibilité avec handleContactUser (chat privé depuis les commentaires)
  const handleCloseChatModal = () => {
    if (chatContext?.type === 'private') {
      setChatContext(null);
      setPrivateConversationId(null);
    }
  };

  const totalReactions = Object.values(reactions).reduce((sum, reaction) => {
    return sum + (reaction?.count || 0);
  }, 0);

  return (
    <>
      <LinearGradient
        colors={['rgba(79, 70, 229, 0.14)', 'rgba(14, 165, 233, 0.08)', 'rgba(255, 255, 255, 0.6)']}
        style={styles.cardGradient}
      >
        <NativeCard
          padding={0}
          style={[styles.cardContainer, !hasMedia && styles.cardContainerCompact]}
        >
          <TouchableOpacity
            style={styles.touchableContainer}
            activeOpacity={0.9}
            onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id || service?.id }))}
          >
            {hasMedia && (
              <View style={styles.imageContainer}>
                <ProductMediaCarousel
                  images={images}
                  videos={videos}
                  variantImage={variantImage}
                  onImagePress={() => {
                    setShowGallery(true);
                  }}
                />

                {countryFlag && (
                  <View style={styles.countryBadge}>
                    <Text style={styles.countryFlag}>{countryFlag}</Text>
                  </View>
                )}

                {/* ✅ CORRIGÉ: Afficher la distance même sans médias */}
                {hasDistance && distanceKm !== undefined && (
                  <View style={styles.distanceBadge}>
                    <SafeIcon name="navigation" size={12} color="#FFF" />
                    <Text style={styles.distanceText}>
                      {distanceKm < 1
                        ? `${Math.round(distanceKm * 1000)}m`
                        : `${distanceKm.toFixed(1)}km`}
                    </Text>
                  </View>
                )}

                {isTrending && (
                  <View style={styles.trendingBadge}>
                    <Text style={styles.trendingEmoji}>🔥🔥</Text>
                    <Text style={styles.trendingText}>Tendance</Text>
                    <Text style={styles.trendingCount}>{usageCount}×</Text>
                  </View>
                )}
                {!isTrending && isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularEmoji}>🔥</Text>
                    <Text style={styles.popularText}>Populaire</Text>
                    <Text style={styles.popularCount}>{usageCount}×</Text>
                  </View>
                )}
              </View>
            )}

            <View style={[styles.content, !hasMedia && styles.contentCompact]}>
              {/* ✅ CORRIGÉ: Afficher la distance en haut si pas de médias */}
              {!hasMedia && hasDistance && distanceKm !== undefined && (
                <View style={styles.distanceBadgeInline}>
                  <SafeIcon name="navigation" size={14} color="#6366F1" />
                  <Text style={styles.distanceTextInline}>
                    {distanceKm < 1
                      ? `${Math.round(distanceKm * 1000)}m`
                      : `${distanceKm.toFixed(1)}km`}
                  </Text>
                </View>
              )}

              {topStatsData.length > 0 && (
                <View style={styles.topStatsRow}>
                  {topStatsData.map((stat) => (
                    <View
                      key={stat.key}
                      style={[
                        styles.topStatPill,
                        { backgroundColor: `${stat.tint}12` },
                      ]}
                    >
                      <SafeIcon name={stat.icon as any} size={14} color={stat.tint} />
                      <Text style={[styles.topStatValue, { color: stat.tint }]}>
                        {formatCompactNumber(stat.value)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.productName} numberOfLines={2}>
                {(() => {
                  const nom = productData.nom || service?.data?.nom_produit?.valeur || service?.data?.titre_service?.valeur;
                  // ✅ CORRIGÉ 2026-01-07: Éviter d'afficher "false" ou autres valeurs booléennes
                  if (typeof nom === 'boolean') return 'Produit';
                  if (nom === 'false' || nom === false) return 'Produit';
                  return nom || 'Produit';
                })()}
              </Text>

              {prestataire.nom && (
                <TouchableOpacity
                  style={styles.prestataireRow}
                  onPress={() => {
                    if (prestataire.user_id) {
                      navigation.navigate('ProfilePrestataire' as any, { userId: prestataire.user_id });
                    }
                  }}
                >
                  {prestataire.avatar_url ? (
                    <Image
                      source={{ uri: prestataire.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <SafeIcon name="user" size={14} color="#FFF" />
                    </View>
                  )}
                  <Text style={styles.prestataireName} numberOfLines={1}>
                    {(() => {
                      const nom = prestataire.nom;
                      // ✅ CORRIGÉ 2026-01-07: Éviter d'afficher "false" ou autres valeurs booléennes
                      if (typeof nom === 'boolean') return 'Prestataire';
                      if (nom === 'false' || nom === false) return 'Prestataire';
                      return nom || 'Prestataire';
                    })()}
                  </Text>
                  <SafeIcon name="chevron-right" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              {chosenLocation && (
                <View style={styles.locationSection}>
                  <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                    <Text style={styles.locationTextPrimary} numberOfLines={1}>
                      {chosenLocation || 'Localisation non spécifiée'}
                    </Text>
                    {countryFlag && (
                      <Text style={styles.locationFlag}>{countryFlag}</Text>
                    )}
                  </View>
                  {locationVector.length > 1 && (
                    <View style={styles.locationHierarchy}>
                      <SafeIcon name="corner-down-right" size={12} color="#9CA3AF" />
                      <Text style={styles.locationTextSecondary} numberOfLines={1}>
                        {locationVector.slice(1).join(' › ')}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {(totalReactions > 0 || usageCount > 0) && (
                <LinearGradient
                  colors={['#EEF2FF', '#FFFFFF']}
                  style={styles.metricsCard}
                >
                  <View style={styles.compactStatsRow}>
                    {totalReactions > 0 && (
                      <View style={styles.compactStatPillMuted}>
                        <Text style={styles.compactStatEmoji}>🎭</Text>
                        <Text style={styles.compactStatValue}>{totalReactions}</Text>
                        <Text style={styles.compactStatLabel}>réactions</Text>
                      </View>
                    )}

                    {usageCount > 0 && (
                      <View style={styles.compactStatPillMuted}>
                        <Text style={styles.compactStatEmoji}>🔥</Text>
                        <Text style={styles.compactStatValue}>{usageCount}</Text>
                        <Text style={styles.compactStatLabel}>recherches</Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              )}

              {productVector.length > 0 && (
                <View style={styles.characteristicsSection}>
                  <View style={styles.sectionHeader}>
                    <SafeIcon name="tag" size={14} color="#6B7280" />
                    <Text style={styles.sectionTitle}>Caractéristiques</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsScroll}
                  >
                    {productVector.map((carac: string, i: number) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{carac}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {hasVariant && variants.length > 0 ? (
                <View style={styles.priceVariations}>
                  <View style={styles.sectionHeader}>
                    <SafeIcon name="dollar-sign" size={14} color="#6B7280" />
                    <Text style={styles.sectionTitle}>
                      Prix selon {(() => {
                        const dim = productData.variant_dimension;
                        // ✅ CORRIGÉ 2026-01-07: Éviter d'afficher "false"
                        if (typeof dim === 'boolean' || dim === 'false' || dim === false) return 'variante';
                        return dim || 'variante';
                      })()}
                    </Text>
                  </View>

                  <View style={styles.priceTable}>
                    <View style={styles.priceTableHeader}>
                      <Text style={styles.tableHeaderText}>Variante</Text>
                      <Text style={styles.tableHeaderText}>Prix</Text>
                      <Text style={styles.tableHeaderText}>Stock</Text>
                    </View>

                    {variants.slice(0, 5).map((variant: any, i: number) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.priceRow,
                          selectedVariantIndex === i && styles.priceRowSelected
                        ]}
                        onPress={() => {
                          setSelectedVariantIndex(selectedVariantIndex === i ? null : i);
                        }}
                      >
                        <View style={styles.cellVariant}>
                          {variant.image && (
                            <Image
                              source={{ uri: variant.image.startsWith('data:') ? variant.image : `data:image/jpeg;base64,${variant.image}` }}
                              style={styles.variantImageThumb}
                              resizeMode="cover"
                            />
                          )}
                          <Text style={styles.variantValue}>{variant.value || variant.valeur}</Text>
                        </View>
                        <View style={styles.cellPrice}>
                          <Text style={styles.variantPrice}>
                            {variant.prix?.toLocaleString()}
                          </Text>
                          <Text style={styles.variantDevise}>{variant.devise || devise}</Text>
                        </View>
                        <View style={styles.cellStock}>
                          <View style={[
                            styles.stockBadge,
                            (variant.stock || 0) > 5 ? styles.stockOK :
                              (variant.stock || 0) > 0 ? styles.stockLow : styles.stockOut
                          ]}>
                            <Text style={styles.stockText}>
                              {(variant.stock || 0) > 0 ? `${variant.stock}` : '0'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {variants.length > 5 && (
                      <Text style={styles.moreVariantsText}>
                        +{variants.length - 5} autres variantes
                      </Text>
                    )}
                  </View>

                  <View style={styles.priceFromContainer}>
                    <Text style={styles.priceFromLabel}>À partir de</Text>
                    <Text style={styles.priceFromValue}>
                      {displayPrice.toLocaleString()} {devise}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.priceUniqueContainer}>
                  <Text style={styles.priceLabel}>Prix</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      {displayPrice.toLocaleString()}
                    </Text>
                    <Text style={styles.priceDevise}>{devise}</Text>
                  </View>
                </View>
              )}

              <View style={styles.actions}>
                {/* ✅ CORRIGÉ: Toujours afficher le bouton "Me livrer" pour les produits, même si désactivé */}
                {serviceId && isProduct && (
                  <TouchableOpacity
                    style={[
                      styles.actionButtonDelivery,
                      styles.actionButton,
                      !deliveryEnabled && styles.actionButtonDeliveryDisabled
                    ]}
                    onPress={() => {
                      if (!serviceId) {
                        Alert.alert('Erreur', 'Service non disponible');
                        return;
                      }
                      if (!deliveryEnabled) {
                        Alert.alert(
                          'Livraison non disponible',
                          'La livraison n\'est pas activée pour ce produit. Contactez le prestataire pour plus d\'informations.'
                        );
                        return;
                      }
                      setShowOrderModal(true);
                    }}
                    disabled={!deliveryEnabled}
                    activeOpacity={0.7}
                  >
                    <SafeIcon
                      name="truck"
                      size={18}
                      color={deliveryEnabled ? "#10B981" : "#9CA3AF"}
                    />
                    <Text style={[
                      styles.actionButtonDeliveryText,
                      !deliveryEnabled && styles.actionButtonDeliveryTextDisabled
                    ]}>
                      Me livrer
                    </Text>
                  </TouchableOpacity>
                )}

                <NativeButton
                  title="💬 Chat"
                  variant="primary"
                  onPress={handleChatPress}
                  style={[styles.actionButton, !(serviceId && isProduct) && styles.actionButtonFullWidth]}
                />
                <NativeButton
                  title="👁️ Voir"
                  variant="secondary"
                  onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id || service?.id }))}
                  style={styles.actionButton}
                />
              </View>

              <View style={styles.secondaryActions}>
                {hasMedia && (
                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={() => setShowGallery(true)}
                  >
                    <SafeIcon name="image" size={18} color={modernColors.primary} />
                    <Text style={styles.secondaryActionText}>Galerie</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  onPress={handleShare}
                >
                  <SafeIcon name="share" size={18} color={modernColors.primary} />
                  <Text style={styles.secondaryActionText}>Partager</Text>
                </TouchableOpacity>
              </View>

              {Number.isFinite(commentServiceId) && commentServiceId > 0 && (
                <ProductCommentsSection
                  serviceId={commentServiceId}
                  serviceTitle={serviceTitleForComments}
                  onOpenChat={handleContactUser}
                />
              )}

              <View style={styles.footer}>
                {hasDistance && (
                  <View style={styles.footerItem}>
                    <SafeIcon name="map-pin" size={12} color="#9CA3AF" />
                    <Text style={styles.footerText}>
                      {distanceKm < 1
                        ? 'Très proche'
                        : distanceKm < 5
                          ? 'À proximité'
                          : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`}
                    </Text>
                  </View>
                )}
                {productData.usage_count && (
                  <View style={styles.footerItem}>
                    <SafeIcon name="eye" size={12} color="#9CA3AF" />
                    <Text style={styles.footerText}>
                      {productData.usage_count} vues
                    </Text>
                  </View>
                )}
                {productData.created_at && (
                  <View style={styles.footerItem}>
                    <SafeIcon name="clock" size={12} color="#9CA3AF" />
                    <Text style={styles.footerText}>
                      {formatDate(productData.created_at)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </NativeCard>
      </LinearGradient>

      {/* ✅ CORRIGÉ 2026-01-12: Supprimé logique obsolète showChatModal
          Le chat est maintenant géré par le parent via onChatPress
          Cette logique causait l'erreur "Property 'showChatModal' doesn't exist"
      */}

      {showOrderModal && serviceId && (
        <OrderDeliveryModal
          visible={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          serviceId={serviceId}
          productIndex={productIndex}
          productName={productData.nom || productData.name || productData.titre || 'Produit'}
          onSuccess={(deliveryId) => {
            console.log('[ProductCard] Livraison créée:', deliveryId);
            setShowOrderModal(false);
            Alert.alert('Succès', 'Votre commande de livraison a été créée avec succès');
          }}
        />
      )}

      {showGallery && (
        <ServiceGalleryModal
          visible={showGallery}
          service={service || {
            id: String(product.service_id || service?.id),
            titre: productData.nom || service?.data?.titre_service?.valeur || 'Produit',
            description: productData.description || service?.data?.description?.valeur || '',
            user_id: String(prestataire.user_id || service?.user_id || ''),
            data: service?.data || {},
          }}
          onClose={() => setShowGallery(false)}
        />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // ✅ CORRIGÉ 2025-01-02: Comparaison personnalisée optimisée pour éviter les re-renders inutiles
  // Comparer les IDs et valeurs clés plutôt que les objets entiers
  const prevProductId = prevProps.product?._serviceId || prevProps.product?.service_id || prevProps.product?.id;
  const nextProductId = nextProps.product?._serviceId || nextProps.product?.service_id || nextProps.product?.id;
  
  const prevServiceId = prevProps.service?.id;
  const nextServiceId = nextProps.service?.id;
  
  const prevPrestataireId = prevProps.prestataire?.user_id || prevProps.prestataire?.userId || prevProps.prestataire?.id;
  const nextPrestataireId = nextProps.prestataire?.user_id || nextProps.prestataire?.userId || nextProps.prestataire?.id;
  
  const prevLocation = prevProps.userLocation ? `${prevProps.userLocation.latitude},${prevProps.userLocation.longitude}` : null;
  const nextLocation = nextProps.userLocation ? `${nextProps.userLocation.latitude},${nextProps.userLocation.longitude}` : null;
  
  // ✅ Ne re-render que si les valeurs clés changent
  return (
    prevProductId === nextProductId &&
    prevServiceId === nextServiceId &&
    prevPrestataireId === nextPrestataireId &&
    prevLocation === nextLocation &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onChatPress === nextProps.onChatPress
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    overflow: 'hidden',
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  cardContainerCompact: {
    borderRadius: 24,
  },
  touchableContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 220,
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  countryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  countryFlag: {
    fontSize: 20,
  },
  distanceBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  distanceBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  distanceTextInline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },
  trendingBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  trendingEmoji: {
    fontSize: 14,
  },
  trendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  trendingCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.9,
  },
  popularBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(251, 146, 60, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  popularEmoji: {
    fontSize: 13,
  },
  popularText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  popularCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.9,
  },
  content: {
    padding: 20,
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  contentCompact: {
    paddingTop: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  topStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  topStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  topStatValue: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  productName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 26,
  },
  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prestataireName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  locationSection: {
    gap: 6,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationTextPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  locationFlag: {
    fontSize: 16,
  },
  locationHierarchy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 20,
  },
  locationTextSecondary: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
    fontStyle: 'italic',
  },
  metricsCard: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  compactStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  compactStatPillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 6,
  },
  compactStatEmoji: {
    fontSize: 14,
  },
  compactStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  compactStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  characteristicsSection: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: modernColors.primary,
  },
  chipText: {
    fontSize: 13,
    color: modernColors.primary,
    fontWeight: '600',
  },
  priceVariations: {
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
  },
  priceTable: {
    gap: 6,
  },
  priceTableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    flex: 1,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    borderRadius: 6,
  },
  priceRowSelected: {
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: modernColors.primary,
  },
  cellVariant: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantImageThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cellPrice: {
    flex: 1,
    alignItems: 'center',
  },
  cellStock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  variantValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  variantPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: modernColors.primary,
  },
  variantDevise: {
    fontSize: 11,
    color: '#6B7280',
  },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  stockOK: {
    backgroundColor: '#D1FAE5',
  },
  stockLow: {
    backgroundColor: '#FEF3C7',
  },
  stockOut: {
    backgroundColor: '#FEE2E2',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  moreVariantsText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    paddingTop: 6,
    fontStyle: 'italic',
  },
  priceFromContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  priceFromLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  priceFromValue: {
    fontSize: 17,
    fontWeight: '700',
    color: modernColors.primary,
  },
  priceUniqueContainer: {
    gap: 6,
  },
  priceLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  price: {
    fontSize: 24,
    fontWeight: '800',
    color: modernColors.primary,
  },
  priceDevise: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
    minHeight: 48,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
  },
  actionButtonFullWidth: {
    flex: 1,
    minWidth: '100%',
  },
  actionButtonDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#10B981',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
    minWidth: 100,
  },
  actionButtonDeliveryDisabled: {
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
    opacity: 0.6,
  },
  actionButtonDeliveryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonDeliveryTextDisabled: {
    color: '#9CA3AF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: modernColors.primary,
  },
  cardGradient: {
    borderRadius: 28,
    padding: 1,
    marginBottom: 20,
  },
});

export default ProductCard;
