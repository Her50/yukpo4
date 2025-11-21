/**
 * ProductCard v3.0 - Version optimale moderne (2025-11-02)
 * Toutes fonctionnalités : vecteurs, variations, chat, distance, drapeau pays
 * Sauvegarde : ProductCard.backup.tsx
 */

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { config } from '../config/environment';
import { apiGet, apiPost, commentsApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import ChatModalMobile from './ChatModalMobile';
import OrderDeliveryModal from './delivery/OrderDeliveryModal';
import { NativeCard } from './NativeDesign';
import ProductCommentsSection from './ProductCommentsSection';
import ProductMediaCarousel from './ProductMediaCarousel';
import SafeIcon from './SafeIcon';
import ServiceGalleryModal from './ServiceGalleryModal';

const { width } = Dimensions.get('window');

interface ProductCardProps {
  product: any;
  service: any;
  prestataire?: any; // ✅ NOUVEAU: Prestataire déjà fourni depuis MixedContentCarousel
  userLocation?: { latitude: number; longitude: number } | null;
  onPress?: () => void;
  onChatPress?: () => void; // ✅ NOUVEAU: Handler chat personnalisé
}

// ✅ NOUVEAU : Constantes pour réactions
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

// Mapper codes pays → drapeaux emoji
const getCountryFlag = (country?: string): string => {
  if (!country || typeof country !== 'string') return '🌍';

  const countryLower = country.trim().toLowerCase();

  // ✅ AMÉLIORÉ: Mapping plus complet et robuste
  const countryMap: Record<string, string> = {
    // Cameroun
    'cameroun': '🇨🇲',
    'cameroon': '🇨🇲',
    'cm': '🇨🇲',
    'cmr': '🇨🇲',
    // Gabon
    'gabon': '🇬🇦',
    'ga': '🇬🇦',
    'gab': '🇬🇦',
    // Congo
    'congo': '🇨🇬',
    'cg': '🇨🇬',
    'cog': '🇨🇬',
    // RDC
    'rdc': '🇨🇩',
    'rd congo': '🇨🇩',
    'république démocratique du congo': '🇨🇩',
    'republic democratique du congo': '🇨🇩',
    'cd': '🇨🇩',
    'cod': '🇨🇩',
    // Sénégal
    'sénégal': '🇸🇳',
    'senegal': '🇸🇳',
    'sn': '🇸🇳',
    'sen': '🇸🇳',
    // Côte d'Ivoire
    'côte d\'ivoire': '🇨🇮',
    'cote d\'ivoire': '🇨🇮',
    'ivory coast': '🇨🇮',
    'ci': '🇨🇮',
    'civ': '🇨🇮',
    // Mali
    'mali': '🇲🇱',
    'ml': '🇲🇱',
    'mli': '🇲🇱',
    // Burkina Faso
    'burkina': '🇧🇫',
    'burkina faso': '🇧🇫',
    'bf': '🇧🇫',
    'bfa': '🇧🇫',
    // Niger
    'niger': '🇳🇪',
    'ne': '🇳🇪',
    'ner': '🇳🇪',
    // Tchad
    'tchad': '🇹🇩',
    'chad': '🇹🇩',
    'td': '🇹🇩',
    'tcd': '🇹🇩',
    // Togo
    'togo': '🇹🇬',
    'tg': '🇹🇬',
    'tgo': '🇹🇬',
    // Bénin
    'bénin': '🇧🇯',
    'benin': '🇧🇯',
    'bj': '🇧🇯',
    'ben': '🇧🇯',
    // Guinée
    'guinée': '🇬🇳',
    'guinee': '🇬🇳',
    'guinea': '🇬🇳',
    'gn': '🇬🇳',
    'gin': '🇬🇳',
    // Madagascar
    'madagascar': '🇲🇬',
    'mg': '🇲🇬',
    'mdg': '🇲🇬',
    // France
    'france': '🇫🇷',
    'fr': '🇫🇷',
    'fra': '🇫🇷',
    // USA
    'usa': '🇺🇸',
    'united states': '🇺🇸',
    'united states of america': '🇺🇸',
    'us': '🇺🇸',
  };

  // Recherche exacte d'abord
  if (countryMap[countryLower]) {
    return countryMap[countryLower];
  }

  // Recherche partielle (contient)
  for (const [key, flag] of Object.entries(countryMap)) {
    if (countryLower.includes(key) || key.includes(countryLower)) {
      return flag;
    }
  }

  return '🌍';
};

const firstNonEmptyString = (...values: any[]): string | undefined => {
  for (const candidate of values) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
};

const parseDistanceToKm = (value: any): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase().replace(',', '.');
    const match = normalized.match(/([\d.]+)/);
    if (!match) {
      return undefined;
    }

    const numeric = parseFloat(match[1]);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }

    if (normalized.includes('m') && !normalized.includes('km')) {
      return numeric / 1000;
    }

    return numeric;
  }

  return undefined;
};

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  service,
  prestataire: prestataireFromProps,
  userLocation = null,
  onPress,
  onChatPress,
}) => {
  const navigation = useNavigation();
  const [imageError, setImageError] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  // ✅ NOUVEAU : États pour contact privé
  const [privateConversationId, setPrivateConversationId] = useState<string | null>(null);
  const [chatContext, setChatContext] = useState<{
    type: 'service' | 'private';
    targetUserId?: number;
    targetUserName?: string;
    targetAvatar?: string | null;
  } | null>(null);
  // ✅ NOUVEAU : États pour avis/ratings et galerie
  const [showGallery, setShowGallery] = useState(false);
  // ✅ NOUVEAU : États pour réactions
  const [reactions, setReactions] = useState<Record<string, { count: number; hasReacted: boolean }>>({});
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<string | null>(null);
  // ✅ NOUVEAU : États pour commentaires compacts
  const [commentStats, setCommentStats] = useState<{ total_comments: number; rating_count: number; average_rating: number } | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // Données produit
  const productVector = Array.isArray(product.product_vector)
    ? product.product_vector
    : Array.isArray(product.characteristic_vector)
      ? product.characteristic_vector
      : typeof product.product_vector === 'string'
        ? splitWithFallback(product.product_vector, ',')
        : [];
  const maxDisplayedCaracs = 6;
  const limitedProductVector = productVector.slice(0, maxDisplayedCaracs);
  const hasMoreCaracs = productVector.length > maxDisplayedCaracs;

  const rawLocationVector = product.location_vector || product.locationVector || product.location?.vector;
  const locationVector = Array.isArray(rawLocationVector)
    ? rawLocationVector.filter(Boolean)
    : typeof rawLocationVector === 'string'
      ? splitWithFallback(rawLocationVector, ',')
      : [];

  // ✅ AMÉLIORATION: Afficher quartier en priorité, puis ville, puis région
  const chosenLocation = firstNonEmptyString(
    product.chosen_location,
    product.location?.primary,
    product.location?.address,
    product.location?.formatted_address,
    product.location?.full_address,
    locationVector[0], // Premier élément = lieu exact choisi par prestataire
    product.location_name,
    product.location_label,
    product.location_text,
    product.location,
    product.lieu,
    product.quartier,
    product.city,
    product.ville,
    product.commune,
    product.region,
    product.departement,
    product.adresse_complete,
    product.adresse,
    product.address,
    product.localisation,
    product.site,
    service?.data?.adresse_complete?.valeur,
    service?.data?.adresse?.valeur,
    service?.data?.adresse_service?.valeur,
    service?.data?.adresse_prestataire?.valeur,
    service?.data?.localisation?.valeur,
    service?.data?.lieu?.valeur,
    service?.data?.ville?.valeur,
    service?.data?.quartier?.valeur,
    service?.data?.region?.valeur,
  ) || '';

  const hasVariant = product.has_variant || false;
  const variants = product.variants || [];
  const rawPrestataire =
    prestataireFromProps ||
    product.prestataire ||
    service?.prestataire ||
    {
      nom: service?.data?.nom_prestataire?.valeur ||
        service?.data?.prestataire_nom?.valeur ||
        service?.data?.contact_nom?.valeur ||
        service?.data?.nom_prestataire ||
        service?.data?.prestataire_nom ||
        product?.prestataire_nom ||
        product?.prestataire_name ||
        product?.owner_name ||
        product?.vendor_name ||
        'Prestataire',
      user_id: service?.user_id,
      avatar_url: service?.data?.photo_prestataire?.valeur,
    };

  const prestataireName =
    firstNonEmptyString(
      rawPrestataire?.nom,
      rawPrestataire?.nom_complet,
      rawPrestataire?.name,
      rawPrestataire?.username,
      rawPrestataire?.display_name,
      rawPrestataire?.full_name,
      rawPrestataire?.raison_sociale,
      product.prestataire_nom,
      product.prestataire_nom_affiche,
      product.prestataire_nom_commercial,
      product.prestataire_nom_complet,
      product.prestataire_name,
      product.prestataire_fullname,
      product.prestataire?.nom,
      product.prestataire?.nom_complet,
      product.prestataire?.name,
      product.owner?.nom,
      product.owner?.nom_complet,
      product.owner?.name,
      product.owner?.full_name,
      product.vendor?.nom,
      product.vendor?.name,
      product.user_name,
      product.contact_nom,
      product.contact_name,
      product.responsable_nom,
      product.gerant_nom,
      service?.prestataire?.nom,
      service?.prestataire?.nom_complet,
      service?.data?.nom_prestataire?.valeur,
      service?.data?.prestataire_nom?.valeur,
      service?.data?.contact_nom?.valeur,
      service?.data?.nom?.valeur,
      service?.data?.nom_entreprise?.valeur,
      service?.data?.responsable_nom?.valeur,
      service?.data?.representant_nom?.valeur,
    ) || 'Prestataire';

  const prestataireAvatar = firstNonEmptyString(
    rawPrestataire?.avatar_url,
    rawPrestataire?.photo_profil,
    rawPrestataire?.photo,
    rawPrestataire?.avatar,
    rawPrestataire?.image_url,
    product.prestataire_avatar,
    product.prestataire?.avatar_url,
    product.prestataire?.avatar,
    product.owner?.avatar,
    product.vendor?.avatar_url,
    service?.prestataire?.avatar_url,
    service?.data?.photo_prestataire?.valeur,
    service?.data?.photo_profil?.valeur,
  );

  const prestataireUserId =
    rawPrestataire?.user_id ||
    product.prestataire?.user_id ||
    service?.user_id ||
    service?.data?.user_id;

  const prestataire = {
    ...rawPrestataire,
    nom: prestataireName,
    nom_complet: prestataireName,
    avatar_url: prestataireAvatar,
    user_id: prestataireUserId,
  };

  // ✅ NOUVEAU : Popularité (usage_count de autocomplete_characteristics)
  const usageCount = product.usage_count || 0;
  const isPopular = usageCount >= 5;  // Populaire si recherché 5+ fois
  const isTrending = usageCount >= 10; // Tendance si recherché 10+ fois

  // Images et vidéos
  const rawProductImages: string[] = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : [];
  const rawServiceImages: string[] = Array.isArray(service?.images)
    ? (service?.images as string[]).filter(Boolean)
    : [];
  const serviceBannerImage = firstNonEmptyString(
    service?.data?.banner?.valeur,
    service?.data?.banner,
  );
  const serviceLogoImage = firstNonEmptyString(
    service?.data?.logo?.valeur,
    service?.data?.logo,
  );
  const googlePlaceMeta = service?.data?.google_place;
  const googlePhotoUrls: string[] = Array.isArray(googlePlaceMeta?.photos)
    ? (googlePlaceMeta.photos as any[])
      .map((photo) => {
        const name = typeof photo?.name === 'string' ? photo.name : null;
        if (!name) {
          return null;
        }
        const maxWidth =
          typeof photo?.width_px === 'number' && photo.width_px > 0
            ? Math.min(photo.width_px, 1600)
            : 800;
        return `${config.API_BASE_URL}/api/places/photo?name=${encodeURIComponent(
          name,
        )}&maxWidth=${maxWidth}`;
      })
      .filter((url): url is string => typeof url === 'string')
    : [];

  const orderedImages: string[] = [];
  const addImage = (uri?: string | null) => {
    if (!uri) return;
    if (orderedImages.includes(uri)) return;
    orderedImages.push(uri);
  };

  addImage(serviceBannerImage);
  addImage(serviceLogoImage);
  rawProductImages.forEach(addImage);
  rawServiceImages.forEach(addImage);
  googlePhotoUrls.forEach(addImage);

  const images = orderedImages;
  const videos: string[] = Array.isArray(product.videos)
    ? product.videos.filter(Boolean)
    : Array.isArray(service?.videos)
      ? (service?.videos as string[]).filter(Boolean)
      : [];

  const googleRating =
    typeof googlePlaceMeta?.rating === 'number' ? googlePlaceMeta.rating : null;
  const googleRatingCount =
    typeof googlePlaceMeta?.rating_count === 'number'
      ? googlePlaceMeta.rating_count
      : null;
  const googlePrimaryTag = firstNonEmptyString(
    googlePlaceMeta?.primary_type_display_name,
    googlePlaceMeta?.primary_type,
  );
  const googleCuisineBadges = Array.isArray(googlePlaceMeta?.serves_cuisine)
    ? (googlePlaceMeta.serves_cuisine as string[])
      .filter((cuisine) => typeof cuisine === 'string' && cuisine.trim().length > 0)
      .slice(0, 3)
    : [];
  const googleOpenNow = (() => {
    const opening = googlePlaceMeta?.current_opening_hours;
    if (opening && typeof opening === 'object' && 'openNow' in opening) {
      const value = (opening as any).openNow;
      if (typeof value === 'boolean') {
        return value;
      }
    }
    return null;
  })();
  const googleOpeningHeadline = (() => {
    const opening = googlePlaceMeta?.current_opening_hours;
    if (opening && typeof opening === 'object') {
      const nextMessage = (opening as any).nextOpenTimeMessage;
      if (typeof nextMessage === 'string' && nextMessage.trim().length > 0) {
        return nextMessage.trim();
      }
      const descriptions = (opening as any).weekdayDescriptions;
      if (Array.isArray(descriptions) && descriptions.length > 0) {
        return descriptions[0];
      }
    }
    return null;
  })();
  const googleEditorialSummary =
    typeof googlePlaceMeta?.editorial_summary === 'string'
      ? googlePlaceMeta.editorial_summary
      : undefined;
  const googleMapsUri =
    typeof googlePlaceMeta?.google_maps_uri === 'string'
      ? googlePlaceMeta.google_maps_uri
      : undefined;

  // Image de la variation sélectionnée (si existe)
  const selectedVariant = selectedVariantIndex !== null && variants[selectedVariantIndex]
    ? variants[selectedVariantIndex]
    : null;
  const variantImage = selectedVariant?.image || selectedVariant?.images?.[0];
  const hasMedia = images.length > 0 || videos.length > 0 || !!variantImage;

  const serviceId = product.service_id || service?.id;
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

  // ✅ Vérifier si c'est un produit (pas une prestation de service)
  // Par défaut, si le type n'est pas défini, on considère que c'est un produit
  const isProduct = product.type !== 'prestation_service';

  // Prix
  const displayPrice = hasVariant && variants.length > 0
    ? Math.min(...variants.map((v: any) => v.prix || 0))
    : product.prix || 0;

  const devise = product.devise || variants[0]?.devise || 'XAF';

  // Distance
  const rawDistance = product.distance_km
    ?? product.distanceKm
    ?? product.distance
    ?? product.distance_client
    ?? product.distance_user
    ?? product.distance_user_km
    ?? product.distanceFromUser
    ?? product.distance_text;
  const distanceKm = parseDistanceToKm(rawDistance);
  const hasDistance = typeof distanceKm === 'number' && Number.isFinite(distanceKm);
  const formattedDistance = hasDistance
    ? distanceKm! < 1
      ? `${Math.round(distanceKm! * 1000)}m`
      : `${distanceKm!.toFixed(distanceKm! < 10 ? 1 : 0)}km`
    : null;

  // Pays (pour drapeau) - Extraction améliorée depuis plusieurs sources
  // Essayer d'extraire le pays depuis l'adresse complète si disponible
  const extractCountryFromAddress = (address: string | undefined): string | undefined => {
    if (!address || typeof address !== 'string') return undefined;

    // Liste des pays à chercher dans l'adresse
    const countryKeywords = [
      'Cameroun', 'Cameroon', 'CM', 'CMR',
      'Gabon', 'GA', 'GAB',
      'Congo', 'CG', 'COG',
      'RDC', 'RD Congo', 'République démocratique du Congo',
      'Sénégal', 'Senegal', 'SN', 'SEN',
      'Côte d\'Ivoire', 'Cote d\'Ivoire', 'Ivory Coast', 'CI', 'CIV',
      'Mali', 'ML', 'MLI',
      'Burkina', 'Burkina Faso', 'BF', 'BFA',
      'Niger', 'NE', 'NER',
      'Tchad', 'Chad', 'TD', 'TCD',
      'Togo', 'TG', 'TGO',
      'Bénin', 'Benin', 'BJ', 'BEN',
      'Guinée', 'Guinee', 'Guinea', 'GN', 'GIN',
      'Madagascar', 'MG', 'MDG',
      'France', 'FR', 'FRA',
      'USA', 'United States', 'US', 'USA',
    ];

    const addressLower = address.toLowerCase();
    for (const keyword of countryKeywords) {
      if (addressLower.includes(keyword.toLowerCase())) {
        return keyword;
      }
    }
    return undefined;
  };

  const pays = firstNonEmptyString(
    extractCountryFromAddress(chosenLocation || product.adresse_complete || product.adresse || product.address),
    extractCountryFromAddress(product.location?.formatted_address || product.location?.full_address || product.location?.address),
    locationVector[locationVector.length - 1], // Dernier élément du vecteur = pays
    product.pays,
    product.country,
    product.country_name,
    product.country_code,
    product.countryCode,
    product.country_label,
    product.location?.country,
    product.location?.country_code,
    service?.data?.pays?.valeur,
    service?.data?.pays_origine?.valeur,
    service?.data?.country?.valeur,
    service?.data?.country_code?.valeur,
  );

  const countryFlag = getCountryFlag(pays);
  const showCountryBadge = countryFlag && countryFlag !== '🌍';

  // Debug: afficher le pays extrait
  if (pays) {
    console.log('[ProductCard] Pays extrait:', pays, 'Drapeau:', countryFlag);
  }

  const commentServiceId = Number(product._serviceId || product.service_id || service?.id || 0);
  const serviceTitleForComments =
    product.nom ||
    product.name ||
    product.titre ||
    product.title ||
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
    product.views ??
    product.vues ??
    product.consultations ??
    service?.views ??
    usageCount ??
    0;

  const sharesCount =
    product.shares ??
    product.partages ??
    product.share_count ??
    service?.shares ??
    0;

  const reviewsCount =
    product.reviews ??
    product.reviews_count ??
    product.nb_avis ??
    service?.reviews_count ??
    0;

  const favoritesCount =
    product.favoris ??
    product.likes ??
    product.favorites ??
    product.saves ??
    product.bookmarks ??
    0;

  const topStatsData = [
    { key: 'views', icon: 'eye', value: viewsCount, tint: '#4f46e5', label: 'vues' },
    { key: 'shares', icon: 'share-2', value: sharesCount, tint: '#a855f7', label: 'partages' },
    { key: 'reviews', icon: 'message-circle', value: reviewsCount, tint: '#f59e0b', label: 'avis' },
    { key: 'favorites', icon: 'heart', value: favoritesCount, tint: '#ef4444', label: 'favoris' },
  ];
  // ✅ CORRIGÉ : Toujours afficher les 3 premières statistiques principales même si elles sont à 0
  const compactTopStats = topStatsData.slice(0, 3);

  // ✅ CORRIGÉ: Toujours ouvrir le modal - amélioration robuste
  const handleChatPress = () => {
    // Appeler onChatPress si fourni (pour compatibilité)
    if (onChatPress) {
      onChatPress();
    }

    // Toujours ouvrir le modal - laisser ChatModalMobile gérer les cas manquants
    // Essayer de récupérer prestataireUserId de plusieurs sources
    const resolvedPrestataireUserId =
      prestataireUserId ||
      prestataire?.user_id ||
      product?.prestataire?.user_id ||
      service?.user_id ||
      service?.data?.user_id ||
      null;

    if (!resolvedPrestataireUserId && !service?.id && !product?.service_id) {
      Alert.alert(
        'Information manquante',
        'Impossible d\'ouvrir le chat : informations du service ou du prestataire manquantes.'
      );
      return;
    }

    // Toujours ouvrir le modal local avec les informations disponibles
    setChatContext({
      type: 'service',
      targetUserId: resolvedPrestataireUserId ? Number(resolvedPrestataireUserId) : undefined,
      targetUserName: prestataire.nom || prestataireName || 'Prestataire',
      targetAvatar: prestataire.avatar_url || prestataireAvatar || null,
    });
    setPrivateConversationId(null);
    setShowChatModal(true);
  };

  // ✅ NOUVEAU : Handler partage produit
  const handleShare = async () => {
    try {
      const productName = product.nom || service?.data?.nom_produit?.valeur || service?.data?.titre_service?.valeur || 'Produit';
      const productDesc = product.description || service?.data?.description_produit?.valeur || service?.data?.description?.valeur || '';
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

  // ✅ NOUVEAU : Charger réactions du produit
  const loadReactions = useCallback(async () => {
    if (!serviceId || !resolvedProductId) return;

    try {
      setLoadingReactions(true);
      const response = await apiGet(`/api/products/${serviceId}/${resolvedProductId}/reactions`);
      if (response.success && response.data) {
        const reactionsMap: Record<string, { count: number; hasReacted: boolean }> = {};
        const reactionsArray = response.data as any[];
        reactionsArray.forEach((r: any) => {
          reactionsMap[r.reaction_type] = {
            count: r.count,
            hasReacted: r.has_reacted
          };
        });
        setReactions(reactionsMap);
      }
    } catch (error) {
      console.error('[ProductCard] Erreur chargement réactions:', error);
    } finally {
      setLoadingReactions(false);
    }
  }, [resolvedProductId, serviceId]);

  useEffect(() => {
    loadReactions();
  }, [loadReactions]);

  // ✅ NOUVEAU : Charger les stats des commentaires (version compacte)
  const loadCommentStats = useCallback(async () => {
    if (!commentServiceId || commentServiceId <= 0) return;
    try {
      setLoadingComments(true);
      const response = await commentsApi.getProductComments(commentServiceId);
      if (response.success && response.data) {
        const payload: any = response.data;
        setCommentStats({
          total_comments: payload.stats?.total_comments ?? payload.comments?.length ?? 0,
          rating_count: payload.stats?.rating_count ?? 0,
          average_rating: payload.stats?.average_rating ?? 0,
        });
      }
    } catch (error) {
      console.error('[ProductCard] Erreur chargement stats commentaires:', error);
    } finally {
      setLoadingComments(false);
    }
  }, [commentServiceId]);

  useEffect(() => {
    loadCommentStats();
  }, [loadCommentStats]);

  // ✅ NOUVEAU : Handler pour réagir
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
      Alert.alert('Erreur', 'Impossible d’enregistrer votre réaction pour le moment.');
    } finally {
      setPendingReaction(null);
    }
  };

  // ✅ NOUVEAU : Handler pour contacter un utilisateur en privé
  const handleContactUser = async (userId: number, userName: string, userAvatar?: string | null) => {
    try {
      // Vérifier si une conversation existe déjà
      const checkResponse = await apiGet(`/api/conversations/private/${userId}`);

      let conversationId: string | null = null;

      if (checkResponse.success && checkResponse.data) {
        const data = checkResponse.data as { conversation_id?: string };
        conversationId = data.conversation_id || null;
      }

      if (!conversationId) {
        // Créer une nouvelle conversation privée
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

  const handleCloseChatModal = () => {
    setShowChatModal(false);
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
        colors={['rgba(79, 70, 229, 0.12)', 'rgba(14, 165, 233, 0.05)', 'rgba(255, 255, 255, 0.45)']}
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
            {/* Carousel d'images/vidéos avec support variation */}
            {hasMedia && (
              <View style={styles.imageContainer}>
                <ProductMediaCarousel
                  images={images}
                  videos={videos}
                  variantImage={variantImage}
                  onImagePress={() => {
                    // ✅ NOUVEAU : Ouvrir galerie complète du prestataire
                    setShowGallery(true);
                  }}
                />

                {/* Badge pays (coin supérieur droit) */}
                {showCountryBadge && (
                  <View style={styles.countryBadge}>
                    <Text style={styles.countryFlag}>{countryFlag}</Text>
                  </View>
                )}

                {/* Badge distance (coin supérieur gauche) */}
                {formattedDistance && (
                  <View style={styles.distanceBadge}>
                    <SafeIcon name="navigation" size={12} color="#FFF" />
                    <Text style={styles.distanceText}>{formattedDistance}</Text>
                  </View>
                )}

                {/* ✅ NOUVEAU : Badge popularité (coin inférieur gauche) */}
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
              {/* ✅ CORRIGÉ: Toujours afficher les statistiques principales avec icônes */}
              <View style={styles.topStatsRow}>
                {compactTopStats.map((stat) => (
                  <View
                    key={stat.key}
                    style={[
                      styles.topStatPillCompact,
                      { backgroundColor: `${stat.tint}08` },
                      { borderColor: `${stat.tint}30` },
                    ]}
                  >
                    <SafeIcon name={stat.icon as any} size={14} color={stat.tint} />
                    <Text style={[styles.topStatValueCompact, { color: stat.tint }]}>
                      {formatCompactNumber(stat.value ?? 0)}
                    </Text>
                    <Text style={[styles.topStatLabelCompact, { color: stat.tint }]}>
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Nom produit */}
              <Text style={styles.productName} numberOfLines={2}>
                {product.nom || service?.data?.nom_produit?.valeur || service?.data?.titre_service?.valeur || 'Produit'}
              </Text>

              {/* ✅ AMÉLIORÉ: Prestataire cliquable - S'assure d'afficher le vrai nom */}
              {prestataireName && prestataireName !== 'Prestataire' && (
                <TouchableOpacity
                  style={styles.prestataireRow}
                  onPress={() => {
                    if (prestataire.user_id) {
                      navigation.navigate('ProfilePrestataire' as any, { userId: prestataire.user_id });
                    }
                  }}
                >
                  {prestataireAvatar ? (
                    <Image
                      source={{ uri: prestataireAvatar }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <SafeIcon name="user" size={14} color="#FFF" />
                    </View>
                  )}
                  <Text style={styles.prestataireName} numberOfLines={1}>
                    {prestataireName}
                  </Text>
                  <SafeIcon name="chevron-right" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              {/* ✅ CORRIGÉ: Localisation hiérarchique détaillée - Affiche le drapeau avec l'adresse */}
              {(chosenLocation || locationVector.length > 0 || pays) && (
                <View style={styles.locationSection}>
                  <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                    <Text style={styles.locationTextPrimary} numberOfLines={2}>
                      {chosenLocation || locationVector[0] || 'Localisation disponible'}
                    </Text>
                    {/* ✅ CORRIGÉ : Toujours afficher le drapeau si disponible */}
                    {countryFlag && countryFlag !== '🌍' && (
                      <Text style={styles.locationFlag} numberOfLines={1}>
                        {countryFlag}
                      </Text>
                    )}
                  </View>
                  {/* Hiérarchie complète (quartier > ville > région > pays) */}
                  {locationVector.length > 1 && (
                    <View style={styles.locationHierarchy}>
                      <SafeIcon name="corner-down-right" size={12} color="#9CA3AF" />
                      <Text style={styles.locationTextSecondary} numberOfLines={2}>
                        {locationVector.slice(1).join(' › ')}
                      </Text>
                    </View>
                  )}
                  {/* Affichage supplémentaire des adresses si disponibles */}
                  {(!chosenLocation || locationVector.length === 0) && (
                    <>
                      {product.quartier && (
                        <Text style={styles.locationTextSecondary} numberOfLines={1}>
                          📍 Quartier: {product.quartier}
                        </Text>
                      )}
                      {product.ville && (
                        <Text style={styles.locationTextSecondary} numberOfLines={1}>
                          🏙️ Ville: {product.ville}
                        </Text>
                      )}
                      {product.region && (
                        <Text style={styles.locationTextSecondary} numberOfLines={1}>
                          🌍 Région: {product.region}
                        </Text>
                      )}
                    </>
                  )}
                  {formattedDistance && (
                    <View style={styles.locationDistanceChip}>
                      <SafeIcon name="navigation" size={12} color={modernColors.primary} />
                      <Text style={styles.locationDistanceText}>{formattedDistance}</Text>
                    </View>
                  )}
                </View>
              )}

              {(googleRating ||
                googlePrimaryTag ||
                googleCuisineBadges.length > 0 ||
                googleOpenNow !== null) && (
                  <View style={styles.googleMetaSection}>
                    {googlePrimaryTag && (
                      <View style={styles.googleMetaChip}>
                        <SafeIcon name="sparkles" size={12} color="#4F46E5" />
                        <Text style={styles.googleMetaText}>{googlePrimaryTag}</Text>
                      </View>
                    )}
                    {googleRating && (
                      <View style={styles.googleMetaChip}>
                        <SafeIcon name="star" size={12} color="#F59E0B" />
                        <Text style={styles.googleMetaText}>{googleRating.toFixed(1)}</Text>
                        {typeof googleRatingCount === 'number' && googleRatingCount > 0 && (
                          <Text style={styles.googleMetaSubText}>({googleRatingCount})</Text>
                        )}
                      </View>
                    )}
                    {googleOpenNow !== null && (
                      <View
                        style={[
                          styles.googleMetaChip,
                          googleOpenNow ? styles.googleMetaChipOpen : styles.googleMetaChipClosed,
                        ]}
                      >
                        <SafeIcon
                          name="clock"
                          size={12}
                          color={googleOpenNow ? '#047857' : '#B91C1C'}
                        />
                        <Text
                          style={[
                            styles.googleMetaText,
                            googleOpenNow ? styles.googleMetaTextOpen : styles.googleMetaTextClosed,
                          ]}
                        >
                          {googleOpenNow ? 'Ouvert' : 'Fermé'}
                        </Text>
                      </View>
                    )}
                    {googleCuisineBadges.map((cuisine) => (
                      <View key={cuisine} style={styles.googleCuisineChip}>
                        <Text style={styles.googleCuisineText}>🍽️ {cuisine}</Text>
                      </View>
                    ))}
                  </View>
                )}
              {googleOpeningHeadline && (
                <Text style={styles.googleMetaSubInfo} numberOfLines={1}>
                  {googleOpeningHeadline}
                </Text>
              )}

              {googleEditorialSummary && (
                <Text style={styles.googleEditorialText} numberOfLines={2}>
                  {googleEditorialSummary}
                </Text>
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

              {/* Caractéristiques (vecteur produit) en chips */}
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
                    {limitedProductVector.map((carac: string, i: number) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{carac}</Text>
                      </View>
                    ))}
                    {hasMoreCaracs && (
                      <View style={styles.chipMore}>
                        <Text style={styles.chipMoreText}>+{productVector.length - maxDisplayedCaracs}</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}

              {/* Prix avec variations */}
              {hasVariant && variants.length > 0 ? (
                <View style={styles.priceVariations}>
                  <View style={styles.sectionHeader}>
                    <SafeIcon name="dollar-sign" size={14} color="#6B7280" />
                    <Text style={styles.sectionTitle}>
                      Prix selon {product.variant_dimension || 'variante'}
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
                          // Sélectionner la variation pour afficher son image
                          setSelectedVariantIndex(selectedVariantIndex === i ? null : i);
                        }}
                      >
                        <View style={styles.cellVariant}>
                          {/* Image de la variation si existe */}
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

              {/* Actions - Design moderne et subtil */}
              <View style={styles.actions}>
                {/* ✅ AMÉLIORÉ: Bouton "Me livrer" - Style outline subtil */}
                {serviceId && isProduct && (
                  <TouchableOpacity
                    style={[styles.actionButtonModern, styles.actionButtonDelivery]}
                    onPress={() => setShowOrderModal(true)}
                  >
                    <SafeIcon name="truck" size={16} color="#10B981" />
                    <Text style={[styles.actionButtonText, styles.actionButtonTextDelivery]} numberOfLines={1}>
                      Me livrer
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButtonModern, styles.actionButtonChat]}
                  onPress={handleChatPress}
                >
                  <SafeIcon name="message-circle" size={16} color={modernColors.primary} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextChat]} numberOfLines={1}>
                    Chat
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButtonModern, styles.actionButtonView]}
                  onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id || service?.id }))}
                >
                  <SafeIcon name="eye" size={16} color="#6B7280" />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextView]} numberOfLines={1}>
                    Voir
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ✅ NOUVEAU : Actions secondaires (Galerie, Partage) */}
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
                {googleMapsUri && (
                  <TouchableOpacity
                    style={styles.secondaryActionButton}
                    onPress={async () => {
                      try {
                        await Linking.openURL(googleMapsUri);
                      } catch (error) {
                        Alert.alert('Google Maps', 'Impossible d\'ouvrir la fiche Google Maps');
                      }
                    }}
                  >
                    <SafeIcon name="map" size={18} color={modernColors.primary} />
                    <Text style={styles.secondaryActionText}>Google Maps</Text>
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

              {/* ✅ AMÉLIORÉ: Section commentaires ultra-compacte */}
              {Number.isFinite(commentServiceId) && commentServiceId > 0 && (
                <View style={styles.commentsCompactSection}>
                  <View style={styles.commentsCompactRow}>
                    <View style={styles.commentsCompactStats}>
                      <SafeIcon name="message-circle" size={14} color="#6B7280" />
                      <Text style={styles.commentsCompactText}>
                        {loadingComments ? '...' : commentStats ? `${commentStats.rating_count} avis` : '0 avis'}
                      </Text>
                      {commentStats && commentStats.average_rating > 0 && (
                        <>
                          <Text style={styles.commentsCompactSeparator}>•</Text>
                          <Text style={styles.commentsCompactRating}>
                            {commentStats.average_rating.toFixed(1)}/5
                          </Text>
                        </>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.commentsCompactButton}
                      onPress={() => setShowCommentsModal(true)}
                    >
                      <SafeIcon name="corner-up-right" size={14} color={modernColors.primary} />
                      <Text style={styles.commentsCompactButtonText}>Ouvrir le fil</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Footer info */}
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
                {product.usage_count && (
                  <View style={styles.footerItem}>
                    <SafeIcon name="eye" size={12} color="#9CA3AF" />
                    <Text style={styles.footerText}>
                      {product.usage_count} vues
                    </Text>
                  </View>
                )}
                {product.created_at && (
                  <View style={styles.footerItem}>
                    <SafeIcon name="clock" size={12} color="#9CA3AF" />
                    <Text style={styles.footerText}>
                      {formatDate(product.created_at)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </NativeCard>
      </LinearGradient>

      {/* ✅ CORRIGÉ: Modal Chat - Toujours rendre le composant, contrôler via visible */}
      <ChatModalMobile
        visible={showChatModal}
        onClose={handleCloseChatModal}
        service={service || {
          id: product.service_id || service?.id,
          data: { titre_service: { valeur: product.nom || service?.data?.titre_service?.valeur || 'Produit' } },
          user_id: prestataireUserId || service?.user_id,
        }}
        prestataireInfo={activeChatPeer || prestataire || {
          nom: prestataireName || 'Prestataire',
          nom_complet: prestataireName || 'Prestataire',
          user_id: prestataireUserId,
          avatar_url: prestataireAvatar,
        }}
        user={null} // L'utilisateur sera récupéré depuis AuthContext dans ChatModalMobile
        conversationId={isPrivateChat ? privateConversationId || undefined : undefined}
        isPrivateConversation={isPrivateChat}
      />

      {/* ✅ NOUVEAU : Modal Galerie du prestataire */}
      {showGallery && (
        <ServiceGalleryModal
          visible={showGallery}
          service={service || {
            id: String(product.service_id || service?.id),
            titre: product.nom || service?.data?.titre_service?.valeur || 'Produit',
            description: product.description || service?.data?.description?.valeur || '',
            user_id: String(prestataire.user_id || service?.user_id || ''),
            data: service?.data || {},
          }}
          onClose={() => setShowGallery(false)}
        />
      )}

      {/* ✅ Modal commande livraison - Uniquement pour les produits */}
      {serviceId && isProduct && (
        <OrderDeliveryModal
          visible={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          serviceId={serviceId}
          productIndex={productIndex}
          productName={product.nom || product.name || 'Produit'}
          onSuccess={(deliveryId) => {
            console.log('Commande créée:', deliveryId);
            // Optionnel : rediriger vers la page de suivi
          }}
        />
      )}

      {/* ✅ NOUVEAU: Modal commentaires complet */}
      <Modal
        visible={showCommentsModal}
        animationType="slide"
        onRequestClose={() => setShowCommentsModal(false)}
        transparent={false}
      >
        {Number.isFinite(commentServiceId) && commentServiceId > 0 && (
          <View style={styles.commentsModalContainer}>
            <View style={styles.commentsModalHeader}>
              <Text style={styles.commentsModalTitle}>Commentaires & Avis</Text>
              <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
                <SafeIcon name="x" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ProductCommentsSection
              serviceId={commentServiceId}
              serviceTitle={serviceTitleForComments}
              onOpenChat={handleContactUser}
              mode="full"
            />
          </View>
        )}
      </Modal>
    </>
  );
};

// Helper formatage date
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

const styles = StyleSheet.create({
  cardContainer: {
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardContainerCompact: {
    borderRadius: 20,
  },
  touchableContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 160,
    overflow: 'hidden',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
  imageCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  contentCompact: {
    paddingTop: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  topStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  topStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  // ✅ AMÉLIORÉ: Style compact pour indicateurs miniaturisés
  topStatPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  topStatValue: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  topStatValueCompact: {
    fontSize: 11,
    fontWeight: '600',
  },
  topStatLabelCompact: {
    fontSize: 9,
    fontWeight: '500',
    opacity: 0.8,
    marginLeft: 2,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 22,
  },
  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prestataireName: {
    fontSize: 13,
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
  hierarchyHint: {
    fontSize: 11,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  chipMore: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5F5',
  },
  chipMoreText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  priceVariations: {
    gap: 8,
    backgroundColor: '#F9FAFB',
    padding: 10,
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
    paddingVertical: 6,
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
    gap: 4,
  },
  priceLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: modernColors.primary,
  },
  priceDevise: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
  },
  // ✅ AMÉLIORÉ: Styles boutons d'action modernes et subtils
  actionButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  actionButtonDelivery: {
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  actionButtonChat: {
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
  },
  actionButtonView: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonTextDelivery: {
    color: '#047857',
  },
  actionButtonTextChat: {
    color: modernColors.primary,
  },
  actionButtonTextView: {
    color: '#6B7280',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
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
  // ✅ NOUVEAU : Styles pour avis/ratings et actions secondaires
  metricsCard: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  compactStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  compactStatPillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 7,
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
  locationSection: {
    gap: 4,
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  locationFlag: {
    fontSize: 18,
    marginLeft: 4,
    lineHeight: 20,
  },
  locationHierarchy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 16,
  },
  locationTextSecondary: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
    fontStyle: 'italic',
  },
  locationDistanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#CBD5F5',
    marginTop: 4,
  },
  locationDistanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.primary,
  },
  googleMetaSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  googleMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
  },
  googleMetaChipOpen: {
    backgroundColor: '#DCFCE7',
  },
  googleMetaChipClosed: {
    backgroundColor: '#FEE2E2',
  },
  googleMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#312E81',
  },
  googleMetaTextOpen: {
    color: '#047857',
  },
  googleMetaTextClosed: {
    color: '#991B1B',
  },
  googleMetaSubText: {
    fontSize: 11,
    color: '#6366F1',
  },
  googleCuisineChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E0E7FF',
  },
  googleCuisineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3730A3',
  },
  googleMetaSubInfo: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 6,
  },
  googleEditorialText: {
    fontSize: 12,
    color: '#1F2937',
    marginTop: 8,
    lineHeight: 16,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.primary,
  },
  cardGradient: {
    borderRadius: 22,
    padding: 1,
    marginBottom: 12,
  },
  // ✅ NOUVEAU: Styles section commentaires compacte
  commentsCompactSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  commentsCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentsCompactStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  commentsCompactText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  commentsCompactSeparator: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 2,
  },
  commentsCompactRating: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  commentsCompactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#CBD5F5',
  },
  commentsCompactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.primary,
  },
  // ✅ NOUVEAU: Styles modal commentaires
  commentsModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  commentsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  commentsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
});

export default ProductCard;
