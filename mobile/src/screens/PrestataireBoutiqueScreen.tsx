/**
 * PrestataireBoutiqueScreen - Affiche tous les produits/services d'un prestataire
 * Utilise ProductCard pour l'affichage, comme une boutique
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import ProductCard from '../components/ProductCard';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface PrestataireBoutiqueScreenProps { }

const PrestataireBoutiqueScreen: React.FC<PrestataireBoutiqueScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { location } = useLocation();

  const routeParams = (route.params as any) || {};
  const prestataireUserId = routeParams.userId || routeParams.user_id;
  const prestataireName = routeParams.prestataireName || routeParams.name || 'Prestataire';
  // ✅ NOUVEAU 2026-01-23: Produit cliqué pour l'inclure dans les résultats
  const clickedProduct = routeParams.clickedProduct;
  const clickedService = routeParams.clickedService;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prestataire, setPrestataire] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [screenTitle, setScreenTitle] = useState<string>('Boutique'); // ✅ NOUVEAU: Titre dynamique selon type_offre

  // Fonction pour charger les données du prestataire
  const loadPrestataireData = useCallback(async (isRefresh = false) => {
    if (!prestataireUserId) {
      setError('ID prestataire manquant');
      setLoading(false);
      return;
    }

    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);

      // 1. Charger les informations du prestataire
      const prestataireResponse = await apiGet(`/api/users/profile/${prestataireUserId}`);
      if (prestataireResponse.success && prestataireResponse.data) {
        setPrestataire(prestataireResponse.data);
      }

      // 2. Charger tous les services du prestataire
      const servicesResponse = await apiGet(`/api/services/user/${prestataireUserId}`);
      console.log(`🔍 [PrestataireBoutiqueScreen] Réponse services pour prestataire ${prestataireUserId}:`, {
        success: servicesResponse.success,
        hasData: !!servicesResponse.data,
        dataType: typeof servicesResponse.data,
        isArray: Array.isArray(servicesResponse.data),
        responseKeys: servicesResponse.data ? Object.keys(servicesResponse.data) : [],
        rawResponse: JSON.stringify(servicesResponse).substring(0, 500)
      });

      // ✅ Gérer différents formats de réponse
      let servicesData: any[] = [];
      if (servicesResponse.success && servicesResponse.data) {
        servicesData = Array.isArray(servicesResponse.data)
          ? servicesResponse.data
          : (Array.isArray(servicesResponse.data.data) ? servicesResponse.data.data : []);
      } else if (Array.isArray(servicesResponse.data)) {
        servicesData = servicesResponse.data;
      } else if (servicesResponse.data && typeof servicesResponse.data === 'object') {
        // ✅ CORRIGÉ 2026-01-21: Vérifier aussi servicesResponse.data.data directement
        if (Array.isArray(servicesResponse.data.data)) {
          servicesData = servicesResponse.data.data;
        } else if (Array.isArray(servicesResponse.data.services)) {
          servicesData = servicesResponse.data.services;
        } else if (Array.isArray(servicesResponse.data.resultats)) {
          servicesData = servicesResponse.data.resultats;
        }
      }

      setServices(servicesData);
      console.log(`✅ [PrestataireBoutiqueScreen] ${servicesData.length} services chargés pour prestataire ${prestataireUserId}:`,
        servicesData.map((s: any) => ({ id: s.id, hasData: !!s.data, user_id: s.user_id }))
      );

      // 3. Extraire tous les produits de tous les services
      const allProducts: any[] = [];
      const serviceIds = servicesData.map((s: any) => s.id).filter((id: any) => id);

      // Charger les produits pour chaque service
      const productPromises = serviceIds.map(async (serviceId: number) => {
        try {
          console.log(`🔍 [PrestataireBoutiqueScreen] Chargement produits pour service ${serviceId}...`);
          const productsResponse = await apiGet(`/api/services/${serviceId}/products`);

          console.log(`📦 [PrestataireBoutiqueScreen] Réponse produits service ${serviceId}:`, {
            success: productsResponse.success,
            hasData: !!productsResponse.data,
            isArray: Array.isArray(productsResponse.data),
            dataLength: Array.isArray(productsResponse.data) ? productsResponse.data.length : 0,
            error: productsResponse.error,
            rawResponse: JSON.stringify(productsResponse).substring(0, 200)
          });

          // ✅ CORRIGÉ 2026-01-23: Gérer le format de réponse de l'endpoint
          // L'endpoint /api/services/{serviceId}/products retourne Json<Vec<ProductResponse>>
          // apiGet wrapper la réponse dans { success: true, data: [...] }
          let productsArray: any[] = [];

          // ✅ CAS 1: La réponse est dans le format standard { success: true, data: [...] }
          if (productsResponse && typeof productsResponse === 'object' && Array.isArray(productsResponse.data)) {
            productsArray = productsResponse.data;
          }
          // ✅ CAS 2: La réponse est directement un tableau (peu probable avec apiGet, mais on gère le cas)
          else if (Array.isArray(productsResponse)) {
            productsArray = productsResponse;
          }
          // ✅ CAS 3: La réponse est dans un wrapper imbriqué
          else if (productsResponse?.data && typeof productsResponse.data === 'object') {
            if (Array.isArray(productsResponse.data.data)) {
              productsArray = productsResponse.data.data;
            } else if (Array.isArray(productsResponse.data.products)) {
              productsArray = productsResponse.data.products;
            }
          }

          console.log(`📦 [PrestataireBoutiqueScreen] Produits extraits pour service ${serviceId}:`, {
            productsCount: productsArray.length,
            firstProduct: productsArray[0] ? {
              id: productsArray[0].id,
              product_index: productsArray[0].product_index,
              product_name: productsArray[0].product_name,
              hasProductData: !!productsArray[0].product_data
            } : null
          });

          if (productsArray.length > 0) {
            const mappedProducts = productsArray.map((productFromAPI: any) => {
              const productData = productFromAPI.product_data || productFromAPI;
              const service = servicesData.find((s: any) => s.id === serviceId);

              // ✅ NOUVEAU 2026-01-22: Extraire type_offre depuis product_data ou service.data
              const typeOffre = productData.type_offre ||
                productData.type_offre?.valeur ||
                service?.data?.type_offre?.valeur ||
                '';

              const transformedProduct = {
                ...productData,
                // ✅ CORRIGÉ 2026-01-21: Préserver product_data pour ProductCard
                product_data: productData,
                // ✅ NOUVEAU 2026-01-22: Inclure type_offre pour déterminer le titre de l'écran
                type_offre: typeOffre,
                id: productFromAPI.id || productFromAPI.product_id || `${serviceId}_${productFromAPI.product_index}`,
                product_index: productFromAPI.product_index,
                product_name: productFromAPI.product_name || productData.nom_produit || productData.nom || productData.name,
                product_type: productFromAPI.product_type,
                product_price: productFromAPI.product_price || productData.prix_produit || productData.prix,
                nom_produit: productData.nom_produit || productData.nom || productData.name || productFromAPI.product_name,
                nom: productData.nom_produit || productData.nom || productData.name || productFromAPI.product_name,
                name: productData.nom_produit || productData.nom || productData.name || productFromAPI.product_name,
                _serviceId: serviceId,
                _service: service,
                _prestataire: prestataireResponse.data,
              };

              console.log(`✅ [PrestataireBoutiqueScreen] Produit transformé:`, {
                id: transformedProduct.id,
                nom: transformedProduct.nom,
                _serviceId: transformedProduct._serviceId,
                hasProductData: !!transformedProduct.product_data
              });

              return transformedProduct;
            });

            console.log(`✅ [PrestataireBoutiqueScreen] ${mappedProducts.length} produits mappés pour service ${serviceId}`);
            return mappedProducts;
          } else {
            console.log(`⚠️ [PrestataireBoutiqueScreen] Aucun produit trouvé pour service ${serviceId}`);
          }
          return [];
        } catch (error: any) {
          console.error(`❌ [PrestataireBoutiqueScreen] Erreur chargement produits service ${serviceId}:`, error?.message || error);
          return [];
        }
      });

      const productsArrays = await Promise.all(productPromises);
      let extractedProducts = productsArrays.flat();

      console.log(`📊 [PrestataireBoutiqueScreen] Total produits extraits de l'API: ${extractedProducts.length}`, {
        servicesProcessed: serviceIds.length,
        productsPerService: productsArrays.map((arr, idx) => ({ serviceId: serviceIds[idx], count: arr.length })),
      });

      // ✅ CORRIGÉ 2026-02-25: Supprimé l'ajout manuel du produit cliqué
      // Le produit cliqué est déjà inclus dans les résultats de l'API quand on charge 
      // tous les produits du prestataire via /api/services/{serviceId}/products
      // L'ajout manuel causait une duplication inutile

      console.log(`📊 [PrestataireBoutiqueScreen] Total produits chargés: ${extractedProducts.length}`, {
        servicesProcessed: serviceIds.length,
        productsPerService: productsArrays.map((arr, idx) => ({ serviceId: serviceIds[idx], count: arr.length })),
        note: 'Le produit cliqué est déjà inclus dans les résultats de l\'API'
      });

      if (extractedProducts.length === 0) {
        console.warn(`⚠️ [PrestataireBoutiqueScreen] Aucun produit trouvé pour prestataire ${prestataireUserId} (${servicesData.length} services)`);
      }

      // Calculer la distance pour chaque produit
      const userGPS = location?.coords ? `${location.coords.latitude},${location.coords.longitude}` : null;
      const productsWithDistance = extractedProducts.map((product: any) => {
        let distance = undefined;
        if (userGPS && location?.coords && product._service) {
          const serviceGPS = product._service.gps || product._service.data?.gps_fixe?.valeur;
          if (serviceGPS) {
            try {
              const [userLat, userLon] = userGPS.split(',').map(Number);
              const [serviceLat, serviceLon] = serviceGPS.split(',').map(Number);

              if (!isNaN(userLat) && !isNaN(userLon) && !isNaN(serviceLat) && !isNaN(serviceLon)) {
                const R = 6371; // Rayon de la Terre en km
                const dLat = (serviceLat - userLat) * Math.PI / 180;
                const dLon = (serviceLon - userLon) * Math.PI / 180;
                const a =
                  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(userLat * Math.PI / 180) * Math.cos(serviceLat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                distance = R * c;
              }
            } catch (error) {
              console.warn('[PrestataireBoutiqueScreen] Erreur calcul distance:', error);
            }
          }
        }

        return {
          ...product,
          distance,
          distance_km: distance,
        };
      });

      // Trier par date de création (plus récents en premier)
      productsWithDistance.sort((a, b) => {
        const dateA = a.created_at || a._service?.created_at || 0;
        const dateB = b.created_at || b._service?.created_at || 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setProducts(productsWithDistance);
      console.log(`✅ [PrestataireBoutiqueScreen] ${productsWithDistance.length} produits chargés pour prestataire ${prestataireUserId}`);

      // ✅ NOUVEAU 2026-01-22: Déterminer le titre de l'écran selon type_offre
      // Vérifier si au moins un produit/prestation a type_offre = 'prestation'
      const hasPrestation = productsWithDistance.some((p: any) => {
        const typeOffre = p.type_offre || p.product_data?.type_offre || p._service?.data?.type_offre?.valeur || '';
        return typeOffre === 'prestation' || typeOffre === 'prestation_service';
      });

      // Si tous les produits sont des prestations, utiliser "Prestation de service"
      // Sinon, utiliser "Boutique"
      const allArePrestations = productsWithDistance.length > 0 && productsWithDistance.every((p: any) => {
        const typeOffre = p.type_offre || p.product_data?.type_offre || p._service?.data?.type_offre?.valeur || '';
        return typeOffre === 'prestation' || typeOffre === 'prestation_service';
      });

      if (allArePrestations) {
        setScreenTitle('Prestation de service');
      } else if (hasPrestation) {
        // Mix de produits et prestations : utiliser "Boutique" par défaut
        setScreenTitle('Boutique');
      } else {
        setScreenTitle('Boutique');
      }

      // ✅ DEBUG 2026-01-21: Log final des produits
      if (productsWithDistance.length > 0) {
        console.log(`📦 [PrestataireBoutiqueScreen] Détails des produits chargés:`,
          productsWithDistance.map((p: any) => ({
            id: p.id,
            nom: p.nom || p.name || p.nom_produit,
            _serviceId: p._serviceId,
            hasService: !!p._service,
            hasProductData: !!p.product_data,
            type_offre: p.type_offre || p.product_data?.type_offre || p._service?.data?.type_offre?.valeur
          }))
        );
      } else {
        console.warn(`⚠️ [PrestataireBoutiqueScreen] AUCUN produit trouvé pour prestataire ${prestataireUserId} après traitement`);
      }
    } catch (error: any) {
      console.error('[PrestataireBoutiqueScreen] Erreur chargement données:', error);
      setError(error.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [prestataireUserId, location, clickedProduct, clickedService]);

  useEffect(() => {
    loadPrestataireData();
  }, [loadPrestataireData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPrestataireData(true);
  }, [loadPrestataireData]);

  const userLocationMemo = useMemo(() => {
    return location?.coords ? {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    } : null;
  }, [location?.coords?.latitude, location?.coords?.longitude]);

  const renderProductCard = useCallback((product: any) => {
    console.log(`🎨 [PrestataireBoutiqueScreen] Rendu ProductCard pour:`, {
      productId: product.id,
      productNom: product.nom || product.name || product.nom_produit,
      hasService: !!product._service,
      serviceId: product._service?.id,
      hasPrestataire: !!(product._prestataire || prestataire),
      hasProductData: !!product.product_data
    });

    return (
      <ProductCard
        key={`product-${product._serviceId}-${product.product_index || product.id}`}
        product={product}
        service={product._service}
        prestataire={product._prestataire || prestataire}
        userLocation={userLocationMemo}
        onPress={() => {
          // Navigation vers les détails du produit si nécessaire
        }}
      />
    );
  }, [prestataire, userLocationMemo]);

  if (loading && !refreshing) {
    return (
      <KeyboardAwareScreen>
        <SafeNativeView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={modernColors.primary} />
            <Text style={styles.loadingText}>Chargement de la boutique...</Text>
          </View>
        </SafeNativeView>
      </KeyboardAwareScreen>
    );
  }

  if (error) {
    return (
      <KeyboardAwareScreen>
        <SafeNativeView style={styles.container}>
          <View style={styles.errorContainer}>
            <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </SafeNativeView>
      </KeyboardAwareScreen>
    );
  }

  return (
    <KeyboardAwareScreen>
      <SafeNativeView style={styles.container}>
        {/* En-tête avec nom du prestataire */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <SafeIcon name="store" size={24} color={modernColors.primary} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>
                {screenTitle === 'Prestation de service'
                  ? `Prestation de service de ${prestataireName}`
                  : `Boutique de ${prestataireName}`}
              </Text>
              <Text style={styles.headerSubtitle}>
                {products.length} {products.length === 1
                  ? (screenTitle === 'Prestation de service' ? 'prestation' : 'produit')
                  : (screenTitle === 'Prestation de service' ? 'prestations' : 'produits')}
              </Text>
            </View>
          </View>
          {/* ✅ NOUVEAU 2026-01-20: Bouton pour accéder à la recherche */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={async () => {
              try {
                // ✅ Option 1: Faire une recherche avec le nom du prestataire pour obtenir tous ses services
                const searchResponse = await apiPost('/api/search/direct', {
                  texte: prestataireName,
                  user_id: prestataireUserId, // Filtrer par prestataire si l'API le supporte
                });

                let results: any[] = [];
                if (searchResponse?.success && searchResponse?.resultats) {
                  results = searchResponse.resultats.resultats || searchResponse.resultats || [];
                }

                // ✅ Option 2: Si la recherche ne retourne rien, utiliser les services chargés
                if (results.length === 0 && services.length > 0) {
                  // Convertir les services en format SearchResult
                  results = services.map((service: any) => ({
                    service_id: String(service.id),
                    id: String(service.id),
                    score: 100, // Score élevé car c'est le prestataire recherché
                    semantic_score: 100,
                    interaction_score: 0,
                    gps: service.gps || service.data?.gps_fixe?.valeur,
                    distance: undefined, // Sera calculé dans ResultatBesoinScreen
                    proximityScore: undefined,
                    data: service.data || {},
                    user_id: prestataireUserId,
                  }));
                }

                // Naviguer vers ResultatBesoinScreen avec les résultats
                (navigation as any).navigate('ResultatBesoin', {
                  results: results,
                  searchQuery: prestataireName,
                  query: prestataireName,
                  type: 'recherche_besoin',
                  fromPrestataireBoutique: true,
                });
              } catch (error) {
                console.error('[PrestataireBoutiqueScreen] Erreur lors de la recherche:', error);
                // Fallback: Naviguer quand même avec les services chargés
                const fallbackResults = services.map((service: any) => ({
                  service_id: String(service.id),
                  id: String(service.id),
                  score: 100,
                  semantic_score: 100,
                  interaction_score: 0,
                  gps: service.gps || service.data?.gps_fixe?.valeur,
                  data: service.data || {},
                  user_id: prestataireUserId,
                }));

                (navigation as any).navigate('ResultatBesoin', {
                  results: fallbackResults,
                  searchQuery: prestataireName,
                  query: prestataireName,
                  type: 'recherche_besoin',
                  fromPrestataireBoutique: true,
                });
              }
            }}
            activeOpacity={0.7}
          >
            <SafeIcon name="search" size={18} color={modernColors.primary} />
            <Text style={styles.searchButtonText}>Voir dans la recherche</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des produits */}
        {products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <SafeIcon name={screenTitle === 'Prestation de service' ? "briefcase" : "package"} size={64} color={modernColors.textSecondary} />
            <Text style={styles.emptyText}>
              {screenTitle === 'Prestation de service'
                ? 'Aucune prestation disponible'
                : 'Aucun produit disponible'}
            </Text>
            <Text style={styles.emptySubtext}>
              {screenTitle === 'Prestation de service'
                ? 'Ce prestataire n\'a pas encore de prestations en ligne'
                : 'Ce prestataire n\'a pas encore de produits en ligne'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={products}
            renderItem={({ item, index }) => {
              // ✅ DEBUG 2026-01-21: Log chaque rendu de produit
              if (index === 0) {
                console.log(`🖥️ [PrestataireBoutiqueScreen] Premier produit rendu:`, {
                  id: item.id,
                  nom: item.nom || item.name || item.nom_produit,
                  totalProducts: products.length
                });
              }
              return renderProductCard(item);
            }}
            keyExtractor={(item, index) =>
              `product-${item._serviceId}-${item.product_index || item.id || index}`
            }
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[modernColors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <SafeIcon name={screenTitle === 'Prestation de service' ? "briefcase" : "package"} size={64} color={modernColors.textSecondary} />
                <Text style={styles.emptyText}>
                  {screenTitle === 'Prestation de service'
                    ? 'Aucune prestation disponible'
                    : 'Aucun produit disponible'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {screenTitle === 'Prestation de service'
                    ? 'Ce prestataire n\'a pas encore de prestations en ligne'
                    : 'Ce prestataire n\'a pas encore de produits en ligne'}
                </Text>
              </View>
            }
          />
        )}
      </SafeNativeView>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: modernColors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: modernColors.error,
    textAlign: 'center',
  },
  header: {
    backgroundColor: modernColors.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: modernColors.border,
    gap: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: modernColors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    marginTop: 4,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: modernColors.primary + '15', // 15% opacity
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: modernColors.primary + '30', // 30% opacity
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.primary,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: modernColors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
});

export default PrestataireBoutiqueScreen;

