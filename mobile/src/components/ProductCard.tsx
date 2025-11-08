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
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import ChatModalMobile from './ChatModalMobile';
import { NativeButton, NativeCard } from './NativeDesign';
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

// Mapper codes pays → drapeaux emoji
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
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  // ✅ NOUVEAU : États pour contact privé
  const [privateConversationId, setPrivateConversationId] = useState<string | null>(null);
  // ✅ NOUVEAU : États pour avis/ratings et galerie
  const [showGallery, setShowGallery] = useState(false);
  // ✅ NOUVEAU : États pour réactions
  const [reactions, setReactions] = useState<Record<string, { count: number; hasReacted: boolean }>>({});
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<string | null>(null);

  // Données produit
  const productVector = product.product_vector || product.characteristic_vector || [];
  const locationVector = product.location_vector || [];

  // ✅ AMÉLIORATION: Afficher quartier en priorité, puis ville, puis région
  const chosenLocation = product.chosen_location ||
    locationVector[0] || // Premier élément = lieu exact choisi par prestataire
    '';

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
        'Prestataire',
      user_id: service?.user_id,
      avatar_url: service?.data?.photo_prestataire?.valeur,
    };

  const prestataireName =
    rawPrestataire?.nom ||
    rawPrestataire?.nom_complet ||
    rawPrestataire?.name ||
    rawPrestataire?.username ||
    product.prestataire_nom ||
    product.prestataire?.nom ||
    product.prestataire?.nom_complet ||
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
    product.prestataire_avatar ||
    service?.data?.photo_prestataire?.valeur ||
    service?.data?.photo_profil?.valeur;

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
  const images = product.images || service?.images || [];
  const videos = product.videos || service?.videos || [];

  // Image de la variation sélectionnée (si existe)
  const selectedVariant = selectedVariantIndex !== null && variants[selectedVariantIndex]
    ? variants[selectedVariantIndex]
    : null;
  const variantImage = selectedVariant?.image || selectedVariant?.images?.[0];
  const hasMedia = (images?.length || 0) + (videos?.length || 0) > 0 || !!variantImage;

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

  // Prix
  const displayPrice = hasVariant && variants.length > 0
    ? Math.min(...variants.map((v: any) => v.prix || 0))
    : product.prix || 0;

  const devise = product.devise || variants[0]?.devise || 'XAF';

  // Distance
  const distanceKm = product.distance_km;

  // Pays (pour drapeau)
  const pays = locationVector[locationVector.length - 1] ||
    product.pays ||
    service?.data?.pays?.valeur;

  const countryFlag = getCountryFlag(pays);

  const commentServiceId = Number(product._serviceId || product.service_id || service?.id || 0);
  const serviceTitleForComments =
    product.nom ||
    product.name ||
    product.titre ||
    product.title ||
    service?.data?.titre_service?.valeur ||
    service?.data?.nom ||
    'Produit';

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
    { key: 'views', icon: 'eye', value: viewsCount, tint: '#4f46e5' },
    { key: 'shares', icon: 'share-2', value: sharesCount, tint: '#a855f7' },
    { key: 'reviews', icon: 'message-circle', value: reviewsCount, tint: '#f59e0b' },
    { key: 'favorites', icon: 'heart', value: favoritesCount, tint: '#ef4444' },
  ];

  // ✅ AMÉLIORATION: Utiliser onChatPress si fourni, sinon modal local
  const handleChatPress = () => {
    if (onChatPress) {
      onChatPress(); // Utiliser le handler externe (depuis MixedContentCarousel)
      return;
    }

    if (!prestataire.user_id) {
      Alert.alert(
        'Information manquante',
        'Impossible de contacter ce prestataire pour le moment. Veuillez réessayer plus tard.'
      );
      return;
    }

    setShowChatModal(true); // Sinon, modal local
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
  const handleContactUser = async (userId: number, userName: string) => {
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
          context: 'product_review'
        });

        if (createResponse.success && createResponse.data) {
          const data = createResponse.data as { conversation_id?: string };
          conversationId = data.conversation_id || null;
        }
      }

      if (conversationId) {
        setPrivateConversationId(conversationId);
        setShowChatModal(true);
        Alert.alert(
          'Conversation privée',
          `Vous pouvez maintenant discuter en privé avec ${userName}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Erreur', 'Impossible de créer la conversation privée');
      }
    } catch (error) {
      console.error('[ProductCard] Erreur création conversation privée:', error);
      Alert.alert('Erreur', 'Impossible de contacter cet utilisateur');
    }
  };

  const totalReactions = Object.values(reactions).reduce((sum, reaction) => {
    return sum + (reaction?.count || 0);
  }, 0);

  return (
    <>
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
              {countryFlag && (
                <View style={styles.countryBadge}>
                  <Text style={styles.countryFlag}>{countryFlag}</Text>
                </View>
              )}

              {/* Badge distance (coin supérieur gauche) */}
              {distanceKm !== undefined && distanceKm !== null && (
                <View style={styles.distanceBadge}>
                  <SafeIcon name="navigation" size={12} color="#FFF" />
                  <Text style={styles.distanceText}>
                    {distanceKm < 1
                      ? `${Math.round(distanceKm * 1000)}m`
                      : `${distanceKm.toFixed(1)}km`}
                  </Text>
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

            {/* Nom produit */}
            <Text style={styles.productName} numberOfLines={2}>
              {product.nom || service?.data?.nom_produit?.valeur || service?.data?.titre_service?.valeur || 'Produit'}
            </Text>

            {/* Prestataire cliquable */}
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
                  {prestataire.nom}
                </Text>
                <SafeIcon name="chevron-right" size={14} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {/* ✅ AMÉLIORATION: Localisation hiérarchique détaillée */}
            {chosenLocation && (
              <View style={styles.locationSection}>
                <View style={styles.locationRow}>
                  <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                  <Text style={styles.locationTextPrimary} numberOfLines={1}>
                    {chosenLocation}
                  </Text>
                  {countryFlag && (
                    <Text style={styles.locationFlag}>{countryFlag}</Text>
                  )}
                </View>
                {/* Hiérarchie complète (ville > région > pays) */}
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
                  {productVector.map((carac: string, i: number) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{carac}</Text>
                    </View>
                  ))}
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

            {/* Actions */}
            <View style={styles.actions}>
              <NativeButton
                title="💬 Chat"
                variant="primary"
                onPress={handleChatPress}
                style={styles.actionButton}
              />
              <NativeButton
                title="👁️ Voir"
                variant="secondary"
                onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id || service?.id }))}
                style={styles.actionButton}
              />
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

            {/* Footer info */}
            <View style={styles.footer}>
              {distanceKm !== undefined && distanceKm !== null && (
                <View style={styles.footerItem}>
                  <SafeIcon name="map-pin" size={12} color="#9CA3AF" />
                  <Text style={styles.footerText}>
                    {distanceKm < 1 ? 'Très proche' : distanceKm < 5 ? 'À proximité' : `${distanceKm.toFixed(0)}km`}
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

      {/* ✅ CORRIGÉ: Modal Chat avec props correctes */}
      {showChatModal && !onChatPress && prestataire.user_id && (
        <ChatModalMobile
          visible={showChatModal}
          onClose={() => setShowChatModal(false)}
          service={service || {
            id: product.service_id,
            data: { titre_service: { valeur: product.nom } }
          }}
          prestataireInfo={prestataire}
          user={null} // L'utilisateur sera récupéré depuis AuthContext dans ChatModalMobile
        />
      )}

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
  },
  cardContainerCompact: {
    borderRadius: 20,
  },
  touchableContainer: {
    flex: 1,
    overflow: 'hidden',
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
    padding: 16,
    gap: 14,
  },
  contentCompact: {
    paddingTop: 20,
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
  },
  actionButton: {
    flex: 1,
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
  // ✅ NOUVEAU : Styles pour avis/ratings et actions secondaires
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
});

export default ProductCard;
