/**
 * ProductCard v3.0 - Version optimale moderne (2025-11-02)
 * Toutes fonctionnalit├®s : vecteurs, variations, chat, distance, drapeau pays
 * Sauvegarde : ProductCard.backup.tsx
 */

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
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
import { API_BASE_URL } from '../config/api';
import { modernColors } from '../theme/modernTheme';
import ChatModalMobile from './ChatModalMobile';
import { NativeButton, NativeCard } from './NativeDesign';
import ProductMediaCarousel from './ProductMediaCarousel';
import SafeIcon from './SafeIcon';
import ServiceGalleryModal from './ServiceGalleryModal';
import { ServiceRating } from './ServiceRating';

const { width } = Dimensions.get('window');

interface ProductCardProps {
  product: any;
  service: any;
  prestataire?: any; // Ô£à NOUVEAU: Prestataire d├®j├á fourni depuis MixedContentCarousel
  userLocation?: { latitude: number; longitude: number } | null;
  onPress?: () => void;
  onChatPress?: () => void; // Ô£à NOUVEAU: Handler chat personnalis├®
}

// Ô£à NOUVEAU : Constantes pour r├®actions
const REACTIONS = [
  { type: 'love', emoji: 'ÔØñ´©Å', label: 'J\'adore' },
  { type: 'like', emoji: '­ƒæì', label: 'J\'aime' },
  { type: 'wow', emoji: '­ƒÿ«', label: 'Impressionnant' },
  { type: 'interested', emoji: '­ƒÄ»', label: 'Int├®ressant' },
  { type: 'thinking', emoji: '­ƒñö', label: '├Ç r├®fl├®chir' },
  { type: 'disappointed', emoji: '­ƒÿò', label: 'D├®├ºu' },
];

// Mapper codes pays ÔåÆ drapeaux emoji
const getCountryFlag = (country?: string): string => {
  const countryMap: Record<string, string> = {
    'Cameroun': '­ƒç¿­ƒç▓',
    'Cameroon': '­ƒç¿­ƒç▓',
    'Gabon': '­ƒç¼­ƒçª',
    'Congo': '­ƒç¿­ƒç¼',
    'RDC': '­ƒç¿­ƒç®',
    'S├®n├®gal': '­ƒç©­ƒç│',
    'Senegal': '­ƒç©­ƒç│',
    'C├┤te d\'Ivoire': '­ƒç¿­ƒç«',
    'Mali': '­ƒç▓­ƒç▒',
    'Burkina': '­ƒçº­ƒç½',
    'Niger': '­ƒç│­ƒç¬',
    'Tchad': '­ƒç╣­ƒç®',
    'Togo': '­ƒç╣­ƒç¼',
    'B├®nin': '­ƒçº­ƒç»',
    'Guin├®e': '­ƒç¼­ƒç│',
    'Madagascar': '­ƒç▓­ƒç¼',
    'France': '­ƒç½­ƒçÀ',
    'USA': '­ƒç║­ƒç©',
  };

  if (!country) return '­ƒîì';

  for (const [key, flag] of Object.entries(countryMap)) {
    if (country.toLowerCase().includes(key.toLowerCase())) {
      return flag;
    }
  }

  return '­ƒîì';
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
  // Ô£à NOUVEAU : ├ëtats pour contact priv├®
  const [privateConversationId, setPrivateConversationId] = useState<string | null>(null);
  // Ô£à NOUVEAU : ├ëtats pour avis/ratings et galerie
  const [showGallery, setShowGallery] = useState(false);
  const [serviceReviews, setServiceReviews] = useState<any[]>([]);
  const [serviceRating, setServiceRating] = useState<{ avg: number; count: number } | null>(null);
  // Ô£à NOUVEAU : ├ëtats pour r├®actions
  const [reactions, setReactions] = useState<Record<string, { count: number; hasReacted: boolean }>>({});

  // Donn├®es produit
  const productVector = product.product_vector || product.characteristic_vector || [];
  const locationVector = product.location_vector || [];

  // Ô£à AM├ëLIORATION: Afficher quartier en priorit├®, puis ville, puis r├®gion
  const chosenLocation = product.chosen_location ||
    locationVector[0] || // Premier ├®l├®ment = lieu exact choisi par prestataire
    '';

  const hasVariant = product.has_variant || false;
  const variants = product.variants || [];
  const prestataire = prestataireFromProps || product.prestataire || service?.prestataire || {
    nom: service?.data?.nom_prestataire || 'Prestataire',
    user_id: service?.user_id,
  };

  // Ô£à NOUVEAU : Popularit├® (usage_count de autocomplete_characteristics)
  const usageCount = product.usage_count || 0;
  const isPopular = usageCount >= 5;  // Populaire si recherch├® 5+ fois
  const isTrending = usageCount >= 10; // Tendance si recherch├® 10+ fois

  // Images et vid├®os
  const images = product.images || service?.images || [];
  const videos = product.videos || service?.videos || [];

  // Image de la variation s├®lectionn├®e (si existe)
  const selectedVariant = selectedVariantIndex !== null && variants[selectedVariantIndex]
    ? variants[selectedVariantIndex]
    : null;
  const variantImage = selectedVariant?.image || selectedVariant?.images?.[0];

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

  // Ô£à AM├ëLIORATION: Utiliser onChatPress si fourni, sinon modal local
  const handleChatPress = () => {
    if (onChatPress) {
      onChatPress(); // Utiliser le handler externe (depuis MixedContentCarousel)
    } else {
      setShowChatModal(true); // Sinon, modal local
    }
  };

  // Ô£à NOUVEAU : Handler partage produit
  const handleShare = async () => {
    try {
      const productName = product.nom || service?.data?.nom_produit?.valeur || service?.data?.titre_service?.valeur || 'Produit';
      const productDesc = product.description || service?.data?.description_produit?.valeur || service?.data?.description?.valeur || '';
      const price = displayPrice > 0 ? `${displayPrice.toLocaleString()} ${devise}` : '';
      const location = chosenLocation || '';

      const shareUrl = process.env.EXPO_PUBLIC_SHARE_URL
        ? `${process.env.EXPO_PUBLIC_SHARE_URL}/service/${product.service_id || service?.id}`
        : `https://yukpomnang.com/service/${product.service_id || service?.id}`;

      const shareMessage = `­ƒøì´©Å ${productName}\n\n${productDesc ? `${productDesc}\n\n` : ''}${price ? `­ƒÆ░ Prix: ${price}\n` : ''}${location ? `­ƒôì ${location}\n\n` : '\n'}­ƒöù Voir ce produit:\n${shareUrl}`;

      const result = await Share.share({
        message: shareMessage,
        title: productName,
      });

      if (result.action === Share.sharedAction) {
        console.log('[ProductCard] Produit partag├® avec succ├¿s');
      }
    } catch (error) {
      console.error('[ProductCard] Erreur partage:', error);
      Alert.alert('Erreur', 'Impossible de partager le produit');
    }
  };

  // Ô£à NOUVEAU : Charger avis/ratings du service
  useEffect(() => {
    const loadReviews = async () => {
      const serviceId = product.service_id || service?.id;
      if (!serviceId) return;

      try {
        const response = await apiGet(`/api/services/${serviceId}/reviews`);
        if (response.success && response.data) {
          const data = response.data as any;
          setServiceReviews(data.reviews || []);
          setServiceRating({
            avg: data.average_rating || 0,
            count: data.total_reviews || 0,
          });
        }
      } catch (error) {
        console.error('[ProductCard] Erreur chargement avis:', error);
      }
    };

    loadReviews();
  }, [product.service_id, service?.id]);

  // Ô£à NOUVEAU : Charger r├®actions du produit
  useEffect(() => {
    const loadReactions = async () => {
      const serviceId = product.service_id || service?.id;
      if (!serviceId) return;

      const productId = `${serviceId}_${product.product_index || 0}`;

      try {
        const response = await apiGet(`/api/products/${serviceId}/${productId}/reactions`);
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
        console.error('[ProductCard] Erreur chargement r├®actions:', error);
      }
    };

    loadReactions();
  }, [product.service_id, product.product_index, service?.id]);

  // Ô£à NOUVEAU : Handler pour r├®agir
  const handleReaction = async (reactionType: string) => {
    const serviceId = product.service_id || service?.id;
    if (!serviceId) return;

    const productId = `${serviceId}_${product.product_index || 0}`;

    try {
      const response = await apiPost(`/api/products/${serviceId}/${productId}/react`, {
        reaction_type: reactionType
      });

      if (response.success) {
        setReactions(prev => {
          const current = prev[reactionType] || { count: 0, hasReacted: false };
          const data = response.data as { action: string };
          const action = data.action;

          return {
            ...prev,
            [reactionType]: {
              count: action === 'added' ? current.count + 1 : Math.max(0, current.count - 1),
              hasReacted: action === 'added'
            }
          };
        });
      }
    } catch (error) {
      console.error('[ProductCard] Erreur r├®action:', error);
    }
  };

  // Ô£à NOUVEAU : Handler pour contacter un utilisateur en priv├®
  const handleContactUser = async (userId: number, userName: string) => {
    try {
      // V├®rifier si une conversation existe d├®j├á
      const checkResponse = await apiGet(`/api/conversations/private/${userId}`);

      let conversationId: string | null = null;

      if (checkResponse.success && checkResponse.data) {
        const data = checkResponse.data as { conversation_id?: string };
        conversationId = data.conversation_id || null;
      }

      if (!conversationId) {
        // Cr├®er une nouvelle conversation priv├®e
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
          'Conversation priv├®e',
          `Vous pouvez maintenant discuter en priv├® avec ${userName}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Erreur', 'Impossible de cr├®er la conversation priv├®e');
      }
    } catch (error) {
      console.error('[ProductCard] Erreur cr├®ation conversation priv├®e:', error);
      Alert.alert('Erreur', 'Impossible de contacter cet utilisateur');
    }
  };

  return (
    <>
      <NativeCard>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id || service?.id }))}
        >
          {/* Carousel d'images/vid├®os avec support variation */}
          <View style={styles.imageContainer}>
            <ProductMediaCarousel
              images={images}
              videos={videos}
              variantImage={variantImage}
              onImagePress={(index) => {
                // Ô£à NOUVEAU : Ouvrir galerie compl├¿te du prestataire
                setShowGallery(true);
              }}
            />

            {/* Badge pays (coin sup├®rieur droit) */}
            {countryFlag && (
              <View style={styles.countryBadge}>
                <Text style={styles.countryFlag}>{countryFlag}</Text>
              </View>
            )}

            {/* Badge distance (coin sup├®rieur gauche) */}
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

            {/* Ô£à NOUVEAU : Badge popularit├® (coin inf├®rieur gauche) */}
            {isTrending && (
              <View style={styles.trendingBadge}>
                <Text style={styles.trendingEmoji}>­ƒöÑ­ƒöÑ</Text>
                <Text style={styles.trendingText}>Tendance</Text>
                <Text style={styles.trendingCount}>{usageCount}├ù</Text>
              </View>
            )}
            {!isTrending && isPopular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularEmoji}>­ƒöÑ</Text>
                <Text style={styles.popularText}>Populaire</Text>
                <Text style={styles.popularCount}>{usageCount}├ù</Text>
              </View>
            )}
          </View>

          <View style={styles.content}>
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

            {/* Ô£à AM├ëLIORATION: Localisation hi├®rarchique d├®taill├®e */}
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
                {/* Hi├®rarchie compl├¿te (ville > r├®gion > pays) */}
                {locationVector.length > 1 && (
                  <View style={styles.locationHierarchy}>
                    <SafeIcon name="corner-down-right" size={12} color="#9CA3AF" />
                    <Text style={styles.locationTextSecondary} numberOfLines={1}>
                      {locationVector.slice(1).join(' ÔÇ║ ')}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Ô£à NOUVEAU : Notation moyenne du produit (visible pour tous) */}
            {serviceRating && serviceRating.count > 0 && (
              <View style={styles.productRatingBadge}>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <SafeIcon
                      key={star}
                      name={star <= Math.round(serviceRating.avg) ? 'star' : 'star-outline'}
                      size={16}
                      color="#FFD700"
                    />
                  ))}
                </View>
                <Text style={styles.ratingValue}>
                  {serviceRating.avg.toFixed(1)} ({serviceRating.count} avis)
                </Text>
              </View>
            )}

            {/* Ô£à NOUVEAU : Section avis/ratings/commentaires (TOUS les utilisateurs) */}
            <View style={styles.ratingSection}>
              <View style={styles.ratingHeader}>
                <SafeIcon name="message-circle" size={18} color={modernColors.primary} />
                <Text style={styles.ratingSectionTitle}>
                  Avis et Commentaires
                </Text>
                {serviceRating && serviceRating.count > 0 && (
                  <Text style={styles.ratingCount}>
                    {serviceRating.count}
                  </Text>
                )}
              </View>

              <ServiceRating
                service={{
                  id: String(product.service_id || service?.id),
                  data: service?.data || {},
                  reviews: serviceReviews,
                  user_rating: serviceRating?.avg || 0,
                }}
                onContactUser={handleContactUser}  // Ô£à NOUVEAU : Contact priv├®
                onRatingSubmit={async (rating, comment) => {
                  try {
                    const response = await fetch(`${API_BASE_URL}/api/services/${product.service_id || service?.id}/reviews`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ rating, comment }),
                    });
                    if (response.ok) {
                      Alert.alert('Succ├¿s', 'Votre avis a ├®t├® publi├® avec succ├¿s !');
                      // Recharger les avis
                      const reviewsResp = await apiGet(`/api/services/${product.service_id || service?.id}/reviews`);
                      if (reviewsResp.success && reviewsResp.data) {
                        const data = reviewsResp.data as any;
                        setServiceReviews(data.reviews || []);
                        setServiceRating({
                          avg: data.average_rating || 0,
                          count: data.total_reviews || 0,
                        });
                      }
                    } else {
                      Alert.alert('Erreur', 'Impossible de publier votre avis');
                    }
                  } catch (error) {
                    console.error('[ProductCard] Erreur envoi avis:', error);
                    Alert.alert('Erreur', 'Une erreur est survenue lors de la publication');
                  }
                }}
                onReviewHelpful={async (reviewId) => {
                  try {
                    await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/helpful`, {
                      method: 'POST',
                    });
                  } catch (error) {
                    console.error('[ProductCard] Erreur marquer utile:', error);
                  }
                }}
                showReviewForm={true}
              />

              {/* Ô£à NOUVEAU : Section R├®actions rapides */}
              <View style={styles.reactionsSubsection}>
                <View style={styles.reactionsSectionHeader}>
                  <Text style={styles.reactionsSectionTitle}>­ƒÄ¡ R├®actions</Text>
                </View>

                <View style={styles.reactionsBar}>
                  {REACTIONS.map((reaction) => {
                    const count = reactions[reaction.type]?.count || 0;
                    const hasReacted = reactions[reaction.type]?.hasReacted || false;

                    return (
                      <TouchableOpacity
                        key={reaction.type}
                        style={[
                          styles.reactionButton,
                          hasReacted && styles.reactionButtonActive
                        ]}
                        onPress={() => handleReaction(reaction.type)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                        {count > 0 && (
                          <Text style={[
                            styles.reactionCount,
                            hasReacted && styles.reactionCountActive
                          ]}>
                            {count}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Caract├®ristiques (vecteur produit) en chips */}
            {productVector.length > 0 && (
              <View style={styles.characteristicsSection}>
                <View style={styles.sectionHeader}>
                  <SafeIcon name="tag" size={14} color="#6B7280" />
                  <Text style={styles.sectionTitle}>Caract├®ristiques</Text>
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
                        // S├®lectionner la variation pour afficher son image
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
                  <Text style={styles.priceFromLabel}>├Ç partir de</Text>
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
                title="­ƒÆ¼ Chat"
                variant="primary"
                onPress={handleChatPress}
                style={styles.actionButton}
              />
              <NativeButton
                title="­ƒæü´©Å Voir"
                variant="secondary"
                onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id || service?.id }))}
                style={styles.actionButton}
              />
            </View>

            {/* Ô£à NOUVEAU : Actions secondaires (Galerie, Partage) */}
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => setShowGallery(true)}
              >
                <SafeIcon name="image" size={18} color={modernColors.primary} />
                <Text style={styles.secondaryActionText}>Galerie</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={handleShare}
              >
                <SafeIcon name="share" size={18} color={modernColors.primary} />
                <Text style={styles.secondaryActionText}>Partager</Text>
              </TouchableOpacity>
            </View>

            {/* Footer info */}
            <View style={styles.footer}>
              {distanceKm !== undefined && distanceKm !== null && (
                <View style={styles.footerItem}>
                  <SafeIcon name="map-pin" size={12} color="#9CA3AF" />
                  <Text style={styles.footerText}>
                    {distanceKm < 1 ? 'Tr├¿s proche' : distanceKm < 5 ? '├Ç proximit├®' : `${distanceKm.toFixed(0)}km`}
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

      {/* Ô£à CORRIG├ë: Modal Chat avec props correctes */}
      {showChatModal && !onChatPress && prestataire.user_id && (
        <ChatModalMobile
          visible={showChatModal}
          onClose={() => setShowChatModal(false)}
          service={service || {
            id: product.service_id,
            data: { titre_service: { valeur: product.nom } }
          }}
          prestataireInfo={prestataire}
          user={null} // L'utilisateur sera r├®cup├®r├® depuis AuthContext dans ChatModalMobile
        />
      )}

      {/* Ô£à NOUVEAU : Modal Galerie du prestataire */}
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
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 220,
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
  // Ô£à NOUVEAU : Styles pour avis/ratings et actions secondaires
  productRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  ratingSection: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    padding: 12,
    borderRadius: 10,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ratingSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  ratingCount: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.primary,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
  // Ô£à NOUVEAU : Styles pour r├®actions
  reactionsSubsection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reactionsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reactionsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  reactionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 4,
  },
  reactionButtonActive: {
    borderColor: modernColors.primary,
    backgroundColor: modernColors.primary + '10',
    borderWidth: 2,
  },
  reactionEmoji: {
    fontSize: 18,
  },
  reactionCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    minWidth: 20,
    textAlign: 'center',
  },
  reactionCountActive: {
    color: modernColors.primary,
  },
});

export default ProductCard;
