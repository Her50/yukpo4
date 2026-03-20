// ✅ NOUVEAU 2026-03-11: Écran utilisateur dédié Hôtel / Meublé
// Liste : recherche texte, ville, chambres min, budget max, standing, GPS ~50 km ; dates & occupants → HotelBooking
// Distinct de l'écran Immobilier générique

import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import IntelligentChat from '../../components/IntelligentChat';
import IntelligentChatFab from '../../components/IntelligentChatFab';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { immobilierService, PropertySearchFilters, RealEstateProperty } from '../../services/immobilierService';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import { hapticPress } from '../../utils/hapticFeedback';

const HotelMeubleHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    // Standings hôteliers (inside component so t() is available)
    const STANDINGS = [
        { id: 'all', label: t('hotelMeubleHome.tous'), icon: 'list' },
        { id: 'Économique', label: t('hotelMeubleHome.economique'), icon: 'wallet' },
        { id: 'Standard', label: t('hotelMeubleHome.standard'), icon: 'home' },
        { id: 'Bon standing', label: t('hotelMeubleHome.confort'), icon: 'star' },
        { id: 'Haut standing', label: t('hotelMeubleHome.premium'), icon: 'award' },
        { id: 'Luxe / Prestige', label: t('hotelMeubleHome.luxe'), icon: 'gem' },
    ];

    const routeParams = (route.params as any) || {};
    // 'hotel' ou 'meuble' selon la route
    const mode: 'hotel' | 'meuble' = routeParams.mode || routeParams.initialFilter?.type_bien || 'hotel';

    const isHotel = mode === 'hotel';
    const screenTitle = isHotel ? t('hotelMeubleHomeScreen.hotels') : t('hotelMeubleHomeScreen.meubles');
    const screenSubtitle = isHotel ? t('hotelMeubleHomeScreen.hebergementIdeal') : t('hotelMeubleHomeScreen.locationsMeubleesDisponibles');
    const gradientColors: [string, string] = isHotel ? ['#1E3A5F', '#2563EB'] : ['#7C3AED', '#A855F7'];
    const accentColor = isHotel ? '#2563EB' : '#8B5CF6';

    const navigationRouteName = (route as { name?: string }).name || 'HotelMeubleHome';
    const chatScreenName = navigationRouteName;

    const devise = getCurrencyIntelligently() || 'FCFA';
    const [showChat, setShowChat] = useState(false);

    // Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [properties, setProperties] = useState<RealEstateProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);

    // Filters
    const [activeStanding, setActiveStanding] = useState('all');
    const [prixMax, setPrixMax] = useState('');
    const [nbChambresMin, setNbChambresMin] = useState('');
    const [villeFilter, setVilleFilter] = useState('');

    // Load properties
    const loadProperties = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setLoading(true);
            setError(null);

            const filters: PropertySearchFilters = {
                type_bien: mode,
                limit: 20,
                page: 1,
            };

            if (location?.coords) {
                filters.lat = location.coords.latitude;
                filters.lng = location.coords.longitude;
                filters.max_distance_km = 50;
            }

            if (searchQuery.trim()) {
                (filters as any).query = searchQuery.trim();
            }
            if (villeFilter.trim()) {
                filters.ville = villeFilter.trim();
            }
            if (activeStanding !== 'all') {
                filters.standing = activeStanding;
            }
            if (prixMax.trim()) {
                filters.prix_max = parseInt(prixMax) || undefined;
            }
            if (nbChambresMin.trim()) {
                filters.nb_chambres_min = parseInt(nbChambresMin) || undefined;
            }

            const response = await immobilierService.searchProperties(filters);
            const resData = (response?.data || response) as any;

            if (resData?.success && Array.isArray(resData?.data)) {
                setProperties(resData.data);
                setTotalResults(resData.total || resData.data.length);
            } else if (Array.isArray(resData)) {
                setProperties(resData);
                setTotalResults(resData.length);
            } else {
                setProperties([]);
                setTotalResults(0);
            }
        } catch (err: any) {
            console.error('[HotelMeubleHome] Erreur:', err);
            setError(t('hotelMeubleHome.impossibleDeChargerLesHebergements'));
            setProperties([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [mode, searchQuery, villeFilter, activeStanding, prixMax, nbChambresMin, location]);

    useEffect(() => { loadProperties(); }, [loadProperties]);

    const handleSearch = () => {
        hapticPress();
        loadProperties();
    };

    const formatPrice = (property: RealEstateProperty) => {
        const price = property.prix_location_mensuel || property.prix_vente || 0;
        if (price === 0) return t('hotelMeubleHome.prixSurDemande');
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M ${devise}`;
        if (price >= 1000) return `${Math.round(price / 1000)}K ${devise}`;
        return `${price.toLocaleString()} ${devise}`;
    };

    const getPriceLabel = (property: RealEstateProperty) => {
        if (property.prix_location_mensuel) return `/${t('hotelMeubleHome.nuit')}`;
        if (property.prix_vente) return '';
        return '';
    };

    const navigateToDetails = (property: RealEstateProperty) => {
        hapticPress();
        (navigation as any).navigate('ImmobilierDetails', { propertyId: property.id });
    };

    const navigateToBooking = (property: RealEstateProperty) => {
        hapticPress();
        (navigation as any).navigate('HotelBooking', {
            propertyId: property.id,
            propertyName: property.titre,
            typeBien: property.type_bien,
            prixNuitee: property.prix_location_mensuel || 0,
            ville: property.ville || '',
        });
    };

    // Property card
    const renderProperty = ({ item }: { item: RealEstateProperty }) => (
        <TouchableOpacity
            style={s.propertyCard}
            onPress={() => navigateToDetails(item)}
            activeOpacity={0.7}
        >
            {/* Photo placeholder */}
            <View style={[s.photoPlaceholder, { backgroundColor: accentColor + '15' }]}>
                <SafeIcon
                    name={isHotel ? 'building' : 'home'}
                    size={32}
                    color={accentColor}
                    type="lucide"
                />
                {item.is_available_now && (
                    <View style={s.availableBadge}>
                        <Text style={s.availableBadgeText}>{t('hotelMeubleHome.disponible')}</Text>
                    </View>
                )}
            </View>

            {/* Info */}
            <View style={s.propertyInfo}>
                <Text style={s.propertyTitle} numberOfLines={2}>{item.titre}</Text>

                <View style={s.propertyMeta}>
                    {item.ville && (
                        <View style={s.metaItem}>
                            <SafeIcon name="map-pin" size={13} color="#6B7280" type="lucide" />
                            <Text style={s.metaText} numberOfLines={1}>
                                {item.quartier ? `${item.quartier}, ${item.ville}` : item.ville}
                            </Text>
                        </View>
                    )}
                    {item.nb_chambres != null && (
                        <View style={s.metaItem}>
                            <SafeIcon name="bed-double" size={13} color="#6B7280" type="lucide" />
                            <Text style={s.metaText}>{item.nb_chambres} {item.nb_chambres > 1 ? t('hotelMeubleHome.chambres') : t('hotelMeubleHome.chambre')}</Text>
                        </View>
                    )}
                    {item.standing && (
                        <View style={s.metaItem}>
                            <SafeIcon name="star" size={13} color="#F59E0B" type="lucide" />
                            <Text style={s.metaText}>{item.standing}</Text>
                        </View>
                    )}
                    {item.distance_km != null && (
                        <View style={s.metaItem}>
                            <SafeIcon name="navigation" size={13} color="#6B7280" type="lucide" />
                            <Text style={s.metaText}>{item.distance_km.toFixed(1)} km</Text>
                        </View>
                    )}
                </View>

                {/* Price + CTA */}
                <View style={s.propertyFooter}>
                    <View>
                        <Text style={[s.propertyPrice, { color: accentColor }]}>
                            {formatPrice(item)}
                            <Text style={s.priceLabel}>{getPriceLabel(item)}</Text>
                        </Text>
                        {item.average_rating != null && item.average_rating > 0 && (
                            <View style={s.ratingRow}>
                                <SafeIcon name="star" size={12} color="#F59E0B" type="lucide" />
                                <Text style={s.ratingText}>{item.average_rating.toFixed(1)}</Text>
                                {item.total_ratings != null && (
                                    <Text style={s.ratingCount}>({item.total_ratings})</Text>
                                )}
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        style={[s.bookBtn, { backgroundColor: accentColor }]}
                        onPress={() => navigateToBooking(item)}
                    >
                        <SafeIcon name="calendar" size={14} color="#FFF" type="lucide" />
                        <Text style={s.bookBtnText}>{t('hotelMeubleHome.reserver')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeNativeView style={s.container}>
            {/* Header */}
            <LinearGradient colors={gradientColors} style={s.header}>
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={s.headerTitleWrap}>
                        <Text style={s.headerTitle}>{screenTitle}</Text>
                        {totalResults > 0 && (
                            <Text style={s.headerSubtitle}>
                                {totalResults} {totalResults > 1 ? t('hotelMeubleHome.hebergements') : t('hotelMeubleHome.hebergement')} {t('hotelMeubleHome.disponible').toLowerCase()}{totalResults > 1 ? 's' : ''}
                            </Text>
                        )}
                        {totalResults === 0 && !loading && (
                            <Text style={s.headerSubtitle}>{screenSubtitle}</Text>
                        )}
                    </View>
                </View>

                {/* Search bar */}
                <View style={s.searchBar}>
                    <SafeIcon name="search" size={18} color="#9CA3AF" type="lucide" />
                    <TextInput
                        style={s.searchInput}
                        placeholder={t('hotelMeubleHomeScreen.rechercherUn', { type: isHotel ? t('hotelMeubleHomeScreen.hotel') : t('hotelMeubleHomeScreen.meuble') })}
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchQuery(''); }} style={s.clearBtn}>
                            <SafeIcon name="x" size={16} color="#9CA3AF" type="lucide" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Quick filters row: ville + chambres */}
                <View style={s.quickFilterRow}>
                    <View style={s.quickFilterItem}>
                        <SafeIcon name="map-pin" size={14} color="#FFFFFFCC" type="lucide" />
                        <TextInput
                            style={s.quickFilterInput}
                            placeholder={t('hotelMeubleHomeScreen.ville')}
                            placeholderTextColor="#FFFFFF88"
                            value={villeFilter}
                            onChangeText={setVilleFilter}
                            onSubmitEditing={handleSearch}
                        />
                    </View>
                    <View style={s.quickFilterItem}>
                        <SafeIcon name="bed" size={14} color="#FFFFFFCC" type="lucide" />
                        <TextInput
                            style={s.quickFilterInput}
                            placeholder={t('hotelDashboard.chambres')}
                            placeholderTextColor="#FFFFFF88"
                            value={nbChambresMin}
                            onChangeText={setNbChambresMin}
                            onSubmitEditing={handleSearch}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={s.quickFilterItem}>
                        <SafeIcon name="wallet" size={14} color="#FFFFFFCC" type="lucide" />
                        <TextInput
                            style={s.quickFilterInput}
                            placeholder={t('hotelMeubleHome.budgetMax')}
                            placeholderTextColor="#FFFFFF88"
                            value={prixMax}
                            onChangeText={setPrixMax}
                            onSubmitEditing={handleSearch}
                            keyboardType="numeric"
                        />
                    </View>
                </View>
            </LinearGradient>

            {/* Standings filter chips */}
            <View style={s.standingsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.standingsScroll}
                >
                    {STANDINGS.map(st => (
                        <TouchableOpacity
                            key={st.id}
                            style={[
                                s.standingChip,
                                activeStanding === st.id && { backgroundColor: accentColor }
                            ]}
                            onPress={() => {
                                hapticPress();
                                setActiveStanding(st.id);
                            }}
                        >
                            <SafeIcon
                                name={st.icon}
                                size={14}
                                color={activeStanding === st.id ? '#FFF' : '#6B7280'}
                                type="lucide"
                            />
                            <Text style={[
                                s.standingChipText,
                                activeStanding === st.id && { color: '#FFF' }
                            ]}>
                                {st.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Content */}
            <View style={s.content}>
                {loading && properties.length === 0 ? (
                    <View style={s.centerContainer}>
                        <ActivityIndicator size="large" color={accentColor} />
                        <Text style={s.loadingText}>{t('hotelMeubleHome.rechercheDhebergements')}</Text>
                    </View>
                ) : error && properties.length === 0 ? (
                    <View style={s.centerContainer}>
                        <SafeIcon name={isHotel ? 'building' : 'home'} size={64} color="#D1D5DB" type="lucide" />
                        <Text style={s.errorText}>{error}</Text>
                        <TouchableOpacity style={[s.retryBtn, { backgroundColor: accentColor }]} onPress={() => loadProperties()}>
                            <Text style={s.retryBtnText}>{t('hotelMeubleHome.reessayer')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={properties}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderProperty}
                        contentContainerStyle={s.listContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => { setRefreshing(true); loadProperties(true); }}
                                colors={[accentColor]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={s.emptyContainer}>
                                <SafeIcon name={isHotel ? 'building' : 'home'} size={64} color="#D1D5DB" type="lucide" />
                                <Text style={s.emptyTitle}>{t('hotelMeubleHome.aucunTrouve', { type: isHotel ? t('hotelMeubleHomeScreen.hotel') : t('hotelMeubleHomeScreen.meuble') })}</Text>
                                <Text style={s.emptySubtext}>
                                    {t('hotelMeubleHome.essayezModifierCriteres')}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
            {/* Intelligent Chat FAB */}
            <IntelligentChatFab
                onPress={() => setShowChat(true)}
                visible={!showChat}
                screenName={chatScreenName}
            />
            <IntelligentChat
                visible={showChat}
                onClose={() => setShowChat(false)}
                screenContext={{
                    screenName: chatScreenName,
                    currentRoute: navigationRouteName,
                    screenType: 'specialized',
                    serviceData: {
                        nom: screenTitle,
                        description: screenSubtitle,
                        type_bien: mode,
                        mode,
                        navigation_route: navigationRouteName,
                    },
                }}
            />
        </SafeNativeView>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },

    // Header
    header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    backBtn: { marginRight: 12, padding: 4 },
    headerTitleWrap: { flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
    headerSubtitle: { fontSize: 13, color: '#FFFFFFCC', marginTop: 2 },

    // Search
    searchBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 10, marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
    clearBtn: { padding: 4 },

    // Quick filter row
    quickFilterRow: { flexDirection: 'row', gap: 8 },
    quickFilterItem: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#FFFFFF20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    },
    quickFilterInput: { flex: 1, fontSize: 13, color: '#FFFFFF', padding: 0 },

    // Standings chips
    standingsContainer: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    standingsScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    standingChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    },
    standingChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },

    // Content
    content: { flex: 1 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 15 },
    errorText: { marginTop: 16, color: '#6B7280', fontSize: 15, textAlign: 'center' },
    retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
    retryBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
    listContent: { padding: 16, gap: 14 },

    // Property card
    propertyCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    photoPlaceholder: {
        height: 140, justifyContent: 'center', alignItems: 'center',
    },
    availableBadge: {
        position: 'absolute', top: 10, right: 10,
        backgroundColor: '#10B981', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    },
    availableBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

    propertyInfo: { padding: 14 },
    propertyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },

    propertyMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: '#6B7280' },

    propertyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    propertyPrice: { fontSize: 18, fontWeight: '700' },
    priceLabel: { fontSize: 13, fontWeight: '400', color: '#6B7280' },

    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    ratingText: { fontSize: 12, fontWeight: '600', color: '#374151' },
    ratingCount: { fontSize: 11, color: '#9CA3AF' },

    bookBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    },
    bookBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },

    // Empty
    emptyContainer: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
    emptySubtext: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 20 },
});

export default HotelMeubleHomeScreen;
