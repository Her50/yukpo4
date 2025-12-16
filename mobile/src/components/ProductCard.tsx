/**
 * ProductCard v3.0 - Version optimale moderne (2025-11-02)
 * Toutes fonctionnalités : vecteurs, variations, chat, distance, drapeau pays
 * Sauvegarde : ProductCard.backup.tsx
 */

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AnimatedReanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { config } from '../config/environment';
import { useLocation } from '../contexts/LocationContext';
import { useTheme } from '../contexts/ThemeContext';
import useDeviceType from '../hooks/useDeviceType';
import { apiGet, apiPost, commentsApi } from '../services/api';
import { mediaService } from '../services/mediaService';
import { modernColors } from '../theme/modernTheme';
import { triggerHaptic } from '../utils/hapticFeedback';
import ChatModalMobile from './ChatModalMobile';
import ContextMenu from './ContextMenu';
import OrderDeliveryModal from './delivery/OrderDeliveryModal';
import ModalSwipeable from './ModalSwipeable';
import { NativeCard } from './NativeDesign';
import OptimizedImage from './OptimizedImage';
import ProductBadges from './ProductBadges';
import ProductCommentsSection from './ProductCommentsSection';
import ProductMediaCarousel from './ProductMediaCarousel';
import QuickCartButton from './QuickCartButton';
import SafeIcon from './SafeIcon';
import ServiceGalleryModal from './ServiceGalleryModal';
import { useToaster } from './ToasterProvider';

const { width } = Dimensions.get('window');

// ✅ NOUVEAU: Composant bouton d'action avec animations premium
const EnhancedActionButton: React.FC<{
  style?: any;
  onPress: () => void;
  icon: string;
  iconColor: string;
  text: string;
  textStyle?: any;
  accessibilityLabel?: string;
}> = ({ style, onPress, icon, iconColor, text, textStyle, accessibilityLabel }) => {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const pressGesture = Gesture.Tap()
    .onBegin(() => {
      if (typeof withSpring === 'function' && typeof withTiming === 'function' && scale && glow) {
        try {
          scale.value = withSpring(0.92, { damping: 12, stiffness: 150 });
          glow.value = withTiming(1, { duration: 150 });
        } catch (error) {
          console.warn('[ProductCard] Erreur animation onBegin:', error);
        }
      }
    })
    .onFinalize(() => {
      if (typeof withSpring === 'function' && typeof withTiming === 'function' && scale && glow) {
        try {
          scale.value = withSpring(1, { damping: 12, stiffness: 150 });
          glow.value = withTiming(0, { duration: 300 });
        } catch (error) {
          console.warn('[ProductCard] Erreur animation onFinalize:', error);
        }
      }
      onPress();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value * 0.3,
    shadowRadius: glow.value * 8,
  }));

  return (
    <GestureDetector gesture={pressGesture}>
      <AnimatedReanimated.View style={[style, animatedStyle]} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        <SafeIcon name={icon as any} size={16} color={iconColor} />
        <Text style={textStyle} numberOfLines={1}>
          {text}
        </Text>
      </AnimatedReanimated.View>
    </GestureDetector>
  );
};

interface ProductCardProps {
  product: any;
  service: any;
  prestataire?: any; // ✅ NOUVEAU: Prestataire déjà fourni depuis MixedContentCarousel
  userLocation?: { latitude: number; longitude: number } | null;
  onPress?: () => void;
  onChatPress?: () => void; // ✅ NOUVEAU: Handler chat personnalisé
  onAllMediaViewed?: () => void; // ✅ NOUVEAU: Callback quand tous les médias ont été vus
  isVisible?: boolean; // ✅ NOUVEAU: Lazy load des données seulement si la carte est visible
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

// ✅ NOUVEAU: Composant section "Autres clients ont aussi acheté"
const RelatedProductsSection: React.FC<{ product: any; service: any; navigation: any }> = ({ product, service, navigation }) => {
  const [relatedProducts, setRelatedProducts] = React.useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = React.useState(false);
  const { apiGet } = require('../services/api');

  React.useEffect(() => {
    const loadRelatedProducts = async () => {
      if (!product?.service_id && !service?.id) return;

      setLoadingRelated(true);
      try {
        // Charger des produits similaires du même prestataire ou catégorie
        const serviceId = product?.service_id || service?.id;
        const response = await apiGet(`/api/services/recent?limit=4&exclude=${serviceId}`);

        if (response.success && Array.isArray(response.data?.data)) {
          setRelatedProducts(response.data.data.slice(0, 3)); // Limiter à 3 produits
        }
      } catch (error) {
        console.error('[ProductCard] Erreur chargement produits similaires:', error);
      } finally {
        setLoadingRelated(false);
      }
    };

    // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
    loadRelatedProducts().catch(error => {
      console.error('[ProductCard] Erreur loadRelatedProducts:', error);
    });
    // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
    return undefined;
  }, [product?.service_id, service?.id]);

  if (loadingRelated || relatedProducts.length === 0) {
    return null; // Ne pas afficher si pas de produits ou en chargement
  }

  return (
    <View style={relatedProductsStyles.container}>
      <View style={relatedProductsStyles.header}>
        <SafeIcon name="users" size={16} color={modernColors.primary} />
        <Text style={relatedProductsStyles.title}>Autres clients ont aussi acheté</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={relatedProductsStyles.scrollContent}
      >
        {relatedProducts.map((item: any, index: number) => {
          const productName = item.nom || item.data?.nom_produit?.valeur || item.data?.titre_service?.valeur || 'Produit';
          const productImage = item.images?.[0] || item.data?.images?.[0] || item.image_url;
          const productPrice = item.prix || item.data?.prix?.valeur || item.price;

          return (
            <TouchableOpacity
              key={index}
              style={relatedProductsStyles.productCard}
              onPress={() => {
                navigation.navigate('ServiceDetail' as any, {
                  serviceId: String(item.service_id || item.id)
                });
              }}
              activeOpacity={0.7}
            >
              {productImage ? (
                <OptimizedImage
                  uri={productImage}
                  style={relatedProductsStyles.productImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[relatedProductsStyles.productImage, relatedProductsStyles.placeholderImage]}>
                  <SafeIcon name="image" size={24} color="#D1D5DB" />
                </View>
              )}
              <Text style={relatedProductsStyles.productName} numberOfLines={2}>
                {productName}
              </Text>
              {productPrice && (
                <Text style={relatedProductsStyles.productPrice}>
                  {typeof productPrice === 'number' ? productPrice.toFixed(0) : (productPrice != null ? String(productPrice) : '0')} FCFA
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const relatedProductsStyles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  productCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    minHeight: 32,
  },
  productPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: modernColors.primary,
  },
});

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

// ✅ NOUVEAU 2025-12-03: Utiliser mediaService pour CDN avec fallback
// ✅ REMPLACÉ: buildMediaUrl() par mediaService pour bénéficier du CDN Cloudflare
// Le service gère automatiquement : CDN → Wasabi → Backend
const buildMediaUrl = (path: string | undefined | null): string | undefined => {
  if (!path || typeof path !== 'string') return undefined;

  // Si c'est déjà une URL complète (http/https), la retourner telle quelle
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Si c'est un data URI (base64), le retourner tel quel
  if (path.startsWith('data:')) {
    return path;
  }

  // ✅ NOUVEAU: Utiliser mediaService pour bénéficier du CDN avec fallback
  // mediaService gère automatiquement : CDN Cloudflare → Wasabi Direct → Backend
  return mediaService.getImageUrl(path);
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
  onAllMediaViewed,
  isVisible = true,
}) => {
  // ✅ NOUVEAU: Utiliser le thème (clair/sombre)
  const { colors } = useTheme();
  // ✅ GÉANT-LEVEL: Détection type appareil et breakpoints (Amazon/Instagram style)
  const deviceType = useDeviceType();
  // ✅ CORRIGÉ: Utiliser LocationContext pour calculer la distance si nécessaire
  const { calculateDistance: locationCalculateDistance, location: contextLocation } = useLocation();
  const effectiveUserLocation = useMemo(() =>
    userLocation || (contextLocation ? { latitude: contextLocation.coords.latitude, longitude: contextLocation.coords.longitude } : null),
    [userLocation, contextLocation]
  );
  const navigation = useNavigation();
  const toaster = useToaster(); // ✅ NOUVEAU: Toast pour feedback utilisateur
  const [imageError, setImageError] = useState(false);

  // ✅ NOUVEAU 2025-12-03: Initialiser mediaService pour CDN avec fallback
  useEffect(() => {
    mediaService.initialize(config.API_BASE_URL).catch(() => {
      // Ignorer erreurs d'initialisation
    });
  }, []);

  // ✅ PREMIUM: Animations d'entrée et interactions
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  const trendingPulseAnim = useRef(new Animated.Value(1)).current;
  const popularPulseAnim = useRef(new Animated.Value(1)).current;

  // ✅ PREMIUM: Calculer isTrending et isPopular tôt pour les animations
  const usageCount = product.usage_count || 0;
  const isPopular = usageCount >= 5;  // Populaire si recherché 5+ fois
  const isTrending = usageCount >= 10; // Tendance si recherché 10+ fois

  // ✅ PREMIUM: Animation d'entrée de la carte
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ✅ PREMIUM: Animation pulse pour badges trending/popularité
  useEffect(() => {
    if (isTrending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(trendingPulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(trendingPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
    if (isPopular && !isTrending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(popularPulseAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(popularPulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isTrending, isPopular]);
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

  // ✅ NOUVEAU 2025-12-11: Guards de visibilité & lifecycle
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ NOUVEAU 2025-12-11: Cache mémoire pour éviter les requêtes répétées
  const reactionsCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const commentStatsCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  // ✅ CONFIGURABLE: Durée de cache (5 minutes par défaut, ajuster selon besoins)
  // Plus long = moins de requêtes mais données potentiellement obsolètes
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // ✅ NOUVEAU 2025-12-11: Queue avec limite de concurrence pour éviter les rafales
  // ✅ CONFIGURABLE: Ajuster selon les besoins (3 = équilibré, 5 = plus rapide mais plus de charge)
  const MAX_CONCURRENT_REQUESTS = 3;
  const reactionPendingQueue = useRef<Array<() => void>>([]);
  const activeReactionRequests = useRef(0);
  const commentPendingQueue = useRef<Array<() => void>>([]);
  const activeCommentRequests = useRef(0);

  const enqueueReaction = useCallback((task: () => Promise<void>) => {
    return new Promise<void>((resolve) => {
      const run = () => {
        activeReactionRequests.current += 1;
        task().finally(() => {
          activeReactionRequests.current -= 1;
          const next = reactionPendingQueue.current.shift();
          if (next) {
            next();
          }
          resolve();
        });
      };

      if (activeReactionRequests.current < MAX_CONCURRENT_REQUESTS) {
        run();
      } else {
        reactionPendingQueue.current.push(run);
      }
    });
  }, []);

  const enqueueComment = useCallback((task: () => Promise<void>) => {
    return new Promise<void>((resolve) => {
      const run = () => {
        activeCommentRequests.current += 1;
        task().finally(() => {
          activeCommentRequests.current -= 1;
          const next = commentPendingQueue.current.shift();
          if (next) {
            next();
          }
          resolve();
        });
      };

      if (activeCommentRequests.current < MAX_CONCURRENT_REQUESTS) {
        run();
      } else {
        commentPendingQueue.current.push(run);
      }
    });
  }, []);
  // ✅ NOUVEAU : État pour menu contextuel (long-press)
  const [showContextMenu, setShowContextMenu] = useState(false);
  // ✅ NOUVEAU : État pour mode compact/étendu
  const [isExpanded, setIsExpanded] = useState(false);
  // ✅ GÉANT-LEVEL: États pour swipe gestures et double-tap (Instagram/TikTok style)
  const [isFavorite, setIsFavorite] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const heartScale = useSharedValue(1);

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
  // ✅ CORRIGÉ: Vérifier aussi dans service directement (pas seulement service.data)
  // ✅ CORRIGÉ: Vérifier aussi dans les produits du service.data.produits
  const extractLocationFromProductData = (serviceData: any): string | undefined => {
    if (!serviceData || typeof serviceData !== 'object') return undefined;

    // Vérifier dans data.produits (array ou object)
    const produits = serviceData.produits;
    if (produits) {
      // Si c'est un array, prendre le premier produit
      if (Array.isArray(produits) && produits.length > 0) {
        const firstProduct = produits[0];
        if (typeof firstProduct === 'object') {
          return firstNonEmptyString(
            firstProduct.adresse,
            firstProduct.adresse_complete,
            firstProduct.localisation,
            firstProduct.lieu,
            firstProduct.ville,
            firstProduct.quartier,
            firstProduct.region,
            firstProduct.location,
            firstProduct.chosen_location,
          );
        }
      }
      // Si c'est un object avec valeur (array)
      if (typeof produits === 'object' && produits.valeur && Array.isArray(produits.valeur) && produits.valeur.length > 0) {
        const firstProduct = produits.valeur[0];
        if (typeof firstProduct === 'object') {
          return firstNonEmptyString(
            firstProduct.adresse,
            firstProduct.adresse_complete,
            firstProduct.localisation,
            firstProduct.lieu,
            firstProduct.ville,
            firstProduct.quartier,
            firstProduct.region,
            firstProduct.location,
            firstProduct.chosen_location,
          );
        }
      }
    }

    return undefined;
  };

  const chosenLocation = firstNonEmptyString(
    // ✅ CORRIGÉ: Priorité 1 - Données produit directes
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
    // ✅ CORRIGÉ: Priorité 2 - Extraire depuis service.data.produits
    extractLocationFromProductData(service?.data),
    // ✅ CORRIGÉ: Priorité 3 - service directement
    service?.adresse_complete,
    service?.adresse,
    service?.adresse_service,
    service?.adresse_prestataire,
    service?.localisation,
    service?.lieu,
    service?.ville,
    service?.quartier,
    service?.region,
    // ✅ CORRIGÉ: Priorité 4 - service.data (champs dynamiques)
    service?.data?.adresse_complete?.valeur,
    service?.data?.adresse?.valeur,
    service?.data?.adresse_service?.valeur,
    service?.data?.adresse_prestataire?.valeur,
    service?.data?.localisation?.valeur,
    service?.data?.lieu?.valeur,
    service?.data?.ville?.valeur,
    service?.data?.quartier?.valeur,
    service?.data?.region?.valeur,
    // ✅ CORRIGÉ: Priorité 5 - service.data.location (objet)
    service?.data?.location?.address,
    service?.data?.location?.formatted_address,
    service?.data?.location?.full_address,
    service?.data?.location?.primary,
  ) || '';

  const hasVariant = product.has_variant || false;
  const variants = product.variants || [];
  // ✅ CORRIGÉ: Construire le nom du prestataire depuis service.user si disponible
  const buildPrestataireNameFromUser = (user: any): string | undefined => {
    if (!user) return undefined;
    // Priorité 1: nom_complet
    if (user.nom_complet && typeof user.nom_complet === 'string' && user.nom_complet.trim()) {
      return user.nom_complet.trim();
    }
    // Priorité 2: nom + prenom
    const nom = user.nom || '';
    const prenom = user.prenom || '';
    if (nom || prenom) {
      return `${prenom} ${nom}`.trim();
    }
    // Priorité 3: email (première partie)
    if (user.email && typeof user.email === 'string') {
      return user.email.split('@')[0];
    }
    return undefined;
  };

  const rawPrestataire =
    prestataireFromProps ||
    product.prestataire ||
    service?.prestataire ||
    {
      nom: buildPrestataireNameFromUser(service?.user) ||
        service?.prestataire?.name || // ✅ CORRIGÉ: Vérifier aussi 'name' (format API)
        service?.prestataire?.nom ||
        service?.prestataire?.nom_complet ||
        service?.data?.nom_prestataire?.valeur ||
        service?.data?.prestataire_nom?.valeur ||
        service?.data?.contact_nom?.valeur ||
        service?.data?.nom_prestataire ||
        service?.data?.prestataire_nom ||
        product?.prestataire_nom ||
        product?.prestataire_name ||
        product?.owner_name ||
        product?.vendor_name ||
        'Prestataire',
      user_id: service?.user_id || service?.user?.id,
      avatar_url: service?.prestataire?.photo || service?.prestataire?.avatar_url || service?.user?.avatar_url || service?.user?.photo_profil || service?.data?.photo_prestataire?.valeur,
    };

  // ✅ NOUVEAU: Fonction pour nettoyer le nom et éviter les duplications
  const cleanPrestataireName = (name: string | undefined | null): string | undefined => {
    if (!name || typeof name !== 'string') return undefined;
    const trimmed = name.trim();
    if (!trimmed) return undefined;

    // Détecter et corriger les duplications (ex: "Lélé Hernandez Lélé Hernandez")
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
      const firstHalf = words.slice(0, Math.ceil(words.length / 2)).join(' ');
      const secondHalf = words.slice(Math.ceil(words.length / 2)).join(' ');
      if (firstHalf === secondHalf) {
        return firstHalf; // Retourner seulement la première moitié si duplication
      }
    }

    return trimmed;
  };

  const rawPrestataireName = firstNonEmptyString(
    // ✅ CORRIGÉ: Priorité 1 - Construire depuis service.user (source de vérité)
    buildPrestataireNameFromUser(service?.user),
    // ✅ CORRIGÉ: Priorité 2 - Vérifier service.prestataire.name (format API)
    service?.prestataire?.name,
    service?.prestataire?.nom,
    service?.prestataire?.nom_complet,
    // Priorité 3 - rawPrestataire (déjà construit)
    rawPrestataire?.nom,
    rawPrestataire?.nom_complet,
    rawPrestataire?.name,
    rawPrestataire?.username,
    rawPrestataire?.display_name,
    rawPrestataire?.full_name,
    rawPrestataire?.raison_sociale,
    // Priorité 4 - product.prestataire
    product.prestataire?.nom,
    product.prestataire?.nom_complet,
    product.prestataire?.name,
    product.prestataire_nom,
    product.prestataire_nom_affiche,
    product.prestataire_nom_commercial,
    product.prestataire_nom_complet,
    product.prestataire_name,
    product.prestataire_fullname,
    // Priorité 5 - product.owner/vendor
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
    // Priorité 6 - service.data (champs dynamiques)
    service?.data?.nom_prestataire?.valeur,
    service?.data?.prestataire_nom?.valeur,
    service?.data?.contact_nom?.valeur,
    service?.data?.nom?.valeur,
    service?.data?.nom_entreprise?.valeur,
    service?.data?.responsable_nom?.valeur,
    service?.data?.representant_nom?.valeur,
    // Priorité 7 - service.user (autres champs)
    service?.user?.name,
    service?.user?.username,
    service?.user?.display_name,
  ) || 'Prestataire';

  // ✅ CORRIGÉ: Nettoyer le nom pour éviter les duplications
  const prestataireName = cleanPrestataireName(rawPrestataireName) || 'Prestataire';

  const prestataireAvatar = firstNonEmptyString(
    // ✅ CORRIGÉ: Priorité 1 - service.user (source de vérité)
    service?.user?.avatar_url,
    service?.user?.photo_profil,
    // ✅ CORRIGÉ: Priorité 2 - service.prestataire
    service?.prestataire?.avatar_url,
    service?.prestataire?.photo,
    service?.prestataire?.avatar,
    // Priorité 3 - rawPrestataire
    rawPrestataire?.avatar_url,
    rawPrestataire?.photo_profil,
    rawPrestataire?.photo,
    rawPrestataire?.avatar,
    rawPrestataire?.image_url,
    // Priorité 4 - product.prestataire
    product.prestataire_avatar,
    product.prestataire?.avatar_url,
    product.prestataire?.avatar,
    product.owner?.avatar,
    product.vendor?.avatar_url,
    // Priorité 5 - service.data (champs dynamiques)
    service?.data?.photo_prestataire?.valeur,
    service?.data?.photo_profil?.valeur,
  );

  const prestataireUserId =
    rawPrestataire?.user_id ||
    product.prestataire?.user_id ||
    service?.user_id ||
    service?.data?.user_id;

  // ✅ CORRIGÉ 2025-12-11: Nettoyer rawPrestataire pour éviter d'afficher "false" (boolean) comme texte
  const cleanedRawPrestataire = rawPrestataire ? {
    ...Object.keys(rawPrestataire).reduce((acc: any, key: string) => {
      const value = rawPrestataire[key as keyof typeof rawPrestataire];
      // ✅ CRITIQUE 2025-12-11: Filtrer toutes les valeurs booléennes false et les valeurs null/undefined
      if (value === false || value === null || value === undefined) {
        return acc; // Ne pas inclure les valeurs false/null/undefined
      }
      // ✅ CRITIQUE: Vérifier que les strings ne sont pas vides
      if (typeof value === 'string' && value.trim().length === 0) {
        return acc; // Ne pas inclure les strings vides
      }
      acc[key] = value;
      return acc;
    }, {} as any),
    // ✅ CRITIQUE: S'assurer que adresse est une string valide
    adresse: (rawPrestataire.adresse && typeof rawPrestataire.adresse === 'string' && rawPrestataire.adresse.trim().length > 0) ? rawPrestataire.adresse : undefined,
  } : {};

  const prestataire = {
    ...cleanedRawPrestataire,
    nom: prestataireName,
    nom_complet: prestataireName,
    avatar_url: prestataireAvatar,
    user_id: prestataireUserId,
  };

  // ✅ NOUVEAU : Popularité (usage_count de autocomplete_characteristics)
  // Note: usageCount, isPopular, isTrending sont maintenant déclarés plus haut pour les animations

  // Images et vidéos
  // ✅ CORRIGÉ: Extraire depuis product.images directement (depuis extractSearchResults)
  const rawProductImages: string[] = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : [];
  // ✅ NOUVEAU: Extraire aussi depuis service.data.produits si disponible
  // Note: productIndex sera déclaré plus bas, on le calcule ici temporairement
  const tempProductIndex = typeof product.product_index === 'number'
    ? product.product_index
    : typeof product.index === 'number'
      ? product.index
      : 0;
  const produitsFromService = service?.data?.produits;
  let productImagesFromService: string[] = [];
  let productVideosFromService: string[] = [];
  if (produitsFromService) {
    // Si c'est un array, prendre le produit à l'index
    if (Array.isArray(produitsFromService) && produitsFromService.length > tempProductIndex) {
      const targetProduct = produitsFromService[tempProductIndex];
      if (targetProduct && typeof targetProduct === 'object') {
        productImagesFromService = Array.isArray(targetProduct.images)
          ? targetProduct.images.filter(Boolean)
          : [];
        productVideosFromService = Array.isArray(targetProduct.videos)
          ? targetProduct.videos.filter(Boolean)
          : [];
      }
    }
    // Si c'est un object avec valeur (array)
    else if (typeof produitsFromService === 'object' && produitsFromService.valeur && Array.isArray(produitsFromService.valeur) && produitsFromService.valeur.length > tempProductIndex) {
      const targetProduct = produitsFromService.valeur[tempProductIndex];
      if (targetProduct && typeof targetProduct === 'object') {
        productImagesFromService = Array.isArray(targetProduct.images)
          ? targetProduct.images.filter(Boolean)
          : [];
        productVideosFromService = Array.isArray(targetProduct.videos)
          ? targetProduct.videos.filter(Boolean)
          : [];
      }
    }
  }
  const rawServiceImages: string[] = Array.isArray(service?.images)
    ? (service?.images as string[]).filter(Boolean)
    : [];
  const serviceBannerImage = buildMediaUrl(
    firstNonEmptyString(
      service?.data?.banner?.valeur,
      service?.data?.banner,
      service?.data?.banniere?.valeur,
      service?.data?.banniere,
    )
  );
  const serviceLogoImage = buildMediaUrl(
    firstNonEmptyString(
      service?.data?.logo?.valeur,
      service?.data?.logo,
    )
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
    // ✅ NOUVEAU 2025-11-26: Construire l'URL complète pour les chemins relatifs
    const fullUrl = buildMediaUrl(uri);
    if (!fullUrl) return;
    if (orderedImages.includes(fullUrl)) return;
    orderedImages.push(fullUrl);
  };

  addImage(serviceBannerImage);
  addImage(serviceLogoImage);
  rawProductImages.forEach(addImage);
  productImagesFromService.forEach(addImage); // ✅ NOUVEAU: Ajouter images depuis service.data.produits
  rawServiceImages.forEach(addImage);
  googlePhotoUrls.forEach(addImage);

  const images = orderedImages;
  // ✅ CORRIGÉ: Construire les URLs complètes pour les vidéos avant de les passer au carousel
  const rawVideos: string[] = Array.isArray(product.videos)
    ? product.videos.filter(Boolean)
    : productVideosFromService.length > 0
      ? productVideosFromService // ✅ NOUVEAU: Utiliser videos depuis service.data.produits si disponible
      : Array.isArray(service?.videos)
        ? (service?.videos as string[]).filter(Boolean)
        : [];
  // ✅ CORRIGÉ: Construire les URLs complètes pour chaque vidéo via CDN avec fallback
  const videos: string[] = rawVideos
    .map(vid => {
      if (!vid || typeof vid !== 'string') return null;
      // Utiliser getVideoUrl pour bénéficier du CDN avec fallback
      return mediaService.getVideoUrl(vid);
    })
    .filter((vid): vid is string => typeof vid === 'string' && vid.length > 0);

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

  // ✅ CORRIGÉ: Extraire serviceId depuis plusieurs sources possibles
  const serviceId = product.service_id ||
    product.serviceId ||
    product._serviceId ||
    service?.id ||
    service?.service_id ||
    service?.serviceId ||
    (typeof product.service === 'object' && product.service?.id) ||
    (typeof product.service === 'object' && product.service?.service_id) ||
    null;
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

  // ✅ CORRECTION 2025-11-29: Extraire le prix depuis service.data.produits avec améliorations
  const extractPriceFromProductData = (serviceData: any, productIndex: number = 0): { prix: number; devise: string } => {
    if (!serviceData || typeof serviceData !== 'object') return { prix: 0, devise: 'XAF' };

    const produits = serviceData.produits;
    if (!produits) return { prix: 0, devise: 'XAF' };

    let targetProduct: any = null;

    // Si c'est un array, prendre le produit à l'index spécifié
    if (Array.isArray(produits) && produits.length > productIndex) {
      targetProduct = produits[productIndex];
    }
    // Si c'est un object avec valeur (array)
    else if (typeof produits === 'object' && produits.valeur && Array.isArray(produits.valeur) && produits.valeur.length > productIndex) {
      targetProduct = produits.valeur[productIndex];
    }

    if (!targetProduct) return { prix: 0, devise: 'XAF' };

    // Si le produit est une chaîne (format concaténé), parser
    if (typeof targetProduct === 'string') {
      const parts = targetProduct.split(',').map(p => p.trim());
      // Format: "nom,categorie,description,prix" ou "nom,categorie,description,prix,devise"
      // Chercher le dernier élément numérique (prix)
      for (let i = parts.length - 1; i >= 0; i--) {
        const numericValue = parseFloat(parts[i]);
        if (!isNaN(numericValue) && numericValue > 0) {
          // La devise peut être après le prix ou par défaut XAF
          const devise = parts[i + 1] || 'XAF';
          return { prix: numericValue, devise };
        }
      }
      return { prix: 0, devise: 'XAF' };
    }
    // Si c'est un objet, extraire prix et devise
    else if (typeof targetProduct === 'object') {
      // ✅ AMÉLIORÉ 2025-11-29: Chercher dans plus d'endroits
      let prix = targetProduct.prix ||
        targetProduct.prix_produit ||
        targetProduct.price ||
        (typeof targetProduct.prix === 'string' ? parseFloat(targetProduct.prix) : 0);

      // ✅ NOUVEAU: Gérer cas prix = "0", null, undefined
      if (prix === 0 || prix === null || prix === undefined || prix === "0" || (typeof prix === 'string' && prix.trim() === "0")) {
        // Chercher dans variants si disponible
        if (targetProduct.variants && Array.isArray(targetProduct.variants) && targetProduct.variants.length > 0) {
          const validVariants = targetProduct.variants.filter((v: any) => v && (v.prix || v.price) && (v.prix > 0 || v.price > 0));
          if (validVariants.length > 0) {
            const minVariantPrice = Math.min(...validVariants.map((v: any) => v.prix || v.price || 0));
            if (minVariantPrice > 0) {
              prix = minVariantPrice;
            }
          }
        }
        // Chercher aussi dans variations (format alternatif)
        if (prix === 0 && targetProduct.variations && Array.isArray(targetProduct.variations) && targetProduct.variations.length > 0) {
          const validVariations = targetProduct.variations.filter((v: any) => v && (v.prix || v.price) && (v.prix > 0 || v.price > 0));
          if (validVariations.length > 0) {
            const minVariationPrice = Math.min(...validVariations.map((v: any) => v.prix || v.price || 0));
            if (minVariationPrice > 0) {
              prix = minVariationPrice;
            }
          }
        }
      }

      const devise = targetProduct.devise ||
        targetProduct.devise_produit ||
        targetProduct.currency ||
        targetProduct.variants?.[0]?.devise ||
        targetProduct.variants?.[0]?.currency ||
        'XAF';

      // ✅ AMÉLIORÉ: Convertir prix en number si string
      const prixNumber = typeof prix === 'number' ? prix : (typeof prix === 'string' ? parseFloat(prix) || 0 : 0);

      return {
        prix: prixNumber > 0 ? prixNumber : 0,
        devise: typeof devise === 'string' ? devise : 'XAF'
      };
    }

    return { prix: 0, devise: 'XAF' };
  };

  // ✅ NOUVEAU 2025-11-29: Formater prix en milliers (150000 → "150 000")
  const formatPrice = (price: number | undefined | null): string => {
    if (price === undefined || price === null || price === 0 || isNaN(price)) {
      return '0';
    }
    return price.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // ✅ OPTIMISÉ: Extraire le prix avec useMemo pour éviter recalculs
  const extractedPriceData = useMemo(() =>
    extractPriceFromProductData(service?.data, productIndex),
    [service?.data, productIndex]
  );

  // ✅ OPTIMISÉ: Prix avec useMemo
  const displayPrice = useMemo(() => {
    if (hasVariant && variants.length > 0) {
      return Math.min(...variants.map((v: any) => v.prix || v.price || 0));
    }

    // Chercher dans product directement
    let prix = product.prix || product.prix_produit || product.price;
    // Convertir string en number si nécessaire
    if (typeof prix === 'string') {
      const parsed = parseFloat(prix);
      prix = isNaN(parsed) ? 0 : parsed;
    }
    // Si prix = 0, null, undefined, chercher dans extractedPriceData
    if (!prix || prix === 0 || prix === "0") {
      prix = extractedPriceData.prix;
    }
    return prix || 0;
  }, [hasVariant, variants, product.prix, product.prix_produit, product.price, extractedPriceData.prix]);

  const devise = useMemo(() =>
    product.devise ||
    variants[0]?.devise ||
    extractedPriceData.devise ||
    'XAF',
    [product.devise, variants, extractedPriceData.devise]
  );

  // ✅ OPTIMISÉ: Calculer la distance avec useMemo pour éviter recalculs
  const distanceKm = useMemo(() => {
    // 1. Distance fournie directement
    const rawDistance = product.distance_km
      ?? product.distanceKm
      ?? product.distance
      ?? product.distance_client
      ?? product.distance_user
      ?? product.distance_user_km
      ?? product.distanceFromUser
      ?? product.distance_text
      ?? service?.distance_km
      ?? service?.distanceKm
      ?? service?.distance;

    let parsedDistance = parseDistanceToKm(rawDistance);

    // 2. Calculer la distance côté client si userLocation et service GPS disponibles
    if (!parsedDistance && effectiveUserLocation) {
      // Extraire les coordonnées GPS du service
      const parseGPS = (gpsValue: any): { lat: number; lng: number } | null => {
        if (!gpsValue) return null;

        // Format 1: "lat,lng" ou "lat|lng"
        if (typeof gpsValue === 'string') {
          const parts = gpsValue.replace(/\s+/g, '').split(/[,|]/);
          if (parts.length >= 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              return { lat, lng };
            }
          }
        }

        // Format 2: Objet { lat, lng } ou { latitude, longitude }
        if (typeof gpsValue === 'object') {
          const lat = gpsValue.lat ?? gpsValue.latitude;
          const lng = gpsValue.lng ?? gpsValue.longitude;
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng };
          }
        }

        return null;
      };

      const serviceGPS = parseGPS(service?.gps)
        ?? parseGPS(service?.data?.gps_fixe)
        ?? parseGPS(service?.data?.gps)
        ?? parseGPS(product.gps)
        ?? parseGPS(product.data?.gps);

      if (serviceGPS && locationCalculateDistance) {
        try {
          const calculatedDistance = locationCalculateDistance(
            effectiveUserLocation.latitude,
            effectiveUserLocation.longitude,
            serviceGPS.lat,
            serviceGPS.lng
          );
          if (Number.isFinite(calculatedDistance) && calculatedDistance >= 0) {
            parsedDistance = calculatedDistance;
          }
        } catch (error) {
          // Erreur silencieuse - on continue sans distance
          console.debug('[ProductCard] Erreur calcul distance:', error);
        }
      }
    }

    return parsedDistance;
  }, [
    product.distance_km,
    product.distanceKm,
    product.distance,
    product.distance_client,
    product.distance_user,
    product.distanceFromUser,
    product.distance_text,
    product.gps,
    service?.distance_km,
    service?.distanceKm,
    service?.distance,
    service?.gps,
    service?.data?.gps_fixe,
    service?.data?.gps,
    effectiveUserLocation,
    locationCalculateDistance,
  ]);

  const hasDistance = typeof distanceKm === 'number' && Number.isFinite(distanceKm);

  // ✅ CORRIGÉ: Réduire le niveau de log (warn → debug) car c'est normal qu'un service n'ait pas toujours de distance
  if (hasDistance) {
    // Ne pas logger en production - trop verbeux
    // console.log(`[ProductCard] ✅ Distance extraite pour service ${product.service_id}: ${distanceKm}km`);
  } else {
    // Ne logger que si vraiment nécessaire (debug uniquement)
    // console.debug(`[ProductCard] Pas de distance pour service ${product.service_id}`);
  }
  const formattedDistance = hasDistance && distanceKm != null && Number.isFinite(distanceKm)
    ? distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)}km`
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
    // ✅ AMÉLIORÉ 2025-11-29: Vérifier aussi dans prestataire (transmis par backend)
    prestataire?.pays,
    prestataire?.country,
    prestataire?.country_name,
    prestataire?.country_code,
    // ✅ CORRIGÉ: Vérifier aussi dans service directement
    service?.pays,
    service?.country,
    service?.country_name,
    service?.country_code,
    service?.data?.pays?.valeur,
    service?.data?.pays_origine?.valeur,
    service?.data?.country?.valeur,
    service?.data?.country_code?.valeur,
  );

  const countryFlag = getCountryFlag(pays);
  const showCountryBadge = countryFlag && countryFlag !== '🌍';

  // ✅ CORRIGÉ: Supprimer les logs DEBUG verbeux qui affichent undefined
  // Ces logs ne sont plus nécessaires et polluent les logs en production
  // Si besoin de debug, utiliser des logs conditionnels avec vérification de valeurs

  // ✅ CORRIGÉ: Utiliser serviceId déjà calculé pour commentServiceId
  // serviceId est calculé plus haut avec plusieurs sources, donc on l'utilise en priorité
  const commentServiceId = (() => {
    // Essayer d'abord serviceId qui est déjà calculé avec plusieurs sources
    if (serviceId && typeof serviceId === 'number' && serviceId > 0) {
      return Number(serviceId);
    }
    // Sinon, essayer les autres sources
    const fallbackId = product._serviceId ||
      product.service_id ||
      product.serviceId ||
      service?.id ||
      service?.service_id ||
      0;
    return Number(fallbackId);
  })();
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

  // ✅ AMÉLIORÉ: Handler avec haptic feedback et animations premium (scale + glow)
  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(pressAnim, {
        toValue: 0.95, // ✅ Réduit de 0.96 à 0.95 pour effet plus visible
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
    triggerHaptic('medium'); // ✅ Changé de 'light' à 'medium' pour meilleur feedback
  }, [pressAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(pressAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pressAnim]);

  // ✅ CORRIGÉ: Toujours ouvrir le modal - amélioration robuste
  const handleChatPress = useCallback(() => {
    // ✅ PREMIUM: Haptic feedback
    triggerHaptic('medium');

    // Appeler onChatPress si fourni (pour compatibilité)
    if (onChatPress) {
      onChatPress();
    }

    // ✅ CORRIGÉ: Vérifications strictes avant d'ouvrir le chat
    // Essayer de récupérer serviceId de plusieurs sources
    const resolvedServiceId = 
      service?.id ||
      product?.service_id ||
      product?.serviceId ||
      serviceId ||
      null;

    // Essayer de récupérer prestataireUserId de plusieurs sources
    const resolvedPrestataireUserId =
      prestataireUserId ||
      prestataire?.user_id ||
      product?.prestataire?.user_id ||
      service?.user_id ||
      service?.data?.user_id ||
      null;

    // ✅ CORRIGÉ: Vérifier que serviceId est valide (doit être un nombre > 0)
    if (!resolvedServiceId || typeof resolvedServiceId !== 'number' || resolvedServiceId <= 0) {
      Alert.alert(
        'Information manquante',
        'Impossible d\'ouvrir le chat : l\'identifiant du service est invalide.'
      );
      return;
    }

    // ✅ CORRIGÉ: Vérifier que prestataireUserId est valide (doit être un nombre > 0)
    if (!resolvedPrestataireUserId || typeof resolvedPrestataireUserId !== 'number' || resolvedPrestataireUserId <= 0) {
      Alert.alert(
        'Information manquante',
        'Impossible d\'ouvrir le chat : les informations du prestataire sont manquantes.'
      );
      return;
    }

    // Toujours ouvrir le modal local avec les informations disponibles
    setChatContext({
      type: 'service',
      targetUserId: Number(resolvedPrestataireUserId),
      targetUserName: prestataire?.nom || prestataireName || 'Prestataire',
      targetAvatar: prestataire?.avatar_url || prestataireAvatar || null,
    });
    setPrivateConversationId(null);
    setShowChatModal(true);
  }, [onChatPress, prestataireUserId, prestataire, product, service, prestataireName, prestataireAvatar, serviceId]);

  // ✅ NOUVEAU : Handler partage produit avec toast
  const handleShare = async () => {
    try {
      triggerHaptic('medium');
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
        toaster.success('Produit partagé avec succès');
        triggerHaptic('success');
      }
    } catch (error) {
      // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[ProductCard] Erreur partage:', {
        message: errorMessage,
        stack: errorStack,
        product: product?.nom || product?.name,
        error: error
      });
      toaster.error('Impossible de partager le produit');
      triggerHaptic('error');
    }
  };

  // ✅ AMÉLIORÉ: Charger réactions avec retry automatique + cache + queue + lazy visibility
  const loadReactions = useCallback(async (retryCount = 0) => {
    if (!isVisible) return;
    if (!serviceId || !resolvedProductId) return;

    const cacheKey = `${serviceId}-${resolvedProductId}`;
    const cached = reactionsCacheRef.current.get(cacheKey);
    const now = Date.now();

    // ✅ Cache court pour éviter les rafales
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      const reactionsMap: Record<string, { count: number; hasReacted: boolean }> = {};
      const reactionsArray = Array.isArray(cached.data) ? cached.data : [];
      reactionsArray.forEach((r: any) => {
        if (r && r.reaction_type) {
          reactionsMap[r.reaction_type] = {
            count: typeof r.count === 'number' ? r.count : 0,
            hasReacted: typeof r.has_reacted === 'boolean' ? r.has_reacted : false
          };
        }
      });
      setReactions(reactionsMap);
      return;
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 seconde

    await enqueueReaction(async () => {
      try {
        setLoadingReactions(true);
        const response = await apiGet(`/api/products/${serviceId}/${resolvedProductId}/reactions`);
        if (response.success && response.data) {
          const reactionsMap: Record<string, { count: number; hasReacted: boolean }> = {};
          const reactionsArray = Array.isArray(response.data) ? response.data : [];
          reactionsArray.forEach((r: any) => {
            if (r && r.reaction_type) {
              reactionsMap[r.reaction_type] = {
                count: typeof r.count === 'number' ? r.count : 0,
                hasReacted: typeof r.has_reacted === 'boolean' ? r.has_reacted : false
              };
            }
          });
          reactionsCacheRef.current.set(cacheKey, { data: reactionsArray, timestamp: Date.now() });
          if (isMountedRef.current) {
            setReactions(reactionsMap);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[ProductCard] Erreur chargement réactions:', {
          message: errorMessage,
          serviceId,
          resolvedProductId,
          retryCount,
          error: error
        });

        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
          setTimeout(() => {
            loadReactions(retryCount + 1);
          }, delay);
        } else {
          console.error('[ProductCard] Échec chargement réactions après', MAX_RETRIES, 'tentatives');
        }
      } finally {
        if (isMountedRef.current) {
          setLoadingReactions(false);
        }
      }
    });
  }, [CACHE_TTL_MS, enqueueReaction, isVisible, resolvedProductId, serviceId]);

  useEffect(() => {
    if (!isVisible) return undefined;
    loadReactions().catch(error => {
      console.error('[ProductCard] Erreur loadReactions:', error);
    });
    return undefined;
  }, [isVisible, loadReactions]);

  // ✅ AMÉLIORÉ: Charger les stats des commentaires avec retry + cache + queue + lazy visibility
  const loadCommentStats = useCallback(async (retryCount = 0) => {
    if (!isVisible) return;
    if (!commentServiceId || commentServiceId <= 0) return;

    const cacheKey = `${commentServiceId}`;
    const cached = commentStatsCacheRef.current.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      const payload: any = cached.data;
      setCommentStats({
        total_comments: payload.stats?.total_comments ?? payload.comments?.length ?? 0,
        rating_count: payload.stats?.rating_count ?? 0,
        average_rating: payload.stats?.average_rating ?? 0,
      });
      return;
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    await enqueueComment(async () => {
      try {
        setLoadingComments(true);
        const response = await commentsApi.getProductComments(commentServiceId);
        if (response.success && response.data) {
          const payload: any = response.data;
          commentStatsCacheRef.current.set(cacheKey, { data: payload, timestamp: Date.now() });
          if (isMountedRef.current) {
            setCommentStats({
              total_comments: payload.stats?.total_comments ?? payload.comments?.length ?? 0,
              rating_count: payload.stats?.rating_count ?? 0,
              average_rating: payload.stats?.average_rating ?? 0,
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[ProductCard] Erreur chargement stats commentaires:', {
          message: errorMessage,
          commentServiceId,
          retryCount,
          error: error
        });

        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          setTimeout(() => {
            loadCommentStats(retryCount + 1);
          }, delay);
        } else {
          console.error('[ProductCard] Échec chargement stats commentaires après', MAX_RETRIES, 'tentatives');
        }
      } finally {
        if (isMountedRef.current) {
          setLoadingComments(false);
        }
      }
    });
  }, [CACHE_TTL_MS, commentServiceId, enqueueComment, isVisible]);

  useEffect(() => {
    if (!isVisible) return undefined;
    loadCommentStats().catch(error => {
      console.error('[ProductCard] Erreur loadCommentStats:', error);
    });
    return undefined;
  }, [isVisible, loadCommentStats]);

  // ✅ GÉANT-LEVEL: Handler pour réagir avec optimistic update (Instagram style)
  const handleReaction = async (reactionType: string) => {
    if (!serviceId || !resolvedProductId) {
      toaster.warning('Impossible de réagir à ce produit pour le moment.');
      return;
    }

    setPendingReaction(reactionType);
    triggerHaptic('light');

    // ✅ GÉANT-LEVEL: Optimistic update - Mise à jour UI immédiate
    const previousReactions = { ...reactions };
    const currentReaction = reactions[reactionType] || { count: 0, hasReacted: false };
    const newHasReacted = !currentReaction.hasReacted;
    const newCount = newHasReacted ? currentReaction.count + 1 : Math.max(0, currentReaction.count - 1);

    setReactions({
      ...reactions,
      [reactionType]: {
        count: newCount,
        hasReacted: newHasReacted,
      },
    });

    try {
      const response = await apiPost(`/api/products/${serviceId}/${resolvedProductId}/react`, {
        reaction_type: reactionType
      });

      if (response.success) {
        await loadReactions();
        const reactionLabel = REACTIONS.find(r => r.type === reactionType)?.label || 'réaction';
        toaster.success(`${reactionLabel} enregistrée`);
        triggerHaptic('success');
      } else {
        // ✅ GÉANT-LEVEL: Rollback si erreur
        setReactions(previousReactions);
        toaster.error("Impossible d'enregistrer votre réaction");
        triggerHaptic('error');
      }
    } catch (error) {
      // ✅ GÉANT-LEVEL: Rollback si erreur
      setReactions(previousReactions);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[ProductCard] Erreur réaction:', {
        message: errorMessage,
        stack: errorStack,
        serviceId,
        resolvedProductId,
        reactionType,
        error: error
      });
      toaster.error("Impossible d'enregistrer votre réaction pour le moment.");
      triggerHaptic('error');
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
      // ✅ CORRIGÉ: Afficher correctement l'erreur avec message et stack
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[ProductCard] Erreur création conversation privée:', {
        message: errorMessage,
        stack: errorStack,
        userId,
        userName,
        error: error
      });
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

  // ✅ PREMIUM: Handler principal avec haptic feedback (défini tôt pour être utilisé dans gestures)
  const handleMainPress = useCallback(() => {
    triggerHaptic('light');
    if (onPress) {
      onPress();
    } else {
      const targetServiceId = product.service_id || service?.id;
      if (!targetServiceId) {
        Alert.alert('Erreur', 'Service introuvable : ID manquant');
        return;
      }
      navigation.navigate('ServiceDetail' as any, { serviceId: String(targetServiceId) });
    }
  }, [onPress, product.service_id, service?.id, navigation]);

  // ✅ GÉANT-LEVEL: Handler double-tap pour favoris avec optimistic update (Instagram style)
  const handleDoubleTap = useCallback(async () => {
    const newFavoriteState = !isFavorite;

    // ✅ GÉANT-LEVEL: Optimistic update - Mise à jour UI immédiate
    setIsFavorite(newFavoriteState);
    triggerHaptic('medium');
    setShowHeartAnimation(true);

    heartScale.value = withSequence(
      withSpring(1.5, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 8, stiffness: 200 }, () => {
        runOnJS(setShowHeartAnimation)(false);
      })
    );

    // Appel API en arrière-plan
    try {
      const response = await apiPost(`/api/products/${serviceId}/${resolvedProductId}/favorite`, {
        is_favorite: newFavoriteState,
      });
      if (response.success) {
        toaster.success(newFavoriteState ? 'Ajouté aux favoris' : 'Retiré des favoris');
        triggerHaptic('success');
      } else {
        // ✅ GÉANT-LEVEL: Rollback si erreur
        setIsFavorite(!newFavoriteState);
        toaster.error('Erreur lors de la modification');
        triggerHaptic('error');
      }
    } catch (error) {
      // ✅ GÉANT-LEVEL: Rollback si erreur
      setIsFavorite(!newFavoriteState);
      console.error('[ProductCard] Erreur favoris:', error);
      toaster.error('Erreur lors de la modification');
      triggerHaptic('error');
    }
  }, [isFavorite, serviceId, resolvedProductId, heartScale, toaster]);

  // ✅ GÉANT-LEVEL: Swipe gestures (TikTok/Instagram style)
  const swipeLeftGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationX < -50) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (e.translationX < -100) {
        runOnJS(handleShare)();
      }
      translateX.value = withSpring(0);
    });

  const swipeRightGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationX > 50) {
        translateX.value = e.translationX;
      }
    })
    .onEnd((e) => {
      if (e.translationX > 100) {
        runOnJS(handleChatPress)();
      }
      translateX.value = withSpring(0);
    });

  const swipeUpGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY < -50) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY < -100) {
        runOnJS(handleMainPress)();
      }
      translateY.value = withSpring(0);
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(handleDoubleTap)();
    });

  const composedGesture = Gesture.Simultaneous(
    swipeLeftGesture,
    swipeRightGesture,
    swipeUpGesture,
    doubleTapGesture
  );

  const swipeAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const tx = translateX.value * 0.3;
    const ty = translateY.value * 0.3;
    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
      ] as any, // ✅ Type assertion pour éviter erreur TypeScript
    };
  });

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartScale.value > 1 ? 1 : 0,
  }));

  // ✅ GÉANT-LEVEL: Render contenu optimisé pour tablette paysage
  const renderTabletLandscapeContent = useCallback(() => {
    return (
      <>
        {/* Stats */}
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
        <Text style={[styles.productName, styles.tabletLandscapeProductName]} numberOfLines={3}>
          {product.nom || service?.data?.nom_produit?.valeur || service?.data?.titre_service?.valeur || 'Produit'}
        </Text>

        {/* Badges */}
        <ProductBadges product={product} service={service} />

        {/* Prestataire */}
        {prestataireName && (
          <TouchableOpacity
            style={styles.prestataireRow}
            onPress={() => {
              if (prestataire.user_id) {
                navigation.navigate('ProfilePrestataire' as any, { userId: prestataire.user_id });
              }
            }}
            activeOpacity={0.7}
          >
            {prestataireAvatar ? (
              <OptimizedImage
                uri={prestataireAvatar}
                style={styles.avatar}
                priority="normal"
                cachePolicy="memory-disk"
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

        {/* Localisation */}
        {(chosenLocation || locationVector.length > 0) && (
          <View style={styles.locationSection}>
            <View style={styles.locationRow}>
              <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
              <Text style={styles.locationTextPrimary} numberOfLines={2}>
                {chosenLocation || locationVector[0] || 'Localisation disponible'}
              </Text>
              {countryFlag && countryFlag !== '🌍' && (
                <Text style={styles.locationFlag} numberOfLines={1}>
                  {countryFlag}
                </Text>
              )}
            </View>
            {formattedDistance && (
              <View style={styles.locationDistanceChip}>
                <SafeIcon name="navigation" size={12} color={modernColors.primary} />
                <Text style={styles.locationDistanceText}>{formattedDistance}</Text>
              </View>
            )}
          </View>
        )}

        {/* Prix */}
        {hasVariant && variants.length > 0 ? (
          <View style={styles.priceVariations}>
            <View style={styles.sectionHeader}>
              <SafeIcon name="dollar-sign" size={14} color="#6B7280" />
              <Text style={styles.sectionTitle}>
                Prix selon {product.variant_dimension || 'variante'}
              </Text>
            </View>
            <View style={styles.priceTable}>
              {variants.slice(0, 3).map((variant: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.priceRow,
                    selectedVariantIndex === i && styles.priceRowSelected
                  ]}
                  onPress={() => {
                    setSelectedVariantIndex(selectedVariantIndex === i ? null : i);
                    triggerHaptic('selection');
                  }}
                >
                  <View style={styles.cellVariant}>
                    <Text style={styles.variantValue}>{variant.value || variant.valeur}</Text>
                  </View>
                  <View style={styles.cellPrice}>
                    <Text style={styles.variantPrice}>
                      {formatPrice(variant.prix)}
                    </Text>
                    <Text style={styles.variantDevise}>{variant.devise || devise}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.priceFromContainer}>
              <Text style={styles.priceFromLabel}>À partir de</Text>
              <Text style={styles.priceFromValue}>
                {formatPrice(displayPrice)} {devise}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.priceUniqueContainer}>
            <Text style={styles.priceLabel}>Prix</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {formatPrice(displayPrice)}
              </Text>
              <Text style={styles.priceDevise}>{devise}</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {serviceId && isProduct && (
            <TouchableOpacity
              style={[styles.actionButtonModern, styles.actionButtonDelivery]}
              onPress={() => {
                triggerHaptic('medium');
                setShowOrderModal(true);
              }}
            >
              <SafeIcon name="truck" size={16} color="#10B981" />
              <Text style={[styles.actionButtonText, styles.actionButtonTextDelivery]}>
                Me livrer
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButtonModern, styles.actionButtonChat]}
            onPress={handleChatPress}
          >
            <SafeIcon name="message-circle" size={16} color={modernColors.primary} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextChat]}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButtonModern, styles.actionButtonView]}
            onPress={handleMainPress}
          >
            <SafeIcon name="eye" size={16} color="#6B7280" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextView]}>Voir</Text>
          </TouchableOpacity>
        </View>

        {/* QuickCartButton */}
        {serviceId && isProduct && (
          <QuickCartButton
            product={product}
            service={service}
          />
        )}
      </>
    );
  }, [
    compactTopStats,
    product,
    service,
    prestataireName,
    prestataire,
    prestataireAvatar,
    chosenLocation,
    locationVector,
    countryFlag,
    formattedDistance,
    hasVariant,
    variants,
    selectedVariantIndex,
    displayPrice,
    devise,
    serviceId,
    isProduct,
    handleChatPress,
    handleMainPress,
    navigation,
    formatPrice,
    formatCompactNumber,
  ]);

  // ✅ PREMIUM: Styles animés
  const animatedCardStyle = useMemo(() => ({
    transform: [
      { scale: Animated.multiply(scaleAnim, pressAnim) },
    ],
    opacity: fadeAnim,
  }), [scaleAnim, pressAnim, fadeAnim]);

  const animatedTrendingBadgeStyle = useMemo(() => ({
    transform: [{ scale: trendingPulseAnim }],
  }), [trendingPulseAnim]);

  const animatedPopularBadgeStyle = useMemo(() => ({
    transform: [{ scale: popularPulseAnim }],
  }), [popularPulseAnim]);

  // ✅ GÉANT-LEVEL: Styles adaptatifs selon device type
  const adaptiveCardStyle = useMemo(() => {
    const baseStyle: any[] = [styles.cardContainer, !hasMedia && styles.cardContainerCompact].filter(Boolean);

    // Optimisation tablette
    if (deviceType.isTablet) {
      if (deviceType.orientation === 'landscape') {
        baseStyle.push(styles.cardContainerTabletLandscape);
      } else {
        baseStyle.push(styles.cardContainerTabletPortrait);
      }
    }

    // Breakpoints adaptatifs
    if (deviceType.isSmall) {
      baseStyle.push(styles.cardContainerSmall);
    } else if (deviceType.isLarge || deviceType.isXLarge) {
      baseStyle.push(styles.cardContainerLarge);
    }

    return baseStyle;
  }, [deviceType, hasMedia]);

  return (
    <>
      <Animated.View style={animatedCardStyle}>
        <LinearGradient
          colors={['rgba(79, 70, 229, 0.15)', 'rgba(14, 165, 233, 0.08)', 'rgba(255, 255, 255, 0.5)']} // ✅ PREMIUM: Gradient plus prononcé
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.cardGradient,
            deviceType.isTablet && deviceType.orientation === 'landscape' && styles.cardGradientLandscape
          ]}
        >
          <GestureDetector gesture={composedGesture}>
            <AnimatedReanimated.View style={swipeAnimatedStyle}>
              <NativeCard
                padding={0}
                style={adaptiveCardStyle}
              >
                <Pressable
                  style={styles.touchableContainer}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  onPress={handleMainPress}
                  onLongPress={() => {
                    triggerHaptic('medium');
                    setShowContextMenu(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir les détails de ${product.nom || 'ce produit'}`}
                  accessibilityHint="Double-tapez pour ouvrir la page de détails, maintenez pour le menu contextuel"
                  // ✅ GÉANT-LEVEL: Accessibilité WCAG améliorée
                  accessibilityState={{ disabled: false }}
                  accessibilityValue={{ text: `${product.nom || 'Produit'}, prix ${displayPrice} ${devise}` }}
                >
                  {/* ✅ GÉANT-LEVEL: Layout adaptatif tablette/paysage (Amazon style) */}
                  {deviceType.isTablet && deviceType.orientation === 'landscape' ? (
                    <View style={styles.tabletLandscapeContainer}>
                      {/* Images à gauche en paysage */}
                      {hasMedia && (
                        <View style={styles.tabletLandscapeImageContainer}>
                          <ProductMediaCarousel
                            images={images}
                            videos={videos}
                            variantImage={variantImage}
                            onImagePress={() => setShowGallery(true)}
                            onMediaChange={(currentIndex, totalMedia) => {
                              console.log('[ProductCard] Média changé:', currentIndex, '/', totalMedia);
                            }}
                            onAllMediaViewed={() => {
                              console.log('[ProductCard] Tous les médias ont été vus');
                              onAllMediaViewed?.();
                            }}
                          />
                          {/* Badges sur images */}
                          {showCountryBadge && (
                            <View style={styles.countryBadge}>
                              <Text style={styles.countryFlag}>{countryFlag}</Text>
                            </View>
                          )}
                          {formattedDistance && (
                            <View style={styles.distanceBadge}>
                              <SafeIcon name="navigation" size={12} color="#FFF" />
                              <Text style={styles.distanceText}>{formattedDistance}</Text>
                            </View>
                          )}
                          {isTrending && (
                            <Animated.View style={[styles.trendingBadge, animatedTrendingBadgeStyle]}>
                              <Text style={styles.trendingEmoji}>🔥🔥</Text>
                              <Text style={styles.trendingText}>Tendance</Text>
                              <Text style={styles.trendingCount}>{usageCount != null ? String(usageCount) : '0'}×</Text>
                            </Animated.View>
                          )}
                          {!isTrending && isPopular && (
                            <Animated.View style={[styles.popularBadge, animatedPopularBadgeStyle]}>
                              <Text style={styles.popularEmoji}>🔥</Text>
                              <Text style={styles.popularText}>Populaire</Text>
                              <Text style={styles.popularCount}>{usageCount != null ? String(usageCount) : '0'}×</Text>
                            </Animated.View>
                          )}
                        </View>
                      )}

                      {/* Contenu à droite en paysage */}
                      <ScrollView
                        style={styles.tabletLandscapeContent}
                        contentContainerStyle={styles.tabletLandscapeContentInner}
                        showsVerticalScrollIndicator={false}
                      >
                        {/* Contenu identique mais optimisé pour layout horizontal */}
                        {renderTabletLandscapeContent()}
                      </ScrollView>
                    </View>
                  ) : (
                    <>
                      {/* Layout portrait standard */}
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
                            onMediaChange={(currentIndex, totalMedia) => {
                              // ✅ NOUVEAU: Callback pour tracker navigation médias (utilisé par MixedContentCarousel)
                              console.log('[ProductCard] Média changé:', currentIndex, '/', totalMedia);
                            }}
                            onAllMediaViewed={() => {
                              // ✅ NOUVEAU: Callback quand tous les médias ont été vus (utilisé par MixedContentCarousel)
                              console.log('[ProductCard] Tous les médias ont été vus');
                              onAllMediaViewed?.();
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

                          {/* ✅ PREMIUM : Badge popularité avec animation pulse */}
                          {isTrending && (
                            <Animated.View style={[styles.trendingBadge, animatedTrendingBadgeStyle]}>
                              <Text style={styles.trendingEmoji}>🔥🔥</Text>
                              <Text style={styles.trendingText}>Tendance</Text>
                              <Text style={styles.trendingCount}>{usageCount != null ? String(usageCount) : '0'}×</Text>
                            </Animated.View>
                          )}
                          {!isTrending && isPopular && (
                            <Animated.View style={[styles.popularBadge, animatedPopularBadgeStyle]}>
                              <Text style={styles.popularEmoji}>🔥</Text>
                              <Text style={styles.popularText}>Populaire</Text>
                              <Text style={styles.popularCount}>{usageCount != null ? String(usageCount) : '0'}×</Text>
                            </Animated.View>
                          )}
                        </View>
                      )}

                      {/* ✅ NOUVEAU: ScrollView vertical quand il y a des médias pour éviter la troncature */}
                      {hasMedia ? (
                        <ScrollView
                          style={styles.contentScrollable}
                          contentContainerStyle={styles.contentScrollableContent}
                          showsVerticalScrollIndicator={false}
                          nestedScrollEnabled={true}
                          bounces={false}
                        >
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

                          {/* ✅ GÉANT-LEVEL: Badges promotionnels (Amazon/Instagram/TikTok style) */}
                          <ProductBadges product={product} service={service} />

                          {/* ✅ CORRIGÉ: Prestataire - Toujours afficher si disponible */}
                          {prestataireName && (
                            <TouchableOpacity
                              style={styles.prestataireRow}
                              onPress={() => {
                                if (prestataire.user_id) {
                                  navigation.navigate('ProfilePrestataire' as any, { userId: prestataire.user_id });
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              {prestataireAvatar ? (
                                <OptimizedImage
                                  uri={prestataireAvatar}
                                  style={styles.avatar}
                                  priority="normal"
                                  cachePolicy="memory-disk"
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

                          {/* ✅ AMÉLIORÉ 2025-11-29: Localisation hiérarchique détaillée - Toujours afficher si disponible */}
                          {/* ✅ CORRIGÉ 2025-12-11: Vérifier que prestataire.adresse est une string, pas un boolean */}
                          {(chosenLocation || locationVector.length > 0 || pays || product.adresse || product.ville || product.region || product.adresse_complete || service?.adresse || service?.adresse_complete || (prestataire?.adresse && typeof prestataire.adresse === 'string' && prestataire.adresse.trim().length > 0)) && (
                            <View style={styles.locationSection}>
                              <View style={styles.locationRow}>
                                <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                                <Text style={styles.locationTextPrimary} numberOfLines={2}>
                                  {chosenLocation ||
                                    locationVector[0] ||
                                    product.adresse_complete ||
                                    product.adresse ||
                                    product.ville ||
                                    product.region ||
                                    (prestataire?.adresse && typeof prestataire.adresse === 'string' && prestataire.adresse.trim().length > 0 ? prestataire.adresse : null) || // ✅ CORRIGÉ 2025-12-11: Vérifier que prestataire.adresse est une string non vide
                                    service?.adresse_complete ||
                                    service?.adresse ||
                                    'Localisation disponible'}
                                </Text>
                                {/* ✅ AMÉLIORÉ : Afficher le drapeau si disponible, même si générique */}
                                {countryFlag && countryFlag !== '🌍' && (
                                  <Text style={styles.locationFlag} numberOfLines={1}>
                                    {countryFlag}
                                  </Text>
                                )}
                              </View>
                              {/* Hiérarchie complète (quartier > ville > région > pays) - Progressive disclosure */}
                              {locationVector.length > 1 && isExpanded && (
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
                              {/* ✅ CORRIGÉ: Afficher la distance même si pas dans locationSection */}
                              {!formattedDistance && hasDistance && distanceKm !== undefined && (
                                <View style={styles.locationDistanceChip}>
                                  <SafeIcon name="navigation" size={12} color={modernColors.primary} />
                                  <Text style={styles.locationDistanceText}>
                                    {distanceKm < 1
                                      ? `${Math.round(distanceKm * 1000)}m`
                                      : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)}km`}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                          {/* ✅ CORRIGÉ: Afficher la section localisation même si minimal, pour montrer distance/drapeau */}
                          {!chosenLocation && locationVector.length === 0 && !product.adresse && !product.ville && !product.region && !product.adresse_complete && !service?.adresse && !service?.adresse_complete && (formattedDistance || hasDistance || countryFlag) && (
                            <View style={styles.locationSection}>
                              {formattedDistance && (
                                <View style={styles.locationDistanceChip}>
                                  <SafeIcon name="navigation" size={12} color={modernColors.primary} />
                                  <Text style={styles.locationDistanceText}>{formattedDistance}</Text>
                                </View>
                              )}
                              {countryFlag && countryFlag !== '🌍' && (
                                <View style={styles.locationRow}>
                                  <Text style={styles.locationFlag} numberOfLines={1}>
                                    {countryFlag}
                                  </Text>
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
                                    <Text style={styles.googleMetaText}>
                                      {googleRating != null && Number.isFinite(googleRating) ? googleRating.toFixed(1) : '0.0'}
                                    </Text>
                                    {typeof googleRatingCount === 'number' && googleRatingCount > 0 && (
                                      <Text style={styles.googleMetaSubText}>({String(googleRatingCount)})</Text>
                                    )}
                                  </View>
                                )}
                                {/* ✅ CRITIQUE 2025-12-11: Vérifier que googleOpenNow est bien un boolean et non null avant d'afficher */}
                                {googleOpenNow !== null && typeof googleOpenNow === 'boolean' && (
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
                                    <Text style={styles.compactStatValue}>{totalReactions != null ? String(totalReactions) : '0'}</Text>
                                    <Text style={styles.compactStatLabel}>réactions</Text>
                                  </View>
                                )}

                                {usageCount > 0 && (
                                  <View style={styles.compactStatPillMuted}>
                                    <Text style={styles.compactStatEmoji}>🔥</Text>
                                    <Text style={styles.compactStatValue}>{usageCount != null ? String(usageCount) : '0'}</Text>
                                    <Text style={styles.compactStatLabel}>recherches</Text>
                                  </View>
                                )}
                              </View>
                            </LinearGradient>
                          )}

                          {/* Caractéristiques (vecteur produit) en chips - Progressive disclosure */}
                          {productVector.length > 0 && (isExpanded || productVector.length <= maxDisplayedCaracs) && (
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
                                {(isExpanded ? productVector : limitedProductVector).map((carac: string, i: number) => (
                                  <View key={i} style={styles.chip}>
                                    <Text style={styles.chipText}>{carac}</Text>
                                  </View>
                                ))}
                                {!isExpanded && hasMoreCaracs && (
                                  <View style={styles.chipMore}>
                                    <Text style={styles.chipMoreText}>
                                      +{productVector.length != null && maxDisplayedCaracs != null ? String(productVector.length - maxDisplayedCaracs) : '0'}
                                    </Text>
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
                                      triggerHaptic('selection');
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      selected: selectedVariantIndex === i,
                                      disabled: false
                                    }}
                                    accessibilityLabel={`Variante ${variant.value || variant.valeur}, prix ${formatPrice(variant.prix)} ${variant.devise || devise}`}
                                  >
                                    <View style={styles.cellVariant}>
                                      {/* Image de la variation si existe */}
                                      {variant.image && (
                                        <OptimizedImage
                                          uri={variant.image.startsWith('data:') ? variant.image : `data:image/jpeg;base64,${variant.image}`}
                                          style={styles.variantImageThumb}
                                          priority="low"
                                          cachePolicy="memory-disk"
                                        />
                                      )}
                                      <Text style={styles.variantValue}>{variant.value || variant.valeur}</Text>
                                    </View>
                                    <View style={styles.cellPrice}>
                                      <Text style={styles.variantPrice}>
                                        {formatPrice(variant.prix)}
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
                                    +{String(variants.length - 5)} autres variantes
                                  </Text>
                                )}
                              </View>

                              <View style={styles.priceFromContainer}>
                                <Text style={styles.priceFromLabel}>À partir de</Text>
                                <Text style={styles.priceFromValue}>
                                  {formatPrice(displayPrice)} {devise}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <View style={styles.priceUniqueContainer}>
                              <Text style={styles.priceLabel}>Prix</Text>
                              <View style={styles.priceRow}>
                                <Text style={styles.price}>
                                  {formatPrice(displayPrice)}
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
                                onPress={() => {
                                  triggerHaptic('medium');
                                  setShowOrderModal(true);
                                }}
                                accessibilityRole="button"
                                accessibilityState={{ disabled: false }}
                                accessibilityLabel="Commander la livraison"
                                accessibilityHint="Ouvre le formulaire de commande de livraison"
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
                              accessibilityRole="button"
                              accessibilityState={{ disabled: loadingReactions }}
                              accessibilityLabel="Ouvrir le chat"
                              accessibilityHint="Ouvre une conversation avec le prestataire"
                            >
                              <SafeIcon name="message-circle" size={16} color={modernColors.primary} />
                              <Text style={[styles.actionButtonText, styles.actionButtonTextChat]} numberOfLines={1}>
                                Chat
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionButtonModern, styles.actionButtonView]}
                              onPress={onPress || (() => {
                                // ✅ CORRIGÉ: Vérifier et convertir serviceId en string avant navigation
                                const targetServiceId = serviceId ||
                                  product.service_id ||
                                  product.serviceId ||
                                  service?.id ||
                                  service?.service_id ||
                                  (typeof product.service === 'object' && product.service?.id);
                                if (!targetServiceId) {
                                  console.error('[ProductCard] ❌ ServiceId manquant pour navigation:', {
                                    product: {
                                      service_id: product.service_id,
                                      serviceId: product.serviceId,
                                      service: product.service
                                    },
                                    service: {
                                      id: service?.id,
                                      service_id: service?.service_id
                                    }
                                  });
                                  toaster.error('Service introuvable : ID manquant');
                                  return;
                                }
                                console.log('[ProductCard] ✅ Navigation vers ServiceDetail avec serviceId:', targetServiceId);
                                navigation.navigate('ServiceDetail' as any, { serviceId: String(targetServiceId) });
                              })}
                              accessibilityRole="button"
                              accessibilityState={{ disabled: false }}
                              accessibilityLabel="Voir les détails"
                              accessibilityHint="Ouvre la page de détails du produit"
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

                          {/* ✅ GÉANT-LEVEL: QuickCartButton (Amazon one-click style) */}
                          {serviceId && isProduct && (
                            <QuickCartButton
                              product={product}
                              service={service}
                            />
                          )}

                          {/* ✅ AMÉLIORÉ: Section commentaires ultra-compacte avec état de chargement visible */}
                          {/* ✅ CORRIGÉ: Afficher la section même si commentStats est null (pour permettre le chargement) */}
                          {Number.isFinite(commentServiceId) && commentServiceId > 0 && (
                            <View style={styles.commentsCompactSection}>
                              <View style={styles.commentsCompactRow}>
                                <View style={styles.commentsCompactStats}>
                                  <SafeIcon
                                    name="message-circle"
                                    size={14}
                                    color={loadingComments ? "#9CA3AF" : "#6B7280"}
                                  />
                                  {loadingComments ? (
                                    <View style={styles.loadingIndicator}>
                                      <Animated.View
                                        style={[
                                          styles.loadingDot,
                                          {
                                            opacity: fadeAnim.interpolate({
                                              inputRange: [0, 1],
                                              outputRange: [0.3, 1],
                                            }),
                                          },
                                        ]}
                                      />
                                    </View>
                                  ) : (
                                    <Text style={styles.commentsCompactText}>
                                      {commentStats ? `${commentStats.rating_count} avis` : '0 avis'}
                                    </Text>
                                  )}
                                  {!loadingComments && commentStats && commentStats.average_rating > 0 && (
                                    <>
                                      <Text style={styles.commentsCompactSeparator}>•</Text>
                                      <Text style={styles.commentsCompactRating}>
                                        {commentStats.average_rating.toFixed(1)}/5
                                      </Text>
                                    </>
                                  )}
                                </View>
                                <TouchableOpacity
                                  style={[
                                    styles.commentsCompactButton,
                                    loadingComments && styles.commentsCompactButtonDisabled
                                  ]}
                                  onPress={() => {
                                    if (commentServiceId > 0) {
                                      setShowCommentsModal(true);
                                    }
                                  }}
                                  disabled={loadingComments || commentServiceId <= 0}
                                  accessibilityState={{ disabled: loadingComments || commentServiceId <= 0 }}
                                  accessibilityLabel="Ouvrir les commentaires"
                                >
                                  <SafeIcon name="corner-up-right" size={14} color={modernColors.primary} />
                                  <Text style={styles.commentsCompactButtonText}>Ouvrir le fil</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}

                          {/* ✅ NOUVEAU: Section "Autres clients ont aussi acheté" (Amazon style) */}
                          <RelatedProductsSection product={product} service={service} navigation={navigation} />

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
                        </ScrollView>
                      ) : (
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

                          {/* Nom produit avec toggle expand/collapse */}
                          <View style={styles.productNameRow}>
                            <Text style={styles.productName} numberOfLines={isExpanded ? undefined : 2}>
                              {product.nom || service?.data?.nom_produit?.valeur || service?.data?.titre_service?.valeur || 'Produit'}
                            </Text>
                            {(product.description || productVector.length > maxDisplayedCaracs || locationVector.length > 1) && (
                              <TouchableOpacity
                                style={styles.expandButton}
                                onPress={() => {
                                  setIsExpanded(!isExpanded);
                                  triggerHaptic('light');
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={isExpanded ? "Réduire les détails" : "Voir plus de détails"}
                              >
                                <SafeIcon
                                  name={isExpanded ? "chevron-up" : "chevron-down"}
                                  size={16}
                                  color={modernColors.primary}
                                />
                                <Text style={styles.expandButtonText}>
                                  {isExpanded ? "Moins" : "Plus"}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {/* ✅ CORRIGÉ: Prestataire - Toujours afficher si disponible */}
                          {prestataireName && (
                            <TouchableOpacity
                              style={styles.prestataireRow}
                              onPress={() => {
                                if (prestataire.user_id) {
                                  navigation.navigate('ProfilePrestataire' as any, { userId: prestataire.user_id });
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              {prestataireAvatar ? (
                                <OptimizedImage
                                  uri={prestataireAvatar}
                                  style={styles.avatar}
                                  priority="normal"
                                  cachePolicy="memory-disk"
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

                          {/* ✅ AMÉLIORÉ 2025-11-29: Localisation hiérarchique détaillée - Toujours afficher si disponible */}
                          {(chosenLocation || locationVector.length > 0 || pays || product.adresse || product.ville || product.region || product.adresse_complete || service?.adresse || service?.adresse_complete || (prestataire?.adresse && typeof prestataire.adresse === 'string' && prestataire.adresse.trim().length > 0)) && (
                            <View style={styles.locationSection}>
                              <View style={styles.locationRow}>
                                <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                                <Text style={styles.locationTextPrimary} numberOfLines={2}>
                                  {chosenLocation ||
                                    locationVector[0] ||
                                    product.adresse_complete ||
                                    product.adresse ||
                                    product.ville ||
                                    product.region ||
                                    (prestataire?.adresse && typeof prestataire.adresse === 'string' && prestataire.adresse.trim().length > 0 ? prestataire.adresse : null) || // ✅ CORRIGÉ 2025-12-11: Vérifier que prestataire.adresse est une string non vide
                                    service?.adresse_complete ||
                                    service?.adresse ||
                                    'Localisation disponible'}
                                </Text>
                                {countryFlag && countryFlag !== '🌍' && (
                                  <Text style={styles.locationFlag} numberOfLines={1}>
                                    {countryFlag}
                                  </Text>
                                )}
                              </View>
                              {locationVector.length > 1 && isExpanded && (
                                <View style={styles.locationHierarchy}>
                                  <SafeIcon name="corner-down-right" size={12} color="#9CA3AF" />
                                  <Text style={styles.locationTextSecondary} numberOfLines={2}>
                                    {locationVector.slice(1).join(' › ')}
                                  </Text>
                                </View>
                              )}
                              {formattedDistance && (
                                <View style={styles.locationDistanceChip}>
                                  <SafeIcon name="navigation" size={12} color={modernColors.primary} />
                                  <Text style={styles.locationDistanceText}>{formattedDistance}</Text>
                                </View>
                              )}
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
                                {variants.slice(0, 3).map((variant: any, i: number) => (
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
                                      <Text style={styles.variantValue}>{variant.value || variant.valeur}</Text>
                                    </View>
                                    <View style={styles.cellPrice}>
                                      <Text style={styles.variantPrice}>
                                        {formatPrice(variant.prix)}
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
                                {variants.length > 3 && (
                                  <Text style={styles.moreVariantsText}>
                                    +{String(variants.length - 3)} autres variantes
                                  </Text>
                                )}
                              </View>
                              <View style={styles.priceFromContainer}>
                                <Text style={styles.priceFromLabel}>À partir de</Text>
                                <Text style={styles.priceFromValue}>
                                  {formatPrice(displayPrice)} {devise}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <View style={styles.priceUniqueContainer}>
                              <Text style={styles.priceLabel}>Prix</Text>
                              <View style={styles.priceRow}>
                                <Text style={styles.price}>
                                  {formatPrice(displayPrice)}
                                </Text>
                                <Text style={styles.priceDevise}>{devise}</Text>
                              </View>
                            </View>
                          )}

                          {/* Actions - Design moderne avec animations premium */}
                          <View style={styles.actions}>
                            {serviceId && isProduct && (
                              <EnhancedActionButton
                                style={[styles.actionButtonModern, styles.actionButtonDelivery]}
                                onPress={() => {
                                  triggerHaptic('medium');
                                  setShowOrderModal(true);
                                }}
                                icon="truck"
                                iconColor="#10B981"
                                text="Me livrer"
                                textStyle={[styles.actionButtonText, styles.actionButtonTextDelivery]}
                                accessibilityLabel="Commander la livraison"
                              />
                            )}
                            <EnhancedActionButton
                              style={[styles.actionButtonModern, styles.actionButtonChat]}
                              onPress={handleChatPress}
                              icon="message-circle"
                              iconColor={modernColors.primary}
                              text="Chat"
                              textStyle={[styles.actionButtonText, styles.actionButtonTextChat]}
                              accessibilityLabel="Ouvrir le chat"
                            />
                            <EnhancedActionButton
                              style={[styles.actionButtonModern, styles.actionButtonView]}
                              onPress={handleMainPress}
                              icon="eye"
                              iconColor="#6B7280"
                              text="Voir"
                              textStyle={[styles.actionButtonText, styles.actionButtonTextView]}
                              accessibilityLabel="Voir les détails"
                            />
                          </View>

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
                      )}
                    </>
                  )}
                </Pressable>
                {/* ✅ GÉANT-LEVEL: Animation cœur double-tap (Instagram style) */}
                {showHeartAnimation && (
                  <AnimatedReanimated.View style={[styles.heartOverlay, heartAnimatedStyle]}>
                    <SafeIcon name="heart" size={64} color="#EF4444" />
                  </AnimatedReanimated.View>
                )}
              </NativeCard>
            </AnimatedReanimated.View>
          </GestureDetector>
        </LinearGradient>
      </Animated.View>

      {/* ✅ NOUVEAU: Menu contextuel (long-press) */}
      <ContextMenu
        visible={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        actions={[
          {
            label: 'Partager',
            icon: 'share',
            onPress: handleShare,
          },
          {
            label: 'Ouvrir la galerie',
            icon: 'image',
            onPress: () => {
              if (hasMedia) {
                setShowGallery(true);
              } else {
                toaster.info('Aucun média disponible');
              }
            },
          },
          {
            label: 'Voir sur Google Maps',
            icon: 'map',
            onPress: async () => {
              if (googleMapsUri) {
                try {
                  await Linking.openURL(googleMapsUri);
                  toaster.success('Ouverture de Google Maps');
                } catch (error) {
                  toaster.error('Impossible d\'ouvrir Google Maps');
                }
              } else {
                toaster.info('Adresse Google Maps non disponible');
              }
            },
          },
          {
            label: 'Signaler ce produit',
            icon: 'flag',
            onPress: () => {
              toaster.warning('Fonctionnalité de signalement à venir');
            },
            destructive: true,
          },
        ]}
        title={product.nom || 'Options'}
      />

      {/* ✅ CORRIGÉ: Modal Chat - Toujours rendre le composant, contrôler via visible */}
      {/* ✅ CORRIGÉ: Vérifier que serviceId est valide avant de rendre */}
      {showChatModal && (() => {
        // ✅ CORRIGÉ: Calculer serviceId de manière sécurisée
        const resolvedServiceId = 
          service?.id ||
          product?.service_id ||
          product?.serviceId ||
          serviceId ||
          null;

        // ✅ CORRIGÉ: Vérifier que serviceId est valide
        if (!resolvedServiceId || typeof resolvedServiceId !== 'number' || resolvedServiceId <= 0) {
          return null;
        }

        // ✅ CORRIGÉ: Calculer prestataireUserId de manière sécurisée
        const resolvedPrestataireUserId =
          prestataireUserId ||
          prestataire?.user_id ||
          product?.prestataire?.user_id ||
          service?.user_id ||
          service?.data?.user_id ||
          null;

        // ✅ CORRIGÉ: Vérifier que prestataireUserId est valide
        if (!resolvedPrestataireUserId || typeof resolvedPrestataireUserId !== 'number' || resolvedPrestataireUserId <= 0) {
          return null;
        }

        return (
          <ChatModalMobile
            visible={showChatModal}
            onClose={handleCloseChatModal}
            service={service || {
              id: resolvedServiceId,
              data: { titre_service: { valeur: product.nom || service?.data?.titre_service?.valeur || 'Produit' } },
              user_id: resolvedPrestataireUserId,
            }}
            prestataireInfo={activeChatPeer || prestataire || {
              nom: prestataireName || 'Prestataire',
              nom_complet: prestataireName || 'Prestataire',
              user_id: resolvedPrestataireUserId,
              avatar_url: prestataireAvatar,
            }}
            user={null} // L'utilisateur sera récupéré depuis AuthContext dans ChatModalMobile
            conversationId={isPrivateChat ? privateConversationId || undefined : undefined}
            isPrivateConversation={isPrivateChat}
          />
        );
      })()}

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
      {/* ✅ CORRIGÉ: Vérification stricte de serviceId (doit être un nombre valide) */}
      {serviceId && typeof serviceId === 'number' && serviceId > 0 && isProduct && (
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

      {/* ✅ AMÉLIORÉ: Modal commentaires avec swipe-to-dismiss */}
      <ModalSwipeable
        visible={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        swipeDirection="down"
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
      </ModalSwipeable>
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
    overflow: 'hidden', // ✅ AJOUTÉ: Empêcher le débordement du contenu
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // ✅ AMÉLIORÉ: Plus opaque pour meilleur contraste
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)', // ✅ AMÉLIORÉ: Bordure légèrement plus visible
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, // ✅ AMÉLIORÉ: Ombre plus prononcée pour meilleure profondeur
    shadowRadius: 12,
    elevation: 5, // ✅ AMÉLIORÉ: Élévation augmentée
    // ✅ CORRIGÉ 2025-11-29: S'assurer que la carte s'adapte à la largeur du conteneur parent (carousel)
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    height: 260, // ✅ AMÉLIORÉ: 240 → 260 pour plus de confort visuel
    maxHeight: 260, // ✅ AMÉLIORÉ: 240 → 260
  },
  cardContainerCompact: {
    borderRadius: 20,
  },
  touchableContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)', // ✅ AMÉLIORÉ: Plus opaque
    height: '100%', // ✅ AJOUTÉ: Prendre toute la hauteur disponible
    maxHeight: 260, // ✅ AMÉLIORÉ: 240 → 260
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 130, // ✅ AMÉLIORÉ: 120 → 130 pour meilleure visibilité des images
    overflow: 'hidden',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  countryBadge: {
    position: 'absolute',
    top: 10, // ✅ AMÉLIORÉ: Légèrement plus haut pour éviter chevauchement
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // ✅ AMÉLIORÉ: Plus opaque pour meilleur contraste
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000', // ✅ AMÉLIORÉ: Ombre pour meilleure visibilité
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  countryFlag: {
    fontSize: 20,
  },
  distanceBadge: {
    position: 'absolute',
    top: 10, // ✅ AMÉLIORÉ: Légèrement plus haut
    left: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.98)', // ✅ AMÉLIORÉ: Plus opaque
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#6366F1', // ✅ AMÉLIORÉ: Ombre pour meilleure visibilité
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
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
    backgroundColor: 'rgba(239, 68, 68, 0.98)', // ✅ PREMIUM: Plus opaque
    paddingHorizontal: 12, // ✅ PREMIUM: 10 → 12
    paddingVertical: 6, // ✅ PREMIUM: 5 → 6
    borderRadius: 18, // ✅ PREMIUM: 16 → 18
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5, // ✅ PREMIUM: 4 → 5
    shadowColor: '#EF4444', // ✅ PREMIUM: Ombre colorée
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1.5, // ✅ PREMIUM: Bordure pour plus de définition
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    backgroundColor: 'rgba(251, 146, 60, 0.98)', // ✅ PREMIUM: Plus opaque
    paddingHorizontal: 12, // ✅ PREMIUM: 10 → 12
    paddingVertical: 6, // ✅ PREMIUM: 5 → 6
    borderRadius: 18, // ✅ PREMIUM: 16 → 18
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5, // ✅ PREMIUM: 4 → 5
    shadowColor: '#FB923C', // ✅ PREMIUM: Ombre colorée
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1.5, // ✅ PREMIUM: Bordure pour plus de définition
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    paddingHorizontal: 10, // ✅ RÉDUIT: 12 → 10 (encore plus compact)
    paddingVertical: 8, // ✅ RÉDUIT: 10 → 8
    gap: 4, // ✅ RÉDUIT: 6 → 4
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flex: 1, // ✅ AJOUTÉ: Prendre l'espace disponible
    height: 140, // ✅ CORRIGÉ: Hauteur fixe (280px total - 140px image = 140px contenu)
    maxHeight: 140, // ✅ AJOUTÉ: Hauteur maximale stricte
    overflow: 'hidden', // ✅ AJOUTÉ: Empêcher le débordement
    // ✅ NOTE: Le contenu est limité à 140px pour s'adapter à la hauteur fixe de 280px de la carte
    // Si le contenu dépasse, il sera coupé (overflow: hidden) pour maintenir la cohérence visuelle
  },
  contentCompact: {
    paddingTop: 8, // ✅ RÉDUIT: 10 → 8
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: 280, // ✅ AJOUTÉ: Hauteur fixe pour cartes sans médias (prend toute la hauteur disponible)
    maxHeight: 280, // ✅ AJOUTÉ: Hauteur maximale stricte
    overflow: 'hidden', // ✅ AJOUTÉ: Empêcher le débordement
    // ✅ NOTE: Sans médias, le contenu prend toute la hauteur de 280px
  },
  // ✅ NOUVEAU: Styles pour ScrollView vertical quand il y a des médias
  contentScrollable: {
    flex: 1,
    maxHeight: 130, // ✅ AMÉLIORÉ: 100 → 130 (260px carte - 130px média = 130px)
    overflow: 'hidden',
  },
  contentScrollableContent: {
    paddingHorizontal: 12, // ✅ AMÉLIORÉ: 10 → 12 pour meilleur espacement
    paddingVertical: 10, // ✅ AMÉLIORÉ: 8 → 10
    gap: 6, // ✅ AMÉLIORÉ: 4 → 6 pour meilleure respiration
    backgroundColor: 'rgba(255, 255, 255, 0.98)', // ✅ AMÉLIORÉ: Plus opaque
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 12, // ✅ Padding supplémentaire en bas pour le scroll
  },
  topStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4, // ✅ AMÉLIORÉ: 3 → 4 pour meilleure séparation visuelle
    marginBottom: 4, // ✅ AMÉLIORÉ: 2 → 4 pour meilleur espacement
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
    paddingHorizontal: 6, // ✅ AMÉLIORÉ: 4 → 6 pour meilleure lisibilité
    paddingVertical: 3, // ✅ AMÉLIORÉ: 2 → 3
    borderRadius: 10, // ✅ AMÉLIORÉ: 8 → 10
    borderWidth: 1.5, // ✅ AMÉLIORÉ: 1 → 1.5 pour meilleure visibilité
    gap: 3, // ✅ AMÉLIORÉ: 2 → 3
  },
  topStatValue: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  topStatValueCompact: {
    fontSize: 10, // ✅ AMÉLIORÉ: 9 → 10 pour meilleure lisibilité
    fontWeight: '700', // ✅ AMÉLIORÉ: 600 → 700
  },
  topStatLabelCompact: {
    fontSize: 8, // ✅ AMÉLIORÉ: 7 → 8
    fontWeight: '600', // ✅ AMÉLIORÉ: 500 → 600
    opacity: 0.85, // ✅ AMÉLIORÉ: 0.8 → 0.85
    marginLeft: 2, // ✅ AMÉLIORÉ: 1 → 2
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  productName: {
    fontSize: 15, // ✅ AMÉLIORÉ: 14 → 15 pour meilleure visibilité
    fontWeight: '800', // ✅ AMÉLIORÉ: 700 → 800 pour hiérarchie plus forte
    color: '#111827', // ✅ AMÉLIORÉ: #1F2937 → #111827 pour meilleur contraste
    lineHeight: 20, // ✅ AMÉLIORÉ: 18 → 20
    flex: 1,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#CBD5F5',
  },
  expandButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: modernColors.primary,
  },
  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // ✅ AMÉLIORÉ: 4 → 6 pour meilleur espacement
    paddingVertical: 4, // ✅ AMÉLIORÉ: 2 → 4
    paddingHorizontal: 6, // ✅ AMÉLIORÉ: 4 → 6
    backgroundColor: '#F8FAFC',
    borderRadius: 10, // ✅ AMÉLIORÉ: 8 → 10
    borderWidth: 1, // ✅ AMÉLIORÉ: StyleSheet.hairlineWidth → 1 pour meilleure visibilité
    borderColor: '#E5E7EB',
    marginBottom: 4, // ✅ AMÉLIORÉ: 2 → 4
  },
  avatar: {
    width: 22, // ✅ RÉDUIT: 26 → 22 (encore plus compact)
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 22, // ✅ RÉDUIT: 26 → 22
    height: 22,
    borderRadius: 11,
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
    gap: 5, // ✅ RÉDUIT: 6 → 5
    paddingVertical: 3, // ✅ RÉDUIT: 6 → 3
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
    gap: 5, // ✅ RÉDUIT: 8 → 5
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
    gap: 6, // ✅ RÉDUIT: 8 → 6
    backgroundColor: '#F9FAFB',
    padding: 8, // ✅ RÉDUIT: 10 → 8
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
    fontSize: 28, // ✅ GÉANT-LEVEL: 20 → 28 (niveau Amazon/Instagram)
    fontWeight: '900', // ✅ GÉANT-LEVEL: Hiérarchie maximale
    color: modernColors.primary,
    letterSpacing: -0.5, // ✅ GÉANT-LEVEL: Espacement négatif pour compacité
    lineHeight: 32, // ✅ GÉANT-LEVEL: Ajouté pour meilleure lisibilité
  },
  priceDevise: {
    fontSize: 15, // ✅ AMÉLIORÉ: 14 → 15
    fontWeight: '700', // ✅ AMÉLIORÉ: 600 → 700
    color: '#4B5563', // ✅ AMÉLIORÉ: #6B7280 → #4B5563 pour meilleur contraste
  },
  actions: {
    flexDirection: 'row',
    gap: 4, // ✅ RÉDUIT: 6 → 4 (encore plus compact)
    marginTop: 2,
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
    gap: 4, // ✅ GÉANT-LEVEL: 3 → 4 pour meilleur espacement
    paddingVertical: 10, // ✅ GÉANT-LEVEL: 8 → 10 (Apple HIG: 44px minimum)
    paddingHorizontal: 10, // ✅ GÉANT-LEVEL: 8 → 10
    borderRadius: 10, // ✅ GÉANT-LEVEL: 8 → 10
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    minHeight: 44, // ✅ GÉANT-LEVEL: Apple HIG recommandation (40 → 44)
    minWidth: 44, // ✅ GÉANT-LEVEL: Ajouté pour accessibilité complète
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
    fontSize: 13, // ✅ AMÉLIORÉ: 12 → 13 pour meilleure lisibilité
    fontWeight: '700', // ✅ AMÉLIORÉ: 600 → 700 pour meilleur contraste
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
    paddingTop: 6, // ✅ RÉDUIT: 10 → 6
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
    marginTop: 4, // ✅ RÉDUIT: 6 → 4
    borderRadius: 14,
    paddingVertical: 6, // ✅ RÉDUIT: 8 → 6
    paddingHorizontal: 8, // ✅ RÉDUIT: 10 → 8
  },
  compactStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6, // ✅ RÉDUIT: 8 → 6
    marginTop: 6, // ✅ RÉDUIT: 10 → 6
    marginBottom: 6, // ✅ RÉDUIT: 10 → 6
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
    gap: 4, // ✅ AMÉLIORÉ: 2 → 4 pour meilleure respiration
    backgroundColor: '#F8FAFC',
    padding: 6, // ✅ AMÉLIORÉ: 4 → 6
    borderRadius: 10, // ✅ AMÉLIORÉ: 8 → 10
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4, // ✅ AMÉLIORÉ: 2 → 4
  },
  locationTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827', // ✅ AMÉLIORÉ: #1F2937 → #111827 pour meilleur contraste
    flex: 1,
    lineHeight: 18, // ✅ AMÉLIORÉ: Ajout lineHeight pour meilleure lisibilité
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
    gap: 6, // ✅ RÉDUIT: 10 → 6
    marginTop: 2, // ✅ RÉDUIT: 4 → 2
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4, // ✅ RÉDUIT: 6 → 4
    paddingVertical: 6, // ✅ RÉDUIT: 8 → 6
    paddingHorizontal: 8, // ✅ RÉDUIT: 10 → 8
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
    padding: 1.5, // ✅ PREMIUM: 1 → 1.5 pour gradient plus visible
    marginBottom: 8, // ✅ AMÉLIORÉ: 6 → 8 pour meilleur espacement entre cartes
    height: 260, // ✅ AMÉLIORÉ: 280 → 260 (cohérent avec cardContainer)
    maxHeight: 260, // ✅ AMÉLIORÉ: 280 → 260
    overflow: 'hidden', // ✅ AJOUTÉ: Empêcher le débordement
    // ✅ PREMIUM: Ombre portée pour le gradient
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  // ✅ NOUVEAU: Styles section commentaires compacte
  commentsCompactSection: {
    marginTop: 4, // ✅ RÉDUIT: 8 → 4
    paddingTop: 4, // ✅ RÉDUIT: 8 → 4
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  commentsCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6, // ✅ RÉDUIT: 8 → 6
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
  // ✅ NOUVEAU: Styles pour indicateurs de chargement
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B7280',
  },
  commentsCompactButtonDisabled: {
    opacity: 0.5,
  },
  // ✅ GÉANT-LEVEL: Style pour animation cœur double-tap (Instagram style)
  heartOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -32,
    marginLeft: -32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  // ✅ GÉANT-LEVEL: Styles adaptatifs tablette
  cardContainerTabletPortrait: {
    maxWidth: '48%', // 2 colonnes en portrait tablette
    marginHorizontal: '1%',
  },
  cardContainerTabletLandscape: {
    maxWidth: '32%', // 3 colonnes en paysage tablette
    marginHorizontal: '0.66%',
  },
  cardContainerSmall: {
    padding: 10, // Réduire padding sur petits écrans
  },
  cardContainerLarge: {
    padding: 16, // Augmenter padding sur grands écrans
  },
  cardGradientLandscape: {
    height: 'auto', // Hauteur auto en paysage
    minHeight: 200,
  },
  // ✅ GÉANT-LEVEL: Layout tablette paysage (Amazon style)
  tabletLandscapeContainer: {
    flexDirection: 'row',
    height: '100%',
  },
  tabletLandscapeImageContainer: {
    width: '45%', // 45% pour images
    height: '100%',
    position: 'relative',
  },
  tabletLandscapeContent: {
    width: '55%', // 55% pour contenu
    padding: 12,
  },
  tabletLandscapeContentInner: {
    gap: 8,
  },
  tabletLandscapeProductName: {
    fontSize: 20, // Plus grand sur tablette
    fontWeight: '700',
  },
});

// ✅ OPTIMISÉ: Memoization complète pour performance optimale
export default React.memo(ProductCard, (prevProps, nextProps) => {
  // Comparaison complète pour éviter re-renders inutiles
  const prevProductId = prevProps.product?.service_id || prevProps.product?.id || prevProps.product?.product_id;
  const nextProductId = nextProps.product?.service_id || nextProps.product?.id || nextProps.product?.product_id;

  const prevServiceId = prevProps.service?.id || prevProps.service?.service_id;
  const nextServiceId = nextProps.service?.id || nextProps.service?.service_id;

  const prevPrestataireId = prevProps.prestataire?.user_id || prevProps.prestataire?.id;
  const nextPrestataireId = nextProps.prestataire?.user_id || nextProps.prestataire?.id;

  const prevLocation = prevProps.userLocation?.latitude && prevProps.userLocation?.longitude
    ? `${prevProps.userLocation.latitude},${prevProps.userLocation.longitude}`
    : null;
  const nextLocation = nextProps.userLocation?.latitude && nextProps.userLocation?.longitude
    ? `${nextProps.userLocation.latitude},${nextProps.userLocation.longitude}`
    : null;

  return (
    prevProductId === nextProductId &&
    prevProps.product?.nom === nextProps.product?.nom &&
    prevProps.product?.prix === nextProps.product?.prix &&
    prevServiceId === nextServiceId &&
    prevPrestataireId === nextPrestataireId &&
    prevLocation === nextLocation &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onChatPress === nextProps.onChatPress &&
    prevProps.onAllMediaViewed === nextProps.onAllMediaViewed
  );
});
