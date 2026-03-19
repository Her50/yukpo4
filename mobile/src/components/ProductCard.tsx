/**
 * ProductCard - Version reconstruite intégralement
 * Toutes fonctionnalités : vecteurs, variations, chat, distance, drapeau pays, réactions, livraison
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* @ts-ignore */

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useLocation } from '../contexts/LocationContext';
import { apiGet, apiPost } from '../services/api';
import { productDeliveryService } from '../services/productDeliveryService';
import { modernColors } from '../theme/modernTheme';
import { generateProductShareMessage, generateSmartShareLink } from '../utils/productShareHelper';
import SafeStorage from '../utils/safeStorage';
import InternalShareButton from './InternalShareButton';
import { NativeCard } from './NativeDesign';
import ProductCommentsSection from './ProductCommentsSection';
import ProductMediaCarousel from './ProductMediaCarousel';
import SafeIcon from './SafeIcon';
import ServiceGalleryModal from './ServiceGalleryModal';
import OrderDeliveryModal from './delivery/OrderDeliveryModal';

const { width } = Dimensions.get('window');

interface ProductCardProps {
  product: any;
  service: any;
  prestataire?: any;
  userLocation?: { latitude: number; longitude: number } | null;
  onPress?: () => void;
  onChatPress?: () => void;
  isScrolling?: boolean; // ✅ NOUVEAU 2026-03-06: Indicateur de scroll pour arrêter les vidéos
  isVisible?: boolean; // ✅ Lazy load: charger les données seulement si visible
  // ✅ NOUVEAU 2026-03-12: Props du coordinateur vidéo
  onVideoRef?: (videoRef: any, mediaKey: string) => void;
  onVideoPlaybackRequest?: (playCallback: () => void) => boolean;
  onVideoRelease?: () => void;
}

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

// ✅ NOUVEAU 2026-01-13: Fonction pour normaliser les URLs de médias (images/vidéos)
// ✅ CORRIGÉ 2026-01-22: Gérer correctement les URLs CDN depuis la table media
const normalizeMediaUrl = (media: any, type: 'image' | 'video' = 'image'): string | null => {
  if (!media) return null;

  let url: string | null = null;

  // Extraire l'URL depuis différents formats
  if (typeof media === 'string') {
    url = media.trim();
  } else if (typeof media === 'object') {
    // ✅ CORRIGÉ 2026-01-22: Prioriser les champs qui contiennent les URLs CDN
    url = media.url || media.valeur || media.path || media.uri || media.src || null;
    if (url && typeof url === 'string') {
      url = url.trim();
    } else {
      url = null;
    }
  }

  if (!url || url === '' || url === 'false') return null;

  // ✅ CORRIGÉ 2026-01-22: Les URLs CDN depuis la table media sont déjà des URLs complètes (https://...)
  // Si c'est déjà une URL complète (http/https) ou base64, retourner tel quel
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    // ✅ DEBUG: Log pour diagnostiquer les URLs CDN
    if (__DEV__ && url.startsWith('https://')) {
      console.log(`[ProductCard] ✅ URL CDN détectée (${type}):`, url.substring(0, 80) + '...');
    }
    return url;
  }

  // Si c'est un chemin relatif commençant par /, construire l'URL complète
  if (url.startsWith('/')) {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_UPLOAD_URL || '';
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, '')}${url}`;
    }
    return url; // Retourner tel quel si pas de base URL configurée
  }

  // Si ça ressemble à du base64 (pas d'URL, pas de /, longue chaîne)
  const looksLikeBase64 = /^[A-Za-z0-9+/=]{100,}$/.test(url);
  if (looksLikeBase64) {
    if (type === 'image') {
      return `data:image/jpeg;base64,${url}`;
    } else if (type === 'video') {
      return `data:video/mp4;base64,${url}`;
    }
  }

  // Si ça commence par uploads/, construire l'URL
  if (url.startsWith('uploads/')) {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_UPLOAD_URL || '';
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, '')}/${url}`;
    }
  }

  // Retourner tel quel par défaut
  return url;
};

const getCountryFlag = (country?: string): string => {
  if (!country || typeof country !== 'string') return '🌍';

  const countryLower = country.toLowerCase().trim();

  // Drapeaux des pays africains et internationaux (même mapping que useLocationDisplay)
  if (countryLower.includes('cameroun') || countryLower.includes('cameroon') || countryLower.includes('douala') || countryLower.includes('yaounde') || countryLower.includes('yaoundé')) return '🇨🇲';
  if (countryLower.includes('nigeria') || countryLower.includes('lagos') || countryLower.includes('abuja')) return '🇳🇬';
  if (countryLower.includes('sénégal') || countryLower.includes('senegal') || countryLower.includes('dakar')) return '🇸🇳';
  if (countryLower.includes('côte') || countryLower.includes('ivoire') || countryLower.includes('ivory') || countryLower.includes('abidjan')) return '🇨🇮';
  if (countryLower.includes('ghana') || countryLower.includes('accra')) return '🇬🇭';
  if (countryLower.includes('france') || countryLower.includes('paris')) return '🇫🇷';
  if (countryLower.includes('togo') || countryLower.includes('lome') || countryLower.includes('lomé')) return '🇹🇬';
  if (countryLower.includes('bénin') || countryLower.includes('benin') || countryLower.includes('cotonou')) return '🇧🇯';
  if (countryLower.includes('mali')) return '🇲🇱';
  if (countryLower.includes('burkina')) return '🇧🇫';
  if (countryLower.includes('niger')) return '🇳🇪';
  if (countryLower.includes('tchad') || countryLower.includes('chad')) return '🇹🇩';
  if (countryLower.includes('gabon')) return '🇬🇦';
  if (countryLower.includes('congo')) return '🇨🇬';
  if (countryLower.includes('rdc')) return '🇨🇩';
  if (countryLower.includes('guinée') || countryLower.includes('guinea') || countryLower.includes('guinee')) return '🇬🇳';
  if (countryLower.includes('madagascar')) return '🇲🇬';
  if (countryLower.includes('usa') || countryLower.includes('united states')) return '🇺🇸';

  return '🌍'; // Icône générique pour pays non reconnu
};

// ✅ NOUVEAU: Fonction pour extraire le pays depuis la localisation
const extractCountryFromLocation = (location: string): string | null => {
  if (!location || typeof location !== 'string') return null;

  const locationLower = location.toLowerCase();

  if (locationLower.includes('cameroun') || locationLower.includes('cameroon') || locationLower.includes('douala') || locationLower.includes('yaounde') || locationLower.includes('yaoundé')) return 'Cameroun';
  if (locationLower.includes('nigeria') || locationLower.includes('lagos') || locationLower.includes('abuja')) return 'Nigeria';
  if (locationLower.includes('sénégal') || locationLower.includes('senegal') || locationLower.includes('dakar')) return 'Sénégal';
  if (locationLower.includes('côte') || locationLower.includes('ivoire') || locationLower.includes('ivory') || locationLower.includes('abidjan')) return 'Côte d\'Ivoire';
  if (locationLower.includes('ghana') || locationLower.includes('accra')) return 'Ghana';
  if (locationLower.includes('france') || locationLower.includes('paris')) return 'France';
  if (locationLower.includes('togo') || locationLower.includes('lome') || locationLower.includes('lomé')) return 'Togo';
  if (locationLower.includes('bénin') || locationLower.includes('benin') || locationLower.includes('cotonou')) return 'Bénin';
  if (locationLower.includes('mali')) return 'Mali';
  if (locationLower.includes('burkina')) return 'Burkina Faso';
  if (locationLower.includes('niger')) return 'Niger';
  if (locationLower.includes('tchad') || locationLower.includes('chad')) return 'Tchad';
  if (locationLower.includes('gabon')) return 'Gabon';
  if (locationLower.includes('congo')) return 'Congo';

  return null;
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

// ✅ NOUVEAU: Fonction utilitaire pour filtrer les valeurs booléennes et "false" string
const filterBooleanValue = (value: any, defaultValue: string = ''): string => {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean') return defaultValue;
  if (value === 'false' || value === false) return defaultValue;
  if (typeof value === 'string' && value.trim() === '') return defaultValue;
  return String(value);
};

// ✅ CORRIGÉ 2026-03-03: Normaliser les retours à la ligne dans les descriptions
// L'IA renvoie souvent des textes avec des \n littéraux (2 caractères) au lieu de vrais retours à la ligne
const normalizeNewlines = (text: string): string => {
  return text
    .replace(/\\n/g, '\n')    // Convertir \n littéral en vrai retour à la ligne
    .replace(/\\r/g, '')      // Supprimer \r littéral
    .replace(/<br\s*\/?>/gi, '\n') // Convertir <br> HTML en retour à la ligne
    .replace(/\r\n/g, '\n')  // Normaliser CRLF en LF
    .replace(/\r/g, '\n');   // Normaliser CR en LF
};

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  service,
  prestataire,
  userLocation,
  onPress,
  onChatPress,
  isScrolling = false,
  isVisible,
  onVideoRef,
  onVideoPlaybackRequest,
  onVideoRelease,
}) => {
  const navigation = useNavigation();
  const { t } = useLanguageSafe();
  const reactionItems = useMemo(
    () => [
      { type: 'love', emoji: '❤️', label: 'J\'adore' },
      { type: 'like', emoji: '👍', label: 'J\'aime' },
      { type: 'wow', emoji: '😮', label: 'Impressionnant' },
      { type: 'interested', emoji: '🎯', label: t('productCard.interessant') },
      { type: 'thinking', emoji: '🤔', label: t('productCard.aReflechir') },
      { type: 'disappointed', emoji: '😕', label: t('productCard.decu') },
    ],
    [t],
  );
  // ✅ NOUVEAU: Utiliser useLocation pour calculer la distance si nécessaire
  const { location: contextLocation, calculateDistance: locationCalculateDistance } = useLocation();
  const effectiveUserLocation = userLocation || (contextLocation?.coords ? {
    latitude: contextLocation.coords.latitude,
    longitude: contextLocation.coords.longitude,
  } : null);

  const [imageError, setImageError] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  // ✅ NOUVEAU 2026-01-13: Ref pour le ScrollView des variations de prix
  const variantsScrollRef = useRef<ScrollView>(null);
  const [isScrollingManually, setIsScrollingManually] = useState(false);
  // ✅ NOUVEAU 2026-01-14: État pour suivre l'index actuel des variations (pour scroll automatique)
  const [currentVariantIndex, setCurrentVariantIndex] = useState(0);
  // ✅ NOUVEAU 2026-01-14: Ref et état pour le scroll automatique des caractéristiques
  const characteristicsScrollRef = useRef<ScrollView>(null);
  const [isScrollingCharacteristicsManually, setIsScrollingCharacteristicsManually] = useState(false);
  const [currentCharacteristicIndex, setCurrentCharacteristicIndex] = useState(0);
  const [privateConversationId, setPrivateConversationId] = useState<string | null>(null);
  const [chatContext, setChatContext] = useState<{
    type: 'service' | 'private';
    targetUserId?: number;
    targetUserName?: string;
    targetAvatar?: string | null;
  } | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // ✅ NOUVEAU 2026-03-12: Gestion des vidéos avec coordinateur
  const videoRefs = useRef<Map<string, any>>(new Map());

  const handleVideoRef = useCallback((videoRef: any, mediaKey: string) => {
    videoRefs.current.set(mediaKey, videoRef);
    // Notifier le parent si le callback est fourni
    if (onVideoRef) {
      onVideoRef(videoRef, mediaKey);
    }
  }, [onVideoRef]);

  const handleStopVideo = useCallback((mediaKey: string) => {
    // La vidéo est déjà arrêtée par le parent, on nettoie juste la ref
    videoRefs.current.delete(mediaKey);
    // Notifier le parent du release
    if (onVideoRelease) {
      onVideoRelease();
    }
  }, [onVideoRelease]);

  // ✅ FIX 2026-03-15: Effet isScrolling SUPPRIMÉ ici — ProductMediaCarousel gère déjà
  // l'arrêt de toutes les vidéos quand isScrolling=true (+ appelle onVideoRelease).
  // L'ancien code dupliquait pauseAsync() + onVideoRelease() → triple release inutile.

  const [reactions, setReactions] = useState<Record<string, { count: number; hasReacted: boolean }>>({});
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);


  // ✅ NOUVEAU 2026-01-23: Tracking des produits consultés
  useEffect(() => {
    const trackProductView = async () => {
      try {
        const serviceId = product?.service_id || service?.id;
        const productIndex = product?.product_index || product?.index;
        // ✅ CORRIGÉ 2026-01-23: Vérifier que productData existe avant d'accéder à ses propriétés
        const productName = productData?.nom || productData?.nom_produit || productData?.name || t('productCard.produit');

        if (!serviceId) return;

        const STORAGE_KEY = 'viewed_products_history';
        const MAX_HISTORY_ITEMS = 100;

        // Charger l'historique existant
        const stored = await SafeStorage.getItem(STORAGE_KEY);
        let history: Array<{
          serviceId: number;
          productIndex?: number;
          productName: string;
          viewedAt: string;
        }> = stored ? JSON.parse(stored) : [];

        // Vérifier si le produit n'est pas déjà dans l'historique (éviter les doublons)
        const existingIndex = history.findIndex(
          item => item.serviceId === serviceId &&
            (productIndex === undefined || item.productIndex === productIndex)
        );

        const newEntry = {
          serviceId,
          productIndex,
          productName,
          viewedAt: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
          // Mettre à jour la date de consultation
          history[existingIndex] = newEntry;
        } else {
          // Ajouter à l'historique
          history.unshift(newEntry);
        }

        // Limiter à MAX_HISTORY_ITEMS
        history = history.slice(0, MAX_HISTORY_ITEMS);

        // Sauvegarder
        await SafeStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      } catch (error) {
        console.error('[ProductCard] Erreur tracking produit consulté:', error);
      }
    };

    // Tracker après un court délai pour éviter de tracker à chaque re-render
    const timer = setTimeout(trackProductView, 1000);
    return () => clearTimeout(timer);
  }, [product?.service_id, service?.id, product?.product_index, product?.product_data?.nom, product?.nom]);
  const [hasDeliveryConfig, setHasDeliveryConfig] = useState<boolean | null>(null); // null = en cours de vérification
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // ✅ PHASE 4: Gérer les produits depuis l'API (type Product) ou JSONB (fallback)
  // Si le produit vient de l'API, utiliser product.product_data pour les données
  // ✅ CORRIGÉ 2026-01-23: S'assurer que productData n'est jamais undefined
  const productData = product?.product_data || product || {};

  // ✅ CORRIGÉ 2026-01-04: Vérifier aussi _serviceId ajouté par ResultatBesoinScreen
  const serviceId = product._serviceId || product.service_id || service?.id;
  const productIndex =
    typeof product.product_index === 'number'
      ? product.product_index
      : typeof product.index === 'number'
        ? product.index
        : 0;

  // ✅ CORRIGÉ 2026-01-13: Filtrer les valeurs booléennes et "false" string du productVector
  // ✅ CORRIGÉ 2026-01-23: Vérifier que productData existe avant d'accéder à ses propriétés
  const rawProductVector = Array.isArray(productData?.product_vector)
    ? productData.product_vector
    : Array.isArray(productData?.characteristic_vector)
      ? productData.characteristic_vector
      : typeof productData?.product_vector === 'string'
        ? splitWithFallback(productData.product_vector, ',')
        : [];

  // Filtrer les valeurs booléennes, null, undefined, et "false" string
  const productVector = rawProductVector.filter((item: any) => {
    if (item === null || item === undefined) return false;
    if (typeof item === 'boolean') return false;
    if (item === 'false' || item === false) return false;
    if (typeof item === 'string' && item.trim() === '') return false;
    return true;
  });

  const rawLocationVector = productData?.location_vector || productData?.locationVector || productData?.location?.vector;
  const locationVector = Array.isArray(rawLocationVector)
    ? rawLocationVector.filter((item: any) => {
      // ✅ CORRIGÉ 2026-01-13: Filtrer aussi les strings "false" et valeurs booléennes
      if (item === null || item === undefined) return false;
      if (typeof item === 'boolean') return false;
      if (item === 'false' || item === false) return false;
      if (typeof item === 'string' && item.trim() === '') return false;
      return true;
    })
    : typeof rawLocationVector === 'string'
      ? splitWithFallback(rawLocationVector, ',').filter((item: string) => item !== 'false' && item.trim() !== '')
      : [];

  // ✅ CORRIGÉ 2026-01-21: Améliorer l'extraction de la localisation (quartier/ville) - Priorité aux composants
  // Priorité 1: lieu_produit.composants (quartier, ville) - FORMAT PREFERE
  // Priorité 2: Parser la valeur de lieu_produit si elle contient "quartier, ville"
  // Priorité 3: chosen_location depuis productData
  // Priorité 4: locationVector (peut contenir quartier, ville, etc.)
  // Priorité 5: adresse depuis productData ou service.data
  const lieuProduitComposants = service?.data?.lieu_produit?.valeur?.composants
    || service?.data?.lieu_produit?.valeur?.valeur?.components
    || productData.lieu_produit?.valeur?.composants
    || productData.lieu_produit?.valeur?.valeur?.components
    || productData.lieu_produit?.composants;

  // ✅ PRIORITAIRE: Extraire quartier et ville depuis les composants
  let quartier = lieuProduitComposants?.quartier
    ? filterBooleanValue(lieuProduitComposants.quartier, '')
    : null;
  let ville = lieuProduitComposants?.ville
    ? filterBooleanValue(lieuProduitComposants.ville, '')
    : null;

  // ✅ NOUVEAU 2026-01-21: Si pas de composants, essayer de parser la valeur de lieu_produit
  if (!quartier || !ville) {
    const lieuProduitValeur = service?.data?.lieu_produit?.valeur
      || productData.lieu_produit?.valeur
      || productData.lieu_produit;

    // Si c'est une chaîne, essayer de la parser (format "quartier, ville" ou "ville")
    if (typeof lieuProduitValeur === 'string') {
      const parts = lieuProduitValeur.split(',').map((p: string) => p.trim());
      if (parts.length >= 2) {
        // Probablement "quartier, ville"
        if (!quartier) quartier = parts[0];
        if (!ville) ville = parts.slice(1).join(', '); // Prendre le reste comme ville (peut contenir pays)
      } else if (parts.length === 1 && !ville) {
        // Juste une ville
        ville = parts[0];
      }
    } else if (typeof lieuProduitValeur === 'object' && lieuProduitValeur !== null) {
      // Si c'est un objet, essayer d'extraire directement
      const lieuObj = lieuProduitValeur as any;
      if (!quartier && lieuObj.quartier) quartier = filterBooleanValue(lieuObj.quartier, '');
      if (!ville && lieuObj.ville) ville = filterBooleanValue(lieuObj.ville, '');
      if (!ville && lieuObj.valeur && typeof lieuObj.valeur === 'string') {
        // Si valeur est une chaîne, essayer de parser
        const parts = lieuObj.valeur.split(',').map((p: string) => p.trim());
        if (parts.length >= 2 && !quartier) quartier = parts[0];
        if (parts.length >= 1 && !ville) ville = parts[parts.length - 1]; // Prendre la dernière partie comme ville
      }
    }
  }

  // Construire la localisation préférée : "quartier, ville" ou juste l'un des deux
  let locationDisplay = '';
  if (quartier && ville) {
    // ✅ CORRIGÉ 2026-01-21: Afficher "quartier, ville" (enlever le pays si présent dans ville)
    const villeClean = ville.replace(/,\s*(Cameroun|Cameroon)$/i, '').trim();
    locationDisplay = `${quartier}, ${villeClean}`;
  } else if (quartier) {
    locationDisplay = quartier;
  } else if (ville) {
    // Enlever le pays si présent
    locationDisplay = ville.replace(/,\s*(Cameroun|Cameroon)$/i, '').trim();
  }

  // Fallback si pas de composants : utiliser les autres sources
  const chosenLocationRaw = locationDisplay ||
    productData.chosen_location ||
    (locationVector.length > 0 ? locationVector.filter((item: any) => {
      const itemStr = filterBooleanValue(item, '');
      // Éviter d'afficher le pays dans la localisation principale
      return itemStr && !itemStr.toLowerCase().includes('cameroun') && !itemStr.toLowerCase().includes('cameroon');
    }).join(', ') : null) ||
    productData.adresse ||
    productData.address ||
    service?.data?.adresse?.valeur ||
    service?.data?.adresse_service?.valeur ||
    '';

  // ✅ CORRIGÉ 2026-01-21: Filtrer strictement les valeurs booléennes, "false" string, null, undefined
  const chosenLocation = (typeof chosenLocationRaw === 'string' &&
    chosenLocationRaw !== 'false' &&
    chosenLocationRaw.trim() !== '')
    ? chosenLocationRaw.trim()
    : '';

  // ✅ CORRIGÉ 2026-03-07: Logger uniquement en dev
  useEffect(() => {
    if (__DEV__) {
      if (chosenLocation) {
        console.log('[ProductCard] 📍 Localisation extraite:', {
          chosenLocation,
          quartier,
          ville,
          hasLieuProduitComposants: !!lieuProduitComposants,
          hasLocationVector: locationVector.length > 0,
          locationVector,
          hasProductDataChosenLocation: !!productData.chosen_location,
          hasServiceAdresse: !!service?.data?.adresse?.valeur,
        });
      } else {
        console.log('[ProductCard] ⚠️ Aucune localisation trouvée:', {
          quartier,
          ville,
          hasLieuProduitComposants: !!lieuProduitComposants,
          hasProductDataChosenLocation: !!productData.chosen_location,
          locationVectorLength: locationVector.length,
          hasProductDataAdresse: !!productData.adresse,
          hasServiceAdresse: !!service?.data?.adresse?.valeur,
        });
      }
    }
  }, [chosenLocation, quartier, ville, locationVector.length]);

  // ✅ CORRIGÉ 2026-01-20: Transformer variation_prix en variants si nécessaire
  // Vérifier si variation_prix existe et n'a pas encore été transformé
  let hasVariant = productData.has_variant || product.has_variant || false;
  let variants = productData.variants || product.variants || [];

  // ✅ DEBUG: Logger pour diagnostiquer les problèmes de variations
  useEffect(() => {
    if (__DEV__) {
      const variationPrix = productData.variation_prix || productData.variabilite_prix || productData.price_variant
        || product.variation_prix || product.variabilite_prix || product.price_variant;
      if (variationPrix || hasVariant || variants.length > 0) {
        console.log('[ProductCard] 💰 Variations debug:', {
          hasVariant,
          variantsCount: variants.length,
          hasVariationPrix: !!variationPrix,
          variationPrixType: typeof variationPrix,
          isArray: Array.isArray(variationPrix),
          productDataHasVariant: productData.has_variant,
          productHasVariant: product.has_variant,
          productDataVariants: Array.isArray(productData.variants) ? productData.variants.length : 'not-array',
          productVariants: Array.isArray(product.variants) ? product.variants.length : 'not-array',
        });
      }
    }
  }, [hasVariant, variants.length, productData.variation_prix, product.variation_prix, productData.has_variant, product.has_variant]);

  // Si pas de variants mais qu'on a variation_prix, le transformer
  if (!hasVariant && variants.length === 0) {
    // ✅ CORRIGÉ: Vérifier aussi dans product directement (pas seulement productData)
    const variationPrix = productData.variation_prix || productData.variabilite_prix || productData.price_variant
      || product.variation_prix || product.variabilite_prix || product.price_variant;

    if (variationPrix) {
      // ✅ CORRIGÉ 2026-03-11: Dé-wrapper robustement le format formulaire dynamique
      // Formats possibles:
      //   1. {origine_champs, valeur: {variable, modalites: [...]}, type_donnee} (formulaire dynamique complet)
      //   2. {valeur: {variable, modalites: [...]}} (sans origine_champs — premier produit créé avec le service)
      //   3. {variable, modalites: [...]} (déjà dé-wrappé)
      //   4. [{valeur, prix}, ...] (tableau direct)
      let unwrappedVariationPrix = variationPrix;
      // Dé-wrapper récursivement les couches {valeur: ...} jusqu'au contenu réel
      let maxDepth = 3;
      while (maxDepth-- > 0 &&
        typeof unwrappedVariationPrix === 'object' && !Array.isArray(unwrappedVariationPrix) &&
        unwrappedVariationPrix.valeur !== undefined &&
        !unwrappedVariationPrix.modalites && // S'arrêter si on a déjà les modalites
        typeof unwrappedVariationPrix.valeur === 'object') {
        unwrappedVariationPrix = unwrappedVariationPrix.valeur;
      }

      console.log('[ProductCard] 🔍 variation_prix trouvé:', {
        type: typeof unwrappedVariationPrix,
        isArray: Array.isArray(unwrappedVariationPrix),
        keys: typeof unwrappedVariationPrix === 'object' && !Array.isArray(unwrappedVariationPrix) ? Object.keys(unwrappedVariationPrix) : [],
        hasModalites: typeof unwrappedVariationPrix === 'object' && !Array.isArray(unwrappedVariationPrix) && 'modalites' in unwrappedVariationPrix,
        wasWrapped: unwrappedVariationPrix !== variationPrix,
      });
      // Si c'est un objet avec modalites
      if (typeof unwrappedVariationPrix === 'object' && !Array.isArray(unwrappedVariationPrix)) {
        const modalites = unwrappedVariationPrix.modalites || unwrappedVariationPrix.valeur || unwrappedVariationPrix;

        if (Array.isArray(modalites) && modalites.length > 0) {
          variants = modalites.map((modalite: any) => {
            const variant: any = {};
            if (modalite.valeur || modalite.value) {
              variant.value = modalite.valeur || modalite.value;
              variant.valeur = modalite.valeur || modalite.value;
            }
            if (modalite.prix !== undefined || modalite.price !== undefined) {
              variant.prix = modalite.prix || modalite.price;
            }
            if (modalite.devise || modalite.currency) {
              variant.devise = modalite.devise || modalite.currency;
            }
            if (modalite.stock !== undefined || modalite.quantite !== undefined) {
              variant.stock = modalite.stock || modalite.quantite;
            }
            if (modalite.image) {
              variant.image = modalite.image;
            }
            return variant;
          });

          hasVariant = variants.length > 0;

          // ✅ CORRIGÉ 2026-03-07: Ne PAS muter productData (prop) pendant le render
          // variant_dimension est stocké dans une variable locale à la place

          console.log('[ProductCard] ✅ variation_prix transformé en variants:', variants.length);
        }
      }
      // Si c'est directement un tableau
      else if (Array.isArray(unwrappedVariationPrix) && unwrappedVariationPrix.length > 0) {
        variants = unwrappedVariationPrix.map((modalite: any) => {
          const variant: any = {};
          if (modalite.valeur || modalite.value) {
            variant.value = modalite.valeur || modalite.value;
            variant.valeur = modalite.valeur || modalite.value;
          }
          if (modalite.prix !== undefined || modalite.price !== undefined) {
            variant.prix = modalite.prix || modalite.price;
          }
          if (modalite.devise || modalite.currency) {
            variant.devise = modalite.devise || modalite.currency;
          }
          if (modalite.stock !== undefined || modalite.quantite !== undefined) {
            variant.stock = modalite.stock || modalite.quantite;
          }
          if (modalite.image) {
            variant.image = modalite.image;
          }
          return variant;
        });

        hasVariant = variants.length > 0;
        console.log('[ProductCard] ✅ variation_prix (array) transformé en variants:', variants.length);
      }
    }
  }
  const rawPrestataire =
    prestataire ||
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
        t('productCard.prestataire'),
      user_id: service?.user_id,
      avatar_url: service?.data?.photo_prestataire?.valeur,
    };

  // ✅ NOUVEAU 2026-02-10: Utiliser le nom de la structure (titre_service) en priorité au lieu du nom personnel
  // Priorité 1: Nom de la structure depuis le service (titre_service)
  const structureName =
    service?.data?.titre_service?.valeur ||
    service?.data?.titre_service ||
    service?.titre_service ||
    service?.titre ||
    service?.data?.nom_structure?.valeur ||
    service?.data?.nom_structure ||
    service?.data?.nom_entreprise?.valeur ||
    service?.data?.nom_entreprise ||
    null;

  const prestataireName =
    structureName || // ✅ PRIORITÉ: Nom de la structure
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
    t('productCard.prestataire');

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

  const prestataireInfo = {
    ...rawPrestataire,
    nom: prestataireName,
    nom_complet: prestataireName,
    avatar_url: prestataireAvatar,
    user_id: prestataireUserId,
  };

  const usageCount = productData.usage_count || 0;
  const isPopular = usageCount >= 5;
  const isTrending = usageCount >= 10;

  // ✅ CORRIGÉ 2026-01-23: Extraire les images et vidéos depuis product/service avec fallbacks multiples
  // ✅ CORRIGÉ: Priorité absolue aux médias passés directement par ResultatBesoinScreen (product.images/videos)
  // Structure de stockage des médias dans la base de données:
  // 1. product.images/videos (passés directement par ResultatBesoinScreen depuis service_products ou media table) - PRIORITÉ ABSOLUE
  // 2. product.product_data.images/videos (médias dans product_data)
  // 3. productData.images/videos (product.product_data || product)
  // 4. service.data->'produits'[index].images/videos (ancien système)
  // 5. service.data->'images'/'videos' (médias du service)
  // 6. service.images/videos (médias du service au niveau racine)

  // ✅ CORRIGÉ 2026-02-27: Helper pour extraire un tableau de médias depuis différents formats
  // Gère: tableau simple, objet {valeur: [...]}, string simple
  const asMediaArray = (field: any): any[] => {
    if (Array.isArray(field) && field.length > 0) return field;
    if (field && typeof field === 'object' && Array.isArray(field.valeur) && field.valeur.length > 0) return field.valeur;
    if (field && typeof field === 'string' && field.trim()) return [field];
    return [];
  };

  // ✅ CORRIGÉ 2026-03-02: Extraire les images/vidéos UNIQUEMENT depuis le produit (jamais depuis le service)
  // L'ancien code tombait en fallback sur service.data.images / service.images qui contenaient
  // les médias du PREMIER produit du service (pas du produit recherché).
  // Chaque produit est maintenant enrichi par le backend avec ses propres médias (table media + presigned URLs).
  const rawImages =
    asMediaArray(product.images).length > 0 ? asMediaArray(product.images)
      : asMediaArray(product.product_data?.images).length > 0 ? asMediaArray(product.product_data?.images)
        : asMediaArray(productData.images).length > 0 && productData !== product ? asMediaArray(productData.images)
          : asMediaArray(productData.data?.images);

  // Filtrer et normaliser les images avec la fonction globale
  const images = rawImages
    .map((img: any) => normalizeMediaUrl(img, 'image'))
    .filter((img): img is string => img !== null && img !== '');

  // ✅ CORRIGÉ 2026-03-02: Même correction pour les vidéos - pas de fallback service
  const rawVideos =
    asMediaArray(product.videos).length > 0 ? asMediaArray(product.videos)
      : asMediaArray(product.product_data?.videos).length > 0 ? asMediaArray(product.product_data?.videos)
        : asMediaArray(productData.videos).length > 0 && productData !== product ? asMediaArray(productData.videos)
          : asMediaArray(productData.data?.videos);

  // Filtrer et normaliser les vidéos avec la fonction globale
  const videos = rawVideos
    .map((vid: any) => normalizeMediaUrl(vid, 'video'))
    .filter((vid): vid is string => vid !== null && vid !== '');

  // ✅ DEBUG 2026-03-06: Analyse complète des sources de médias pour diagnostiquer la limitation à 2
  useEffect(() => {
    if (__DEV__) {
      console.log(`[ProductCard] 🔍 ANALYSE MÉDIA COMPLÈTE - Service ${serviceId}, Produit ${productIndex}:`);
      console.log(`[ProductCard] 📊 Sources brutes:`);
      console.log(`  - product.images:`, product.images);
      console.log(`  - product.videos:`, product.videos);
      console.log(`  - product.product_data?.images:`, product.product_data?.images);
      console.log(`  - product.product_data?.videos:`, product.product_data?.videos);
      console.log(`  - productData.images:`, productData.images);
      console.log(`  - productData.videos:`, productData.videos);
      console.log(`  - productData.data?.images:`, productData.data?.images);
      console.log(`  - productData.data?.videos:`, productData.data?.videos);

      console.log(`[ProductCard] 🔄 Extraction asMediaArray:`);
      console.log(`  - asMediaArray(product.images):`, asMediaArray(product.images));
      console.log(`  - asMediaArray(product.videos):`, asMediaArray(product.videos));
      console.log(`  - asMediaArray(product.product_data?.images):`, asMediaArray(product.product_data?.images));
      console.log(`  - asMediaArray(product.product_data?.videos):`, asMediaArray(product.product_data?.videos));

      console.log(`[ProductCard] 📈 Résultats finaux:`);
      console.log(`  - rawImages (${rawImages.length}):`, rawImages);
      console.log(`  - rawVideos (${rawVideos.length}):`, rawVideos);
      console.log(`  - images (${images.length}):`, images);
      console.log(`  - videos (${videos.length}):`, videos);
      console.log(`  - variantImage:`, normalizedVariantImage);
      console.log(`  - totalMedia:`, images.length + videos.length + (normalizedVariantImage ? 1 : 0));

      // 🚨 ALERTE si limitation à 2 détectée
      const totalRawMedia = rawImages.length + rawVideos.length;
      const totalProcessedMedia = images.length + videos.length;
      if (totalRawMedia > 2 && totalProcessedMedia === 2) {
        console.warn(`[ProductCard] 🚨 LIMITATION À 2 DÉTECTÉE!`);
        console.warn(`[ProductCard]   - Brut: ${totalRawMedia} médias`);
        console.warn(`[ProductCard]   - Traités: ${totalProcessedMedia} médias`);
        console.warn(`[ProductCard]   - Perte: ${totalRawMedia - totalProcessedMedia} médias`);
      }
    }
  }, [product._serviceId, product.service_id, service?.id, product.product_index, product.index, product.images, product.videos, product.product_data, productData.images, productData.videos, rawImages, rawVideos, images, videos]);

  const selectedVariant = selectedVariantIndex !== null && variants[selectedVariantIndex]
    ? variants[selectedVariantIndex]
    : null;
  const variantImage = selectedVariant?.image || selectedVariant?.images?.[0];

  // ✅ CORRIGÉ 2026-01-13: Normaliser l'image de variation si nécessaire
  const normalizedVariantImage = variantImage ? normalizeMediaUrl(variantImage, 'image') : null;

  const hasMedia = (images?.length || 0) + (videos?.length || 0) > 0 || !!normalizedVariantImage;

  // ✅ DEBUG: Logger pour diagnostiquer les problèmes de médias
  useEffect(() => {
    if (__DEV__ && (rawImages.length > 0 || rawVideos.length > 0 || images.length > 0 || videos.length > 0)) {
      console.log('[ProductCard] 📸 Media debug:', {
        hasMedia,
        imagesCount: images.length,
        videosCount: videos.length,
        rawImagesCount: rawImages.length,
        rawVideosCount: rawVideos.length,
        productImages: Array.isArray(product.images) ? product.images.length : 'not-array',
        productVideos: Array.isArray(product.videos) ? product.videos.length : 'not-array',
        productDataImages: Array.isArray(productData.images) ? productData.images.length : 'not-array',
        productDataVideos: Array.isArray(productData.videos) ? productData.videos.length : 'not-array',
        hasVariantImage: !!normalizedVariantImage,
      });
    }
  }, [hasMedia, images.length, videos.length, rawImages.length, rawVideos.length, product.images, product.videos, productData.images, productData.videos, normalizedVariantImage]);

  // ✅ DEBUG 2026-01-13: Logger hasMedia pour diagnostiquer
  if (__DEV__ && (rawImages.length > 0 || rawVideos.length > 0)) {
    console.log(`[ProductCard] hasMedia=${hasMedia}, images=${images.length}, videos=${videos.length}, variantImage=${!!normalizedVariantImage}`);
  }

  // ✅ CORRIGÉ: Utiliser un format d'ID cohérent pour éviter les doublons
  // Priorité: service_id-product_index (format standard) > id de la table > fallback
  const resolvedProductId = (() => {
    // Si product_index est disponible, utiliser le format service_id-product_index (standard)
    if (productIndex !== undefined && productIndex !== null && serviceId) {
      return `${serviceId}_${productIndex}`;
    }
    // Sinon, utiliser l'ID de la table service_products si disponible
    if (product.product_id || product.id) {
      return String(product.product_id || product.id);
    }
    // Fallback: construire depuis service_id et nom
    // ✅ CORRIGÉ 2026-01-23: Vérifier que productData existe avant d'accéder à ses propriétés
    return serviceId ? `${serviceId}-${productData?.nom || productData?.name || 'unknown'}` : null;
  })();

  // ✅ NOUVEAU 2026-03-14: Détection catégorie spécialisée (automobile, pharmacie, supermarché)
  const detectedCategory = useMemo(() => {
    const cat = (
      service?.category ||
      service?.data?.category?.valeur ||
      service?.data?.category ||
      productData?.category ||
      productData?.categorie_service ||
      product?.category ||
      ''
    ).toString().toLowerCase().trim();
    if (cat.includes('auto') || cat.includes('vehicule') || cat.includes('voiture') || cat.includes('moto'))
      return 'automobile';
    if (cat.includes('pharma') || cat.includes('medicament') || cat.includes('médicament'))
      return 'pharmacie';
    if (cat.includes('supermarche') || cat.includes('supermarket') || cat.includes('epicerie') || cat.includes('alimentation'))
      return 'supermarche';
    return null;
  }, [service?.category, service?.data?.category, productData?.category, productData?.categorie_service, product?.category]);

  // ✅ CORRIGÉ 2026-01-13: Distinction stricte entre produits et prestations
  // Le bouton "Me livrer" ne doit s'afficher QUE pour les produits, jamais pour les prestations
  const serviceType = filterBooleanValue(service?.data?.type?.valeur || service?.data?.type || service?.category || '', '');
  const productType = filterBooleanValue(productData.type || productData.product_type || '', '');
  const typeOffre = filterBooleanValue(service?.data?.type_offre?.valeur || productData.type_offre || '', '');

  // ✅ CORRIGÉ 2026-01-13: Vérifier si c'est une prestation de service (ne doit PAS avoir le bouton "Me livrer")
  // Une prestation est identifiée par : type_offre === 'prestation' OU type === 'prestation_service' / 'service' / 'service_prestation'
  // ET elle n'a PAS de données de produit (nom, prix, etc.)
  const isPrestation =
    typeOffre === 'prestation' ||
    typeOffre === 'service' ||
    serviceType === 'prestation_service' ||
    serviceType === 'service_prestation' ||
    productType === 'prestation_service' ||
    productType === 'service_prestation' ||
    (serviceType === 'service' && !product?.product_data && !productData?.nom && !productData?.name && !productData?.prix && !productData?.price);

  // ✅ CORRIGÉ 2026-01-13: C'est un produit si :
  // 1. type_offre === 'produit' (définitif)
  // 2. OU product.product_data existe (produit depuis service_products)
  // 3. OU le type n'est PAS une prestation ET il y a des données de produit (nom, prix, etc.)
  const isProduct =
    typeOffre === 'produit' || // ✅ Définitif : type_offre = 'produit'
    product.product_data !== undefined || // Produit depuis service_products
    (!isPrestation && (
      (productData?.nom || productData?.name || productData?.titre) || // A un nom de produit
      (productData?.prix !== undefined || productData?.price !== undefined) // A un prix
    ));

  // ✅ CORRIGÉ 2026-01-20: Vérifier si le produit a une configuration de livraison automatique
  // ✅ CORRIGÉ: Gérer correctement le cas où la config n'existe pas (404) vs erreur
  useEffect(() => {
    const checkDeliveryConfig = async () => {
      // ✅ CORRIGÉ: Convertir serviceId en number si c'est une string
      const numericServiceId = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;

      // ✅ CORRIGÉ 2026-01-20: Vérifier que productIndex est valide (pas juste 0 par défaut)
      // Si productIndex est 0 mais qu'il n'était pas explicitement défini, ne pas vérifier
      const hasValidProductIndex = productIndex !== undefined && productIndex !== null && productIndex >= 0;

      if (!isProduct || !numericServiceId || isNaN(numericServiceId) || !hasValidProductIndex) {
        console.log('[ProductCard] ⚠️ Vérification config livraison ignorée:', {
          isProduct,
          serviceId: numericServiceId,
          productIndex,
          hasValidProductIndex,
          reason: !isProduct ? 'pas un produit' : !numericServiceId || isNaN(numericServiceId) ? 'serviceId invalide' : !hasValidProductIndex ? 'productIndex invalide' : 'inconnu'
        });
        setHasDeliveryConfig(false);
        return;
      }

      console.log('[ProductCard] 🔍 Vérification config livraison pour:', {
        serviceId: numericServiceId,
        productIndex,
        serviceIdType: typeof serviceId,
        productIndexType: typeof productIndex
      });

      try {
        const config = await productDeliveryService.getDeliveryConfig(numericServiceId, productIndex);
        console.log('[ProductCard] 📦 Config livraison reçue:', {
          config: config ? {
            id: config.id,
            service_id: config.service_id,
            product_index: config.product_index,
            is_configured: config.is_configured,
            is_immediately_available: config.is_immediately_available
          } : null
        });

        // ✅ CORRIGÉ: Vérifier que config n'est pas null ET que is_configured est true
        if (config && config.is_configured === true) {
          console.log('[ProductCard] ✅ Config livraison valide - bouton activé');
          setHasDeliveryConfig(true);
        } else {
          console.log('[ProductCard] ⚠️ Config livraison invalide ou non configurée:', {
            hasConfig: !!config,
            is_configured: config?.is_configured
          });
          // Config n'existe pas ou n'est pas configurée
          setHasDeliveryConfig(false);
        }
      } catch (error: any) {
        // ✅ CORRIGÉ: Ne pas logger les erreurs 404 comme des erreurs critiques
        if (error?.message?.includes('404') || error?.response?.status === 404) {
          console.log('[ProductCard] ℹ️ Config livraison non trouvée (404)');
          // Configuration non trouvée = pas de livraison disponible
          setHasDeliveryConfig(false);
        } else if (error?.message?.includes('Token') || error?.message?.includes('authentification') || error?.message?.includes('401')) {
          // ✅ CORRIGÉ 2026-01-20: Gérer le cas où le token est manquant ou expiré
          console.log('[ProductCard] ⚠️ Token d\'authentification manquant ou expiré - config livraison non vérifiée');
          setHasDeliveryConfig(false);
        } else {
          console.error('[ProductCard] ❌ Erreur vérification config livraison:', {
            error: error?.message || error,
            serviceId: numericServiceId,
            productIndex,
            errorType: error?.constructor?.name,
            errorStack: error?.stack?.substring(0, 200)
          });
          setHasDeliveryConfig(false);
        }
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

  // ✅ DEBUG 2026-01-20: Logger l'état du bouton pour déboguer
  useEffect(() => {
    if (isProduct && serviceId) {
      console.log('[ProductCard] 🔘 État bouton "Me livrer":', {
        deliveryEnabled,
        isProduct,
        serviceId,
        hasDeliveryConfig,
        productIndex,
        serviceIdType: typeof serviceId
      });
    }
  }, [deliveryEnabled, isProduct, serviceId, hasDeliveryConfig, productIndex]);

  // ✅ CORRIGÉ 2026-01-22: Extraire le prix depuis toutes les sources possibles
  // Le prix peut être dans : prix, prix_produit, prix.valeur, prix_produit.valeur, price, product_price
  const extractPrice = (data: any): number => {
    if (!data) return 0;

    // Vérifier les variations de prix d'abord
    if (hasVariant && variants.length > 0) {
      const variantPrices = variants.map((v: any) => {
        const variantPrice = v.prix || v.price || 0;
        return typeof variantPrice === 'number' ? variantPrice : parseFloat(variantPrice) || 0;
      }).filter((p: number) => p > 0);
      if (variantPrices.length > 0) {
        return Math.min(...variantPrices);
      }
    }

    // Vérifier prix direct (nombre)
    if (typeof data.prix === 'number') return data.prix;
    if (typeof data.price === 'number') return data.price;
    if (typeof data.product_price === 'number') return data.product_price;

    // Vérifier prix_produit direct (nombre)
    if (typeof data.prix_produit === 'number') return data.prix_produit;

    // Vérifier prix structuré (objet avec valeur)
    if (data.prix && typeof data.prix === 'object') {
      const prixValue = data.prix.valeur || data.prix.value || data.prix;
      if (typeof prixValue === 'number') return prixValue;
      if (typeof prixValue === 'string') {
        const parsed = parseFloat(prixValue);
        if (!isNaN(parsed)) return parsed;
      }
    }

    // Vérifier prix_produit structuré (objet avec valeur)
    if (data.prix_produit && typeof data.prix_produit === 'object') {
      const prixProduitValue = data.prix_produit.valeur || data.prix_produit.value || data.prix_produit;
      if (typeof prixProduitValue === 'number') return prixProduitValue;
      if (typeof prixProduitValue === 'string') {
        const parsed = parseFloat(prixProduitValue);
        if (!isNaN(parsed)) return parsed;
      }
    }

    // Vérifier prix en string
    if (typeof data.prix === 'string') {
      const parsed = parseFloat(data.prix);
      if (!isNaN(parsed)) return parsed;
    }
    if (typeof data.price === 'string') {
      const parsed = parseFloat(data.price);
      if (!isNaN(parsed)) return parsed;
    }
    if (typeof data.prix_produit === 'string') {
      const parsed = parseFloat(data.prix_produit);
      if (!isNaN(parsed)) return parsed;
    }

    return 0;
  };

  // ✅ CORRIGÉ 2026-01-22: Extraire le prix depuis productData ET product (si disponible)
  const displayPrice = extractPrice(productData) || extractPrice(product) || 0;

  // ✅ NOUVEAU 2026-03-05: Extraire les données de promotion flash active
  const isEnPromotion = !!(productData?.en_promotion || product?.en_promotion || productData?.promotion_active || product?.promotion_active);
  const promoDiscountType = productData?.promo_discount_type || product?.promo_discount_type || '';
  const promoDiscountValue = typeof (productData?.promo_discount_value ?? product?.promo_discount_value) === 'number'
    ? (productData?.promo_discount_value ?? product?.promo_discount_value)
    : parseFloat(productData?.promo_discount_value || product?.promo_discount_value || '0') || 0;
  const promoTitle = productData?.promo_title || product?.promo_title || 'Promo';
  const promoEndsAt = productData?.promo_ends_at || product?.promo_ends_at || '';

  // ✅ NOUVEAU 2026-03-05: Calculer le prix promotionnel
  const promoPrice = useMemo(() => {
    if (!isEnPromotion || displayPrice <= 0) return 0;
    if (promoDiscountType === 'free') return 0;
    if (promoDiscountType === 'percentage' && promoDiscountValue > 0) {
      return Math.round(displayPrice * (1 - promoDiscountValue / 100));
    }
    if (promoDiscountType === 'fixed' && promoDiscountValue > 0) {
      return Math.max(0, displayPrice - promoDiscountValue);
    }
    return 0;
  }, [isEnPromotion, displayPrice, promoDiscountType, promoDiscountValue]);

  // ✅ CORRIGÉ 2026-01-22: Extraire la devise depuis toutes les sources possibles
  const extractDevise = (data: any): string => {
    if (!data) return 'XAF';

    // Vérifier devise directe
    if (data.devise && typeof data.devise === 'string') return data.devise;
    if (data.currency && typeof data.currency === 'string') return data.currency;
    if (data.devise_produit && typeof data.devise_produit === 'string') return data.devise_produit;

    // Vérifier devise structurée (objet avec valeur)
    if (data.devise && typeof data.devise === 'object') {
      const deviseValue = data.devise.valeur || data.devise.value || data.devise;
      if (typeof deviseValue === 'string') return deviseValue;
    }
    if (data.devise_produit && typeof data.devise_produit === 'object') {
      const deviseProduitValue = data.devise_produit.valeur || data.devise_produit.value || data.devise_produit;
      if (typeof deviseProduitValue === 'string') return deviseProduitValue;
    }

    return 'XAF';
  };

  // ✅ CORRIGÉ 2026-03-07: Extraire variant_dimension sans muter productData
  const variantDimension = productData.variant_dimension || ((() => {
    const vp = productData.variation_prix || productData.variabilite_prix || productData.price_variant
      || product.variation_prix || product.variabilite_prix || product.price_variant;
    if (vp && typeof vp === 'object' && !Array.isArray(vp)) {
      const unwrapped = (vp.origine_champs && vp.valeur && typeof vp.valeur === 'object' && !Array.isArray(vp.valeur)) ? vp.valeur : vp;
      return unwrapped.variable || '';
    }
    return '';
  })()) || 'variante';

  const devise = extractDevise(productData) || extractDevise(product) || variants[0]?.devise || 'XAF';

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

  // ✅ CORRIGÉ: Vérifier aussi si distanceKm est 0 (valide) et filtrer les distances aberrantes (>1000km = erreur GPS probable)
  const hasDistance = typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm >= 0 && distanceKm <= 1000;

  // ✅ DEBUG: Logger pour diagnostiquer les problèmes de distance
  useEffect(() => {
    if (__DEV__) {
      console.log('[ProductCard] 📍 Distance debug:', {
        distanceKm,
        hasDistance,
        productDistanceKm: product.distance_km,
        productDistance: product.distance,
        productDataDistanceKm: productData.distance_km,
        productDataDistance: productData.distance,
        effectiveUserLocation: !!effectiveUserLocation,
        hasLocationCalculateDistance: !!locationCalculateDistance,
      });
    }
  }, [distanceKm, hasDistance, product.distance_km, product.distance, productData.distance_km, productData.distance, effectiveUserLocation, locationCalculateDistance]);

  // ✅ PROFESSIONNEL 2026-01-13: Variable simplifiée pour vérifier la présence de GPS
  const hasGPS = !!(product._gps || productData._gps || product.gps || productData.gps || productData.gps_coords || productData.gps_fixe || service?.data?.gps_fixe?.valeur || service?.data?.gps?.valeur);

  // ✅ CORRIGÉ 2026-01-14: Améliorer l'extraction du pays depuis la localisation
  // Priorité 1: Depuis service?.data?.pays?.valeur (données backend)
  // Priorité 2: Depuis les composants de localisation (lieu_produit.composants.pays)
  // Priorité 3: Depuis chosenLocation (extraire le pays depuis la chaîne de localisation)
  // Priorité 4: Depuis locationVector (dernier élément)
  // Priorité 5: Depuis productData.pays
  // ✅ CORRIGÉ 2026-01-14: Filtrer les valeurs "false" string et valeurs vides
  const paysFromService = filterBooleanValue(service?.data?.pays?.valeur, '');
  const paysFromLocationComponents = filterBooleanValue(
    service?.data?.lieu_produit?.valeur?.composants?.pays
    || service?.data?.lieu_produit?.valeur?.valeur?.components?.pays,
    ''
  );
  const paysFromLocation = chosenLocation ? extractCountryFromLocation(chosenLocation) : null;
  const paysFromVector = locationVector.length > 0 ? filterBooleanValue(locationVector[locationVector.length - 1], '') : '';
  const paysFromProduct = filterBooleanValue(productData.pays, '');

  const pays = paysFromService || paysFromLocationComponents || paysFromLocation || paysFromVector || paysFromProduct || null;
  const countryFlag = pays && pays.trim() !== '' ? getCountryFlag(pays) : '';

  // ✅ CORRIGÉ 2026-03-07: Logger uniquement en dev
  useEffect(() => {
    if (__DEV__) {
      if (pays || countryFlag) {
        console.log('[ProductCard] 🏳️ Pays et drapeau extraits:', {
          pays,
          countryFlag,
          paysFromService,
          paysFromLocationComponents,
          paysFromLocation,
          paysFromVector,
          paysFromProduct
        });
      } else {
        console.log('[ProductCard] ⚠️ Aucun pays trouvé:', {
          hasPaysFromService: !!paysFromService,
          hasPaysFromLocationComponents: !!paysFromLocationComponents,
          hasPaysFromLocation: !!paysFromLocation,
          hasPaysFromVector: !!paysFromVector,
          hasPaysFromProduct: !!paysFromProduct,
          chosenLocation
        });
      }
    }
  }, [pays, countryFlag]);

  const commentServiceId = Number(productData?._serviceId || product?.service_id || service?.id || 0);
  // ✅ CORRIGÉ 2026-01-23: Vérifier que productData existe avant d'accéder à ses propriétés
  const serviceTitleForComments =
    productData?.nom ||
    productData?.name ||
    productData?.titre ||
    productData?.title ||
    service?.data?.titre_service?.valeur ||
    service?.data?.nom ||
    t('productCard.produit');

  const isPrivateChat = chatContext?.type === 'private';
  const activeChatPeer = isPrivateChat && chatContext?.targetUserId
    ? {
      nom: chatContext.targetUserName || t('productCard.utilisateur'),
      nom_complet: chatContext.targetUserName || t('productCard.utilisateur'),
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

  // ✅ CORRIGÉ 2026-01-23: Prioriser les statistiques dynamiques depuis les résultats de recherche
  // Le backend calcule maintenant reviews_count dynamiquement depuis product_comments
  const reviewsCount =
    service?.reviews_count ?? // ✅ PRIORITÉ 1: Statistique dynamique depuis backend (calculée depuis product_comments)
    productData.reviews_count ?? // ✅ PRIORITÉ 2: Depuis product_data enrichi
    productData.reviews ??
    productData.nb_avis ??
    0;

  // ✅ NOUVEAU 2026-03-06: Extraire la note moyenne pour affichage étoiles Amazon-style
  const averageRating: number =
    service?.average_rating ??
    productData.average_rating ??
    productData.note_moyenne ??
    productData.rating ??
    0;

  // ✅ NOTE 2026-01-23: favoritesCount n'est pas encore tracké dynamiquement
  // Les valeurs viennent du JSON statique product_data qui n'est probablement jamais mis à jour
  const favoritesCount =
    service?.favorites_count ?? // ✅ PRIORITÉ 1: Depuis service enrichi (si disponible)
    productData.favoris ??
    productData.likes ??
    productData.favorites ??
    productData.saves ??
    productData.bookmarks ??
    0;

  // ✅ DEBUG 2026-01-23: Logger les statistiques pour vérifier leur cohérence
  useEffect(() => {
    if (__DEV__) {
      console.log('[ProductCard] 📊 Statistiques extraites:', {
        serviceId: service?.id,
        viewsCount,
        sharesCount,
        reviewsCount,
        favoritesCount,
        usageCount,
        hasServiceReviewsCount: !!service?.reviews_count,
        serviceReviewsCount: service?.reviews_count,
        productDataReviewsCount: productData.reviews_count,
        productDataReviews: productData.reviews,
        productDataNbAvis: productData.nb_avis,
      });
    }
  }, [viewsCount, sharesCount, reviewsCount, favoritesCount, usageCount, service?.id, service?.reviews_count, productData.reviews_count]);

  // ✅ CORRIGÉ: Filtrer les stats à 0 pour réduire le bruit visuel et rendre les cartes plus compactes
  const topStatsData = [
    { key: 'views', icon: 'eye', value: viewsCount, tint: '#4f46e5' },
    { key: 'shares', icon: 'share-2', value: sharesCount, tint: '#a855f7' },
    { key: 'reviews', icon: 'message-circle', value: reviewsCount, tint: '#f59e0b' },
    { key: 'favorites', icon: 'heart', value: favoritesCount, tint: '#ef4444' },
  ].filter(stat => stat.value > 0);

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
      targetUserId: prestataireInfo.user_id ? Number(prestataireInfo.user_id) : undefined,
      targetUserName: structureName || prestataireInfo.nom, // ✅ CORRIGÉ 2026-02-10: Utiliser le nom de la structure en priorité
      targetAvatar: prestataireInfo.avatar_url || null,
    });
    setPrivateConversationId(null);
  };

  const handleShare = async () => {
    try {
      // ✅ CORRIGÉ 2026-02-10: Utiliser UNIQUEMENT productData.nom pour éviter d'utiliser le nom du premier produit du service
      // Ne pas utiliser service?.data?.nom_produit?.valeur car cela pourrait être le premier produit du service
      const productName = productData?.nom || productData?.nom_produit || product?.nom || t('productCard.produit');
      // ✅ CORRIGÉ 2026-01-21: Utiliser UNIQUEMENT productData.description pour éviter confusion avec autres produits
      const productDesc = productData.description || productData.description_produit || '';
      const price = displayPrice > 0 ? displayPrice : undefined;
      const location = chosenLocation || undefined;

      // ✅ CORRIGÉ: Utiliser les valeurs pré-calculées du composant (productIndex, serviceId)
      // au lieu d'une chaîne de fallback fragile qui peut résulter en 'unknown'
      const shareProductId = productIndex !== undefined && productIndex !== null ? productIndex : (product?.id || product?.product_id || 0);
      const shareServiceId = serviceId || product?.service_id || service?.id || 0;

      const shareMessage = generateProductShareMessage({
        productName,
        productDescription: productDesc,
        price,
        devise,
        location,
        productId: shareProductId,
        serviceId: shareServiceId,
      });

      // ✅ CORRIGÉ: Utiliser le lien intelligent (HTTPS) dans l'URL du Share
      // Le lien HTTPS sera intercepté par l'app si installée (via intentFilters)
      // Sinon, il ouvrira la page web. C'est un seul lien intelligent qui fonctionne partout.
      const smartLink = generateSmartShareLink(shareProductId, shareServiceId);

      const result = await Share.share({
        message: shareMessage,
        title: productName,
        url: smartLink, // ✅ Utiliser le lien intelligent HTTPS qui sera intercepté par l'app si disponible
      });

      if (result.action === Share.sharedAction) {
        console.log('[ProductCard] Produit partagé avec succès');
      }
    } catch (error) {
      console.error('[ProductCard] Erreur partage:', error);
      Alert.alert('Erreur', 'Impossible de partager le produit');
    }
  };

  // ✅ FIX 2026-03-12: Ouvrir Google Maps directement pour navigation vers la boutique
  const handleOpenNavigation = () => {
    try {
      // Extraire les coordonnées GPS du produit/service
      const productGPS = product._gps || productData._gps || product.gps || productData.gps || productData.gps_coords || productData.gps_fixe || service?.data?.gps_fixe?.valeur || service?.data?.gps?.valeur;

      if (!productGPS) {
        Alert.alert(
          'Localisation indisponible',
          'Les coordonnées GPS du prestataire ne sont pas disponibles pour le moment.'
        );
        return;
      }

      let lat: number | null = null;
      let lng: number | null = null;

      // Parser le GPS (peut être string "lat,lng" ou object {lat, lng} ou {latitude, longitude})
      if (typeof productGPS === 'string') {
        const parts = productGPS.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          lat = parseFloat(parts[0]);
          lng = parseFloat(parts[1]);
        }
      } else if (typeof productGPS === 'object') {
        lat = productGPS.lat ?? productGPS.latitude ?? null;
        lng = productGPS.lng ?? productGPS.longitude ?? null;
      }

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        Alert.alert(
          t('productCard.coordonneesInvalides'),
          'Les coordonnées GPS du prestataire sont invalides.'
        );
        return;
      }

      // ✅ FIX: Ouvrir Google Maps directement avec l'itinéraire
      const destName = chosenLocation || filterBooleanValue(productData?.product_name || product?.product_name, 'Destination');
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(destName)}`;

      // Ouvrir Google Maps
      Linking.openURL(url).catch((error) => {
        console.error('[ProductCard] Erreur ouverture Google Maps:', error);
        // Fallback: ouvrir Google Maps sans itinéraire si l'URL dir échoue
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        Linking.openURL(fallbackUrl).catch((fallbackError) => {
          console.error('[ProductCard] Erreur ouverture Google Maps fallback:', fallbackError);
          Alert.alert('Erreur', 'Impossible d\'ouvrir Google Maps');
        });
      });
    } catch (error) {
      console.error('[ProductCard] Erreur navigation GPS:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la navigation');
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

  // ✅ SUPPRIMÉ 2026-03-XX: Auto-scroll des variations supprimé (UX Amazon-style: scroll manuel uniquement)

  // ✅ SUPPRIMÉ 2026-03-XX: Auto-scroll des caractéristiques supprimé (UX Amazon-style: scroll manuel uniquement)

  // ✅ NOUVEAU 2026-01-14: Synchroniser currentVariantIndex avec le scroll réel
  const handleVariantsScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const cardWidth = 110 + 8; // ✅ CORRIGÉ 2026-03-04: 120 → 110
    const index = Math.round(contentOffsetX / cardWidth);
    setCurrentVariantIndex(index);
  };

  // ✅ NOUVEAU 2026-01-14: Handler pour le scroll des caractéristiques
  const handleCharacteristicsScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    // ✅ AMÉLIORÉ: Calculer la largeur approximative basée sur la longueur moyenne du texte
    const avgTextLength = productVector.reduce((sum: number, carac: string) => {
      const displayValue = filterBooleanValue(carac, '');
      return sum + (displayValue ? displayValue.length : 0);
    }, 0) / productVector.length;
    const chipWidth = Math.max(60, Math.min(150, (8 * 2) + (avgTextLength * 7) + 4)); // Min 60px, max 150px
    const index = Math.round(contentOffsetX / chipWidth);
    setCurrentCharacteristicIndex(index);
  };

  const handleReaction = async (reactionType: string) => {
    if (!serviceId || !resolvedProductId) {
      Alert.alert(
        t('productCard.informationManquante'),
        t('productCard.impossibleReagir')
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
      Alert.alert(t('productCard.erreur'), t('productCard.impossibleEnregistrerReaction'));
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
          throw new Error(createResponse.error || t('productCard.impossibleDeCreerLaConversation'));
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
        // Le chat modal est géré par le parent via onChatPress
      } else {
        Alert.alert(t('productCard.information'), t('productCard.impossibleCreerConversation'));
      }
    } catch (error) {
      console.error('[ProductCard] Erreur création conversation privée:', error);
      Alert.alert(t('productCard.erreur'), error instanceof Error ? error.message : t('productCard.impossibleContacter'));
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
            onPress={onPress || (() => (navigation as any).navigate('ServiceDetail', { serviceId: product.service_id || service?.id }))}
          >
            {hasMedia && (
              <View style={styles.imageContainer}>
                <ProductMediaCarousel
                  images={images}
                  videos={videos}
                  variantImage={normalizedVariantImage || undefined}
                  onImagePress={() => {
                    setShowGallery(true);
                  }}
                  onVideoRef={handleVideoRef}
                  onStopVideo={handleStopVideo}
                  isScrolling={isScrolling}
                  isVisible={isVisible}
                  // ✅ NOUVEAU 2026-03-12: Passer les callbacks du coordinateur vidéo
                  onVideoPlaybackRequest={onVideoPlaybackRequest}
                  onVideoRelease={onVideoRelease}
                />

                {/* ✅ SUPPRIMÉ 2026-01-14: Drapeau déplacé après l'adresse textuelle */}
                {/* ✅ SUPPRIMÉ 2026-01-14: Distance déplacée dans topHeaderRow (cliquable) */}

                {isTrending && (
                  <View style={styles.trendingBadge}>
                    <Text style={styles.trendingEmoji}>🔥🔥</Text>
                    <Text style={styles.trendingText}>{t('productCard.tendance')}</Text>
                    <Text style={styles.trendingCount}>{usageCount}×</Text>
                  </View>
                )}
                {!isTrending && isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularEmoji}>🔥</Text>
                    <Text style={styles.popularText}>{t('productCard.populaire')}</Text>
                    <Text style={styles.popularCount}>{usageCount}×</Text>
                  </View>
                )}
              </View>
            )}

            <View style={[styles.content, !hasMedia && styles.contentCompact]}>
              {/* ✅ OPTIMISÉ 2026-01-14: Header unifié avec distance, stats et partage - Disposition équilibrée */}
              <View style={styles.topHeaderRow}>
                {/* Distance à gauche (cliquable pour navigation) */}
                {hasDistance && distanceKm !== undefined && (
                  <TouchableOpacity
                    style={styles.distanceBadgeClickable}
                    onPress={hasGPS ? handleOpenNavigation : undefined}
                    disabled={!hasGPS}
                    activeOpacity={hasGPS ? 0.7 : 1}
                  >
                    <SafeIcon name="navigation" size={12} color="#6366F1" />
                    <Text style={styles.distanceTextClickable}>
                      {distanceKm < 1
                        ? `${Math.round(distanceKm * 1000)}m`
                        : `${distanceKm.toFixed(1)}km`}
                    </Text>
                    {/* ✅ NOUVEAU: Badge "≈" pour GPS temps réel (position approximative du prestataire) */}
                    {product._gpsSource === 'service_realtime' && (
                      <Text style={styles.approximateBadge}>≈</Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* Statistiques centrées - Espacement équilibré */}
                {topStatsData.length > 0 && (
                  <View style={styles.topStatsRowCentered}>
                    {topStatsData.map((stat) => (
                      <View
                        key={stat.key}
                        style={[
                          styles.topStatPillCompact,
                          { backgroundColor: `${stat.tint}12` },
                        ]}
                      >
                        <SafeIcon name={stat.icon as any} size={10} color={stat.tint} />
                        <Text style={[styles.topStatValueCompact, { color: stat.tint }]}>
                          {formatCompactNumber(stat.value)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* ✅ CORRIGÉ 2026-03-14: Boutons réaction (long-press = picker) + partage */}
                <View style={styles.topHeaderActions}>
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={styles.heartButtonCompact}
                      onPress={() => {
                        if (showReactionPicker) {
                          setShowReactionPicker(false);
                        } else {
                          handleReaction('love');
                        }
                      }}
                      onLongPress={() => setShowReactionPicker(!showReactionPicker)}
                      activeOpacity={0.7}
                      disabled={pendingReaction !== null}
                    >
                      {(() => {
                        const userReaction = reactionItems.find(r => reactions[r.type]?.hasReacted);
                        if (userReaction && userReaction.type !== 'love') {
                          return <Text style={{ fontSize: 14 }}>{userReaction.emoji}</Text>;
                        }
                        return (
                          <SafeIcon
                            name="heart"
                            size={16}
                            color={reactions.love?.hasReacted ? '#EF4444' : '#6B7280'}
                          />
                        );
                      })()}
                      {totalReactions > 0 && (
                        <Text style={[
                          styles.heartCountText,
                          reactionItems.some(r => reactions[r.type]?.hasReacted) && { color: '#EF4444' }
                        ]}>
                          {formatCompactNumber(totalReactions)}
                        </Text>
                      )}
                    </TouchableOpacity>
                    {showReactionPicker && (
                      <View style={styles.reactionPickerBubble}>
                        {reactionItems.map((reaction) => {
                          const hasReacted = reactions[reaction.type]?.hasReacted || false;
                          const count = reactions[reaction.type]?.count || 0;
                          return (
                            <TouchableOpacity
                              key={reaction.type}
                              style={[styles.reactionPickerBubbleItem, hasReacted && styles.reactionPickerBubbleItemActive]}
                              onPress={() => {
                                handleReaction(reaction.type);
                                setShowReactionPicker(false);
                              }}
                              activeOpacity={0.7}
                              disabled={pendingReaction !== null}
                            >
                              <Text style={styles.reactionPickerBubbleEmoji}>{reaction.emoji}</Text>
                              {count > 0 && (
                                <Text style={[styles.reactionPickerBubbleCount, hasReacted && { color: '#3B82F6' }]}>{count}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.shareButtonCompact}
                    onPress={handleShare}
                    activeOpacity={0.7}
                  >
                    <SafeIcon name="share" size={14} color="#6B7280" />
                  </TouchableOpacity>
                  {/* ✅ NOUVEAU 2026-03-14: Partage interne via composant réutilisable */}
                  <InternalShareButton
                    payload={{
                      contentType: 'product',
                      serviceId: serviceId || product?.service_id || service?.id,
                      productIndex: productIndex !== undefined && productIndex !== null ? productIndex : (product?.product_index ?? null),
                      title: productData?.nom || productData?.product_name || product?.product_name || t('productCard.produit'),
                      description: productData?.description || '',
                    }}
                    iconSize={14}
                    iconColor="#6B7280"
                    style={[styles.shareButtonCompact, { marginLeft: 4 }]}
                  />
                </View>
              </View>

              {/* ✅ OPTIMISÉ 2026-01-14: Section produit - Titre en pleine largeur pour meilleure lisibilité */}
              <View style={styles.productHeaderSection}>
                <Text style={styles.productName} numberOfLines={2}>
                  {filterBooleanValue(
                    // ✅ MIGRATION COMPLÈTE 2026-01-23: Utiliser UNIQUEMENT product_name depuis le backend
                    // Le backend garantit que product_name est toujours présent dans service_products
                    productData?.product_name || product?.product_name || t('productCard.produit'),
                    t('productCard.produit')
                  )}
                </Text>

                {/* ✅ NOUVEAU 2026-03-XX: Prix affiché directement sous le nom (Amazon-style) */}
                {/* ✅ NOUVEAU 2026-03-05: Badge promotion flash si produit en promo */}
                {isEnPromotion && (
                  <View style={styles.promoBadgeRow}>
                    <View style={styles.promoBadge}>
                      <SafeIcon name="zap" size={10} color="#FFFFFF" />
                      <Text style={styles.promoBadgeText}>
                        {promoDiscountType === 'free' ? t('productCard.gratuit') :
                          promoDiscountType === 'percentage' ? `-${promoDiscountValue}%` :
                            promoDiscountType === 'fixed' ? `-${promoDiscountValue.toLocaleString()} ${devise}` :
                              promoTitle}
                      </Text>
                    </View>
                    {promoEndsAt ? (
                      <Text style={styles.promoEndsText}>
                        {t('productCard.fin')}: {(() => { try { const d = new Date(promoEndsAt); return `${d.getDate()}/${d.getMonth() + 1}`; } catch { return ''; } })()}
                      </Text>
                    ) : null}
                  </View>
                )}
                <View style={styles.priceInlineRow}>
                  {hasVariant && variants.length > 0 && displayPrice > 0 && (
                    <Text style={styles.priceInlineFrom}>{t('productCard.aPartirDe')}</Text>
                  )}
                  {/* ✅ NOUVEAU 2026-03-05: Si en promo, afficher ancien prix barré + nouveau prix en rouge */}
                  {isEnPromotion && displayPrice > 0 ? (
                    <>
                      <Text style={styles.priceInlineStrikethrough}>
                        {displayPrice.toLocaleString()}
                      </Text>
                      <Text style={styles.priceInlinePromo}>
                        {promoDiscountType === 'free' ? t('productCard.gratuit') : `${promoPrice.toLocaleString()}`}
                      </Text>
                      {promoDiscountType !== 'free' && (
                        <Text style={styles.priceInlineDevisePromo}> {devise}</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.priceInline}>
                        {displayPrice > 0 ? `${displayPrice.toLocaleString()}` : t('productCard.prixSurDemande')}
                      </Text>
                      {displayPrice > 0 && (
                        <Text style={styles.priceInlineDevise}> {devise}</Text>
                      )}
                    </>
                  )}
                  {(reviewsCount > 0 || averageRating > 0) && (
                    <View style={styles.ratingInline}>
                      {averageRating > 0 ? (
                        <>
                          <Text style={styles.ratingStarsInline}>
                            {Array.from({ length: 5 }, (_, i) =>
                              i < Math.round(averageRating) ? '★' : '☆'
                            ).join('')}
                          </Text>
                          <Text style={styles.ratingValueInline}>{averageRating.toFixed(1)}</Text>
                        </>
                      ) : (
                        <SafeIcon name="star" size={12} color="#f59e0b" />
                      )}
                      {reviewsCount > 0 && (
                        <Text style={styles.ratingCountInline}>
                          {averageRating > 0 ? '· ' : ''}{reviewsCount} {t('productCard.avis')}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* ✅ OPTIMISÉ 2026-01-14: Description juste sous le titre pour meilleure hiérarchie */}
                {/* ✅ CORRIGÉ 2026-01-23: Utiliser UNIQUEMENT productData.description pour éviter confusion avec description du service */}
                {/* ✅ CORRIGÉ 2026-02-06: Permettre l'affichage de la description sur plus de lignes (4 au lieu de 2) */}
                {(productData.description || productData.description_produit || product.description || product.description_produit) && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setDescriptionExpanded(prev => !prev)}
                  >
                    <Text
                      style={styles.productDescription}
                      numberOfLines={descriptionExpanded ? undefined : 2}
                    >
                      {normalizeNewlines(filterBooleanValue(
                        // ✅ CORRIGÉ 2026-01-23: PRIORITÉ ABSOLUE à la description du produit depuis productData
                        // Ne JAMAIS utiliser la description du service comme fallback
                        productData.description ||
                        productData.description_produit ||
                        product.description ||
                        product.description_produit ||
                        '',
                        ''
                      ))}
                    </Text>
                    {!descriptionExpanded && (
                      <Text style={styles.voirPlusText}>{t('productCard.voirPlus')}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* ✅ NOUVEAU 2026-03-14: Specs spécialisées selon la catégorie détectée */}
              {detectedCategory === 'automobile' && (
                <View style={styles.specializedSpecsRow}>
                  <View style={styles.specializedSpecsBadge}>
                    <SafeIcon name="car" size={10} color="#3B82F6" type="lucide" />
                    <Text style={styles.specializedSpecsBadgeText}>{t('productCard.auto')}</Text>
                  </View>
                  {(() => {
                    const specs = [
                      productData.annee || productData.année,
                      productData.kilometrage ? `${Number(productData.kilometrage).toLocaleString()} km` : null,
                      productData.carburant,
                      productData.transmission,
                      productData.couleur,
                      productData.etat || productData.état,
                      productData.marque,
                      productData.modele || productData.modèle,
                      productData.type_vehicule,
                    ].filter(Boolean);
                    return specs.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                        {specs.map((spec, i) => (
                          <View key={i} style={styles.specializedSpecChip}>
                            <Text style={styles.specializedSpecChipText}>{String(spec)}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null;
                  })()}
                </View>
              )}
              {detectedCategory === 'pharmacie' && (
                <View style={styles.specializedSpecsRow}>
                  <View style={[styles.specializedSpecsBadge, { backgroundColor: '#ECFDF5' }]}>
                    <SafeIcon name="pill" size={10} color="#059669" type="lucide" />
                    <Text style={[styles.specializedSpecsBadgeText, { color: '#059669' }]}>{t('productCard.pharma')}</Text>
                  </View>
                  {(() => {
                    const specs = [
                      productData.categorie,
                      productData.forme_galenique || productData.forme,
                      productData.dosage || productData.posologie,
                      productData.dci || productData.molecule || productData.molécule,
                      productData.ordonnance_requise === true ? t('productCard.ordonnance') : null,
                      productData.stock ? `${t('productCard.stock')}: ${productData.stock} ${productData.unite || ''}`.trim() : null,
                    ].filter(Boolean);
                    return specs.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                        {specs.map((spec, i) => (
                          <View key={i} style={[styles.specializedSpecChip, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Text style={[styles.specializedSpecChipText, { color: '#065F46' }]}>{String(spec)}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null;
                  })()}
                </View>
              )}
              {detectedCategory === 'supermarche' && (
                <View style={styles.specializedSpecsRow}>
                  <View style={[styles.specializedSpecsBadge, { backgroundColor: '#FFF7ED' }]}>
                    <SafeIcon name="shopping-cart" size={10} color="#EA580C" type="lucide" />
                    <Text style={[styles.specializedSpecsBadgeText, { color: '#EA580C' }]}>{t('productCard.supermarche')}</Text>
                  </View>
                  {(() => {
                    const specs = [
                      productData.categorie || productData.rayon,
                      productData.marque || productData.brand,
                      productData.poids || productData.contenance || productData.volume,
                      productData.code_barre ? `EAN: ${productData.code_barre}` : null,
                      productData.en_promotion ? t('productCard.promo') : null,
                    ].filter(Boolean);
                    return specs.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                        {specs.map((spec, i) => (
                          <View key={i} style={[styles.specializedSpecChip, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                            <Text style={[styles.specializedSpecChipText, { color: '#9A3412' }]}>{String(spec)}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null;
                  })()}
                </View>
              )}

              {/* ✅ OPTIMISÉ 2026-01-14: Section prestataire et localisation - Ligne compacte et équilibrée */}
              <View style={styles.prestataireLocationRow}>
                {/* Nom prestataire */}
                {prestataireInfo.nom && (
                  <TouchableOpacity
                    style={styles.prestataireNameCompact}
                    onPress={() => {
                      if (prestataireInfo.user_id) {
                        // ✅ NOUVEAU 2026-01-20: Rediriger vers la boutique du prestataire
                        // ✅ CORRIGÉ 2026-01-23: Passer le produit et service cliqués pour les inclure dans les résultats
                        (navigation as any).navigate('PrestataireBoutique', {
                          userId: prestataireInfo.user_id,
                          user_id: prestataireInfo.user_id,
                          prestataireName: prestataireInfo.nom || prestataireInfo.nom_complet || prestataireInfo.name,
                          name: prestataireInfo.nom || prestataireInfo.nom_complet || prestataireInfo.name,
                          // ✅ NOUVEAU 2026-01-23: Passer le produit et service cliqués
                          clickedProduct: product,
                          clickedService: service,
                        });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <SafeIcon name="store" size={10} color="#6366F1" />
                    <Text style={styles.prestataireNameText} numberOfLines={1}>
                      {filterBooleanValue(prestataireInfo.nom, t('productCard.prestataire'))}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* ✅ FIX 2026-03-11: Adresse cliquable → NavigationScreen (comme la distance) */}
                {(chosenLocation || countryFlag) && (
                  <TouchableOpacity
                    style={styles.addressRowCompact}
                    onPress={hasGPS ? handleOpenNavigation : undefined}
                    disabled={!hasGPS}
                    activeOpacity={hasGPS ? 0.7 : 1}
                  >
                    {chosenLocation && (
                      <>
                        <SafeIcon name="map-pin" size={10} color={hasGPS ? '#6366F1' : '#6B7280'} />
                        <View style={styles.addressTextWithFlagContainer}>
                          <Text style={[styles.addressTextCompact, hasGPS && { color: '#6366F1' }]} numberOfLines={1}>
                            {chosenLocation}
                          </Text>
                          {countryFlag && countryFlag !== '🌍' && (
                            <Text style={styles.addressFlagCompact}>{countryFlag}</Text>
                          )}
                        </View>
                      </>
                    )}
                    {!chosenLocation && countryFlag && countryFlag !== '🌍' && (
                      <Text style={styles.addressFlagCompact}>{countryFlag}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* ✅ SUPPRIMÉ 2026-03-XX: Metrics card supprimé (info déjà dans top stats - UX Amazon-style compact) */}

              {productVector.length > 0 && (
                <View style={styles.characteristicsSection}>
                  <View style={styles.sectionHeader}>
                    <SafeIcon name="tag" size={14} color="#6B7280" />
                    <Text style={styles.sectionTitle}>{t('productCard.caracteristiques')}</Text>
                  </View>
                  <ScrollView
                    ref={characteristicsScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsScroll}
                    onScroll={handleCharacteristicsScroll}
                    scrollEventThrottle={16}
                    onScrollBeginDrag={() => setIsScrollingCharacteristicsManually(true)}
                    onMomentumScrollEnd={() => {
                      // ✅ CORRIGÉ 2026-01-21: Réactiver le scroll automatique après 3 secondes d'inactivité
                      setTimeout(() => setIsScrollingCharacteristicsManually(false), 3000);
                    }}
                    onScrollEndDrag={() => {
                      // ✅ CORRIGÉ 2026-01-21: Réactiver le scroll automatique après 3 secondes d'inactivité
                      setTimeout(() => setIsScrollingCharacteristicsManually(false), 3000);
                    }}
                    decelerationRate="fast"
                    style={{ flexGrow: 0 }} // ✅ CORRIGÉ 2026-01-21: Forcer le ScrollView à prendre seulement la largeur nécessaire
                  >
                    {productVector.map((carac: string, i: number) => {
                      // ✅ CORRIGÉ 2026-01-13: Filtrer les valeurs booléennes avant affichage
                      const displayValue = filterBooleanValue(carac, '');
                      if (!displayValue) return null;
                      return (
                        <View key={i} style={styles.chip}>
                          <Text style={styles.chipText}>{displayValue}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {hasVariant && variants.length > 0 && (
                <View style={styles.priceVariations}>
                  <View style={styles.sectionHeader}>
                    <SafeIcon name="dollar-sign" size={12} color="#6B7280" />
                    <Text style={styles.sectionTitle}>
                      {t('productCard.prixSelon', { dimension: filterBooleanValue(variantDimension, t('productCard.variante')) })}
                    </Text>
                  </View>

                  <ScrollView
                    ref={variantsScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={styles.variantsScrollContainer}
                    onScroll={handleVariantsScroll}
                    scrollEventThrottle={16}
                    onScrollBeginDrag={() => setIsScrollingManually(true)}
                    onMomentumScrollEnd={() => {
                      // ✅ CORRIGÉ 2026-01-21: Réactiver le scroll automatique après 3 secondes d'inactivité
                      setTimeout(() => setIsScrollingManually(false), 3000);
                    }}
                    onScrollEndDrag={() => {
                      // ✅ CORRIGÉ 2026-01-21: Réactiver le scroll automatique après 3 secondes d'inactivité
                      setTimeout(() => setIsScrollingManually(false), 3000);
                    }}
                    decelerationRate="fast"
                    snapToInterval={118} // ✅ CORRIGÉ 2026-03-04: cardWidth (110) + marginRight (8) = 118
                    snapToAlignment="start"
                    pagingEnabled={false} // ✅ Utiliser snapToInterval au lieu de pagingEnabled
                    style={{ flexGrow: 0 }} // ✅ CORRIGÉ 2026-01-21: Forcer le ScrollView à prendre seulement la largeur nécessaire
                  >
                    {variants.map((variant: any, i: number) => (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.variantCard,
                          selectedVariantIndex === i && styles.variantCardSelected
                        ]}
                        onPress={() => {
                          setSelectedVariantIndex(selectedVariantIndex === i ? null : i);
                        }}
                      >
                        {variant.image && (
                          <Image
                            source={{ uri: normalizeMediaUrl(variant.image, 'image') || undefined }}
                            style={styles.variantCardImage}
                            resizeMode="cover"
                          />
                        )}
                        <Text style={styles.variantCardValue} numberOfLines={1}>
                          {filterBooleanValue(variant.value || variant.valeur, 'Variante')}
                        </Text>
                        <Text style={styles.variantCardPrice}>
                          {(typeof variant.prix === 'number' ? variant.prix : (parseFloat(variant.prix) || 0)).toLocaleString()} {variant.devise || devise}
                        </Text>
                        <View style={[
                          styles.variantCardStock,
                          (variant.stock || 0) > 5 ? styles.stockOK :
                            (variant.stock || 0) > 0 ? styles.stockLow : styles.stockOut
                        ]}>
                          <Text style={styles.variantCardStockText}>
                            {t('productCard.stock')}: {(variant.stock || 0) > 0 ? variant.stock : '0'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                </View>
              )}

              {/* ✅ NOUVEAU 2026-01-14: Actions sur même ligne */}
              <View style={styles.actionsRow}>
                {serviceId && isProduct && (
                  <TouchableOpacity
                    style={[
                      styles.actionButtonDeliveryCompact,
                      !deliveryEnabled && styles.actionButtonDeliveryDisabled
                    ]}
                    onPress={() => {
                      if (!serviceId) {
                        Alert.alert(t('productCard.erreur'), t('productCard.serviceNonDisponible'));
                        return;
                      }
                      if (!deliveryEnabled) {
                        Alert.alert(
                          t('productCard.livraisonNonDisponible'),
                          t('productCard.livraisonNonActivee')
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
                      size={14}
                      color={deliveryEnabled ? "#10B981" : "#9CA3AF"}
                    />
                    <Text style={[
                      styles.actionButtonDeliveryTextCompact,
                      !deliveryEnabled && styles.actionButtonDeliveryTextDisabled
                    ]}>
                      {t('productCard.commander')}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.actionButtonChatCompact}
                  onPress={handleChatPress}
                  activeOpacity={0.7}
                >
                  <SafeIcon name="message-circle" size={14} color="#FFFFFF" />
                  <Text style={styles.actionButtonChatTextCompact}>{t('productCard.chat')}</Text>
                </TouchableOpacity>
              </View>

              {/* ✅ NOUVEAU 2026-01-XX: Section commentaires/avis pour les produits */}
              {serviceId && !isNaN(parseInt(String(serviceId))) && (
                <View style={styles.commentsContainerCompact}>
                  <ProductCommentsSection
                    serviceId={typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId}
                    productIndex={productIndex}
                    serviceTitle={productData?.nom || service?.data?.titre_service?.valeur || t('productCard.produit')}
                    onOpenChat={handleChatPress}
                    mode="inline"
                    compact={true}
                  />
                </View>
              )}
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
          productName={productData?.nom || productData?.name || productData?.titre || t('productCard.produit')}
          // ✅ NOUVEAU 2026-01-23: Passer les variations de prix au modal
          productVariants={hasVariant && variants.length > 0 ? variants : undefined}
          selectedVariantIndex={selectedVariantIndex !== null ? selectedVariantIndex : undefined}
          // ✅ FIX 2026-03-03: Passer le prix du produit directement pour éviter "Calcul en cours..."
          initialProductPrice={displayPrice}
          onSuccess={(deliveryId) => {
            console.log('[ProductCard] Livraison créée:', deliveryId);
            setShowOrderModal(false);
            // ✅ FIX 2026-03-03: Navigation vers l'écran de suivi de livraison
            try {
              (navigation as any).navigate('DeliveryShoppingTracking', { deliveryId });
            } catch (navError) {
              console.warn('[ProductCard] Erreur navigation suivi:', navError);
            }
          }}
        ></OrderDeliveryModal>
      )}

      {showGallery && (
        <ServiceGalleryModal
          visible={showGallery}
          service={service || {
            id: String(product?.service_id || service?.id),
            titre: productData?.nom || service?.data?.titre_service?.valeur || t('productCard.produit'),
            description: productData?.description || service?.data?.description?.valeur || '',
            user_id: String(prestataireInfo.user_id || service?.user_id || ''),
            data: service?.data || {},
          }}
          onClose={() => setShowGallery(false)}
        />
      )}

    </>
  );
};

export default React.memo(ProductCard, (prevProps, nextProps) => {
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
  // ✅ CORRIGÉ 2026-03-07: Ajouter isScrolling pour que les vidéos s'arrêtent pendant le scroll
  return (
    prevProductId === nextProductId &&
    prevServiceId === nextServiceId &&
    prevPrestataireId === nextPrestataireId &&
    prevLocation === nextLocation &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onChatPress === nextProps.onChatPress &&
    prevProps.isScrolling === nextProps.isScrolling &&
    prevProps.isVisible === nextProps.isVisible
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    overflow: 'hidden',
    borderRadius: 14, // ✅ OPTIMISÉ 2026-01-14: 12 -> 14 pour meilleur rendu
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // ✅ OPTIMISÉ: Plus opaque pour meilleur contraste
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)', // ✅ OPTIMISÉ: Bordure plus subtile
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 }, // ✅ OPTIMISÉ: Ombre légèrement plus prononcée
    shadowOpacity: 0.08, // ✅ OPTIMISÉ: Ombre plus visible
    shadowRadius: 10, // ✅ OPTIMISÉ: Ombre plus douce
    elevation: 3, // ✅ OPTIMISÉ: Élévation Android
    width: '100%', // ✅ OPTIMISÉ: Largeur maximale
    maxWidth: width - 32, // ✅ OPTIMISÉ: Largeur maximale avec marges
  },
  cardContainerCompact: {
    borderRadius: 16,
  },
  touchableContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180, // ✅ CORRIGÉ 2026-02-27: 120 → 180 pour aligner avec ProductMediaCarousel et rendre les médias visibles
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  // ✅ SUPPRIMÉ 2026-01-14: countryBadge et countryFlag supprimés (drapeau déplacé après adresse)
  // ✅ SUPPRIMÉ 2026-01-14: distanceBadge, distanceText, distanceBadgeInline, distanceTextInline remplacés par distanceBadgeClickable
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
    padding: 10, // ✅ OPTIMISÉ 2026-03-04: 12 → 10 pour layout plus compact
    gap: 6, // ✅ OPTIMISÉ 2026-03-04: 8 → 6 pour réduire l'espacement vertical
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  contentCompact: {
    paddingTop: 6, // ✅ RÉDUIT 2026-01-14
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  // ✅ OPTIMISÉ 2026-01-14: Header unifié - Disposition équilibrée avec espacement uniforme
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4, // ✅ OPTIMISÉ 2026-03-04: 8 → 4 plus compact
    gap: 6, // ✅ OPTIMISÉ 2026-03-04: 8 → 6
    minHeight: 24, // ✅ OPTIMISÉ 2026-03-04: 28 → 24 plus compact
  },
  distanceBadgeClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distanceTextClickable: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
  },
  approximateBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f59e0b',
    marginLeft: 1,
  },
  topStatsRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
    justifyContent: 'center',
  },
  topStatPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  topStatValueCompact: {
    fontSize: 9,
    fontWeight: '700',
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  heartButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'transparent',
    gap: 2,
  },
  heartCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  shareButtonCompact: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  reactionPickerBubble: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactionPickerBubbleItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 12,
  },
  reactionPickerBubbleItemActive: {
    backgroundColor: '#EEF2FF',
  },
  reactionPickerBubbleEmoji: {
    fontSize: 20,
  },
  reactionPickerBubbleCount: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 1,
  },
  // ✅ OPTIMISÉ 2026-01-14: Section produit - Titre et description avec hiérarchie claire
  productHeaderSection: {
    marginBottom: 4, // ✅ OPTIMISÉ 2026-03-04: 8 → 4 plus compact
  },
  // ✅ OPTIMISÉ 2026-01-14: Description - Positionnée juste sous le titre
  productDescription: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15, // ✅ OPTIMISÉ 2026-03-04: 16 → 15 plus compact
    marginTop: 2, // ✅ OPTIMISÉ 2026-03-04: 4 → 2
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  // ✅ OPTIMISÉ 2026-01-14: Section prestataire et localisation - Ligne compacte et équilibrée
  prestataireLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6, // ✅ OPTIMISÉ 2026-03-04: 8 → 6
    marginBottom: 4, // ✅ OPTIMISÉ 2026-03-04: 8 → 4
    flexWrap: 'wrap',
  },
  prestataireNameCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // ✅ OPTIMISÉ: 4px entre icône et texte
    paddingHorizontal: 8, // ✅ OPTIMISÉ: 8px padding horizontal
    paddingVertical: 4, // ✅ OPTIMISÉ: 4px padding vertical
    borderRadius: 8, // ✅ OPTIMISÉ: 8px border radius
    backgroundColor: '#F3F4F6', // ✅ OPTIMISÉ: Fond plus subtil
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexShrink: 1, // ✅ OPTIMISÉ: Permet de rétrécir si nécessaire
    maxWidth: '48%', // ✅ OPTIMISÉ: Maximum 48% pour laisser place à l'adresse
  },
  prestataireNameText: {
    fontSize: 10,
    color: '#374151',
    fontWeight: '600',
    flexShrink: 1,
  },
  // ✅ OPTIMISÉ 2026-01-14: Adresse compacte avec drapeau
  // ✅ CORRIGÉ 2026-01-22: Drapeau juste à côté du texte (pas à l'extrême droite)
  addressRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // ✅ OPTIMISÉ: 4px entre icône et conteneur texte+drapeau
    flex: 1, // ✅ OPTIMISÉ: Prend l'espace restant
    minWidth: '48%', // ✅ OPTIMISÉ: Minimum 48% pour équilibrer avec prestataire
    flexWrap: 'wrap', // ✅ CORRIGÉ 2026-01-22: Permet le retour à la ligne si nécessaire
  },
  // ✅ NOUVEAU 2026-01-22: Conteneur pour texte + drapeau (collés ensemble)
  addressTextWithFlagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2, // ✅ Espacement minimal entre texte et drapeau
    flexShrink: 1, // ✅ Permet de rétrécir si nécessaire
  },
  addressTextCompact: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    flexShrink: 1, // ✅ Permet de rétrécir si nécessaire
  },
  addressFlagCompact: {
    fontSize: 14,
    flexShrink: 0, // ✅ CORRIGÉ 2026-01-22: Le drapeau ne doit pas rétrécir
  },
  // ✅ OPTIMISÉ 2026-01-14: Actions - Boutons bien visibles avec espacement uniforme
  actionsRow: {
    flexDirection: 'row',
    gap: 6, // ✅ OPTIMISÉ 2026-03-04: 8 → 6
    alignItems: 'center',
    marginTop: 4, // ✅ OPTIMISÉ 2026-03-04: 8 → 4
    marginBottom: 0,
  },
  actionButtonDeliveryCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7, // ✅ OPTIMISÉ 2026-03-04: 6 → 7 pour meilleur touch target
    paddingHorizontal: 10,
    backgroundColor: '#10B981',
    borderRadius: 20, // ✅ OPTIMISÉ 2026-03-04: 8 → 20 pill shape pro
    borderWidth: 0,
    flex: 1,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonChatCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7, // ✅ OPTIMISÉ 2026-03-04: 6 → 7 pour meilleur touch target
    paddingHorizontal: 10,
    backgroundColor: modernColors.primary,
    borderRadius: 20, // ✅ OPTIMISÉ 2026-03-04: 8 → 20 pill shape pro
    flex: 1,
    shadowColor: modernColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonDeliveryTextCompact: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtonChatTextCompact: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  // ✅ CORRIGÉ 2026-01-14: Container commentaires avec hauteur adaptative (non coupés)
  // ✅ AMÉLIORÉ 2026-01-23: Ajout d'un header cliquable pour accéder facilement aux avis
  commentsContainerCompact: {
    marginTop: 2, // ✅ OPTIMISÉ 2026-03-04: 4 → 2
    minHeight: 40,
  },
  commentsHeaderButton: {
    backgroundColor: modernColors.primary + '10', // 10% opacity
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: modernColors.primary + '30', // 30% opacity
  },
  commentsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentsHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.primary,
  },
  topStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2, // ✅ COMPACT 2026-01-13: 4 -> 2 pour réduire de 50%+
    marginBottom: 0,
  },
  topStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4, // ✅ COMPACT 2026-01-13: 6 -> 4
    paddingVertical: 1, // ✅ COMPACT 2026-01-13: 2 -> 1
    borderRadius: 6, // ✅ COMPACT 2026-01-13: 8 -> 6
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  topStatValue: {
    fontSize: 10, // ✅ RÉDUIT 2026-01-13: 11 -> 10
    fontWeight: '700',
    marginLeft: 2, // ✅ RÉDUIT 2026-01-13: 4 -> 2
  },
  productName: {
    fontSize: 14, // ✅ OPTIMISÉ 2026-03-04: 15 → 14 plus compact sans sacrifier lisibilité
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18, // ✅ OPTIMISÉ 2026-03-04: 20 → 18
    letterSpacing: -0.2,
  },
  // ✅ NOUVEAU 2026-03-XX: Styles Amazon-style pour prix inline et rating
  priceInlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 2,
  },
  priceInline: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B12704', // Amazon price red
    letterSpacing: -0.3,
  },
  priceInlineDevise: {
    fontSize: 11,
    fontWeight: '600',
    color: '#565959', // Amazon gray
  },
  priceInlineFrom: {
    fontSize: 11,
    color: '#565959',
  },
  // ✅ NOUVEAU 2026-03-05: Styles pour les promotions flash
  promoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 1,
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  promoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  promoEndsText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  priceInlineStrikethrough: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  priceInlinePromo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: -0.3,
  },
  priceInlineDevisePromo: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 8,
  },
  ratingStarsInline: {
    fontSize: 12,
    color: '#f59e0b',
    letterSpacing: -0.5,
  },
  ratingValueInline: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    marginLeft: 2,
  },
  ratingCountInline: {
    fontSize: 11,
    color: '#007185', // Amazon teal link
    fontWeight: '500',
  },
  voirPlusText: {
    fontSize: 11,
    color: '#007185',
    fontWeight: '600',
    marginTop: 2,
  },
  // ✅ SUPPRIMÉ 2026-01-14: prestataireRow, avatar, avatarPlaceholder, prestataireName remplacés par prestataireNameCompact
  // ✅ SUPPRIMÉ 2026-01-14: locationRow, locationText, locationSection remplacés par addressRow
  // ✅ SUPPRIMÉ 2026-01-14: locationNavigationSection remplacée par addressRow
  metricsCard: {
    marginTop: 2, // ✅ COMPACT 2026-01-13: 4 -> 2 pour réduire de 50%+
    borderRadius: 6, // ✅ COMPACT 2026-01-13: 8 -> 6
    paddingVertical: 2, // ✅ COMPACT 2026-01-13: 4 -> 2 pour réduire de 50%+
    paddingHorizontal: 4, // ✅ COMPACT 2026-01-13: 6 -> 4 pour réduire de 50%+
  },
  // ✅ OPTIMISÉ 2026-01-14: Carte métriques compacte avec fond subtil
  metricsCardCompact: {
    marginTop: 0,
    marginBottom: 4, // ✅ OPTIMISÉ 2026-03-04: 8 → 4
    borderRadius: 8,
    paddingVertical: 4, // ✅ OPTIMISÉ 2026-03-04: 6 → 4
    paddingHorizontal: 6, // ✅ OPTIMISÉ 2026-03-04: 8 → 6
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  compactStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2, // ✅ COMPACT 2026-01-13: 4 -> 2 pour réduire de 50%+
    marginTop: 1, // ✅ COMPACT 2026-01-13: 2 -> 1
    marginBottom: 1, // ✅ COMPACT 2026-01-13: 2 -> 1
  },
  compactStatPillMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 8, // ✅ RÉDUIT 2026-01-13: 12 -> 8
    paddingHorizontal: 6, // ✅ RÉDUIT 2026-01-13: 8 -> 6
    paddingVertical: 2, // ✅ RÉDUIT 2026-01-13: 4 -> 2
    borderWidth: 1,
    borderColor: '#E4E4E7',
    gap: 3, // ✅ RÉDUIT 2026-01-13: 4 -> 3
  },
  compactStatEmoji: {
    fontSize: 12,
  },
  compactStatValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  compactStatLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  characteristicsSection: {
    gap: 1, // ✅ OPTIMISÉ 2026-03-04: 2 → 1
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionTitle: {
    fontSize: 11, // ✅ RÉDUIT 2026-01-13: 12 -> 11
    fontWeight: '600',
    color: '#374151',
  },
  chipsScroll: {
    gap: 4,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7, // ✅ OPTIMISÉ 2026-03-04: 8 → 7
    paddingVertical: 3, // ✅ OPTIMISÉ 2026-03-04: 4 → 3
    borderRadius: 12, // ✅ OPTIMISÉ 2026-03-04: 8 → 12 pill shape
    borderWidth: 0.5,
    borderColor: modernColors.primary + '60', // ✅ OPTIMISÉ 2026-03-04: bordure plus subtile
  },
  chipText: {
    fontSize: 10, // ✅ OPTIMISÉ 2026-03-04: 11 → 10
    color: modernColors.primary,
    fontWeight: '600',
  },
  priceVariations: {
    gap: 2,
    backgroundColor: '#F8FAFC', // ✅ OPTIMISÉ 2026-03-04: fond plus clair
    padding: 6, // ✅ OPTIMISÉ 2026-03-04: 3 → 6 pour meilleur rendu
    borderRadius: 10, // ✅ OPTIMISÉ 2026-03-04: 6 → 10
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  variantsScrollContainer: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 4,
  },
  variantCard: {
    width: 110, // ✅ OPTIMISÉ 2026-03-04: 120 → 110 plus compact
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 6, // ✅ OPTIMISÉ 2026-03-04: 8 → 6
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  variantCardSelected: {
    borderColor: modernColors.primary,
    backgroundColor: '#EEF2FF',
  },
  variantCardImage: {
    width: '100%',
    height: 60,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  variantCardValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  variantCardPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: modernColors.primary,
    marginBottom: 4,
  },
  variantCardStock: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  variantCardStockText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#374151',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 40,
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
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  priceFromContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 3, // ✅ COMPACT 2026-01-13: 6 -> 3 pour réduire de 50%+
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 2, // ✅ COMPACT 2026-01-13: 4 -> 2 pour réduire de 50%+
  },
  priceFromLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  priceFromValue: {
    fontSize: 15, // ✅ OPTIMISÉ 2026-03-04: 14 → 15 prix plus visible
    fontWeight: '800',
    color: modernColors.primary,
  },
  priceUniqueContainer: {
    gap: 4,
  },
  priceLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  price: {
    fontSize: 16, // ✅ OPTIMISÉ 2026-03-04: 14 → 16, le prix doit être visuellement dominant
    fontWeight: '800',
    color: modernColors.primary,
  },
  priceDevise: {
    fontSize: 10, // ✅ COMPACT 2026-01-13: 12 -> 10 pour réduire de 50%+
    fontWeight: '600',
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 4, // ✅ COMPACT 2026-01-13: 8 -> 4 pour réduire de 50%+
    alignItems: 'center',
    flexWrap: 'wrap',
    minHeight: 32, // ✅ COMPACT 2026-01-13: 40 -> 32 pour réduire de 50%+
  },
  actionButton: {
    flex: 1,
    minWidth: 80,
  },
  actionButtonFullWidth: {
    flex: 1,
    minWidth: '100%',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ✅ SUPPRIMÉ 2026-01-14: navigationButton et navigationButtonText supprimés (distance cliquable à la place)
  actionButtonDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3, // ✅ COMPACT 2026-01-13: 4 -> 3
    paddingVertical: 4, // ✅ COMPACT 2026-01-13: 8 -> 4 pour réduire de 50%+
    paddingHorizontal: 8, // ✅ COMPACT 2026-01-13: 12 -> 8 pour réduire de 50%+
    backgroundColor: '#10B981',
    borderRadius: 6, // ✅ COMPACT 2026-01-13: 8 -> 6
    borderWidth: 1,
    borderColor: '#059669',
    minWidth: 70, // ✅ COMPACT 2026-01-13: 80 -> 70
  },
  actionButtonDeliveryDisabled: {
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
    opacity: 0.6,
  },
  actionButtonDeliveryText: {
    color: '#FFFFFF',
    fontSize: 10, // ✅ COMPACT 2026-01-13: 12 -> 10 pour réduire de 50%+
    fontWeight: '600',
  },
  actionButtonDeliveryTextDisabled: {
    color: '#9CA3AF',
  },
  // ✅ SUPPRIMÉ 2026-01-14: footer supprimé (informations déplacées dans topHeaderRow)
  // ✅ SUPPRIMÉ 2026-01-14: secondaryActions supprimé (partage déplacé en haut)
  cardGradient: {
    borderRadius: 16, // ✅ OPTIMISÉ 2026-03-04: 18 → 16
    padding: 1,
    marginBottom: 10, // ✅ OPTIMISÉ 2026-03-04: 8 → 10 un peu d'air entre les cartes
  },
  // ✅ NOUVEAU 2026-03-14: Styles pour les specs spécialisées (automobile, pharmacie, supermarché)
  specializedSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  specializedSpecsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  specializedSpecsBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  specializedSpecChip: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 4,
  },
  specializedSpecChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1E40AF',
  },
});

// ProductCard is already exported as default above via React.memo
