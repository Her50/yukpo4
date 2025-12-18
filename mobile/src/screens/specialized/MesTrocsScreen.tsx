// ✅ Liste des trocs de l'utilisateur (Mobile)

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface TrocLivre {
    id: number;
    type_troc: string; // "direct" ou "chaine"
    statut: string; // "en_attente", "accepte", "refuse", "annule", "complete"
    livre_offert_id: number;
    livre_souhaite_id: number;
    participant_id?: number;
    initiateur_id: number;
    chaine_troc_id?: number;
    distance_km?: number;
    validation_initiateur: boolean;
    validation_participant: boolean;
    created_at: string;
    livre_offert?: any;
    livre_souhaite?: any;
    participant?: any;
}

const MesTrocsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [trocs, setTrocs] = useState<TrocLivre[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<string>('all'); // 'all', 'en_attente', 'accepte', 'complete'

    useFocusEffect(
        useCallback(() => {
            loadTrocs();
        }, [filter])
    );

    const loadTrocs = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const params = filter !== 'all' ? `?statut=${filter}` : '';
            const response = await apiGet(`/api/troc-livres/my-trocs${params}`);

            if (response.success && response.data) {
                setTrocs(response.data.trocs || []);
            } else {
                Alert.alert('Erreur', 'Impossible de charger vos trocs');
            }
        } catch (error: any) {
            console.error('[MesTrocsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger vos trocs');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getStatutColor = (statut: string): string => {
        switch (statut) {
            case 'en_attente': return modernColors.warning;
            case 'accepte': return modernColors.success;
            case 'refuse': return modernColors.error;
            case 'complete': return modernColors.primary;
            case 'annule': return modernColors.textSecondary;
            default: return modernColors.textSecondary;
        }
    };

    const getStatutLabel = (statut: string): string => {
        switch (statut) {
            case 'en_attente': return 'En attente';
            case 'accepte': return 'Accepté';
            case 'refuse': return 'Refusé';
            case 'complete': return 'Complété';
            case 'annule': return 'Annulé';
            default: return statut;
        }
    };

    const renderTroc = ({ item }: { item: TrocLivre }) => {
        const isInitiateur = user?.id === item.initiateur_id;
        const statutColor = getStatutColor(item.statut);

        return (
            <NativeCard style={styles.trocCard}>
                <TouchableOpacity
                    onPress={() => {
                        navigation.navigate('TrocDetails' as never, {
                            trocId: item.id,
                            typeTroc: item.type_troc,
                        } as never);
                    }}
                >
                    <View style={styles.trocHeader}>
                        <View style={styles.trocInfo}>
                            <View style={[
                                styles.statutBadge,
                                { backgroundColor: statutColor + '20' }
                            ]}>
                                <Text style={[styles.statutText, { color: statutColor }]}>
                                    {getStatutLabel(item.statut)}
                                </Text>
                            </View>
                            {item.type_troc === 'chaine' && (
                                <View style={styles.chaineBadge}>
                                    <SafeIcon name="link" size={14} color={modernColors.primary} />
                                    <Text style={styles.chaineText}>Chaîne</Text>
                                </View>
                            )}
                        </View>
                        <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                    </View>

                    <View style={styles.trocContent}>
                        <View style={styles.livreRow}>
                            <View style={styles.livreItem}>
                                <Text style={styles.livreLabel}>
                                    {isInitiateur ? 'Vous offrez' : 'Vous recevez'}
                                </Text>
                                <Text style={styles.livreTitle} numberOfLines={2}>
                                    {item.livre_offert?.titre || 'Livre offert'}
                                </Text>
                            </View>
                            <SafeIcon name="arrow-right" size={20} color={modernColors.primary} />
                            <View style={styles.livreItem}>
                                <Text style={styles.livreLabel}>
                                    {isInitiateur ? 'Vous recevez' : 'Vous offrez'}
                                </Text>
                                <Text style={styles.livreTitle} numberOfLines={2}>
                                    {item.livre_souhaite?.titre || 'Livre souhaité'}
                                </Text>
                            </View>
                        </View>

                        {item.distance_km && (
                            <Text style={styles.distanceText}>
                                📍 {item.distance_km.toFixed(1)} km
                            </Text>
                        )}

                        <View style={styles.validationRow}>
                            <Text style={styles.validationLabel}>Validations:</Text>
                            <View style={styles.validationBadges}>
                                <View style={[
                                    styles.validationBadge,
                                    item.validation_initiateur && styles.validationBadgeValid
                                ]}>
                                    <Text style={[
                                        styles.validationText,
                                        item.validation_initiateur && styles.validationTextValid
                                    ]}>
                                        Initiateur
                                    </Text>
                                </View>
                                <View style={[
                                    styles.validationBadge,
                                    item.validation_participant && styles.validationBadgeValid
                                ]}>
                                    <Text style={[
                                        styles.validationText,
                                        item.validation_participant && styles.validationTextValid
                                    ]}>
                                        Participant
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </NativeCard>
        );
    };

    const filters = [
        { key: 'all', label: 'Tous' },
        { key: 'en_attente', label: 'En attente' },
        { key: 'accepte', label: 'Acceptés' },
        { key: 'complete', label: 'Complétés' },
    ];

    if (loading && trocs.length === 0) {
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
                <Text style={styles.title}>Mes Troc</Text>
            </View>

            {/* Filtres */}
            <View style={styles.filters}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filtersContent}
                >
                    {filters.map((f) => (
                        <TouchableOpacity
                            key={f.key}
                            style={[
                                styles.filterChip,
                                filter === f.key && styles.filterChipActive
                            ]}
                            onPress={() => setFilter(f.key)}
                        >
                            <Text style={[
                                styles.filterText,
                                filter === f.key && styles.filterTextActive
                            ]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {trocs.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="repeat" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucun troc</Text>
                    <Text style={styles.emptySubtext}>
                        {filter === 'all'
                            ? 'Vous n\'avez pas encore de troc. Créez-en un depuis un livre !'
                            : `Aucun troc avec le statut "${filters.find(f => f.key === filter)?.label}".`
                        }
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={trocs}
                    renderItem={renderTroc}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadTrocs(true)}
                        />
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
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    filters: {
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingVertical: 8,
    },
    filtersContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
    },
    filterText: {
        fontSize: 14,
        color: '#374151',
    },
    filterTextActive: {
        color: '#FFF',
        fontWeight: '600',
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
    trocCard: {
        marginBottom: 12,
    },
    trocHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    trocInfo: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    statutBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statutText: {
        fontSize: 12,
        fontWeight: '600',
    },
    chaineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: modernColors.primary + '20',
    },
    chaineText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    trocContent: {
        gap: 12,
    },
    livreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    livreItem: {
        flex: 1,
        gap: 4,
    },
    livreLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    livreTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    distanceText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    validationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    validationLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    validationBadges: {
        flexDirection: 'row',
        gap: 8,
    },
    validationBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    validationBadgeValid: {
        backgroundColor: modernColors.success + '20',
        borderColor: modernColors.success,
    },
    validationText: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    validationTextValid: {
        color: modernColors.success,
        fontWeight: '600',
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

export default MesTrocsScreen;

