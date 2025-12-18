// ✅ Liste des résultats de recherche d'offres d'emploi (Mobile)
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
import { NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface OffreEmploi {
    id: number;
    titre_poste: string;
    description: string;
    type_contrat: string;
    lieu_travail: string;
    salaire_min?: number;
    salaire_max?: number;
    secteur: string;
    remote: boolean;
    date_publication: string;
    nombre_candidatures: number;
    nombre_vues: number;
}

const OffreListScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as any;

    const [offres, setOffres] = useState<OffreEmploi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        loadOffres();
    }, []);

    const loadOffres = async (isRefresh = false) => {
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

            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    if (Array.isArray(value)) {
                        queryParams.append(key, value.join(','));
                    } else {
                        queryParams.append(key, String(value));
                    }
                }
            });

            queryParams.append('page', currentPage.toString());
            queryParams.append('limit', '20');

            const response = await apiGet(`/api/offres-emploi/search?${queryParams.toString()}`);

            if (response.success && response.data) {
                const newOffres = response.data.data || [];
                if (isRefresh || currentPage === 1) {
                    setOffres(newOffres);
                } else {
                    setOffres([...offres, ...newOffres]);
                }
                setTotal(response.data.total || 0);
                setHasMore(newOffres.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les offres');
            }
        } catch (error: any) {
            console.error('[OffreListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les offres');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadOffres();
        }
    };

    const formatSalaire = (min?: number, max?: number) => {
        if (!min && !max) return 'Salaire non renseigné';
        if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} XAF`;
        if (min) return `À partir de ${min.toLocaleString()} XAF`;
        return `Jusqu'à ${max?.toLocaleString()} XAF`;
    };

    const renderOffre = ({ item }: { item: OffreEmploi }) => (
        <NativeCard style={styles.offreCard}>
            <TouchableOpacity
                onPress={() => (navigation as any).navigate('OffreDetails', { offreId: item.id })}
            >
                <View style={styles.offreHeader}>
                    <Text style={styles.offreTitle}>{item.titre_poste}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.type_contrat}</Text>
                    </View>
                </View>
                <Text style={styles.offreDescription} numberOfLines={2}>
                    {item.description}
                </Text>
                <View style={styles.offreMeta}>
                    <View style={styles.metaItem}>
                        <SafeIcon name="map-pin" size={16} color={modernColors.textSecondary} type="lucide" />
                        <Text style={styles.metaText}>
                            {item.lieu_travail}
                            {item.remote && <Text style={styles.remoteText}> (Remote)</Text>}
                        </Text>
                    </View>
                    <View style={styles.metaItem}>
                        <SafeIcon name="dollar-sign" size={16} color={modernColors.textSecondary} type="lucide" />
                        <Text style={styles.metaText}>{formatSalaire(item.salaire_min, item.salaire_max)}</Text>
                    </View>
                </View>
                <View style={styles.offreFooter}>
                    <Text style={styles.footerText}>
                        {item.nombre_vues} vues • {item.nombre_candidatures} candidatures
                    </Text>
                    <Text style={styles.footerText}>
                        {new Date(item.date_publication).toLocaleDateString('fr-FR')}
                    </Text>
                </View>
            </TouchableOpacity>
        </NativeCard>
    );

    if (loading && offres.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des offres...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>
                    {total} offre{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
                </Text>
            </View>

            {offres.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="briefcase" size={64} color={modernColors.textSecondary} type="lucide" />
                    <Text style={styles.emptyTitle}>Aucune offre trouvée</Text>
                    <Text style={styles.emptyText}>Essayez de modifier vos critères de recherche</Text>
                    <TouchableOpacity
                        style={styles.emptyButton}
                        onPress={() => (navigation as any).navigate('OffreSearch')}
                    >
                        <Text style={styles.emptyButtonText}>Nouvelle recherche</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={offres}
                    renderItem={renderOffre}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOffres(true)} />}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        hasMore && !loading ? (
                            <ActivityIndicator size="small" color={modernColors.primary} style={styles.footerLoader} />
                        ) : null
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: modernColors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    listContent: {
        padding: 16,
    },
    offreCard: {
        marginBottom: 12,
        padding: 16,
    },
    offreHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    offreTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginRight: 8,
    },
    badge: {
        backgroundColor: modernColors.primary + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    offreDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 12,
        lineHeight: 20,
    },
    offreMeta: {
        marginBottom: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    metaText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    remoteText: {
        color: '#10B981',
        fontWeight: '600',
    },
    offreFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    footerText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    footerLoader: {
        marginVertical: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyButton: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    emptyButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default OffreListScreen;

