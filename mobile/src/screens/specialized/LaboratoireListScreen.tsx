// ✅ Phase 3: Liste des résultats de recherche de laboratoires
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
import { NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface Laboratoire {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    type_laboratoire: string;
    ville?: string;
    quartier?: string;
    gps?: string;
    is_available_now: boolean;
    analyses_disponibles?: string[];
    imagerie_disponible?: string[];
    rdv_requis: boolean;
    resultats_en_ligne: boolean;
    telephone?: string;
    distance_km?: number;
}

interface LaboratoireListScreenParams {
    filters?: {
        ville?: string;
        quartier?: string;
        lat?: number;
        lng?: number;
        max_distance_km?: number;
        type_laboratoire?: string;
        analyse?: string;
        imagerie?: string;
        available_only?: boolean;
    };
}

const LaboratoireListScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as LaboratoireListScreenParams;

    const [laboratoires, setLaboratoires] = useState<Laboratoire[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadLaboratoires();
    }, []);

    const loadLaboratoires = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const filters = params?.filters || {};

            const queryParams = new URLSearchParams();
            if (filters.ville) queryParams.append('ville', filters.ville);
            if (filters.quartier) queryParams.append('quartier', filters.quartier);
            if (filters.lat) queryParams.append('lat', filters.lat.toString());
            if (filters.lng) queryParams.append('lng', filters.lng.toString());
            if (filters.max_distance_km) queryParams.append('max_distance_km', filters.max_distance_km.toString());
            if (filters.type_laboratoire) queryParams.append('type_laboratoire', filters.type_laboratoire);
            if (filters.analyse) queryParams.append('prestation_analyse', filters.analyse);
            if (filters.imagerie) queryParams.append('imagerie', filters.imagerie);
            if (filters.available_only) queryParams.append('available_only', 'true');
            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/laboratoires/search?${queryParams.toString()}`);

            if (response.success && response.data) {
                const newLaboratoires = response.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setLaboratoires(newLaboratoires);
                } else {
                    setLaboratoires([...laboratoires, ...newLaboratoires]);
                }
                setHasMore(newLaboratoires.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les laboratoires');
            }
        } catch (error: any) {
            console.error('[LaboratoireListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les laboratoires');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadLaboratoires();
        }
    };

    const handleLaboratoirePress = (laboratoire: Laboratoire) => {
        navigation.navigate('LaboratoireDetails' as never, { laboratoryId: laboratoire.id } as never);
    };

    const renderLaboratoire = ({ item }: { item: Laboratoire }) => (
        <TouchableOpacity onPress={() => handleLaboratoirePress(item)}>
            <NativeCard style={styles.laboratoireCard}>
                <View style={styles.laboratoireHeader}>
                    <View style={styles.laboratoireInfo}>
                        <Text style={styles.laboratoireNom}>{item.nom}</Text>
                        <Text style={styles.laboratoireType}>{item.type_laboratoire}</Text>
                    </View>
                    <View style={[styles.statusBadge, item.is_available_now && styles.statusBadgeAvailable]}>
                        <Text style={[styles.statusText, item.is_available_now && styles.statusTextAvailable]}>
                            {item.is_available_now ? 'Disponible' : 'Indisponible'}
                        </Text>
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
                        <Text style={styles.distanceText}>
                            {item.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}

                {item.telephone && (
                    <View style={styles.phoneRow}>
                        <SafeIcon name="phone" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.phoneText}>{item.telephone}</Text>
                    </View>
                )}

                {item.analyses_disponibles && item.analyses_disponibles.length > 0 && (
                    <View style={styles.analysesContainer}>
                        <Text style={styles.analysesLabel}>Analyses:</Text>
                        <View style={styles.analysesChips}>
                            {item.analyses_disponibles.slice(0, 3).map((anal, idx) => (
                                <View key={idx} style={styles.analyseChip}>
                                    <Text style={styles.analyseChipText}>{anal}</Text>
                                </View>
                            ))}
                            {item.analyses_disponibles.length > 3 && (
                                <Text style={styles.analysesMore}>
                                    +{item.analyses_disponibles.length - 3}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                {item.imagerie_disponible && item.imagerie_disponible.length > 0 && (
                    <View style={styles.imagerieContainer}>
                        <Text style={styles.imagerieLabel}>Imagerie:</Text>
                        <View style={styles.imagerieChips}>
                            {item.imagerie_disponible.slice(0, 2).map((img, idx) => (
                                <View key={idx} style={styles.imagerieChip}>
                                    <Text style={styles.imagerieChipText}>{img}</Text>
                                </View>
                            ))}
                            {item.imagerie_disponible.length > 2 && (
                                <Text style={styles.imagerieMore}>
                                    +{item.imagerie_disponible.length - 2}
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                {item.resultats_en_ligne && (
                    <View style={styles.resultatsBadge}>
                        <SafeIcon name="check-circle" size={12} color="#059669" />
                        <Text style={styles.resultatsText}>Résultats en ligne</Text>
                    </View>
                )}
            </NativeCard>
        </TouchableOpacity>
    );

    if (loading && laboratoires.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des laboratoires...</Text>
            </View>
        );
    }

    if (laboratoires.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Résultats de recherche</Text>
                </View>
                <View style={styles.centerContainer}>
                    <SafeIcon name="microscope" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Aucun laboratoire trouvé</Text>
                    <Text style={styles.emptySubtext}>
                        Essayez de modifier vos critères de recherche
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>
                    {laboratoires.length} laboratoire{laboratoires.length > 1 ? 's' : ''} trouvé{laboratoires.length > 1 ? 's' : ''}
                </Text>
            </View>

            <FlatList
                data={laboratoires}
                renderItem={renderLaboratoire}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadLaboratoires(true)}
                        colors={[modernColors.primary]}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loading && laboratoires.length > 0 ? (
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
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    laboratoireCard: {
        padding: 16,
        marginBottom: 12,
    },
    laboratoireHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    laboratoireInfo: {
        flex: 1,
    },
    laboratoireNom: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    laboratoireType: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
    },
    statusBadgeAvailable: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    statusTextAvailable: {
        color: '#059669',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    phoneText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    analysesContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    analysesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    analysesChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    analyseChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F3E8FF',
    },
    analyseChipText: {
        fontSize: 11,
        color: '#7C3AED',
    },
    analysesMore: {
        fontSize: 11,
        color: modernColors.textSecondary,
        alignSelf: 'center',
    },
    imagerieContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    imagerieLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    imagerieChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    imagerieChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#DBEAFE',
    },
    imagerieChipText: {
        fontSize: 11,
        color: '#1E40AF',
    },
    imagerieMore: {
        fontSize: 11,
        color: modernColors.textSecondary,
        alignSelf: 'center',
    },
    resultatsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 6,
    },
    resultatsText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    footerLoader: {
        marginVertical: 16,
    },
});

export default LaboratoireListScreen;

