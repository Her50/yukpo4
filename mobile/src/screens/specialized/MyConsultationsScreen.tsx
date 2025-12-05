// ✅ Phase 2: Écran liste des consultations hôpitaux pour le client
import { useNavigation } from '@react-navigation/native';
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
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useAuth } from '../../contexts/AuthContext';
import { HospitalConsultation, hospitalService } from '../../services/hospitalService';
import { modernColors } from '../../theme/modernTheme';

const MyConsultationsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [consultations, setConsultations] = useState<HospitalConsultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const limit = 20;

    useEffect(() => {
        if (user) {
            loadConsultations(true);
        } else {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour voir vos consultations');
            navigation.goBack();
        }
    }, [statusFilter]);

    const loadConsultations = async (reset = false) => {
        try {
            if (reset) {
                setPage(1);
                setConsultations([]);
                setHasMore(true);
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const currentPage = reset ? 1 : page;
            const response = await hospitalService.getMyConsultations(currentPage, limit);

            if (response.success && response.data) {
                const newConsultations = response.data.consultations || [];

                if (reset) {
                    setConsultations(newConsultations);
                } else {
                    setConsultations(prev => [...prev, ...newConsultations]);
                }

                setHasMore(newConsultations.length === limit);
                setPage(currentPage + 1);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de charger les consultations');
            }
        } catch (error: any) {
            console.error('[MyConsultationsScreen] Erreur chargement:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les consultations');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadConsultations(true);
    };

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            loadConsultations(false);
        }
    };

    const getStatusColor = (status: string | null) => {
        if (!status) return modernColors.textSecondary;
        switch (status.toLowerCase()) {
            case 'confirmed':
            case 'confirmed':
                return modernColors.success;
            case 'pending':
            case 'en_attente':
                return modernColors.warning;
            case 'completed':
            case 'completed':
                return modernColors.primary;
            case 'cancelled':
            case 'annulée':
                return modernColors.error;
            default:
                return modernColors.textSecondary;
        }
    };

    const getStatusLabel = (status: string | null) => {
        if (!status) return 'Inconnu';
        switch (status.toLowerCase()) {
            case 'confirmed':
            case 'confirmée':
                return 'Confirmée';
            case 'pending':
            case 'en_attente':
                return 'En attente';
            case 'completed':
            case 'terminée':
                return 'Terminée';
            case 'cancelled':
            case 'annulée':
                return 'Annulée';
            default:
                return status;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Non spécifié';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const handleViewDetails = (consultation: HospitalConsultation) => {
        navigation.navigate('HopitalDetails' as never, {
            hospitalId: consultation.hospital_id,
        } as never);
    };

    const renderConsultation = ({ item }: { item: HospitalConsultation }) => {
        const statusColor = getStatusColor(item.status);
        const statusLabel = getStatusLabel(item.status);

        return (
            <TouchableOpacity
                onPress={() => handleViewDetails(item)}
                activeOpacity={0.8}
            >
                <NativeCard style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.hospitalInfo}>
                            <SafeIcon name="hospital" size={24} color={modernColors.primary} />
                            <View style={styles.hospitalDetails}>
                                <Text style={styles.hospitalName}>
                                    {item.hospital_name || 'Hôpital non spécifié'}
                                </Text>
                                {item.type_etablissement && (
                                    <Text style={styles.hospitalType}>
                                        {item.type_etablissement}
                                    </Text>
                                )}
                            </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {statusLabel}
                            </Text>
                        </View>
                    </View>

                    {item.specialty && (
                        <View style={styles.specialtyRow}>
                            <SafeIcon name="stethoscope" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.specialtyText}>{item.specialty}</Text>
                        </View>
                    )}

                    {item.consultation_date && (
                        <View style={styles.dateRow}>
                            <SafeIcon name="calendar" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.dateText}>
                                {formatDate(item.consultation_date)}
                            </Text>
                        </View>
                    )}

                    {item.notes && (
                        <View style={styles.notesContainer}>
                            <Text style={styles.notesLabel}>Notes:</Text>
                            <Text style={styles.notesText} numberOfLines={2}>
                                {item.notes}
                            </Text>
                        </View>
                    )}

                    <View style={styles.cardFooter}>
                        <Text style={styles.createdDate}>
                            Créée le {formatDate(item.created_at)}
                        </Text>
                        <NativeButton
                            title="Voir détails"
                            onPress={() => handleViewDetails(item)}
                            variant="outline"
                            size="small"
                        />
                    </View>
                </NativeCard>
            </TouchableOpacity>
        );
    };

    const renderFilters = () => (
        <View style={styles.filtersContainer}>
            <Text style={styles.filtersTitle}>Filtrer par statut:</Text>
            <View style={styles.filtersRow}>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === null && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter(null)}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === null && styles.filterButtonTextActive,
                        ]}
                    >
                        Tous
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'pending' && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter('pending')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === 'pending' && styles.filterButtonTextActive,
                        ]}
                    >
                        En attente
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'confirmed' && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter('confirmed')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === 'confirmed' && styles.filterButtonTextActive,
                        ]}
                    >
                        Confirmées
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        statusFilter === 'completed' && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter('completed')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === 'completed' && styles.filterButtonTextActive,
                        ]}
                    >
                        Terminées
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Mes consultations</Text>
            </View>

            {renderFilters()}

            {loading && consultations.length === 0 ? (
                <View style={styles.listContent}>
                    <SkeletonList count={5} />
                </View>
            ) : consultations.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="clipboard-list" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyTitle}>Aucune consultation</Text>
                    <Text style={styles.emptyText}>
                        Vous n'avez pas encore de consultations enregistrées.
                    </Text>
                    <NativeButton
                        title="Rechercher un hôpital"
                        onPress={() => navigation.navigate('HopitalSearch' as never)}
                        variant="primary"
                        style={styles.emptyButton}
                    />
                </View>
            ) : (
                <FlatList
                    data={consultations}
                    renderItem={renderConsultation}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            colors={[modernColors.primary]}
                        />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator size="small" color={modernColors.primary} style={styles.loader} />
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
    filtersContainer: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filtersTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterButtonText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
    },
    listContent: {
        padding: 16,
    },
    card: {
        marginBottom: 12,
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    hospitalInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    hospitalDetails: {
        marginLeft: 12,
        flex: 1,
    },
    hospitalName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    hospitalType: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    specialtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    specialtyText: {
        fontSize: 14,
        color: modernColors.text,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    dateText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    notesContainer: {
        marginTop: 8,
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    notesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    notesText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    createdDate: {
        fontSize: 12,
        color: modernColors.textSecondary,
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
        color: modernColors.textSecondary,
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
        marginTop: 8,
    },
    loader: {
        marginVertical: 16,
    },
});

export default MyConsultationsScreen;

