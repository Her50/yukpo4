// MarketplaceScreen.tsx
// Marketplace cross-partenaires Yukpo — découvrir et publier des produits entre boutiques

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchWithAuth } from '../../services/api';

interface Listing {
  id: number;
  service_id: number;
  shop_name: string;
  title: string;
  description: string | null;
  price: string;
  sale_price: string | null;
  category: string | null;
  image_url: string | null;
  region: string;
  views: number;
  orders: number;
}

const REGIONS = [
  { key: 'CM', label: '🇨🇲 Cameroun' },
  { key: 'SN', label: '🇸🇳 Sénégal' },
  { key: 'CI', label: '🇨🇮 Côte d\'Ivoire' },
  { key: 'NG', label: '🇳🇬 Nigeria' },
  { key: 'ALL', label: '🌍 Tout' },
];

const CATEGORIES = [
  'Alimentation', 'Mode', 'Beauté', 'Électronique',
  'Maison', 'Santé', 'Services', 'Éducation',
];

export default function MarketplaceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const serviceId: number = route.params?.service_id ?? 0;

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [region, setRegion] = useState('CM');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'publish'>('discover');

  // Publier
  const [showPublish, setShowPublish] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubDescription, setPubDescription] = useState('');
  const [pubPrice, setPubPrice] = useState('');
  const [pubCategory, setPubCategory] = useState('');
  const [pubRegion, setPubRegion] = useState('CM');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ region });
      if (selectedCategory) params.append('category', selectedCategory);
      if (search.trim()) params.append('q', search.trim());
      params.append('limit', '50');

      const res = await fetchWithAuth(`/api/social-ai/marketplace/discover?${params}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings ?? []);
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [region, selectedCategory, search]);

  useEffect(() => { load(); }, [load]);

  const publishListing = async () => {
    if (!pubTitle.trim() || !pubPrice.trim()) return;
    setPublishing(true);
    try {
      const res = await fetchWithAuth('/api/social-ai/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          title: pubTitle,
          description: pubDescription || null,
          price: parseInt(pubPrice, 10),
          category: pubCategory || null,
          region: pubRegion,
        }),
      });
      if (res.ok) {
        setShowPublish(false);
        setPubTitle('');
        setPubDescription('');
        setPubPrice('');
        setActiveTab('discover');
        load();
      }
    } catch (_) {
    } finally {
      setPublishing(false);
    }
  };

  const formatPrice = (price: string, salePrice: string | null) => {
    const p = parseInt(price, 10);
    if (salePrice) {
      const sp = parseInt(salePrice, 10);
      return `${sp.toLocaleString()} FCFA`;
    }
    return `${p.toLocaleString()} FCFA`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketplace Yukpo</Text>
        <TouchableOpacity style={styles.publishBtn} onPress={() => setShowPublish(true)}>
          <Text style={styles.publishBtnText}>+ Publier</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Découvrir
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'publish' && styles.tabActive]}
          onPress={() => setActiveTab('publish')}
        >
          <Text style={[styles.tabText, activeTab === 'publish' && styles.tabTextActive]}>
            Mes annonces
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtres région */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
        {REGIONS.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[styles.regionBtn, region === r.key && styles.regionBtnActive]}
            onPress={() => setRegion(r.key)}
          >
            <Text style={[styles.regionText, region === r.key && styles.regionTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filtres catégories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity
          style={[styles.categoryBtn, !selectedCategory && styles.categoryBtnActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
            Tout
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.categoryBtn, selectedCategory === c && styles.categoryBtnActive]}
            onPress={() => setSelectedCategory(selectedCategory === c ? null : c)}
          >
            <Text style={[styles.categoryText, selectedCategory === c && styles.categoryTextActive]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recherche */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un produit…"
          placeholderTextColor="#666"
          returnKeyType="search"
          onSubmitEditing={load}
        />
      </View>

      {/* Liste */}
      {loading && listings.length === 0 ? (
        <ActivityIndicator color="#6C5CE7" size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Grille 2 colonnes */}
          <View style={styles.grid}>
            {listings.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏪</Text>
                <Text style={styles.emptyTitle}>Aucun produit trouvé</Text>
                <Text style={styles.emptyText}>
                  Soyez le premier à publier dans cette région !
                </Text>
              </View>
            ) : (
              listings.map(l => (
                <View key={l.id} style={styles.productCard}>
                  <View style={styles.productImageContainer}>
                    {l.image_url ? (
                      <Image source={{ uri: l.image_url }} style={styles.productImage} />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Text style={styles.productImageIcon}>🛍️</Text>
                      </View>
                    )}
                    {l.sale_price && (
                      <View style={styles.saleBadge}>
                        <Text style={styles.saleBadgeText}>PROMO</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={2}>{l.title}</Text>
                    <Text style={styles.productShop} numberOfLines={1}>{l.shop_name}</Text>
                    <Text style={styles.productPrice}>{formatPrice(l.price, l.sale_price)}</Text>
                    <View style={styles.productMeta}>
                      {l.category && (
                        <Text style={styles.productCategory}>{l.category}</Text>
                      )}
                      <Text style={styles.productOrders}>{l.orders} ventes</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Modal publication */}
      <Modal
        visible={showPublish}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPublish(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Publier sur la Marketplace</Text>

              <Text style={styles.fieldLabel}>Titre du produit *</Text>
              <TextInput
                style={styles.input}
                value={pubTitle}
                onChangeText={setPubTitle}
                placeholder="Ex: Sac à main cuir véritable"
                placeholderTextColor="#666"
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={pubDescription}
                onChangeText={setPubDescription}
                placeholder="Décrivez votre produit…"
                placeholderTextColor="#666"
                multiline
              />

              <Text style={styles.fieldLabel}>Prix (FCFA) *</Text>
              <TextInput
                style={styles.input}
                value={pubPrice}
                onChangeText={setPubPrice}
                placeholder="Ex: 15000"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryBtn, pubCategory === c && styles.categoryBtnActive]}
                    onPress={() => setPubCategory(pubCategory === c ? '' : c)}
                  >
                    <Text style={[styles.categoryText, pubCategory === c && styles.categoryTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Région</Text>
              <View style={styles.regionPicker}>
                {REGIONS.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.regionPickerBtn, pubRegion === r.key && styles.regionPickerBtnActive]}
                    onPress={() => setPubRegion(r.key)}
                  >
                    <Text style={[styles.regionPickerText, pubRegion === r.key && styles.regionPickerTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, (!pubTitle.trim() || !pubPrice.trim() || publishing) && styles.btnDisabled]}
                onPress={publishListing}
                disabled={!pubTitle.trim() || !pubPrice.trim() || publishing}
              >
                {publishing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Publier maintenant</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnClose} onPress={() => setShowPublish(false)}>
                <Text style={styles.btnCloseText}>Annuler</Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const BG = '#0F0F1A';
const CARD = '#1E1E2E';
const CARD2 = '#2A2A3E';
const TEXT = '#FFFFFF';
const MUTED = '#888';
const PRIMARY = '#6C5CE7';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  backText: { color: TEXT, fontSize: 22 },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },
  publishBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  publishBtnText: { color: TEXT, fontSize: 13, fontWeight: '700' },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: PRIMARY },
  tabText: { color: MUTED, fontSize: 14 },
  tabTextActive: { color: TEXT, fontWeight: '700' },

  regionScroll: { paddingLeft: 16, marginBottom: 8, maxHeight: 42 },
  regionBtn: {
    backgroundColor: CARD,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  regionBtnActive: { borderColor: PRIMARY },
  regionText: { color: MUTED, fontSize: 12 },
  regionTextActive: { color: TEXT, fontWeight: '600' },

  categoryScroll: { paddingLeft: 16, marginBottom: 8, maxHeight: 38 },
  categoryBtn: {
    backgroundColor: CARD2,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryBtnActive: { backgroundColor: PRIMARY + '33', borderColor: PRIMARY },
  categoryText: { color: MUTED, fontSize: 12 },
  categoryTextActive: { color: PRIMARY, fontWeight: '600' },

  searchRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 11,
    color: TEXT,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },

  listContainer: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },

  productCard: {
    width: '47%',
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: 'hidden',
  },
  productImageContainer: { position: 'relative' },
  productImage: { width: '100%', height: 140, resizeMode: 'cover' },
  productImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: CARD2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageIcon: { fontSize: 40 },
  saleBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF4444',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  saleBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  productInfo: { padding: 10 },
  productTitle: { color: TEXT, fontSize: 13, fontWeight: '600', marginBottom: 3, lineHeight: 18 },
  productShop: { color: MUTED, fontSize: 10, marginBottom: 6 },
  productPrice: { color: '#00C851', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productCategory: {
    color: PRIMARY,
    fontSize: 9,
    backgroundColor: PRIMARY + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  productOrders: { color: MUTED, fontSize: 9 },

  empty: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: MUTED, fontSize: 13, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#444',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 20 },
  fieldLabel: { color: TEXT, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: CARD2,
    borderRadius: 10,
    padding: 12,
    color: TEXT,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  regionPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  regionPickerBtn: {
    backgroundColor: CARD2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  regionPickerBtnActive: { borderColor: PRIMARY },
  regionPickerText: { color: MUTED, fontSize: 12 },
  regionPickerTextActive: { color: TEXT, fontWeight: '600' },

  btnPrimary: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  btnPrimaryText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  btnClose: { padding: 14, alignItems: 'center' },
  btnCloseText: { color: MUTED, fontSize: 14 },
});
