// ✅ Liste des résultats de recherche de pharmacies (Mobile)
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
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { pharmacyService } from '../../services/pharmacyService';
import { modernColors } from '../../theme/modernTheme';
import { computeGreedySplit } from './PharmacyMultiOrderScreen';

interface Pharmacie {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    is_on_duty: boolean;
    telephone?: string;
    distance_km?: number;
    nom_produit?: string;
    prix?: number;
    can_fulfill_quantity?: boolean;
    // Champs ordonnance matching
    matching_score?: number;
    matching_label?: string;
    available_count?: number;
    total_requested?: number;
    // Disponibilité par médicament (pour calcul split multi-pharmacies)
    medications_availability?: Array<{ name: string; available: boolean }>;
}

const PharmacieListScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const params = route.params as any;

    const [pharmacies, setPharmacies] = useState<Pharmacie[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    // Mode ordonnance : indique si aucune pharmacie n'a 100% des médicaments
    const [hasMissingMeds, setHasMissingMeds] = useState(false);

    useEffect(() => {
        loadPharmacies();
    }, []);

    const loadPharmacies = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const filters = params?.filters || {};

            // ✅ Mode ordonnance : recherche par liste de médicaments avec matching score
            const hasOrdonnanceMedications = Boolean(filters.ordonnance_medications?.length);
            if (hasOrdonnanceMedications) {
                const result = await pharmacyService.searchByMedications(
                    filters.ordonnance_medications,
                    filters.lat,
                    filters.lng,
                    filters.max_distance_km,
                );
                if (result.success && result.pharmacies) {
                    const mapped = result.pharmacies.map((p: any) => ({
                        id: p.id,
                        service_id: p.service_id,
                        user_id: p.user_id || 0,
                        nom: p.nom,
                        ville: p.ville,
                        quartier: p.quartier,
                        is_available_now: p.is_available_now ?? true,
                        is_on_duty: !!p.is_on_duty_now,
                        telephone: p.telephone,
                        distance_km: p.distance_km,
                        matching_score: p.matching_score,
                        matching_label: p.matching_label,
                        available_count: p.available_count,
                        total_requested: p.total_requested,
                        medications_availability: p.medications_availability || [],
                    }));
                    setPharmacies(isRefresh || currentPage === 1 ? mapped : [...pharmacies, ...mapped]);
                    // Si aucune pharmacie n'a 100% → proposer la multi-commande
                    setHasMissingMeds(mapped.every(p => (p.matching_score ?? 0) < 100));
                    setHasMore(false); // résultat complet en une fois
                } else {
                    Alert.alert('Erreur', result.error || 'Impossible de charger les pharmacies');
                }
                return;
            }

            const queryParams = new URLSearchParams();
            if (filters.ville) queryParams.append('ville', filters.ville);
            if (filters.quartier) queryParams.append('quartier', filters.quartier);
            if (filters.lat) queryParams.append('lat', filters.lat.toString());
            if (filters.lng) queryParams.append('lng', filters.lng.toString());
            if (filters.max_distance_km) queryParams.append('max_distance_km', filters.max_distance_km.toString());
            if (filters.on_duty_only) queryParams.append('on_duty_only', 'true');
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const hasProductSearch = Boolean(filters.product_search);
            const response = hasProductSearch
                ? await apiGet('/api/medicines/nearby', {
                    params: {
                        q: filters.product_search,
                        lat: filters.lat,
                        lng: filters.lng,
                        radius_km: filters.max_distance_km,
                        quantity: 1,
                        on_duty_only: filters.on_duty_only ? true : undefined,
                        limit: 20,
                    }
                })
                : await apiGet(`/api/pharmacies/search?${queryParams.toString()}`);

            if (response.success && response.data) {
                const rawData = response.data as any;
                const newPharmacies = hasProductSearch
                    ? (rawData.items || []).map((item: any) => ({
                        id: item.pharmacy_id || item.id,
                        service_id: item.pharmacy_service_id || item.service_id,
                        user_id: item.user_id || 0,
                        nom: item.pharmacy_nom || 'Pharmacie',
                        ville: item.ville,
                        quartier: item.quartier,
                        is_available_now: true,
                        is_on_duty: !!item.is_on_duty_now,
                        telephone: item.telephone,
                        distance_km: item.distance_km,
                        nom_produit: item.nom_produit,
                        prix: item.prix,
                        can_fulfill_quantity: !!item.can_fulfill_quantity,
                    }))
                    : (rawData.data || []);
                if (isRefresh || currentPage === 1) {
                    setPharmacies(newPharmacies);
                } else {
                    setPharmacies([...pharmacies, ...newPharmacies]);
                }
                setHasMore(newPharmacies.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les pharmacies');
            }
        } catch (error: any) {
            console.error('[PharmacieListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les pharmacies');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadPharmacies();
        }
    };

    const handlePharmaciePress = (pharmacie: Pharmacie) => {
        navigation.navigate('PharmacieDetails' as never, { pharmacieId: pharmacie.id } as never);
    };

    const renderPharmacie = ({ item }: { item: Pharmacie }) => (
        <TouchableOpacity onPress={() => handlePharmaciePress(item)}>
            <NativeCard style={styles.pharmacieCard}>
                <View style={styles.pharmacieHeader}>
                    <View style={styles.pharmacieInfo}>
                        <Text style={styles.pharmacieNom}>{item.nom}</Text>
                    </View>
                    <View style={styles.badgesContainer}>
                        {item.matching_score !== undefined ? (
                            <View style={[
                                styles.matchingBadge,
                                item.matching_score === 100 ? styles.matchingBadge100 : styles.matchingBadgePartial
                            ]}>
                                <Text style={[
                                    styles.matchingText,
                                    item.matching_score === 100 ? styles.matchingText100 : styles.matchingTextPartial
                                ]}>
                                    {item.matching_label || `${item.matching_score}%`}
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.statusBadge, item.is_available_now && styles.statusBadgeAvailable]}>
                                <Text style={[styles.statusText, item.is_available_now && styles.statusTextAvailable]}>
                                    {item.is_available_now ? 'Disponible' : 'Indisponible'}
                                </Text>
                            </View>
                        )}
                        {item.is_on_duty && (
                            <View style={styles.dutyBadge}>
                                <Text style={styles.dutyText}>De garde</Text>
                            </View>
                        )}
                    </View>
                </View>

                {(item.ville || item.quartier) && (
                    <View style={styles.locationRow}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.locationText}>
                            {[item.ville, item.quartier].filter(Boolean).join(', ')}
                        </Text>
                    </View>
                )}

                {item.distance_km !== undefined && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.distanceText}>{item.distance_km.toFixed(1)} km</Text>
                    </View>
                )}
                {item.nom_produit && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="pill" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.distanceText}>
                            {item.nom_produit}
                            {item.prix ? ` • ${Number(item.prix).toLocaleString()} FCFA` : ''}
                        </Text>
                    </View>
                )}

                {item.available_count !== undefined && item.total_requested !== undefined && (
                    <View style={styles.matchingDetailRow}>
                        <SafeIcon name="pill" size={14} color={item.matching_score === 100 ? '#059669' : '#D97706'} type="lucide" />
                        <Text style={[styles.matchingDetailText, { color: item.matching_score === 100 ? '#059669' : '#D97706' }]}>
                            {item.available_count}/{item.total_requested} médicament{item.total_requested > 1 ? 's' : ''} disponible{item.available_count > 1 ? 's' : ''}
                        </Text>
                    </View>
                )}

                {/* Détail médicament par médicament : ✓ disponible / ✗ manquant */}
                {item.medications_availability && item.medications_availability.length > 0 && (
                    <View style={styles.medsAvailList}>
                        {item.medications_availability.map((med, idx) => (
                            <View key={idx} style={styles.medAvailRow}>
                                <SafeIcon
                                    name={med.available ? 'check-circle' : 'x-circle'}
                                    size={13}
                                    color={med.available ? '#059669' : '#EF4444'}
                                    type="lucide"
                                />
                                <Text style={[
                                    styles.medAvailName,
                                    { color: med.available ? '#065F46' : '#991B1B' }
                                ]}>
                                    {med.name}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {item.telephone && (
                    <View style={styles.phoneRow}>
                        <SafeIcon name="phone" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.phoneText}>{item.telephone}</Text>
                    </View>
                )}
            </NativeCard>
        </TouchableOpacity>
    );

    if (loading && pharmacies.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('pharmacieList.chargementDesPharmacies')}</Text>
            </View>
        );
    }

    if (pharmacies.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="pill" size={64} color={modernColors.textSecondary} />
                <Text style={styles.emptyTitle}>{t('pharmacieList.aucunePharmacieTrouvee')}</Text>
                <Text style={styles.emptyText}>{t('pharmacieList.essayezDeModifierVosCriteres')}</Text>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>{t('pharmacieList.nouvelleRecherche')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleMultiOrder = () => {
        const filters = params?.filters || {};
        const requestedMeds: string[] = (filters.ordonnance_medications || []).map((m: any) =>
            typeof m === 'string' ? m : m.name
        );
        const split = computeGreedySplit(pharmacies, requestedMeds);
        if (split.length === 0) {
            Alert.alert('Couverture impossible', 'Aucune combinaison de pharmacies ne couvre tous vos médicaments.');
            return;
        }
        const uncovered = requestedMeds.filter(
            name => !split.some(s => s.medications.some(m => m.medication_name.toLowerCase() === name.toLowerCase()))
        );
        const confirmMsg = uncovered.length > 0
            ? `${split.length} pharmacie(s) couvrent ${requestedMeds.length - uncovered.length}/${requestedMeds.length} médicaments.\n\nNon disponibles : ${uncovered.join(', ')}.\n\nContinuer quand même ?`
            : `Répartition sur ${split.length} pharmacie(s) pour couvrir tous vos médicaments.`;

        Alert.alert('Commander en multi-pharmacies', confirmMsg, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Voir la répartition',
                onPress: () => (navigation as any).navigate('PharmacyMultiOrder', {
                    split,
                    deliveryMethod: filters.delivery_method || 'pickup',
                    deliveryAddress: filters.delivery_address,
                }),
            },
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>
                    {pharmacies.length} pharmacie{pharmacies.length > 1 ? 's' : ''}
                </Text>
            </View>

            {/* Bannière multi-pharmacies : apparaît quand aucune pharmacie n'a 100% */}
            {hasMissingMeds && pharmacies.length > 0 && (
                <TouchableOpacity style={styles.multiBanner} onPress={handleMultiOrder} activeOpacity={0.85}>
                    <View style={styles.multiBannerLeft}>
                        <SafeIcon name="git-merge" size={18} color="#7C3AED" type="lucide" />
                        <View>
                            <Text style={styles.multiBannerTitle}>Aucune pharmacie n'a tout</Text>
                            <Text style={styles.multiBannerSub}>Commander dans plusieurs pharmacies</Text>
                        </View>
                    </View>
                    <SafeIcon name="chevron-right" size={18} color="#7C3AED" type="lucide" />
                </TouchableOpacity>
            )}

            <FlatList
                data={pharmacies}
                renderItem={renderPharmacie}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadPharmacies(true)}
                        colors={[modernColors.primary]}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    hasMore && loading ? (
                        <ActivityIndicator size="small" color={modernColors.primary} style={styles.footerLoader} />
                    ) : null
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    listContent: {
        padding: 16,
    },
    pharmacieCard: {
        marginBottom: 12,
        padding: 16,
    },
    pharmacieHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    pharmacieInfo: {
        flex: 1,
    },
    pharmacieNom: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    badgesContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#F3F4F6',
    },
    statusBadgeAvailable: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },
    statusTextAvailable: {
        color: '#065F46',
    },
    dutyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#DBEAFE',
    },
    dutyText: {
        fontSize: 12,
        color: '#1E40AF',
        fontWeight: '600',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    phoneText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    footerLoader: {
        marginVertical: 16,
    },
    // Matching badges pour mode ordonnance
    matchingBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    matchingBadge100: {
        backgroundColor: '#D1FAE5',
    },
    matchingBadgePartial: {
        backgroundColor: '#FEF3C7',
    },
    matchingText: {
        fontSize: 12,
        fontWeight: '700',
    },
    matchingText100: {
        color: '#065F46',
    },
    matchingTextPartial: {
        color: '#92400E',
    },
    matchingDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 6,
    },
    matchingDetailText: {
        fontSize: 13,
        fontWeight: '500',
    },
    medsAvailList: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        gap: 4,
    },
    medAvailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    medAvailName: {
        fontSize: 12,
        fontWeight: '500',
    },
    // Bannière multi-pharmacies
    multiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F3FF',
        borderBottomWidth: 1,
        borderBottomColor: '#DDD6FE',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    multiBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    multiBannerTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#5B21B6',
    },
    multiBannerSub: {
        fontSize: 12,
        color: '#7C3AED',
        marginTop: 1,
    },
});

export default PharmacieListScreen;

