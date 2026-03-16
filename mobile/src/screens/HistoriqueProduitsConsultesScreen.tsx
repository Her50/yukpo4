/**
 * HistoriqueProduitsConsultesScreen - Affiche les produits récemment consultés par l'utilisateur
 */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeStorage from '../utils/safeStorage';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ViewedProduct {
  serviceId: number;
  productIndex?: number;
  productName: string;
  viewedAt: string;
  productData?: any;
  serviceData?: any;
}

const STORAGE_KEY = 'viewed_products_history';
const MAX_HISTORY_ITEMS = 100; // Limiter l'historique à 100 produits

const HistoriqueProduitsConsultesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { location } = useLocation();
    const { t } = useLanguageSafe();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewedProducts, setViewedProducts] = useState<ViewedProduct[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);

  // Charger l'historique depuis le stockage local
  const loadHistory = useCallback(async () => {
    try {
      const stored = await SafeStorage.getItem(STORAGE_KEY);
      if (stored) {
        const history: ViewedProduct[] = JSON.parse(stored);
        // Trier par date de consultation (plus récent en premier)
        const sorted = history.sort((a, b) =>
          new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
        );
        setViewedProducts(sorted);

        // Charger les données des produits depuis l'API
        await loadProductsData(sorted);
      }
    } catch (error) {
      console.error('[HistoriqueProduitsConsultesScreen] Erreur chargement historique:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Charger les données des produits depuis l'API
  const loadProductsData = async (history: ViewedProduct[]) => {
    try {
      const productsPromises = history.map(async (item) => {
        try {
          // ✅ CORRIGÉ 2026-02-10: Charger le service ET le prestataire
          const serviceResponse = await apiGet(`/api/services/${item.serviceId}`);
          if (!serviceResponse.success || !serviceResponse.data) {
            console.warn(`[HistoriqueProduitsConsultesScreen] Service ${item.serviceId} non trouvé`);
            return null;
          }

          const service: any = serviceResponse.data;

          // ✅ CORRIGÉ 2026-02-10: Charger le prestataire depuis le service
          let prestataire = null;
          if (service.user_id) {
            try {
              const prestataireResponse = await apiGet(`/api/users/profile/${service.user_id}`);
              if (prestataireResponse.success && prestataireResponse.data) {
                prestataire = prestataireResponse.data;
              }
            } catch (error) {
              console.warn(`[HistoriqueProduitsConsultesScreen] Erreur chargement prestataire ${service.user_id}:`, error);
              // Continuer même si le prestataire n'est pas chargé
              prestataire = {
                user_id: service.user_id,
                nom: (service as any).data?.nom_prestataire?.valeur || 'Prestataire',
              };
            }
          }

          // ✅ CORRIGÉ 2026-02-10: TOUJOURS charger les produits, ne jamais retourner le service comme produit
          const productsResponse = await apiGet(`/api/services/${item.serviceId}/products`);
          if (productsResponse.success && Array.isArray(productsResponse.data)) {
            // Si productIndex est défini, chercher le produit spécifique
            if (item.productIndex !== undefined) {
              const product = productsResponse.data.find(
                (p: any) => p.product_index === item.productIndex
              );

              if (product) {
                const productData = product.product_data || product;
                return {
                  // ✅ CORRIGÉ: Structure identique à ResultatBesoinScreen
                  ...product,
                  product_data: productData,
                  id: product.id || `${item.serviceId}_${item.productIndex}`,
                  product_id: product.id || `${item.serviceId}_${item.productIndex}`,
                  product_index: item.productIndex,
                  product_name: product.product_name || productData.nom_produit || productData.nom || productData.name,
                  nom_produit: productData.nom_produit || productData.nom || productData.name || product.product_name,
                  nom: productData.nom_produit || productData.nom || productData.name || product.product_name,
                  name: productData.nom_produit || productData.nom || productData.name || product.product_name,
                  _serviceId: item.serviceId,
                  _service: service,
                  _prestataire: prestataire,
                  viewedAt: item.viewedAt,
                };
              }
            }

            // ✅ CORRIGÉ 2026-02-10: Si productIndex n'est pas défini ou produit non trouvé, prendre le premier produit
            // Ne jamais retourner le service comme produit
            if (productsResponse.data.length > 0) {
              const product = productsResponse.data[0];
              const productData = product.product_data || product;
              return {
                ...product,
                product_data: productData,
                id: product.id || `${item.serviceId}_${product.product_index || 0}`,
                product_id: product.id || `${item.serviceId}_${product.product_index || 0}`,
                product_index: product.product_index || 0,
                product_name: product.product_name || productData.nom_produit || productData.nom || productData.name,
                nom_produit: productData.nom_produit || productData.nom || productData.name || product.product_name,
                nom: productData.nom_produit || productData.nom || productData.name || product.product_name,
                name: productData.nom_produit || productData.nom || productData.name || product.product_name,
                _serviceId: item.serviceId,
                _service: service,
                _prestataire: prestataire,
                viewedAt: item.viewedAt,
              };
            }
          }

          // ✅ CORRIGÉ 2026-02-10: Si aucun produit n'est trouvé, retourner null au lieu du service
          console.warn(`[HistoriqueProduitsConsultesScreen] Aucun produit trouvé pour service ${item.serviceId}`);
          return null;
        } catch (error) {
          console.error(`[HistoriqueProduitsConsultesScreen] Erreur chargement produit ${item.serviceId}:`, error);
          return null;
        }
      });

      const products = await Promise.all(productsPromises);
      const validProducts = products.filter(p => p !== null) as any[];
      setProductsData(validProducts);
    } catch (error) {
      console.error('[HistoriqueProduitsConsultesScreen] Erreur chargement données produits:', error);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistory();
  }, [loadHistory]);

  const userLocationMemo = useMemo(() => {
    return location?.coords ? {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    } : null;
  }, [location?.coords?.latitude, location?.coords?.longitude]);

  const renderProductCard = useCallback((product: any) => {
    return (
      <ProductCard
        key={`product-${product._serviceId}-${product.product_index || product.id}`}
        product={product}
        service={product._service}
        prestataire={product._prestataire}
        userLocation={userLocationMemo}
        onPress={() => {
          // Navigation vers les détails du produit si nécessaire
        }}
      />
    );
  }, [userLocationMemo]);

  const clearHistory = async () => {
    try {
      await SafeStorage.removeItem(STORAGE_KEY);
      setViewedProducts([]);
      setProductsData([]);
      Alert.alert('Succès', 'Historique effacé');
    } catch (error) {
      console.error('[HistoriqueProduitsConsultesScreen] Erreur effacement historique:', error);
      Alert.alert('Erreur', 'Impossible d\'effacer l\'historique');
    }
  };

  if (loading) {
    return (
      <KeyboardAwareScreen>
        <SafeNativeView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={modernColors.primary} />
            <Text style={styles.loadingText}>{t('historiqueProduitsConsultes.chargementDeLhistorique')}</Text>
          </View>
        </SafeNativeView>
      </KeyboardAwareScreen>
    );
  }

  return (
    <KeyboardAwareScreen>
      <SafeNativeView style={styles.container}>
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <SafeIcon name="clock" size={24} color={modernColors.primary} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{t('historiqueProduitsConsultes.produitsConsultes')}</Text>
              <Text style={styles.headerSubtitle}>
                {productsData.length} {productsData.length === 1 ? 'produit' : 'produits'}
              </Text>
            </View>
          </View>
          {productsData.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearHistory}
            >
              <SafeIcon name="trash-2" size={18} color={modernColors.error} />
              <Text style={styles.clearButtonText}>Effacer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Liste des produits */}
        {productsData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <SafeIcon name="package" size={64} color={modernColors.textSecondary} />
            <Text style={styles.emptyText}>{t('historiqueProduitsConsultes.aucunProduitConsulte')}</Text>
            <Text style={styles.emptySubtext}>
              Les produits que vous consultez apparaîtront ici
            </Text>
          </View>
        ) : (
          <FlatList
            data={productsData}
            renderItem={({ item }) => renderProductCard(item)}
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
  header: {
    backgroundColor: modernColors.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: modernColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.error,
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

export default HistoriqueProduitsConsultesScreen;

