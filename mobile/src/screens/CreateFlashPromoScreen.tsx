// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { NativeButton } from '../components/SafeNativeDesign';
import { NativeInput } from '../components/SafeNativeDesign';
import { NativeCard } from '../components/SafeNativeDesign';
import { apiPost, apiGet } from '../services/api';
import { useToaster } from '../components/ToasterProvider';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import SafeIcon from '../components/SafeIcon';

interface RouteParams {
  serviceId: number;
  serviceData?: any;
  serviceTitle?: string;
  productIndex?: number; // Pour pré-sélection si un seul produit
}

interface Product {
  index: number;
  nom: string;
  description?: string;
  prix?: number;
}

const CreateFlashPromoScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { colors } = useTheme();
  const toaster = useToaster();
  
  const params = (route.params || {}) as RouteParams;
  const { serviceId, serviceData, serviceTitle, productIndex } = params;

  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIndexes, setSelectedProductIndexes] = useState<number[]>([]);
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

  // Pré-sélectionner le produit si productIndex est fourni
  useEffect(() => {
    if (productIndex !== undefined && products.length > 0) {
      setSelectedProductIndexes([productIndex]);
    }
  }, [productIndex, products]);

  // Pré-remplir le titre si disponible
  useEffect(() => {
    if (serviceTitle) {
      setTitle(`Flash Promo - ${serviceTitle}`);
    }
  }, [serviceTitle]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      
      // Si serviceData est fourni, extraire les produits
      if (serviceData?.produits) {
        const produits = serviceData.produits.valeur || serviceData.produits || [];
        const productsList: Product[] = [];
        
        if (Array.isArray(produits)) {
          produits.forEach((prod: any, index: number) => {
            const nom = typeof prod === 'string' 
              ? prod.split(',')[0] 
              : prod.nom || prod.data?.nom || prod.nom_produit || `Produit ${index + 1}`;
            const description = typeof prod === 'string' 
              ? prod.split(',')[1] 
              : prod.description || prod.data?.description || '';
            const prix = typeof prod === 'object' 
              ? (prod.prix || prod.data?.prix || prod.prix_produit || 0)
              : 0;
            
            productsList.push({ index, nom, description, prix });
          });
        }
        
        setProducts(productsList);
      } else {
        // Sinon, charger depuis l'API
        const response = await apiGet(`/api/prestataire/services`);
        if (response.success && Array.isArray(response.data)) {
          const service = response.data.find((s: any) => s.id === serviceId);
          if (service?.data?.produits) {
            const produits = service.data.produits.valeur || service.data.produits || [];
            const productsList: Product[] = [];
            
            if (Array.isArray(produits)) {
              produits.forEach((prod: any, index: number) => {
                const nom = typeof prod === 'string' 
                  ? prod.split(',')[0] 
                  : prod.nom || prod.data?.nom || prod.nom_produit || `Produit ${index + 1}`;
                const description = typeof prod === 'string' 
                  ? prod.split(',')[1] 
                  : prod.description || prod.data?.description || '';
                const prix = typeof prod === 'object' 
                  ? (prod.prix || prod.data?.prix || prod.prix_produit || 0)
                  : 0;
                
                productsList.push({ index, nom, description, prix });
              });
            }
            
            setProducts(productsList);
          }
        }
      }
    } catch (error: any) {
      console.error('[CreateFlashPromo] Erreur chargement produits:', error);
      toaster.error('Erreur lors du chargement des produits');
    } finally {
      setLoadingProducts(false);
    }
  };

  const toggleProductSelection = (index: number) => {
    setSelectedProductIndexes(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleCreate = async () => {
    // Validation
    if (!title.trim()) {
      toaster.error('Veuillez saisir un titre');
      return;
    }

    if (selectedProductIndexes.length === 0) {
      toaster.error('Veuillez sélectionner au moins un produit');
      return;
    }

    if (discountType !== 'free' && !discountValue.trim()) {
      toaster.error('Veuillez saisir une valeur de réduction');
      return;
    }

    if (discountType === 'percentage') {
      const value = parseFloat(discountValue);
      if (isNaN(value) || value < 0 || value > 100) {
        toaster.error('Le pourcentage doit être entre 0 et 100');
        return;
      }
    }

    if (discountType === 'fixed') {
      const value = parseFloat(discountValue);
      if (isNaN(value) || value < 0) {
        toaster.error('Le montant doit être positif');
        return;
      }
    }

    if (endsAt <= startsAt) {
      toaster.error('La date de fin doit être postérieure à la date de début');
      return;
    }

    if (endsAt < new Date()) {
      toaster.error('La date de fin ne peut pas être dans le passé');
      return;
    }

    // Si availability inclut "live", vérifier que live_session_id est fourni (optionnel mais recommandé)
    if ((availability === 'live' || availability === 'both') && !liveSessionId.trim()) {
      // Ne pas bloquer, mais avertir
      console.warn('[CreateFlashPromo] Session live non fournie pour availability=', availability);
    }

    setLoading(true);

    try {
      const payload = {
        service_id: serviceId,
        product_indexes: selectedProductIndexes, // ✅ NOUVEAU: Liste de produits
        discount_type: discountType,
        discount_value: discountType === 'free' ? null : parseFloat(discountValue),
        title: title.trim(),
        description: description.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        conditions: conditions.trim() || null,
        availability: availability, // ✅ NOUVEAU: online, live, both
        live_session_id: liveSessionId.trim() || null, // ✅ NOUVEAU: Session live optionnelle
        stock_cap: stockCap.trim() ? parseInt(stockCap) : null, // ✅ NOUVEAU: Limite de stock
      };

      const response = await apiPost('/api/flash-promos', payload);

      if (response.success) {
        toaster.success('⚡ Flash promotionnel créé avec succès (gratuit) !');
        navigation.goBack();
      } else {
        toaster.error(response.error || 'Erreur lors de la création');
      }
    } catch (error: any) {
      console.error('[CreateFlashPromo] Erreur:', error);
      toaster.error(error.message || 'Erreur lors de la création du flash promotionnel');
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
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Chargement des produits...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          ⚡ Créer un Flash Promotionnel
        </Text>
        <Text style={[styles.subtitle, { color: colors.text, opacity: 0.85 }]}>
          Gratuit - Créez une promotion limitée dans le temps pour vos produits
        </Text>

        <NativeCard style={styles.card}>
          <Text style={[styles.label, { color: colors.text, fontWeight: '700' }]}>Service</Text>
          <Text style={[styles.value, { color: colors.text, fontWeight: '600' }]}>
            {serviceTitle || `Service #${serviceId}`}
          </Text>
        </NativeCard>

        {/* ✅ NOUVEAU: Sélection multiple de produits */}
        <NativeCard style={styles.card}>
          <View style={styles.productHeaderRow}>
            <Text style={[styles.label, { color: colors.text, fontWeight: '700' }]}>
              Produits à promouvoir * {selectedProductIndexes.length > 0 && `(${selectedProductIndexes.length} sélectionné${selectedProductIndexes.length > 1 ? 's' : ''})`}
            </Text>
            {products.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  if (selectedProductIndexes.length === products.length) {
                    setSelectedProductIndexes([]);
                  } else {
                    setSelectedProductIndexes(products.map(p => p.index));
                  }
                }}
                style={[styles.selectAllButton, { backgroundColor: colors.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}
              >
                <Text style={[styles.selectAllText, { color: colors.primary, fontWeight: '700' }]}>
                  {selectedProductIndexes.length === products.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {products.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.text, opacity: 0.7 }]}>
              Aucun produit trouvé dans ce service
            </Text>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item.index.toString()}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isSelected = selectedProductIndexes.includes(item.index);
                return (
                  <TouchableOpacity
                    style={[
                      styles.productItem,
                      { 
                        backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }
                    ]}
                    onPress={() => toggleProductSelection(item.index)}
                  >
                    <View style={styles.productContent}>
                      <View style={styles.productHeader}>
                        <SafeIcon name={isSelected ? 'check-circle' : 'circle'} size={22} color={isSelected ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.productName, { color: colors.text, fontWeight: '700' }]}>
                          {item.nom}
                        </Text>
                      </View>
                      {item.description && (
                        <Text style={[styles.productDescription, { color: colors.text, opacity: 0.8 }]} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                      {item.prix && item.prix > 0 && (
                        <Text style={[styles.productPrice, { color: colors.primary, fontWeight: '700' }]}>
                          {item.prix.toLocaleString()} FCFA
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </NativeCard>

        <NativeInput
          label="Titre de la promotion *"
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Réduction exceptionnelle -50%"
          style={styles.input}
        />

        <NativeInput
          label="Description (optionnel)"
          value={description}
          onChangeText={setDescription}
          placeholder="Décrivez votre offre promotionnelle"
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        <NativeCard style={styles.card}>
          <Text style={[styles.label, { color: colors.text, fontWeight: '700' }]}>Type de réduction *</Text>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
            <Picker
              selectedValue={discountType}
              onValueChange={(value) => {
                setDiscountType(value);
                if (value === 'free') {
                  setDiscountValue('');
                }
              }}
              style={{ color: colors.text, fontWeight: '600' }}
              itemStyle={{ color: colors.text, fontWeight: '600' }}
            >
              <Picker.Item label="Pourcentage (%)" value="percentage" color={colors.text} />
              <Picker.Item label="Montant fixe (FCFA)" value="fixed" color={colors.text} />
              <Picker.Item label="Gratuit" value="free" color={colors.text} />
            </Picker>
          </View>

          {discountType !== 'free' && (
            <NativeInput
              label={discountType === 'percentage' ? 'Pourcentage (%) *' : 'Montant (FCFA) *'}
              value={discountValue}
              onChangeText={setDiscountValue}
              placeholder={discountType === 'percentage' ? 'Ex: 50' : 'Ex: 5000'}
              keyboardType="numeric"
              style={styles.input}
            />
          )}
        </NativeCard>

        {/* ✅ NOUVEAU: Disponibilité (online, live, both) */}
        <NativeCard style={styles.card}>
          <Text style={[styles.label, { color: colors.text, fontWeight: '700' }]}>Disponibilité *</Text>
          <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
            <Picker
              selectedValue={availability}
              onValueChange={(value) => {
                setAvailability(value);
                if (value === 'online') {
                  setLiveSessionId('');
                }
              }}
              style={{ color: colors.text, fontWeight: '600' }}
              itemStyle={{ color: colors.text, fontWeight: '600' }}
            >
              <Picker.Item label="📱 En ligne uniquement" value="online" color={colors.text} />
              <Picker.Item label="📺 Live uniquement" value="live" color={colors.text} />
              <Picker.Item label="📱📺 En ligne et Live" value="both" color={colors.text} />
            </Picker>
          </View>
          {(availability === 'live' || availability === 'both') && (
            <NativeInput
              label="ID Session Live (optionnel)"
              value={liveSessionId}
              onChangeText={setLiveSessionId}
              placeholder="Ex: uuid-de-la-session-live"
              style={styles.input}
            />
          )}
        </NativeCard>

        {/* ✅ NOUVEAU: Limite de stock */}
        <NativeInput
          label="Limite de stock (optionnel)"
          value={stockCap}
          onChangeText={setStockCap}
          placeholder="Ex: 50 (nombre d'unités disponibles)"
          keyboardType="numeric"
          style={styles.input}
        />

        <NativeCard style={styles.card}>
          <Text style={[styles.label, { color: colors.text, fontWeight: '700' }]}>Date de début *</Text>
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
              onChange={(event, selectedDate) => {
                setShowStartPicker(false);
                if (selectedDate) {
                  setStartsAt(selectedDate);
                }
              }}
            />
          )}
        </NativeCard>

        <NativeCard style={styles.card}>
          <Text style={[styles.label, { color: colors.text, fontWeight: '700' }]}>Date de fin *</Text>
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
              onChange={(event, selectedDate) => {
                setShowEndPicker(false);
                if (selectedDate) {
                  setEndsAt(selectedDate);
                }
              }}
            />
          )}
        </NativeCard>

        <NativeInput
          label="Conditions (optionnel)"
          value={conditions}
          onChangeText={setConditions}
          placeholder="Ex: Valable uniquement en magasin, minimum d'achat 10000 FCFA"
          multiline
          numberOfLines={2}
          style={styles.input}
        />

        <View style={styles.buttonContainer}>
          <NativeButton
            title="Annuler"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.button}
          />
          <NativeButton
            title={loading ? 'Création...' : '⚡ Créer (Gratuit)'}
            onPress={handleCreate}
            variant="primary"
            style={styles.button}
            disabled={loading}
          />
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
    opacity: 0.9,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  input: {
    marginBottom: 16,
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
    marginTop: 24,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
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
  },
  productItem: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productContent: {
    flex: 1,
  },
  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllButton: {
    padding: 4,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
    flex: 1,
    letterSpacing: 0.2,
  },
  productDescription: {
    fontSize: 13,
    marginLeft: 32,
    marginTop: 6,
    lineHeight: 18,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 32,
    marginTop: 6,
    letterSpacing: 0.3,
  },
});

export default CreateFlashPromoScreen;
