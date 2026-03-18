import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface DonorMatch {
    match_id: string;
    donor_user_id: number;
    donor_name: string | null;
    donor_telephone: string | null;
    donor_whatsapp: string | null;
    groupe_sanguin: string;
    distance_km: number | null;
    relevance_score: number;
    match_status: string;
    notified_at: string | null;
}

interface RequestInfo {
    id: string;
    banque_sang_nom: string;
    groupe_sanguin_requis: string;
    quantite_requise: number;
    is_urgent: boolean;
    urgence_level: string;
    status: string;
    matches_count: number;
    accepted_matches_count: number;
}

const BloodDonationMatchesScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user } = useAuth();
    const requestId = (route.params as any)?.requestId as string;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [matches, setMatches] = useState<DonorMatch[]>([]);
    const [requestInfo, setRequestInfo] = useState<RequestInfo | null>(null);
    const [notifying, setNotifying] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [requestId]);

    const loadData = async () => {
        if (!requestId) return;
        try {
            setLoading(true);
            await Promise.all([loadRequestInfo(), loadMatches()]);
        } catch (error: any) {
            console.error('[BloodDonationMatchesScreen] Erreur chargement:', error);
            Alert.alert('Erreur', 'Impossible de charger les matches');
        } finally {
            setLoading(false);
        }
    };

    const loadRequestInfo = async () => {
        try {
            const response = await apiGet(`/api/blood-donation/requests/${requestId}`);
            if (response.success && response.data) {
                setRequestInfo(response.data as RequestInfo);
            }
        } catch (error: any) {
            console.error('[BloodDonationMatchesScreen] Erreur chargement info demande:', error);
        }
    };

    const loadMatches = async () => {
        try {
            const response = await apiGet(`/api/blood-donation/requests/${requestId}/matches`);
            if (response.success && response.data) {
                setMatches((response.data as any).matches || []);
            }
        } catch (error: any) {
            console.error('[BloodDonationMatchesScreen] Erreur chargement matches:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleNotifyDonors = async () => {
        try {
            setNotifying('all');
            const response = await apiPost(`/api/blood-donation/requests/${requestId}/notify`, {
                max_donors_to_notify: 20,
            });

            if (response.success) {
                const notified = (response.data as any)?.notified_count || 0;
                Alert.alert(t('bloodDonationMatchesScreen.succes'), t('bloodDonationMatchesScreen.donneursOntEteNotifies', { notified: notified }));
                await loadMatches(); // Recharger pour voir les statuts mis à jour
            } else {
                Alert.alert('Erreur', (response as any).error || 'Impossible de notifier les donneurs');
            }
        } catch (error: any) {
            console.error('[BloodDonationMatchesScreen] Erreur notification:', error);
            Alert.alert('Erreur', error.message || 'Impossible de notifier les donneurs');
        } finally {
            setNotifying(null);
        }
    };

    const handleCall = (phoneNumber: string | null) => {
        if (!phoneNumber) {
            Alert.alert('Erreur', t('bloodDonationMatchesScreen.numeroDeTelephoneNonDisponible'));
            return;
        }
        Linking.openURL(`tel:${phoneNumber}`);
    };

    const handleWhatsApp = (whatsapp: string | null) => {
        if (!whatsapp) {
            Alert.alert('Erreur', t('bloodDonationMatchesScreen.numeroWhatsappNonDisponible'));
            return;
        }
        const cleanNumber = whatsapp.replace(/[^0-9]/g, '');
        Linking.openURL(`https://wa.me/${cleanNumber}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'accepted':
                return '#10B981'; // Vert
            case 'declined':
                return '#EF4444'; // Rouge
            case 'notified':
                return '#F59E0B'; // Orange
            case 'completed':
                return '#6366F1'; // Indigo
            default:
                return '#6B7280'; // Gris
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'accepted':
                return t('bloodDonationMatchesScreen.accepte');
            case 'declined':
                return t('bloodDonationMatchesScreen.refuse');
            case 'notified':
                return t('bloodDonationMatchesScreen.notifie');
            case 'completed':
                return t('bloodDonationMatchesScreen.complete');
            default:
                return 'En attente';
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Matches donneurs</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('bloodDonationMatches.chargement')}</Text>
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
                <Text style={styles.title}>Matches donneurs</Text>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {/* Informations de la demande */}
                {requestInfo && (
                    <View style={styles.requestInfoCard}>
                        <View style={styles.requestHeader}>
                            <View>
                                <Text style={styles.requestTitle}>{requestInfo.banque_sang_nom}</Text>
                                <Text style={styles.requestSubtitle}>
                                    Groupe requis: <Text style={styles.bloodGroup}>{requestInfo.groupe_sanguin_requis}</Text>
                                </Text>
                            </View>
                            {requestInfo.is_urgent && (
                                <View style={[styles.urgentBadge, { backgroundColor: '#EF4444' }]}>
                                    <Text style={styles.urgentBadgeText}>URGENT</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.requestStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Matches</Text>
                                <Text style={styles.statValue}>{requestInfo.matches_count}</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>{t('bloodDonationMatches.acceptes')}</Text>
                                <Text style={[styles.statValue, { color: '#10B981' }]}>
                                    {requestInfo.accepted_matches_count}
                                </Text>
                            </View>
                        </View>

                        <NativeButton
                            title={
                                notifying === 'all'
                                    ? 'Notification en cours...'
                                    : `Notifier ${matches.filter((m) => m.match_status === 'pending').length} donneur(s)`
                            }
                            onPress={handleNotifyDonors}
                            disabled={notifying !== null || matches.filter((m) => m.match_status === 'pending').length === 0}
                            variant="primary"
                            size="medium"
                            style={styles.notifyButton}
                        />
                    </View>
                )}

                {/* Liste des matches */}
                <View style={styles.matchesSection}>
                    <Text style={styles.sectionTitle}>
                        Donneurs compatibles ({matches.length})
                    </Text>

                    {matches.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="users" size={48} color="#9CA3AF" />
                            <Text style={styles.emptyText}>{t('bloodDonationMatches.aucunDonneurCompatibleTrouve')}</Text>
                            <Text style={styles.emptySubtext}>
                                Les donneurs seront automatiquement trouvés selon leur localisation
                            </Text>
                        </View>
                    ) : (
                        matches.map((match) => (
                            <View key={match.match_id} style={styles.matchCard}>
                                <View style={styles.matchHeader}>
                                    <View style={styles.matchHeaderLeft}>
                                        <View style={[styles.bloodGroupBadge, { borderColor: '#DC2626' }]}>
                                            <Text style={[styles.bloodGroupText, { color: '#DC2626' }]}>
                                                {match.groupe_sanguin}
                                            </Text>
                                        </View>
                                        <View style={styles.matchInfo}>
                                            <Text style={styles.donorName}>
                                                {match.donor_name || `Donneur #${match.donor_user_id}`}
                                            </Text>
                                            {match.distance_km !== null && (
                                                <Text style={styles.distance}>
                                                    \uD83D\uDCCD {match.distance_km.toFixed(1)} km
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            { backgroundColor: `${getStatusColor(match.match_status)}20` },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.statusText,
                                                { color: getStatusColor(match.match_status) },
                                            ]}
                                        >
                                            {getStatusLabel(match.match_status)}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.matchActions}>
                                    {match.donor_telephone && (
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleCall(match.donor_telephone)}
                                        >
                                            <SafeIcon name="phone" size={18} color={modernColors.primary} />
                                            <Text style={styles.actionButtonText}>Appeler</Text>
                                        </TouchableOpacity>
                                    )}
                                    {match.donor_whatsapp && (
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleWhatsApp(match.donor_whatsapp)}
                                        >
                                            <SafeIcon name="message-circle" size={18} color="#25D366" />
                                            <Text style={[styles.actionButtonText, { color: '#25D366' }]}>
                                                WhatsApp
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {match.notified_at && (
                                    <Text style={styles.notifiedText}>
                                        Notifié le {new Date(match.notified_at).toLocaleDateString('fr-FR')}
                                    </Text>
                                )}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    requestInfoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    requestTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    requestSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    bloodGroup: {
        fontWeight: '700',
        color: '#DC2626',
    },
    urgentBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    urgentBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
    requestStats: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    notifyButton: {
        marginTop: 8,
    },
    matchesSection: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
    },
    matchCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    matchHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    bloodGroupBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
    },
    bloodGroupText: {
        fontSize: 14,
        fontWeight: '700',
    },
    matchInfo: {
        flex: 1,
    },
    donorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    distance: {
        fontSize: 12,
        color: '#6B7280',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    matchActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    notifiedText: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 8,
        fontStyle: 'italic',
    },
});

export default BloodDonationMatchesScreen;

