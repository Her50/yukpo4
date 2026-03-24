// ✅ Écran BayamSelam - Sélection de supermarché pour achats en ligne (REFONDU)
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { supermarketService, Supermarket } from '../../services/supermarketService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const BayamSelamSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
    const [radiusKm, setRadiusKm] = useState(20);

    useEffect(() => {
        loadSupermarkets();
    }, [location, radiusKm]);

    const loadSupermarkets = useCallback(async () => {
        if (!location?.coords) {
            Alert.alert(
                'Localisation requise',
                t('bayamSelamSearchScreen.veuillezActiverLaLocalisationPourVoir'),
                [
                    { text: 'OK' },
                ]
            );
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await supermarketService.listSupermarkets(
                location.coords.latitude,
                location.coords.longitude,
                radiusKm
            );

            if (response.supermarkets) {
                // Trier par distance ou nom
                const sorted = [...response.supermarkets].sort((a, b) => {
                    if (sortBy === 'distance') {
                        const distA = a.distance_km || 999;
                        const distB = b.distance_km || 999;
                        return distA - distB;
                    } else {
                        return a.name.localeCompare(b.name);
                    }
                });
                setSupermarkets(sorted);
            } else {
                setSupermarkets([]);
            }
        } catch (err: any) {
            console.error('[BayamSelamSearch] Erreur chargement supermarchés:', err);
            Alert.alert('Erreur', 'Impossible de charger les supermarchés. Veuillez réessayer.');
            setSupermarkets([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [location, radiusKm, sortBy]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadSupermarkets();
    };

    const handleSelectSupermarket = (supermarket: Supermarket) => {
        hapticPress();
        // ✅ Naviguer vers le flux d'achat en ligne avec le supermarché sélectionné
        (navigation as any).navigate('DeliveryShoppingFlowNew', {
            selectedSupermarket: {
                id: supermarket.id,
                name: supermarket.name,
                address: supermarket.address,
                latitude: supermarket.latitude,
                longitude: supermarket.longitude,
            },
            fromBayamSelam: true,
        });
    };

    const filteredSupermarkets = supermarkets.filter(supermarket => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            supermarket.name.toLowerCase().includes(query) ||
            supermarket.address.toLowerCase().includes(query)
        );
    });

    const formatDistance = (distance?: number) => {
        if (!distance) return 'Distance inconnue';
        if (distance < 1) return `${Math.round(distance * 1000)}m`;
        return `${distance.toFixed(1)} km`;
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient orange */}
            <LinearGradient
                colors={['#F97316', '#FB923C']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            hapticPress();
                            navigation.goBack();
                        }}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerIconContainer}>
                            <SafeIcon name="shopping-bag" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>{t('bayamSelamSearch.screenTitle')}</Text>
                        <Text style={styles.headerSubtitle}>
                            Choisissez un supermarché pour faire vos achats en ligne
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Barre de recherche et filtres */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('bayamSelamSearch.rechercherUnSupermarche')}
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                setSearchQuery('');
                            }}
                            style={styles.clearButton}
                        >
                            <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filtres de tri */}
                <View style={styles.filtersRow}>
                    <Text style={styles.filtersLabel}>{t('bayamSelamSearch.trierPar')}</Text>
                    <View style={styles.sortButtons}>
                        <TouchableOpacity
                            style={[styles.sortButton, sortBy === 'distance' && styles.sortButtonActive]}
                            onPress={() => {
                                hapticPress();
                                setSortBy('distance');
                            }}
                        >
                            <SafeIcon
                                name="map-pin"
                                size={16}
                                color={sortBy === 'distance' ? '#FFFFFF' : '#6B7280'}
                                type="lucide"
                            />
                            <Text style={[styles.sortButtonText, sortBy === 'distance' && styles.sortButtonTextActive]}>
                                Distance
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
                            onPress={() => {
                                hapticPress();
                                setSortBy('name');
                            }}
                        >
                            <SafeIcon
                                name="sort-asc"
                                size={16}
                                color={sortBy === 'name' ? '#FFFFFF' : '#6B7280'}
                                type="lucide"
                            />
                            <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
                                Nom
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Rayon de recherche */}
                <View style={styles.radiusSection}>
                    <Text style={styles.radiusLabel}>Rayon de recherche: {radiusKm} km</Text>
                    <View style={styles.radiusButtons}>
                        {[5, 10, 20, 50].map((km) => (
                            <TouchableOpacity
                                key={km}
                                style={[styles.radiusButton, radiusKm === km && styles.radiusButtonActive]}
                                onPress={() => {
                                    hapticPress();
                                    setRadiusKm(km);
                                }}
                            >
                                <Text style={[styles.radiusButtonText, radiusKm === km && styles.radiusButtonTextActive]}>
                                    {km} km
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* Liste des supermarchés */}
            {loading && supermarkets.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#F97316" />
                    <Text style={styles.loadingText}>{t('bayamSelamSearch.rechercheDeSupermarches')}</Text>
                </View>
            ) : filteredSupermarkets.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="store" size={64} color="#9CA3AF" type="lucide" />
                    <Text style={styles.emptyText}>
                        {searchQuery ? t('bayamSelamSearchScreen.aucunSupermarcheTrouve') : t('bayamSelamSearchScreen.aucunSupermarcheAProximite')}
                    </Text>
                    <Text style={styles.emptySubtext}>
                        {searchQuery
                            ? 'Essayez de modifier votre recherche'
                            : 'Élargissez le rayon de recherche ou activez votre localisation'}
                    </Text>
                    {!searchQuery && (
                        <NativeButton
                            title={t('bayamSelamSearch.reessayer')}
                            onPress={handleRefresh}
                            variant="outline"
                            style={styles.retryButton}
                        />
                    )}
                </View>
            ) : (
                <FlatList
                    data={filteredSupermarkets}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                        <SupermarketCard
                            supermarket={item}
                            onSelect={() => handleSelectSupermarket(item)}
                            formatDistance={formatDistance}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={['#F97316']}
                        />
                    }
                    ListHeaderComponent={
                        <View style={styles.listHeader}>
                            <Text style={styles.listHeaderText}>
                                {filteredSupermarkets.length} supermarché{filteredSupermarkets.length > 1 ? 's' : ''} trouvé{filteredSupermarkets.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeNativeView>
    );
};

// Composant Card Supermarché
interface SupermarketCardProps {
    supermarket: Supermarket;
    onSelect: () => void;
    formatDistance: (distance?: number) => string;
}

const SupermarketCard: React.FC<SupermarketCardProps> = ({ supermarket, onSelect, formatDistance }) => {
    return (
        <TouchableOpacity
            style={styles.supermarketCard}
            onPress={onSelect}
            activeOpacity={0.7}
        >
            <View style={styles.supermarketCardContent}>
                {/* Logo/Icon */}
                <View style={styles.supermarketIconContainer}>
                    <SafeIcon name="store" size={32} color="#F97316" type="lucide" />
                </View>

                {/* Info */}
                <View style={styles.supermarketInfo}>
                    <Text style={styles.supermarketName} numberOfLines={1}>
                        {supermarket.name}
                    </Text>
                    <View style={styles.supermarketAddressRow}>
                        <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.supermarketAddress} numberOfLines={2}>
                            {supermarket.address}
                        </Text>
                    </View>
                    <View style={styles.supermarketMeta}>
                        {supermarket.distance_km !== undefined && (
                            <View style={styles.metaItem}>
                                <SafeIcon name="navigation" size={14} color="#F97316" type="lucide" />
                                <Text style={styles.metaText}>{formatDistance(supermarket.distance_km)}</Text>
                            </View>
                        )}
                        {supermarket.phone && (
                            <View style={styles.metaItem}>
                                <SafeIcon name="phone" size={14} color="#6B7280" type="lucide" />
                                <Text style={styles.metaText}>{supermarket.phone}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Bouton action */}
                <View style={styles.supermarketAction}>
                    <SafeIcon name="chevron-right" size={24} color="#F97316" type="lucide" />
                </View>
            </View>

            {/* Badge "Achats en ligne" */}
            <View style={styles.onlineBadge}>
                <SafeIcon name="shopping-cart" size={12} color="#FFFFFF" type="lucide" />
                <Text style={styles.onlineBadgeText}>Achats en ligne</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
    },
    backButton: {
        marginRight: 12,
        marginTop: 4,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    searchSection: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 12,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    clearButton: {
        padding: 4,
    },
    filtersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    filtersLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        gap: 6,
    },
    sortButtonActive: {
        backgroundColor: '#F97316',
    },
    sortButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    sortButtonTextActive: {
        color: '#FFFFFF',
    },
    radiusSection: {
        marginTop: 8,
    },
    radiusLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    radiusButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    radiusButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    radiusButtonActive: {
        backgroundColor: '#F97316',
        borderColor: '#F97316',
    },
    radiusButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    radiusButtonTextActive: {
        color: '#FFFFFF',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
        textAlign: 'center',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    retryButton: {
        marginTop: 20,
    },
    listContent: {
        padding: 16,
    },
    listHeader: {
        marginBottom: 12,
    },
    listHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    supermarketCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        overflow: 'hidden',
        position: 'relative',
    },
    supermarketCardContent: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
    },
    supermarketIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 12,
        backgroundColor: '#FED7AA',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    supermarketInfo: {
        flex: 1,
    },
    supermarketName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 6,
    },
    supermarketAddressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
        gap: 6,
    },
    supermarketAddress: {
        flex: 1,
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    supermarketMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    supermarketAction: {
        marginLeft: 8,
    },
    onlineBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    onlineBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default BayamSelamSearchScreen;
