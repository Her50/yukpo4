// ✅ Écran Résultats Recherche Assurance
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
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
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import assuranceService, { InsuranceSearchFilters } from '../../services/assuranceService';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface InsuranceResult {
    id: number;
    name: string;
    description?: string;
    category?: string;
    address?: string;
    phone?: string;
    price?: number;
    distance_km?: number;
    rating?: number;
    compagnie?: string;
    couvertures?: string[];
    prestataire?: string;
}

const InsuranceServicesResultsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const params = route.params as { filters?: any } | undefined;
    const filters = params?.filters || {};

    const [results, setResults] = useState<InsuranceResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadResults();
    }, []);

    const loadResults = async () => {
        try {
            setLoading(true);
            // ✅ Utiliser le nouveau endpoint dédié /api/assurance/search
            const searchFilters: InsuranceSearchFilters = {};
            if (filters.type_assurance) searchFilters.type_assurance = filters.type_assurance;
            if (filters.compagnie) searchFilters.compagnie = filters.compagnie;
            if (filters.ville) searchFilters.ville = filters.ville;
            if (filters.quartier) searchFilters.quartier = filters.quartier;
            if (filters.gps_lat) searchFilters.gps_lat = filters.gps_lat;
            if (filters.gps_lon) searchFilters.gps_lon = filters.gps_lon;
            if (filters.rayon_km) searchFilters.rayon_km = filters.rayon_km;
            if (filters.prix_min) searchFilters.prix_min = filters.prix_min;
            if (filters.prix_max) searchFilters.prix_max = filters.prix_max;

            const rawResults = await assuranceService.searchInsurance(searchFilters);

            // Transformer en format affichable
            const mapped = rawResults.map((item: any) => ({
                id: item.id,
                name: item.titre || t('insuranceServicesResults.serviceAssurance'),
                description: item.description || '',
                category: item.type_assurance || 'assurance',
                address: item.adresse || item.ville || '',
                phone: item.telephone || '',
                price: item.prix || undefined,
                distance_km: item.distance_km,
                compagnie: item.compagnie || '',
                couvertures: item.couvertures || [],
                prestataire: item.prestataire || '',
            }));

            setResults(mapped);
        } catch (error: any) {
            console.error('[InsuranceServicesResults] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de charger les résultats');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadResults();
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'Sur devis';
        return `${price.toLocaleString('fr-FR')} FCFA/an`;
    };

    const renderItem = ({ item }: { item: InsuranceResult }) => (
        <TouchableOpacity
            onPress={() => navigation.navigate('ServiceDetail' as never, { serviceId: item.id } as never)}
            activeOpacity={0.7}
        >
            <NativeCard style={styles.resultCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                        <SafeIcon name="shield" size={24} color="#1E40AF" type="lucide" />
                    </View>
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
                        {item.category && (
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>{item.category}</Text>
                            </View>
                        )}
                    </View>
                </View>
                {item.description && (
                    <Text style={styles.resultDescription} numberOfLines={2}>{item.description}</Text>
                )}
                <View style={styles.cardFooter}>
                    {item.address && (
                        <View style={styles.footerItem}>
                            <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" />
                            <Text style={styles.footerText} numberOfLines={1}>{item.address}</Text>
                        </View>
                    )}
                    {item.distance_km !== undefined && (
                        <View style={styles.footerItem}>
                            <SafeIcon name="navigation" size={14} color="#6B7280" type="lucide" />
                            <Text style={styles.footerText}>{item.distance_km.toFixed(1)} km</Text>
                        </View>
                    )}
                    <Text style={styles.priceText}>{formatPrice(item.price)}</Text>
                </View>
            </NativeCard>
        </TouchableOpacity>
    );

    const filterSummary = [
        filters.type_assurance,
        filters.compagnie,
        filters.ville,
    ].filter(Boolean).join(' · ') || t('insuranceServicesResults.tousLesResultats');

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.title}>{t('insuranceServicesResults.resultatsAssurance')}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{filterSummary}</Text>
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('insuranceServicesResults.rechercheEnCours')}</Text>
                </View>
            ) : results.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="search-x" size={64} color="#D1D5DB" type="lucide" />
                    <Text style={styles.emptyTitle}>{t('insuranceServicesResults.aucunResultat')}</Text>
                    <Text style={styles.emptyText}>{t('insuranceServicesResults.essayezDelargirVosCriteresDe')}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.retryText}>{t('insuranceServicesResultsScreen.modifierLaRecherche')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={results}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[modernColors.primary]} />
                    }
                    ListHeaderComponent={
                        <Text style={styles.resultCount}>{results.length} résultat(s) trouvé(s)</Text>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backButton: { marginRight: 12 },
    headerTextContainer: { flex: 1 },
    title: { fontSize: 18, fontWeight: '700', color: '#111827' },
    subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 },
    retryButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#1E40AF', borderRadius: 8 },
    retryText: { color: '#fff', fontWeight: '600' },
    listContent: { padding: 16 },
    resultCount: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
    resultCard: { padding: 16, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    iconContainer: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    cardHeaderText: { flex: 1 },
    resultName: { fontSize: 16, fontWeight: '600', color: '#111827' },
    categoryBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
    categoryText: { fontSize: 12, color: '#1E40AF', fontWeight: '500' },
    resultDescription: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 8 },
    cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 4 },
    footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerText: { fontSize: 12, color: '#6B7280', maxWidth: 150 },
    priceText: { fontSize: 14, fontWeight: '700', color: '#1E40AF', marginLeft: 'auto' },
});

export default InsuranceServicesResultsScreen;
