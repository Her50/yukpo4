/**
 * ProductCard v2.0 - Version simplifiée avec vecteurs (2025-11-02)
 * Affiche vecteur caractéristiques + tableau variations prix
 * Sauvegarde originale : ProductCard.backup.tsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeCard, NativeButton } from './NativeDesign';

interface ProductCardProps {
  product: any;
  service: any;
  onPress?: () => void;
  onChatPress?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  service,
  onPress,
  onChatPress,
}) => {
  const navigation = useNavigation();
  const [imageError, setImageError] = useState(false);

  // Données produit
  const productVector = product.product_vector || [];
  const locationVector = product.location_vector || [];
  const chosenLocation = product.chosen_location || locationVector[0] || '';
  const hasVariant = product.has_variant || false;
  const variants = product.variants || [];
  const prestataire = product.prestataire || service?.prestataire || {};

  // Image principale
  const mainImage = product.image || product.images?.[0] || service?.images?.[0];

  // Prix
  const displayPrice = hasVariant && variants.length > 0
    ? Math.min(...variants.map((v: any) => v.prix || 0))
    : product.prix || 0;

  const devise = product.devise || variants[0]?.devise || 'XAF';

  // Distance
  const distanceKm = product.distance_km;

  return (
    <NativeCard>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id }))}
      >
        {/* Image */}
        {mainImage && !imageError && (
          <Image
            source={{ uri: mainImage }}
            style={styles.image}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        )}

        {!mainImage || imageError ? (
          <View style={styles.imagePlaceholder}>
            <SafeIcon name="package" size={48} color="#D1D5DB" />
          </View>
        ) : null}

        <View style={styles.content}>
          {/* Nom produit */}
          <Text style={styles.productName} numberOfLines={2}>
            {product.nom || service?.data?.titre_service?.valeur || 'Produit'}
          </Text>

          {/* Prestataire */}
          {prestataire.nom && (
            <TouchableOpacity
              style={styles.prestataireRow}
              onPress={() => navigation.navigate('ProfilePrestataire' as any, { userId: prestataire.user_id })}
            >
              {prestataire.avatar_url && (
                <Image
                  source={{ uri: prestataire.avatar_url }}
                  style={styles.avatar}
                />
              )}
              <View style={styles.avatarPlaceholder}>
                <SafeIcon name="user" size={14} color="#FFF" />
              </View>
              <Text style={styles.prestataireName} numberOfLines={1}>
                {prestataire.nom}
              </Text>
            </TouchableOpacity>
          )}

          {/* Localisation */}
          {chosenLocation && (
            <View style={styles.locationRow}>
              <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {chosenLocation}
              </Text>
              {distanceKm !== undefined && distanceKm !== null && (
                <Text style={styles.distanceText}>
                  • {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
                </Text>
              )}
            </View>
          )}

          {/* Caractéristiques (vecteur produit) */}
          {productVector.length > 0 && (
            <View style={styles.characteristicsSection}>
              <Text style={styles.sectionTitle}>Caractéristiques :</Text>
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

          {/* Prix */}
          {hasVariant && variants.length > 0 ? (
            <View style={styles.priceVariations}>
              <Text style={styles.sectionTitle}>
                Prix selon {product.variant_dimension || 'variante'} :
              </Text>
              <View style={styles.priceTable}>
                {variants.map((variant: any, i: number) => (
                  <View key={i} style={styles.priceRow}>
                    <Text style={styles.variantValue}>{variant.value}</Text>
                    <Text style={styles.variantPrice}>
                      {variant.prix?.toLocaleString()} {variant.devise || devise}
                    </Text>
                    <View style={[
                      styles.stockBadge,
                      (variant.stock || 0) > 5 ? styles.stockOK : styles.stockLow
                    ]}>
                      <Text style={styles.stockText}>
                        {(variant.stock || 0) > 0 ? `${variant.stock} dispo` : 'Épuisé'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.priceFrom}>
                À partir de {displayPrice.toLocaleString()} {devise}
              </Text>
            </View>
          ) : (
            <View style={styles.priceUnique}>
              <Text style={styles.price}>
                {displayPrice.toLocaleString()} {devise}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {onChatPress && (
              <NativeButton
                title="💬 Contacter"
                variant="primary"
                onPress={onChatPress}
              />
            )}
            <NativeButton
              title="👁️ Détails"
              variant="secondary"
              onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id }))}
            />
          </View>
        </View>
      </TouchableOpacity>
    </NativeCard>
  );
};

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prestataireName: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  distanceText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  characteristicsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipsScroll: {
    gap: 6,
  },
  chip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: modernColors.primary,
  },
  chipText: {
    fontSize: 13,
    color: modernColors.primary,
    fontWeight: '500',
  },
  priceVariations: {
    gap: 12,
  },
  priceTable: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
  },
  variantValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  variantPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: modernColors.primary,
    flex: 1,
    textAlign: 'center',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockOK: {
    backgroundColor: '#D1FAE5',
  },
  stockLow: {
    backgroundColor: '#FEE2E2',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  priceFrom: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  priceUnique: {
    alignItems: 'flex-start',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default ProductCard;
