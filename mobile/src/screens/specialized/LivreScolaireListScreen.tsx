// ✅ Liste des résultats de recherche de livres scolaires (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface LivreScolaire {
    livre: {
        id: number;
        titre: string;
        auteur?: string;
        classe_actuelle: string;
        classe_souhaitee: string;
        matiere: string;
        niveau?: string;
        etat_livre: string;
        ville?: string;
        quartier?: string;
        images_urls?: string[];
        is_available: boolean;
    };
    distance_km?: number;
}

const LivreScolaireListScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as any;

    const [livres, setLivres] = useState<LivreScolaire[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadLivres();
    }, []);

    const loadLivres = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else {
                setLoading(true);
            }

            const filters = params?.filters || {};
            const queryParams = new URLSearchParams();

            if (filters.classe_actuelle) queryParams.append('classe_actuelle', filters.classe_actuelle);
            if (filters.classe_souhaitee) queryParams.append('classe_souhaitee', filters.classe_souhaitee);
            if (filters.matiere) queryParams.append('matiere', filters.matiere);
            if (filters.niveau) queryParams.append('niveau', filters.niveau);
            if (filters.etat_livre) queryParams.append('etat_livre', filters.etat_livre);
            if (filters.ville) queryParams.append('ville', filters.ville);
            if (filters.quartier) queryParams.append('quartier', filters.quartier);
            if (filters.gps_lat) queryParams.append('gps_lat', filters.gps_lat.toString());
            if (filters.gps_lon) queryParams.append('gps_lon', filters.gps_lon.toString());
            if (filters.rayon_km) queryParams.append('rayon_km', filters.rayon_km.toString());

            queryParams.append('limit', '20');
            queryParams.append('offset', ((isRefresh ? 1 : page) - 1).toString());

            const response = await apiGet(`/api/bourse-livre/search?${queryParams.toString()}`);

            const r = response.data as any;
            if (response.success && r) {
                const newLivres = r.livres || [];
                if (isRefresh || page === 1) {
                    setLivres(newLivres);
                } else {
                    setLivres([...livres, ...newLivres]);
                }
                setHasMore(newLivres.length === 20);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les livres');
            }
        } catch (error: any) {
            console.error('[LivreScolaireListScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les livres');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadLivres();
        }
    };

    const handleLivrePress = (livreId: number) => {
        navigation.navigate('LivreScolaireDetails' as never, { livreId } as never);
    };

    const renderLivre = ({ item }: { item: LivreScolaire }) => {
        const livre = item.livre;
        const firstImage = livre.images_urls?.[0];

        return (
            <NativeCard style={styles.livreCard}>
                <TouchableOpacity
                    style={styles.livreCardContent}
                    onPress={() => handleLivrePress(livre.id)}
                >
                    {firstImage && (
                        <Image source={{ uri: firstImage }} style={styles.livreImage} />
                    )}
                    <View style={styles.livreInfo}>
                        <Text style={styles.livreTitre} numberOfLines={2}>
                            {livre.titre}
                        </Text>
                        {livre.auteur && (
                            <Text style={styles.livreAuteur} numberOfLines={1}>
                                {livre.auteur}
                            </Text>
                        )}
                        <View style={styles.livreMeta}>
                            <Text style={styles.livreMetaText}>
                                📚 {livre.classe_actuelle} → {livre.classe_souhaitee}
                            </Text>
                            <Text style={styles.livreMetaText}>
                                📖 {livre.matiere}
                            </Text>
                            {livre.niveau && (
                                <Text style={styles.livreMetaText}>
                                    🎓 {livre.niveau}
                                </Text>
                            )}
                        </View>
                        <View style={styles.livreFooter}>
                            <View style={[
                                styles.etatBadge,
                                { backgroundColor: getEtatColor(livre.etat_livre) + '20' }
                            ]}>
                                <Text style={[
                                    styles.etatText,
                                    { color: getEtatColor(livre.etat_livre) }
                                ]}>
                                    {livre.etat_livre}
                                </Text>
                            </View>
                            {item.distance_km && (
                                <Text style={styles.distanceText}>
                                    📍 {item.distance_km.toFixed(1)} km
                                </Text>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </NativeCard>
        );
    };

    const getEtatColor = (etat: string): string => {
        switch (etat) {
            case 'Neuf': return modernColors.success;
            case 'Très bon': return '#10B981';
            case 'Bon': return modernColors.warning;
            case 'Acceptable': return modernColors.error;
            default: return modernColors.textSecondary;
        }
    };

    if (loading && livres.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
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
                    {livres.length} livre{livres.length > 1 ? 's' : ''} trouvé{livres.length > 1 ? 's' : ''}
                </Text>
            </View>

            {livres.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="book-open" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucun livre trouvé</Text>
                    <Text style={styles.emptySubtext}>
                        Essayez de modifier vos critères de recherche
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={livres}
                    renderItem={renderLivre}
                    keyExtractor={(item) => item.livre.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadLivres(true)}
                        />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        hasMore && !loading ? (
                            <ActivityIndicator size="small" color={modernColors.primary} />
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
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    livreCard: {
        marginBottom: 12,
    },
    livreCardContent: {
        flexDirection: 'row',
        gap: 12,
    },
    livreImage: {
        width: 100,
        height: 140,
        borderRadius: 8,
        backgroundColor: '#E5E7EB',
    },
    livreInfo: {
        flex: 1,
        gap: 8,
    },
    livreTitre: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    livreAuteur: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    livreMeta: {
        gap: 4,
    },
    livreMetaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    livreFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    etatBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    etatText: {
        fontSize: 12,
        fontWeight: '600',
    },
    distanceText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default LivreScolaireListScreen;

