import DateTimePickerOriginal from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeIcon from '../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../components/SafeNativeDesign';
import { useToaster } from '../components/ToasterProvider';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiPost } from '../services/api';
import { productsService } from '../services/productsService';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';
const DateTimePicker = DateTimePickerOriginal as any;

interface RouteParams {
  serviceId: number;
  serviceData?: any;
  serviceTitle?: string;
  productIndex?: number; // Pour pré-sélection si un seul produit
}

interface Product {
  serviceId: number;
  productIndex: number;
  nom: string;
  description?: string;
  prix?: number;
  serviceTitle?: string;
  id: string; // Identifiant unique pour la sélection
}

const CreateFlashPromoScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { colors } = useTheme();
  const toaster = useToaster();
  const { t } = useLanguageSafe();

  const params = (route.params || {}) as RouteParams;
  const { serviceId, serviceData, serviceTitle, productIndex } = params;

  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'free'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [conditions, setConditions] = useState('');
  const [availability, setAvailability] = useState<'online' | 'live' | 'both'>('online');
  const [liveSessionId, setLiveSessionId] = useState('');
  const [stockCap, setStockCap] = useState('');
  const [startsAt, setStartsAt] = useState(new Date());
  const [endsAt, setEndsAt] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000)); // Demain par défaut
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Charger les produits du service
  useEffect(() => {
    loadProducts();
  }, [serviceId, serviceData]);

  // Pré-sélectionner le produit si productIndex et serviceId sont fournis
  useEffect(() => {
    if (productIndex !== undefined && serviceId && products.length > 0) {
      const productId = `${serviceId}_${productIndex}`;
      const product = products.find(p => p.id === productId);
      if (product) {
        setSelectedProductIds([productId]);
      }
    }
  }, [productIndex, serviceId, products]);

  // Pré-remplir le titre si disponible
  useEffect(() => {
    if (serviceTitle) {
      setTitle(`Flash Promo - ${serviceTitle}`);
    }
  }, [serviceTitle]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);

      if (!user?.id) {
        console.warn('[CreateFlashPromo] ⚠️ Utilisateur non connecté');
        setProducts([]);
        return;
      }

      // ✅ CORRIGÉ: Charger TOUS les produits de l'utilisateur depuis tous ses services
      const apiProducts = await productsService.getProductsByUser(user.id as any);
      console.log('[CreateFlashPromo] ✅ Produits récupérés:', apiProducts.length);

      // Convertir les produits de l'API en format Product
      const productsList: Product[] = apiProducts.map((apiProduct) => {
        const productData = apiProduct.product_data || {};
        return {
          serviceId: apiProduct.service_id,
          productIndex: apiProduct.product_index,
          id: `${apiProduct.service_id}_${apiProduct.product_index}`, // Identifiant unique
          nom: apiProduct.product_name || productData.nom || productData.nom_produit || t('createFlashPromo.produitSansNom'),
          description: productData.description || productData.desc || '',
          prix: apiProduct.product_price || productData.prix || productData.prix_produit || 0,
          serviceTitle: productData.titre_service || productData.nom_service || `Service #${apiProduct.service_id}`,
        };
      });

      setProducts(productsList);
      console.log('[CreateFlashPromo] ✅ Produits convertis:', productsList.length);
    } catch (error: any) {
      console.error('[CreateFlashPromo] Erreur chargement produits:', error);
      toaster.error('Erreur lors du chargement des produits');
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleCreate = async () => {
    // Validation
    if (!title.trim()) {
      toaster.error('Veuillez saisir un titre');
      return;
    }

    if (selectedProductIds.length === 0) {
      toaster.error(t('createFlashPromoScreen.veuillezSelectionnerAuMoinsUnProduit'));
      return;
    }

    if (discountType !== 'free' && !discountValue.trim()) {
      toaster.error(t('createFlashPromoScreen.veuillezSaisirUneValeurDeReduction'));
      return;
    }

    if (discountType === 'percentage') {
      const value = parseFloat(discountValue);
      if (isNaN(value) || value < 0 || value > 100) {
        toaster.error(t('createFlashPromoScreen.lePourcentageDoitEtreEntre0'));
        return;
      }
    }

    if (discountType === 'fixed') {
      const value = parseFloat(discountValue);
      if (isNaN(value) || value < 0) {
        toaster.error(t('createFlashPromoScreen.leMontantDoitEtrePositif'));
        return;
      }
    }

    if (endsAt <= startsAt) {
      toaster.error(t('createFlashPromoScreen.laDateDeFinDoitEtre'));
      return;
    }

    if (endsAt < new Date()) {
      toaster.error(t('createFlashPromoScreen.laDateDeFinNePeut'));
      return;
    }

    // Si availability inclut "live", vérifier que live_session_id est fourni (optionnel mais recommandé)
    if ((availability === 'live' || availability === 'both') && !liveSessionId.trim()) {
      // Ne pas bloquer, mais avertir
      console.warn('[CreateFlashPromo] Session live non fournie pour availability=', availability);
    }

    setLoading(true);

    try {
      // ✅ CORRIGÉ: Extraire service_id et product_index depuis selectedProductIds
      // Format: "serviceId_productIndex"
      const productIndexesByService: Record<number, number[]> = {};
      selectedProductIds.forEach(productId => {
        const [serviceIdStr, productIndexStr] = productId.split('_');
        const serviceIdNum = parseInt(serviceIdStr, 10);
        const productIndexNum = parseInt(productIndexStr, 10);

        if (!isNaN(serviceIdNum) && !isNaN(productIndexNum)) {
          if (!productIndexesByService[serviceIdNum]) {
            productIndexesByService[serviceIdNum] = [];
          }
          productIndexesByService[serviceIdNum].push(productIndexNum);
        }
      });

      // ✅ CORRIGÉ: Créer une promotion flash pour chaque service avec ses produits sélectionnés
      const promises = Object.entries(productIndexesByService).map(async ([serviceIdStr, productIndexes]) => {
        const serviceIdNum = parseInt(serviceIdStr, 10);
        const payload = {
          service_id: serviceIdNum,
          product_indexes: productIndexes,
          discount_type: discountType,
          discount_value: discountType === 'free' ? null : parseFloat(discountValue),
          title: title.trim(),
          description: description.trim() || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          conditions: conditions.trim() || null,
          availability: availability,
          live_session_id: liveSessionId.trim() || null,
          stock_cap: stockCap.trim() ? parseInt(stockCap) : null,
        };

        return apiPost('/api/flash-promos', payload);
      });

      const responses = await Promise.all(promises);
      const allSuccess = responses.every(r => r.success);

      if (allSuccess) {
        const servicesCount = Object.keys(productIndexesByService).length;
        const productsCount = selectedProductIds.length;
        toaster.success(t('createFlashPromoScreen.promotionFlashCreeeAvecSuccesGratuit', { productsCount: productsCount, productsCount > 1 ? 's' : '': productsCount > 1 ? 's' : '', productsCount > 1 ? 's' : '': productsCount > 1 ? 's' : '' }));
      navigation.goBack();
    } else {
      const failedCount = responses.filter(r => !r.success).length;
      toaster.error(t('createFlashPromoScreen.promotionNaPasPuEtreCreee', { failedCount: failedCount, failedCount___1____s_____: failedCount > 1 ? 's' : '', failedCount___1____ont___: failedCount > 1 ? 'ont' : '', failedCount___1____s_____: failedCount > 1 ? 's' : '' }));
    }
  } catch (error: any) {
    console.error('[CreateFlashPromo] Erreur:', error);
    toaster.error(error.message || t('createFlashPromo.erreurLorsDeLaCreation'));
  } finally {
    setLoading(false);
  }
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

if (loadingProducts) {
  return (
    <View style={[styles.container, { backgroundColor: modernColors.background, justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={modernColors.primary} />
      <Text style={[styles.loadingText, { color: modernColors.textSecondary }]}>{t('createFlashPromo.chargementDesProduits')}</Text>
    </View>
  );
}

return (
  <KeyboardAwareScrollView
    style={[styles.container, { backgroundColor: modernColors.background }]}
    contentContainerStyle={styles.scrollContent}
    showsVerticalScrollIndicator={true}
    enableOnAndroid={true}
    enableAutomaticScroll={true}
    extraHeight={Platform.OS === 'android' ? 200 : 0}
    extraScrollHeight={Platform.OS === 'ios' ? 200 : 0}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="none"
  >
    <View style={styles.content}>
      <Text style={[styles.title, { color: modernColors.text }]}>
        ⚡ Créer un Flash Promotionnel
      </Text>
      <Text style={[styles.subtitle, { color: modernColors.textSecondary }]}>
        Gratuit - Créez une promotion limitée dans le temps pour vos produits
      </Text>

      <NativeCard style={styles.card}>
        <Text style={[styles.label, { color: modernColors.text, fontWeight: '700' }]}>Service</Text>
        <Text style={[styles.value, { color: modernColors.text, fontWeight: '600' }]}>
          {serviceTitle || `Service #${serviceId}`}
        </Text>
      </NativeCard>

      {/* ✅ AMÉLIORÉ: Sélection multiple de produits avec meilleure UX */}
      <NativeCard style={styles.card}>
        <View style={styles.productHeaderRow}>
          <View style={styles.productHeaderTitle}>
            <Text style={[styles.label, { color: modernColors.text, fontWeight: '700', fontSize: 16 }]}>
              Produits à promouvoir *
            </Text>
            {selectedProductIds.length > 0 && (
              <View style={styles.selectionBadge}>
                <Text style={styles.selectionBadgeText}>
                  {selectedProductIds.length} sélectionné{selectedProductIds.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
          {products.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (selectedProductIds.length === products.length) {
                  setSelectedProductIds([]);
                } else {
                  setSelectedProductIds(products.map(p => p.id));
                }
              }}
              style={styles.selectAllButton}
            >
              <Text style={styles.selectAllText}>
                {selectedProductIds.length === products.length ? t('createFlashPromoScreen.toutDeselectionner') : t('createFlashPromoScreen.toutSelectionner')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {loadingProducts ? (
          <View style={styles.loadingProductsContainer}>
            <ActivityIndicator size="small" color={modernColors.primary} />
            <Text style={[styles.loadingProductsText, { color: modernColors.textSecondary }]}>
              Chargement des produits...
            </Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <SafeIcon name="package" size={48} color={modernColors.textSecondary} />
            <Text style={[styles.emptyText, { color: modernColors.textSecondary, marginTop: 12 }]}>
              Aucun produit trouvé
            </Text>
            <Text style={[styles.emptySubtext, { color: modernColors.textSecondary }]}>
              Créez d'abord des produits dans vos services
            </Text>
          </View>
        ) : (
          <View style={styles.productsContainer}>
            {products.map((item) => {
              const isSelected = selectedProductIds.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.productItem,
                    {
                      backgroundColor: isSelected ? modernColors.primary + '15' : modernColors.surface,
                      borderColor: isSelected ? modernColors.primary : modernColors.border,
                      borderWidth: isSelected ? 2 : 1,
                    }
                  ]}
                  onPress={() => toggleProductSelection(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.productCheckbox}>
                    {isSelected && (
                      <SafeIcon name="check" size={18} color="#fff" />
                    )}
                  </View>
                  <View style={styles.productContent}>
                    <View style={styles.productHeader}>
                      <Text style={[styles.productName, { color: modernColors.text, fontWeight: '700' }]} numberOfLines={1}>
                        {item.nom}
                      </Text>
                    </View>
                    {item.serviceTitle && (
                      <Text style={[styles.productService, { color: modernColors.textSecondary }]} numberOfLines={1}>
                        📦 {item.serviceTitle}
                      </Text>
                    )}
                    {item.description && (
                      <Text style={[styles.productDescription, { color: modernColors.textSecondary }]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    {item.prix && item.prix > 0 && (
                      <Text style={[styles.productPrice, { color: modernColors.primary, fontWeight: '700' }]}>
                        {item.prix.toLocaleString()} FCFA
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </NativeCard>

      <View style={styles.inputWrapper}>
        <Text style={[styles.inputLabel, { color: modernColors.text, fontWeight: '700' }]}>
          Titre de la promotion *
        </Text>
        <NativeInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('createFlashPromo.exReductionExceptionnelle50')}
          style={styles.input}
        />
      </View>

      <View style={styles.inputWrapper}>
        <Text style={[styles.inputLabel, { color: modernColors.text, fontWeight: '700' }]}>
          Description (optionnel)
        </Text>
        <NativeInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('createFlashPromo.decrivezVotreOffrePromotionnelle')}
          multiline
          numberOfLines={3}
          style={styles.input}
        />
      </View>

      <NativeCard style={styles.card}>
        <Text style={[styles.label, { color: modernColors.text, fontWeight: '700' }]}>{t('createFlashPromo.typeDeReduction')}</Text>
        <View style={[styles.pickerContainer, { backgroundColor: modernColors.surface, borderWidth: 1, borderColor: modernColors.border }]}>
          <Picker
            selectedValue={discountType}
            onValueChange={(value) => {
              setDiscountType(value);
              if (value === 'free') {
                setDiscountValue('');
              }
            }}
            style={{ color: modernColors.text, fontWeight: '600' }}
            itemStyle={{ color: modernColors.text, fontWeight: '600' }}
          >
            <Picker.Item label="Pourcentage (%)" value="percentage" color={modernColors.text} />
            <Picker.Item label={t('createFlashPromo.montantFixeFcfa')} value="fixed" color={modernColors.text} />
            <Picker.Item label={t('createFlashPromo.gratuit')} value="free" color={modernColors.text} />
          </Picker>
        </View>

        {discountType !== 'free' && (
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: modernColors.text, fontWeight: '700' }]}>
              {discountType === 'percentage' ? 'Pourcentage (%) *' : 'Montant (FCFA) *'}
            </Text>
            <NativeInput
              value={discountValue}
              onChangeText={setDiscountValue}
              placeholder={discountType === 'percentage' ? 'Ex: 50' : 'Ex: 5000'}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        )}
      </NativeCard>

      {/* ✅ NOUVEAU: Disponibilité (online, live, both) */}
      <NativeCard style={styles.card}>
        <Text style={[styles.label, { color: modernColors.text, fontWeight: '700' }]}>{t('createFlashPromo.disponibilite')}</Text>
        <View style={[styles.pickerContainer, { backgroundColor: modernColors.surface, borderWidth: 1, borderColor: modernColors.border }]}>
          <Picker
            selectedValue={availability}
            onValueChange={(value) => {
              setAvailability(value);
              if (value === 'online') {
                setLiveSessionId('');
              }
            }}
            style={{ color: modernColors.text, fontWeight: '600' }}
            itemStyle={{ color: modernColors.text, fontWeight: '600' }}
          >
            <Picker.Item label={t('createFlashPromo.enLigneUniquement')} value="online" color={modernColors.text} />
            <Picker.Item label="📺 Live uniquement" value="live" color={modernColors.text} />
            <Picker.Item label={t('createFlashPromo.enLigneEtLive')} value="both" color={modernColors.text} />
          </Picker>
        </View>
        {(availability === 'live' || availability === 'both') && (
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: modernColors.text, fontWeight: '700' }]}>
              ID Session Live (optionnel)
            </Text>
            <NativeInput
              value={liveSessionId}
              onChangeText={setLiveSessionId}
              placeholder="Ex: uuid-de-la-session-live"
              style={styles.input}
            />
          </View>
        )}
      </NativeCard>

      {/* ✅ NOUVEAU: Limite de stock */}
      <View style={styles.inputWrapper}>
        <Text style={[styles.inputLabel, { color: modernColors.text, fontWeight: '700' }]}>
          Limite de stock (optionnel)
        </Text>
        <NativeInput
          value={stockCap}
          onChangeText={setStockCap}
          placeholder={t('createFlashPromoScreen.exUnitsAvailable')}
          keyboardType="numeric"
          style={styles.input}
        />
      </View>

      <NativeCard style={styles.card}>
        <Text style={[styles.label, { color: modernColors.text, fontWeight: '700' }]}>{t('createFlashPromo.dateDeDebut')}</Text>
        <NativeButton
          title={formatDate(startsAt)}
          onPress={() => setShowStartPicker(true)}
          variant="outline"
          style={styles.dateButton}
        />
        {showStartPicker && (
          <DateTimePicker
            value={startsAt}
            mode="datetime"
            is24Hour={true}
            display="default"
            onChange={((event: any, selectedDate: any) => {
              setShowStartPicker(false);
              if (selectedDate) {
                setStartsAt(selectedDate);
              }
            }) as any}
          />
        )}
      </NativeCard>

      <NativeCard style={styles.card}>
        <Text style={[styles.label, { color: modernColors.text, fontWeight: '700' }]}>{t('createFlashPromo.dateDeFin')}</Text>
        <NativeButton
          title={formatDate(endsAt)}
          onPress={() => setShowEndPicker(true)}
          variant="outline"
          style={styles.dateButton}
        />
        {showEndPicker && (
          <DateTimePicker
            value={endsAt}
            mode="datetime"
            is24Hour={true}
            display="default"
            onChange={((event: any, selectedDate: any) => {
              setShowEndPicker(false);
              if (selectedDate) {
                setEndsAt(selectedDate);
              }
            }) as any}
          />
        )}
      </NativeCard>

      <View style={styles.inputWrapper}>
        <Text style={[styles.inputLabel, { color: modernColors.text, fontWeight: '700' }]}>
          Conditions (optionnel)
        </Text>
        <NativeInput
          value={conditions}
          onChangeText={setConditions}
          placeholder="Ex: Valable uniquement en magasin, minimum d'achat 10000 FCFA"
          multiline
          numberOfLines={2}
          style={styles.input}
        />
      </View>

      <View style={styles.buttonContainer}>
        <NativeButton
          title={t('createFlashPromoScreen.annuler')}
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.button}
        />
        <NativeButton
          title={loading ? t('createFlashPromoScreen.creation') : t('createFlashPromoScreen.creerGratuit')}
          onPress={handleCreate}
          variant="primary"
          style={styles.button}
          disabled={loading}
        />
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={modernColors.primary} />
        </View>
      )}
    </View>
  </KeyboardAwareScrollView>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'android' ? 100 : 80,
    flexGrow: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
    color: modernColors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 32,
    lineHeight: 22,
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
  card: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
    color: modernColors.text, // ✅ CORRIGÉ: Couleur de texte visible
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    color: modernColors.text, // ✅ CORRIGÉ: Couleur de texte visible
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  input: {
    marginBottom: 0,
  },
  pickerContainer: {
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
    minHeight: 50,
    justifyContent: 'center',
  },
  dateButton: {
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 32,
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 50,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
    color: modernColors.textSecondary, // ✅ CORRIGÉ: Couleur de texte visible
  },
  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  productHeaderTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionBadge: {
    backgroundColor: modernColors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: modernColors.primary,
  },
  selectAllButton: {
    backgroundColor: modernColors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: modernColors.primary,
  },
  loadingProductsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingProductsText: {
    fontSize: 14,
  },
  emptyStateContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptySubtext: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  productsContainer: {
    gap: 12,
  },
  productItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  productCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: modernColors.primary,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  productContent: {
    flex: 1,
  },
  productHeader: {
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: modernColors.text,
  },
  productService: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 6,
  },
  productDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    color: modernColors.textSecondary,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.3,
    color: modernColors.primary,
  },
});

export default CreateFlashPromoScreen;
