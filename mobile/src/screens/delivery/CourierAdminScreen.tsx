import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface CourierApplication {
    id: string;
    user_id: number;
    user_name: string;
    user_email?: string;
    user_avatar?: string;
    status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
    submitted_at: string | null;
    reviewed_at: string | null;
    reviewer_id: number | null;
    rejection_reason: string | null;
    profile_data: any;
    documents: any;
    notes: any;
    created_at: string;
    updated_at: string;
}

const CourierAdminScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [applications, setApplications] = useState<CourierApplication[]>([]);
    const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'approved' | 'rejected'>('all');
    const [selectedApplication, setSelectedApplication] = useState<CourierApplication | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (user?.role !== 'admin') {
            Alert.alert('Accès refusé', 'Cette page est réservée aux administrateurs', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
            return;
        }
        loadApplications();
    }, [user, filter]);

    const loadApplications = async () => {
        try {
            setLoading(true);
            const statusParam = filter !== 'all' ? `?status=${filter}` : '';
            const response = await apiGet(`/api/courier/applications${statusParam}`);
            const data = response.data || response;
            
            if (data.applications) {
                setApplications(data.applications);
            } else if (Array.isArray(data)) {
                setApplications(data);
            } else {
                setApplications([]);
            }
        } catch (error: any) {
            console.error('[CourierAdminScreen] Erreur chargement candidatures:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les candidatures');
            setApplications([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (applicationId: string) => {
        try {
            setProcessing(applicationId);
            const response = await apiPost(`/api/courier/applications/${applicationId}/approve`, {});
            
            if (response.success !== false) {
                Alert.alert('✅ Succès', 'La candidature a été approuvée avec succès', [
                    { text: 'OK', onPress: () => {
                        setShowDetailModal(false);
                        loadApplications();
                    }},
                ]);
            } else {
                throw new Error(response.message || 'Erreur lors de l\'approbation');
            }
        } catch (error: any) {
            console.error('[CourierAdminScreen] Erreur approbation:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'approuver la candidature');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (applicationId: string) => {
        if (!rejectionReason.trim()) {
            Alert.alert('Erreur', 'Veuillez indiquer une raison de refus');
            return;
        }

        try {
            setProcessing(applicationId);
            const response = await apiPost(`/api/courier/applications/${applicationId}/reject`, {
                rejection_reason: rejectionReason,
            });
            
            if (response.success !== false) {
                Alert.alert('✅ Succès', 'La candidature a été rejetée', [
                    { text: 'OK', onPress: () => {
                        setShowRejectModal(false);
                        setShowDetailModal(false);
                        setRejectionReason('');
                        loadApplications();
                    }},
                ]);
            } else {
                throw new Error(response.message || 'Erreur lors du rejet');
            }
        } catch (error: any) {
            console.error('[CourierAdminScreen] Erreur rejet:', error);
            Alert.alert('Erreur', error.message || 'Impossible de rejeter la candidature');
        } finally {
            setProcessing(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return modernColors.success;
            case 'rejected':
                return modernColors.error;
            case 'submitted':
            case 'under_review':
                return modernColors.warning;
            default:
                return modernColors.textSecondary;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft':
                return 'Brouillon';
            case 'submitted':
                return 'Soumis';
            case 'under_review':
                return 'En examen';
            case 'approved':
                return 'Approuvé';
            case 'rejected':
                return 'Rejeté';
            default:
                return status;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const renderApplicationItem = ({ item }: { item: CourierApplication }) => (
        <TouchableOpacity
            style={styles.applicationCard}
            onPress={() => {
                setSelectedApplication(item);
                setShowDetailModal(true);
            }}
        >
            <View style={styles.applicationHeader}>
                <View style={styles.applicationUserInfo}>
                    {item.user_avatar ? (
                        <View style={styles.avatarContainer}>
                            <Text style={styles.avatarText}>
                                {item.user_name.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    ) : (
                        <SafeIcon name="user" size={24} color={modernColors.primary} />
                    )}
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{item.user_name}</Text>
                        {item.user_email && (
                            <Text style={styles.userEmail}>{item.user_email}</Text>
                        )}
                    </View>
                </View>
                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) + '20' },
                    ]}
                >
                    <Text
                        style={[
                            styles.statusText,
                            { color: getStatusColor(item.status) },
                        ]}
                    >
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>
            <View style={styles.applicationMeta}>
                <Text style={styles.metaText}>
                    Soumis: {formatDate(item.submitted_at)}
                </Text>
                {item.reviewed_at && (
                    <Text style={styles.metaText}>
                        Examiné: {formatDate(item.reviewed_at)}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    if (user?.role !== 'admin') {
        return null;
    }

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Gestion des coursiers</Text>
            </View>

            {/* Filtres */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersContainer}
                contentContainerStyle={styles.filtersContent}
            >
                {(['all', 'submitted', 'under_review', 'approved', 'rejected'] as const).map(
                    (filterOption) => (
                        <TouchableOpacity
                            key={filterOption}
                            style={[
                                styles.filterButton,
                                filter === filterOption && styles.filterButtonActive,
                            ]}
                            onPress={() => setFilter(filterOption)}
                        >
                            <Text
                                style={[
                                    styles.filterText,
                                    filter === filterOption && styles.filterTextActive,
                                ]}
                            >
                                {getStatusLabel(filterOption === 'all' ? 'all' : filterOption)}
                            </Text>
                        </TouchableOpacity>
                    ),
                )}
            </ScrollView>

            {/* Liste des candidatures */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : applications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="inbox" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucune candidature trouvée</Text>
                </View>
            ) : (
                <FlatList
                    data={applications}
                    renderItem={renderApplicationItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={loadApplications}
                />
            )}

            {/* Modal de détails */}
            <Modal
                visible={showDetailModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDetailModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Détails de la candidature</Text>
                            <TouchableOpacity
                                onPress={() => setShowDetailModal(false)}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedApplication && (
                            <ScrollView style={styles.modalBody}>
                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Candidat</Text>
                                    <Text style={styles.detailValue}>
                                        {selectedApplication.user_name}
                                    </Text>
                                    {selectedApplication.user_email && (
                                        <Text style={styles.detailValue}>
                                            {selectedApplication.user_email}
                                        </Text>
                                    )}
                                </NativeCard>

                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Statut</Text>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            {
                                                backgroundColor:
                                                    getStatusColor(selectedApplication.status) +
                                                    '20',
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusText,
                                                {
                                                    color: getStatusColor(
                                                        selectedApplication.status,
                                                    ),
                                                },
                                            ]}
                                        >
                                            {getStatusLabel(selectedApplication.status)}
                                        </Text>
                                    </View>
                                </NativeCard>

                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Informations personnelles</Text>
                                    {selectedApplication.profile_data?.personal && (
                                        <View style={styles.profileSection}>
                                            <Text style={styles.profileText}>
                                                Nom: {selectedApplication.profile_data.personal.fullName || 'N/A'}
                                            </Text>
                                            <Text style={styles.profileText}>
                                                Téléphone: {selectedApplication.profile_data.personal.phone || 'N/A'}
                                            </Text>
                                            <Text style={styles.profileText}>
                                                Adresse: {selectedApplication.profile_data.personal.address || 'N/A'}
                                            </Text>
                                            <Text style={styles.profileText}>
                                                Ville: {selectedApplication.profile_data.personal.city || 'N/A'}
                                            </Text>
                                        </View>
                                    )}
                                </NativeCard>

                                <NativeCard style={styles.detailCard}>
                                    <Text style={styles.detailLabel}>Moyen de transport</Text>
                                    {selectedApplication.profile_data?.transport && (
                                        <View style={styles.profileSection}>
                                            <Text style={styles.profileText}>
                                                Type: {selectedApplication.profile_data.transport.vehicleType || 'N/A'}
                                            </Text>
                                            {selectedApplication.profile_data.transport.vehicleBrand && (
                                                <Text style={styles.profileText}>
                                                    Marque: {selectedApplication.profile_data.transport.vehicleBrand}
                                                </Text>
                                            )}
                                            {selectedApplication.profile_data.transport.vehicleModel && (
                                                <Text style={styles.profileText}>
                                                    Modèle: {selectedApplication.profile_data.transport.vehicleModel}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </NativeCard>

                                {selectedApplication.rejection_reason && (
                                    <NativeCard style={styles.detailCard}>
                                        <Text style={styles.detailLabel}>Raison du refus</Text>
                                        <Text style={styles.rejectionReason}>
                                            {selectedApplication.rejection_reason}
                                        </Text>
                                    </NativeCard>
                                )}

                                {selectedApplication.status === 'submitted' ||
                                selectedApplication.status === 'under_review' ? (
                                    <View style={styles.modalActions}>
                                        <NativeButton
                                            title="Approuver"
                                            variant="primary"
                                            onPress={() => {
                                                Alert.alert(
                                                    'Confirmer',
                                                    'Êtes-vous sûr de vouloir approuver cette candidature ?',
                                                    [
                                                        { text: 'Annuler', style: 'cancel' },
                                                        {
                                                            text: 'Approuver',
                                                            onPress: () =>
                                                                handleApprove(selectedApplication.id),
                                                        },
                                                    ],
                                                );
                                            }}
                                            disabled={processing === selectedApplication.id}
                                        />
                                        <NativeButton
                                            title="Rejeter"
                                            variant="outline"
                                            onPress={() => {
                                                setShowRejectModal(true);
                                            }}
                                            disabled={processing === selectedApplication.id}
                                        />
                                    </View>
                                ) : null}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal de rejet */}
            <Modal
                visible={showRejectModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowRejectModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Raison du refus</Text>
                            <TouchableOpacity
                                onPress={() => setShowRejectModal(false)}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.inputLabel}>
                                Indiquez la raison du refus (obligatoire)
                            </Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Ex: Documents incomplets, informations manquantes..."
                                value={rejectionReason}
                                onChangeText={setRejectionReason}
                                multiline
                                numberOfLines={4}
                            />
                            <View style={styles.modalActions}>
                                <NativeButton
                                    title="Annuler"
                                    variant="outline"
                                    onPress={() => {
                                        setShowRejectModal(false);
                                        setRejectionReason('');
                                    }}
                                />
                                <NativeButton
                                    title="Rejeter"
                                    variant="primary"
                                    onPress={() => {
                                        if (selectedApplication) {
                                            handleReject(selectedApplication.id);
                                        }
                                    }}
                                    disabled={!rejectionReason.trim() || processing !== null}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
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
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    filtersContainer: {
        maxHeight: 60,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    filtersContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    filterTextActive: {
        color: modernColors.surface,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    emptyText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    listContent: {
        padding: 16,
    },
    applicationCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    applicationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    applicationUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    userEmail: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    applicationMeta: {
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        padding: 16,
    },
    detailCard: {
        marginBottom: 16,
        padding: 16,
    },
    detailLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    detailValue: {
        fontSize: 16,
        color: modernColors.text,
        marginBottom: 4,
    },
    profileSection: {
        gap: 8,
    },
    profileText: {
        fontSize: 14,
        color: modernColors.text,
    },
    rejectionReason: {
        fontSize: 14,
        color: modernColors.error,
        fontStyle: 'italic',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.background,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
});

export default CourierAdminScreen;





