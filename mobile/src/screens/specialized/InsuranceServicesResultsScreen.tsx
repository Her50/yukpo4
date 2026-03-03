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
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

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
}

const InsuranceServicesResultsScreen: React.FC = () => {
    const navigation = useNavigation();
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
            const queryParams = new URLSearchParams();
            queryParams.append('category', 'assurance');
            queryParams.append('actif', 'true');
            if (filters.prix_min) queryParams.append('min_price', filters.prix_min.toString());
            if (filters.prix_max) queryParams.append('max_price', filters.prix_max.toString());

            const response = await apiGet(`/services/filter?${queryParams.toString()}`);
            // response.data contains the backend JSON (array of {id, data, is_active})
            const backendData = response?.data as any;
            let rawResults = Array.isArray(backendData) ? backendData : [];

            // Transformer en format affichable + filtrage client-side
            let mapped = rawResults.map((item: any) => {
                const d = item.data || {};
                return {
                    id: item.id,
                    name: d.titre_service || d.nom || d.title || 'Service assurance',
                    description: d.description || d.details || '',
                    category: d.type_assurance || d.sous_categorie || d.category || 'assurance',
                    address: d.adresse || d.ville || '',
                    phone: d.telephone || d.phone || '',
                    price: parseFloat(d.price || d.prix || '0') || undefined,
                    ville: (d.ville || '').toLowerCase(),
                    quartier: (d.quartier || '').toLowerCase(),
                    compagnie: (d.compagnie || d.nom_compagnie || '').toLowerCase(),
                    type_assurance: (d.type_assurance || '').toLowerCase(),
                };
            });

            // Filtrage client-side pour les champs non supportés par le backend
            if (filters.ville) mapped = mapped.filter((s: any) => s.ville.includes(filters.ville.toLowerCase()));
            if (filters.quartier) mapped = mapped.filter((s: any) => s.quartier.includes(filters.quartier.toLowerCase()));
            if (filters.compagnie) mapped = mapped.filter((s: any) => s.compagnie.includes(filters.compagnie.toLowerCase()));
            if (filters.type_assurance) mapped = mapped.filter((s: any) => s.type_assurance.includes(filters.type_assurance.toLowerCase()));

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
    ].filter(Boolean).join(' · ') || 'Tous les résultats';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.title}>Résultats Assurance</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{filterSummary}</Text>
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Recherche en cours...</Text>
                </View>
            ) : results.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="search-x" size={64} color="#D1D5DB" type="lucide" />
                    <Text style={styles.emptyTitle}>Aucun résultat</Text>
                    <Text style={styles.emptyText}>Essayez d'élargir vos critères de recherche</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.retryText}>Modifier la recherche</Text>
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
