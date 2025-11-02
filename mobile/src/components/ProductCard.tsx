/**
 * ProductCard v3.0 - Version optimale moderne (2025-11-02)
 * Toutes fonctionnalités : vecteurs, variations, chat, distance, drapeau pays
 * Sauvegarde : ProductCard.backup.tsx
 */

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import ChatModalMobile from './ChatModalMobile';
import { NativeButton, NativeCard } from './NativeDesign';
import ProductMediaCarousel from './ProductMediaCarousel';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface ProductCardProps {
  product: any;
  service: any;
  userLocation?: { latitude: number; longitude: number } | null;
  onPress?: () => void;
}

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
  userLocation = null,
  onPress,
}) => {
  const navigation = useNavigation();
  const [imageError, setImageError] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);

  // Données produit
  const productVector = product.product_vector || [];
  const locationVector = product.location_vector || [];
  const chosenLocation = product.chosen_location || locationVector[0] || '';
  const hasVariant = product.has_variant || false;
  const variants = product.variants || [];
  const prestataire = product.prestataire || service?.prestataire || {
    nom: service?.data?.nom_prestataire || 'Prestataire',
    user_id: service?.user_id,
  };

  // Images et vidéos
  const images = product.images || service?.images || [];
  const videos = product.videos || service?.videos || [];

  // Image de la variation sélectionnée (si existe)
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

  // Handler chat
  const handleChatPress = () => {
    setShowChatModal(true);
  };

  return (
    <>
      <NativeCard>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id || service?.id }))}
        >
          {/* Carousel d'images/vidéos avec support variation */}
          <View style={styles.imageContainer}>
            <ProductMediaCarousel
              images={images}
              videos={videos}
              variantImage={variantImage}
              onImagePress={(index) => {
                // Optionnel : ouvrir galerie complète
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

            {/* Localisation complète */}
            {chosenLocation && (
              <View style={styles.locationRow}>
                <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {chosenLocation}
                </Text>
                {locationVector.length > 1 && (
                  <Text style={styles.hierarchyHint}>
                    +{locationVector.length - 1}
                  </Text>
                )}
              </View>
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

      {/* Modal Chat */}
      {showChatModal && prestataire.user_id && (
        <ChatModalMobile
          isOpen={showChatModal}
          onClose={() => setShowChatModal(false)}
          prestataireId={prestataire.user_id}
          prestataireName={prestataire.nom}
          serviceId={product.service_id || service?.id}
          serviceTitle={product.nom || service?.data?.titre_service?.valeur}
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
});

export default ProductCard;
