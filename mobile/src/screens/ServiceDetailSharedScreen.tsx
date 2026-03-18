// @ts-nocheck
/**
 * Écran pour afficher un service partagé via deep link
 * Affiche les médias, produits et infos du prestataire
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import NavigatorToolbar from '../components/NavigatorToolbar';
import SafeIcon from '../components/SafeIcon';
import { NativeButton } from '../components/SafeNativeDesign';
import { config } from '../config/environment';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = 220;

const buildMediaUrl = (path: string | undefined | null): string => {
  if (!path) return '';
  const p = typeof path === 'string' ? path.trim() : '';
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
  const cleanPath = p.replace(/^\//, '');
  const base = (config.API_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/api/media/files/${cleanPath}` : cleanPath;
};

const extractMediaArray = (field: any): string[] => {
  if (!field) return [];
  if (typeof field === 'string') return [field];
  if (Array.isArray(field)) return field.filter((v: any) => typeof v === 'string' && v.length > 0);
  if (field && typeof field === 'object' && field.valeur) {
    if (Array.isArray(field.valeur)) return field.valeur.filter((v: any) => typeof v === 'string');
    if (typeof field.valeur === 'string') return [field.valeur];
  }
  return [];
};

const ServiceDetailSharedScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
    const { t } = useLanguageSafe();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // ✅ CORRIGÉ: Accepter à la fois "id" (deep link/linking.ts) et "serviceId" (navigation interne)
  const serviceId = (route.params as any)?.serviceId || (route.params as any)?.id;

  useEffect(() => {
    if (serviceId && serviceId !== 'undefined' && serviceId !== 'null') {
      loadServiceDetails();
    } else {
      console.error('[ServiceDetailShared] serviceId manquant ou invalide:', serviceId);
      setError('ID de service manquant ou invalide');
      setLoading(false);
    }
  }, [serviceId]);

  const loadServiceDetails = async () => {
    if (!serviceId || serviceId === 'undefined' || serviceId === 'null') {
      setError('ID de service manquant ou invalide');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('[ServiceDetailShared] Chargement service:', serviceId);

      // Charger service + produits en parallèle
      const [serviceResponse, productsResponse] = await Promise.all([
        apiGet(`/api/services/${serviceId}`),
        apiGet(`/api/services/${serviceId}/products`).catch(() => ({ success: false, data: [] })),
      ]);

      const data = (serviceResponse?.data || serviceResponse) as any;
      if (!serviceResponse.success || !data || !data.id) {
        throw new Error(serviceResponse.error || 'Service non trouvé');
      }

      setService(data);

      // Extraire les produits
      const prodData = (productsResponse?.data || productsResponse) as any;
      if (productsResponse.success && Array.isArray(prodData)) {
        setProducts(prodData);
        console.log('[ServiceDetailShared] Produits chargés:', prodData.length);
      } else if (Array.isArray(prodData?.data)) {
        setProducts(prodData.data);
      }

      setError(null);
    } catch (err: any) {
      console.error('[ServiceDetailShared] Erreur chargement:', err);
      setError(err.message || 'Impossible de charger le service');
    } finally {
      setLoading(false);
    }
  };

  // Extraire toutes les images du service + produits
  const allImages = useMemo(() => {
    if (!service) return [];
    const seen = new Set<string>();
    const images: string[] = [];
    const addImg = (raw: string) => {
      const url = buildMediaUrl(raw);
      if (url && !seen.has(url)) {
        seen.add(url);
        images.push(url);
      }
    };

    // Service-level images
    extractMediaArray(service.data?.images).forEach(addImg);
    extractMediaArray(service.data?.logo).forEach(addImg);
    extractMediaArray(service.data?.banniere).forEach(addImg);
    extractMediaArray(service.data?.banner).forEach(addImg);
    extractMediaArray(service.data?.images_realisations).forEach(addImg);

    // Product images
    products.forEach((p: any) => {
      const pd = p.product_data || p;
      extractMediaArray(pd.images).forEach(addImg);
    });

    // Old JSONB produits
    const oldProduits = service.data?.produits;
    if (oldProduits) {
      const arr = Array.isArray(oldProduits) ? oldProduits :
        (oldProduits.valeur && Array.isArray(oldProduits.valeur) ? oldProduits.valeur : []);
      arr.forEach((p: any) => {
        extractMediaArray(p.images).forEach(addImg);
      });
    }

    return images;
  }, [service, products]);

  // Déterminer le type d'offre
  const serviceType = useMemo(() => {
    if (!service) return 'produit';
    const typeOffre = service.data?.type_offre?.valeur || service.data?.type_offre || '';
    const category = service.category || service.data?.categorie_service?.valeur || '';
    const typeStr = String(typeOffre).toLowerCase();
    const catStr = String(category).toLowerCase();

    if (typeStr === 'prestation' || typeStr === 'service' ||
      catStr.includes('service') || catStr.includes('prestation') ||
      catStr.includes('reparation') || catStr.includes('coiffure') ||
      catStr.includes('mecanique') || catStr.includes('plomberie')) {
      return 'prestation';
    }
    return 'produit';
  }, [service]);

  const titre = service?.data?.titre_service?.valeur || service?.titre || 'Service';
  const description = service?.data?.description?.valeur || service?.description || '';
  const prix = service?.data?.prix?.valeur || service?.prix;
  const prestataireName = service?.prestataire?.nom_complet || service?.prestataire?.nom ||
    service?.user?.nom_complet || service?.prestataire_name || service?.user_name || 'Prestataire';
  const prestataireAvatar = service?.prestataire?.avatar_url || service?.user?.avatar_url;

  const handleContactService = () => {
    if (!user) {
      Alert.alert(
        'Connexion requise',
        'Connectez-vous pour contacter ce prestataire',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.login'),
            onPress: () => (navigation as any).navigate('Login', {
              returnTo: 'ServiceDetailShared',
              returnParams: { serviceId }
            })
          }
        ]
      );
      return;
    }

    // ✅ FIX: Construire un objet service complet avec tous les champs requis
    const normalizedService = {
      id: serviceId,
      service_id: serviceId,
      user_id: service?.user_id || service?.prestataire?.user_id,
      data: service?.data || {},
      category: service?.category,
      is_active: service?.is_active,
      // Ajouter les infos prestataire
      prestataire: service?.prestataire || {
        user_id: service?.user_id,
        nom_complet: prestataireName,
        nom: prestataireName,
        avatar_url: prestataireAvatar
      },
      user: service?.user || {
        id: service?.user_id,
        nom_complet: prestataireName,
        avatar_url: prestataireAvatar
      }
    };

    // Naviguer vers ResultatBesoin pour accéder au chat
    (navigation as any).navigate('ResultatBesoin', {
      results: [normalizedService],
      openChat: true,
    });
  };

  const handleViewProduct = (product: any) => {
    const pIndex = product.product_index ?? 0;
    console.log('[ServiceDetailShared] Voir produit:', serviceId, pIndex);
    (navigation as any).navigate('ProductDetail', {
      productId: `${serviceId}_${pIndex}`,
      serviceId: serviceId,
      productIndex: pIndex,
    });
  };

  const renderProductItem = useCallback(({ item }: { item: any }) => {
    const pd = item.product_data || item;
    const name = pd.nom || pd.nom_produit || item.product_name || 'Produit';
    const price = pd.prix_produit || pd.prix || item.product_price;
    const imgs = extractMediaArray(pd.images);
    const firstImg = imgs.length > 0 ? buildMediaUrl(imgs[0]) : null;

    return (
      <TouchableOpacity style={styles.productItem} onPress={() => handleViewProduct(item)} activeOpacity={0.7}>
        {firstImg ? (
          <Image source={{ uri: firstImg }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <SafeIcon name="package" size={24} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{name}</Text>
          {price && (
            <Text style={styles.productPrice}>
              {typeof price === 'object' && price.valeur ? price.valeur : price} FCFA
            </Text>
          )}
        </View>
        <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    );
  }, [serviceId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={modernColors.primary} />
        <Text style={styles.loadingText}>Chargement du service...</Text>
      </View>
    );
  }

  if (error || !service) {
    return (
      <View style={styles.errorContainer}>
        <SafeIcon name="alert-circle" size={64} color={modernColors.error} />
        <Text style={styles.errorTitle}>Service introuvable</Text>
        <Text style={styles.errorMessage}>{error || 'Ce service n\'existe pas ou a été supprimé'}</Text>
        <NativeButton
          title="Retour à l'accueil"
          onPress={() => (navigation as any).navigate('Home')}
          variant="primary"
          style={styles.homeButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[modernColors.primary, modernColors.primaryDark || '#4338CA']}
        style={styles.header}
      >
        <NavigatorToolbar
          tone="dark"
          showHandle={false}
          density="compact"
          backIcon="back"
          title={serviceType === 'prestation' ? 'Prestataire' : 'Boutique'}
          subtitle="Via Yukpo"
          onClose={() => (navigation as any).navigate('Home')}
        />
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Carrousel d'images */}
        {allImages.length > 0 && (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setActiveImageIndex(idx);
              }}
            >
              {allImages.map((url, idx) => (
                <Image
                  key={idx}
                  source={{ uri: url }}
                  style={styles.carouselImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {allImages.length > 1 && (
              <View style={styles.dotsContainer}>
                {allImages.map((_, idx) => (
                  <View
                    key={idx}
                    style={[styles.dot, idx === activeImageIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Carte service */}
        <View style={styles.content}>
          <View style={styles.serviceCard}>
            {/* Badge type */}
            <View style={styles.typeBadge}>
              <SafeIcon
                name={serviceType === 'prestation' ? 'tool' : 'shopping-bag'}
                size={12}
                color="#FFFFFF"
              />
              <Text style={styles.typeBadgeText}>
                {serviceType === 'prestation' ? 'Prestation de service' : 'Boutique'}
              </Text>
            </View>

            <Text style={styles.serviceTitle}>{titre}</Text>

            {description ? (
              <Text style={styles.serviceDescription}>{description}</Text>
            ) : null}

            {prix && (
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>
                  {serviceType === 'prestation' ? 'Tarif' : 'Prix'}
                </Text>
                <Text style={styles.priceText}>
                  {typeof prix === 'object' && prix.valeur ? prix.valeur : prix} FCFA
                </Text>
              </View>
            )}

            {/* Prestataire */}
            <View style={styles.prestataireRow}>
              {prestataireAvatar ? (
                <Image source={{ uri: buildMediaUrl(prestataireAvatar) }} style={styles.prestataireAvatar} />
              ) : (
                <View style={styles.prestataireAvatarPlaceholder}>
                  <SafeIcon name="user" size={18} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.prestataireInfo}>
                <Text style={styles.prestataireName}>{prestataireName}</Text>
                <Text style={styles.prestataireLabel}>
                  {serviceType === 'prestation' ? 'Prestataire' : 'Vendeur'}
                </Text>
              </View>
            </View>
          </View>

          {/* Liste des produits */}
          {products.length > 0 && (
            <View style={styles.productsSection}>
              <Text style={styles.sectionTitle}>
                {serviceType === 'prestation'
                  ? `${products.length} prestation${products.length > 1 ? 's' : ''} disponible${products.length > 1 ? 's' : ''}`
                  : `${products.length} produit${products.length > 1 ? 's' : ''} disponible${products.length > 1 ? 's' : ''}`
                }
              </Text>
              {products.slice(0, 6).map((product, idx) => (
                <React.Fragment key={product.id || idx}>
                  {renderProductItem({ item: product })}
                </React.Fragment>
              ))}
              {products.length > 6 && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => {
                    (navigation as any).navigate('ResultatBesoin', {
                      results: [{ service_id: serviceId, ...service }],
                    });
                  }}
                >
                  <Text style={styles.showMoreText}>
                    Voir les {products.length - 6} autres...
                  </Text>
                  <SafeIcon name="chevron-right" size={16} color={modernColors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <NativeButton
              title={serviceType === 'prestation'
                ? '\u{1F4AC} Contacter le prestataire'
                : '\u{1F4AC} Contacter le vendeur'
              }
              onPress={handleContactService}
              variant="primary"
              size="large"
            />

            <NativeButton
              title={serviceType === 'prestation'
                ? '\u{1F50D} Explorer les prestations'
                : '\u{1F6CD}\u{FE0F} Explorer la boutique'
              }
              onPress={() => {
                (navigation as any).navigate('ResultatBesoin', {
                  results: [{ service_id: serviceId, ...service }],
                });
              }}
              variant="outline"
              size="large"
            />

            {!user && (
              <View style={styles.authPrompt}>
                <SafeIcon name="lock" size={18} color="#92400E" />
                <Text style={styles.authPromptText}>
                  Connectez-vous pour commander ou contacter le prestataire
                </Text>
                <NativeButton
                  title="Se connecter"
                  onPress={() => (navigation as any).navigate('Login', {
                    returnTo: 'ServiceDetailShared',
                    returnParams: { serviceId }
                  })}
                  variant="outline"
                  size="medium"
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F3F4F6',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: modernColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  homeButton: {
    minWidth: 200,
  },
  header: {
    paddingHorizontal: 0,
    paddingVertical: 16,
    paddingTop: 48,
  },
  scrollView: {
    flex: 1,
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#E5E7EB',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: modernColors.primary,
    width: 20,
    borderRadius: 4,
  },
  content: {
    padding: 16,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: modernColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  serviceTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    lineHeight: 28,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  priceLabel: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },
  priceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#15803D',
  },
  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  prestataireAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  prestataireAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: modernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prestataireInfo: {
    flex: 1,
  },
  prestataireName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  prestataireLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  productsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    gap: 12,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  productImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 3,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.primary,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  authPrompt: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignItems: 'center',
  },
  authPromptText: {
    fontSize: 13,
    color: '#78350F',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ServiceDetailSharedScreen;


