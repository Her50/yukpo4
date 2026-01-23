/**
 * HistoriqueProduitsConsultesScreen - Affiche les produits récemment consultés par l'utilisateur
 */

import { useNavigation, useRoute } from '@react-navigation/native';
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
          // Charger le service
          const serviceResponse = await apiGet(`/api/services/${item.serviceId}`);
          if (serviceResponse.success && serviceResponse.data) {
            const service = serviceResponse.data;
            
            // Si productIndex est défini, charger le produit spécifique
            if (item.productIndex !== undefined) {
              const productsResponse = await apiGet(`/api/services/${item.serviceId}/products`);
              if (productsResponse.success && Array.isArray(productsResponse.data)) {
                const product = productsResponse.data.find(
                  (p: any) => p.product_index === item.productIndex
                );
                
                if (product) {
                  const productData = product.product_data || product;
                  return {
                    ...productData,
                    product_data: productData,
                    id: product.id || `${item.serviceId}_${item.productIndex}`,
                    product_index: item.productIndex,
                    product_name: product.product_name || productData.nom_produit || productData.nom || productData.name,
                    nom_produit: productData.nom_produit || productData.nom || productData.name || product.product_name,
                    nom: productData.nom_produit || productData.nom || productData.name || product.product_name,
                    name: productData.nom_produit || productData.nom || productData.name || product.product_name,
                    _serviceId: item.serviceId,
                    _service: service,
                    viewedAt: item.viewedAt,
                  };
                }
              }
            }
            
            // Si pas de produit spécifique, retourner le service comme produit
            const serviceData = service.data || {};
            return {
              ...serviceData,
              id: `${item.serviceId}_0`,
              product_index: 0,
              nom: serviceData.titre_service?.valeur || serviceData.nom_produit?.valeur || item.productName,
              name: serviceData.titre_service?.valeur || serviceData.nom_produit?.valeur || item.productName,
              _serviceId: item.serviceId,
              _service: service,
              viewedAt: item.viewedAt,
            };
          }
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
            <Text style={styles.loadingText}>Chargement de l'historique...</Text>
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
              <Text style={styles.headerTitle}>Produits consultés</Text>
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
            <Text style={styles.emptyText}>Aucun produit consulté</Text>
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

