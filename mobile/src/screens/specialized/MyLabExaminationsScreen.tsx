// ✅ Phase 2: Écran liste des examens laboratoires pour le client
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
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { LabExamination, labService } from '../../services/labService';
import { modernColors } from '../../theme/modernTheme';

const MyLabExaminationsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [examinations, setExaminations] = useState<LabExamination[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const limit = 20;

    useEffect(() => {
        if (user) {
            loadExaminations(true);
        } else {
            Alert.alert(t('labExams.loginRequired'), t('labExams.loginToViewExams'));
            navigation.goBack();
        }
    }, [statusFilter]);

    const loadExaminations = async (reset = false) => {
        try {
            if (reset) {
                setPage(1);
                setExaminations([]);
                setHasMore(true);
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const currentPage = reset ? 1 : page;
            const response = await labService.getMyExaminations(currentPage, limit);

            if (response.success && response.data) {
                const newExaminations = response.data.examinations || [];

                // Filtrer par statut si nécessaire
                const filteredExaminations = statusFilter
                    ? newExaminations.filter(exam => exam.status?.toLowerCase() === statusFilter.toLowerCase())
                    : newExaminations;

                if (reset) {
                    setExaminations(filteredExaminations);
                } else {
                    setExaminations(prev => [...prev, ...filteredExaminations]);
                }

                setHasMore(newExaminations.length === limit);
                setPage(currentPage + 1);
            } else {
                Alert.alert(t('message.error'), response.error || t('labExams.cannotLoadExams'));
            }
        } catch (error: any) {
            console.error('[MyLabExaminationsScreen] Erreur chargement:', error);
            Alert.alert(t('message.error'), error.message || t('labExams.cannotLoadExams'));
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadExaminations(true);
    };

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            loadExaminations(false);
        }
    };

    const getStatusColor = (status: string | null) => {
        if (!status) return modernColors.textSecondary;
        switch (status.toLowerCase()) {
            case 'pending':
            case 'en_attente':
                return modernColors.warning;
            case 'scheduled':
            case 'programmé':
                return modernColors.info;
            case 'in_progress':
            case 'en_cours':
                return modernColors.primary;
            case 'completed':
            case 'terminé':
                return modernColors.success;
            case 'cancelled':
            case 'annulé':
                return modernColors.error;
            default:
                return modernColors.textSecondary;
        }
    };

    const getStatusLabel = (status: string | null) => {
        if (!status) return 'Inconnu';
        switch (status.toLowerCase()) {
            case 'pending':
            case 'en_attente':
                return 'En attente';
            case 'scheduled':
            case 'programmé':
                return 'Programmé';
            case 'in_progress':
            case 'en_cours':
                return 'En cours';
            case 'completed':
            case 'terminé':
                return 'Terminé';
            case 'cancelled':
            case 'annulé':
                return 'Annulé';
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

    const handleViewResults = async (examination: LabExamination) => {
        if (examination.status?.toLowerCase() !== 'completed') {
            Alert.alert(
                t('labExams.resultsUnavailable'),
                t('labExams.resultsUnavailableMsg')
            );
            return;
        }

        if (!user) {
            Alert.alert(t('labExams.loginRequired'), t('labExams.loginToViewResults'));
            navigation.navigate('Login' as never);
            return;
        }

        // Navigation vers l'écran d'analyse IA qui affiche aussi les résultats
        navigation.navigate('LabAIAnalysis' as never, {
            examinationId: examination.id,
        } as never);
    };

    const handleAnalyzeWithAI = async (examination: LabExamination) => {
        if (examination.status?.toLowerCase() !== 'completed') {
            Alert.alert(
                t('labExams.aiAnalysisUnavailable'),
                t('labExams.aiAnalysisUnavailableMsg')
            );
            return;
        }

        if (!user) {
            Alert.alert(t('labExams.loginRequired'), t('labExams.loginToAnalyze'));
            navigation.navigate('Login' as never);
            return;
        }

        // Navigation vers l'écran d'analyse IA
        navigation.navigate('LabAIAnalysis' as never, {
            examinationId: examination.id,
        } as never);
    };

    const handleViewDetails = (examination: LabExamination) => {
        // TODO: Récupérer le laboratoire ID depuis l'examen
        Alert.alert(t('labExams.info'), t('labExams.labDetailsComingSoon'));
    };

    const renderExamination = ({ item }: { item: LabExamination }) => {
        const statusColor = getStatusColor(item.status);
        const statusLabel = getStatusLabel(item.status);
        const isCompleted = item.status?.toLowerCase() === 'completed';

        return (
            <NativeCard style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.labInfo}>
                        <SafeIcon name="flask" size={24} color={modernColors.primary} />
                        <View style={styles.labDetails}>
                            <Text style={styles.labName}>
                                {item.laboratory_name || 'Laboratoire non spécifié'}
                            </Text>
                            {item.examination_type_name && (
                                <Text style={styles.examType}>
                                    {item.examination_type_name}
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

                {item.scheduled_date && (
                    <View style={styles.dateRow}>
                        <SafeIcon name="calendar" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.dateText}>
                            Programmé le {formatDate(item.scheduled_date)}
                        </Text>
                    </View>
                )}

                {item.completed_at && (
                    <View style={styles.dateRow}>
                        <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                        <Text style={styles.completedDate}>
                            Terminé le {formatDate(item.completed_at)}
                        </Text>
                    </View>
                )}

                <View style={styles.cardFooter}>
                    <Text style={styles.createdDate}>
                        Créé le {formatDate(item.created_at)}
                    </Text>
                    <View style={styles.actionsRow}>
                        {isCompleted && (
                            <>
                                <NativeButton
                                    title="Voir résultats"
                                    onPress={() => handleViewResults(item)}
                                    variant="primary"
                                    size="small"
                                    style={styles.actionButton}
                                />
                                <NativeButton
                                    title="Analyse IA"
                                    onPress={() => handleAnalyzeWithAI(item)}
                                    variant="outline"
                                    size="small"
                                    style={styles.actionButton}
                                />
                            </>
                        )}
                        {!isCompleted && (
                            <NativeButton
                                title="Voir détails"
                                onPress={() => handleViewDetails(item)}
                                variant="outline"
                                size="small"
                                style={styles.actionButton}
                            />
                        )}
                    </View>
                </View>
            </NativeCard>
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
                        statusFilter === 'scheduled' && styles.filterButtonActive,
                    ]}
                    onPress={() => setStatusFilter('scheduled')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            statusFilter === 'scheduled' && styles.filterButtonTextActive,
                        ]}
                    >
                        Programmés
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
                        Terminés
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
                <Text style={styles.title}>Mes examens</Text>
            </View>

            {renderFilters()}

            {loading && examinations.length === 0 ? (
                <View style={styles.listContent}>
                    <SkeletonList count={5} />
                </View>
            ) : examinations.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="flask" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyTitle}>Aucun examen</Text>
                    <Text style={styles.emptyText}>
                        Vous n'avez pas encore effectué d'examen de laboratoire.
                    </Text>
                    <NativeButton
                        title="Rechercher un laboratoire"
                        onPress={() => navigation.navigate('LaboratoireSearch' as never)}
                        variant="primary"
                        style={styles.emptyButton}
                    />
                </View>
            ) : (
                <FlatList
                    data={examinations}
                    renderItem={renderExamination}
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
    labInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    labDetails: {
        marginLeft: 12,
        flex: 1,
    },
    labName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    examType: {
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
    completedDate: {
        fontSize: 14,
        color: modernColors.success,
        fontWeight: '500',
    },
    cardFooter: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    createdDate: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    actionButton: {
        flex: 1,
        minWidth: 100,
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

export default MyLabExaminationsScreen;

