// @ts-nocheck
// Écran "Mes Équipes" — liste les services où l'utilisateur est membre d'équipe + invitations en attente
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { NativeCard } from '../components/SafeNativeDesign';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';

interface TeamMembership {
    membership_id: string;
    service_id: number | null;
    service_name: string;
    category: string | null;
    role: {
        id: string;
        name: string;
        description: string;
        level: number;
        color: string;
        icon: string;
    };
    owner_id: number;
    owner_name: string | null;
    added_at: string | null;
}

interface PendingInvitation {
    id: string;
    service_id: number | null;
    service_name: string;
    category: string | null;
    token: string;
    role_name: string;
    role_color: string;
    role_icon: string;
    invited_by_name: string | null;
    invited_at: string | null;
}

// Mapping catégorie → écran de dashboard spécialisé
const CATEGORY_SCREEN_MAP: Record<string, string> = {
    pharmacie: 'PharmacieHomeScreen',
    hotel: 'HotelDashboardScreen',
    hopital: 'HopitalHomeScreen',
    laboratoire: 'LaboratoireFormScreen',
    agence_voyage: 'AgenceVoyageFormScreen',
    restaurant: 'RestaurantDashboardScreen',
    immobilier: 'ImmobilierDashboardScreen',
    taxi: 'TaxiHomeScreen',
    covoiturage: 'CovoiturageHomeScreen',
    bus: 'BusCompanyDashboard',
    assurance: 'AssuranceDashboardScreen',
};

const MesEquipesScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const [memberships, setMemberships] = useState<TeamMembership[]>([]);
    const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processingToken, setProcessingToken] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const response = await apiGet('/api/user/my-team-memberships');
            if (response.success) {
                const data = (response.data as any) || {};
                setMemberships(Array.isArray(data.memberships) ? data.memberships : []);
                setPendingInvitations(Array.isArray(data.pending_invitations) ? data.pending_invitations : []);
            }
        } catch (error) {
            console.error('[MesEquipesScreen] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const handleAcceptInvitation = async (token: string) => {
        setProcessingToken(token);
        try {
            const response = await apiPost(`/api/services/team/invitations/${token}/accept`, {});
            if (response.success || (response.data as any)?.success) {
                Alert.alert(t('message.success'), t('mesEquipes.invitationAccepted'));
                loadData();
            } else {
                Alert.alert(t('message.error'), (response.data as any)?.message || t('mesEquipes.cannotAccept'));
            }
        } catch (error) {
            Alert.alert(t('message.error'), t('mesEquipes.cannotAccept'));
        } finally {
            setProcessingToken(null);
        }
    };

    const handleRejectInvitation = async (token: string) => {
        Alert.alert(
            t('mesEquipes.rejectInvitation'),
            t('mesEquipes.confirmReject'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.reject'), style: 'destructive', onPress: async () => {
                        setProcessingToken(token);
                        try {
                            const response = await apiPost(`/api/services/team/invitations/${token}/reject`, {});
                            if (response.success || (response.data as any)?.success) {
                                Alert.alert('OK', t('mesEquipes.invitationRejected'));
                                loadData();
                            }
                        } catch (error) {
                            Alert.alert(t('message.error'), t('mesEquipes.cannotReject'));
                        } finally {
                            setProcessingToken(null);
                        }
                    }
                }
            ]
        );
    };

    const navigateToService = (membership: TeamMembership) => {
        const category = membership.category?.toLowerCase() || '';
        const screenName = CATEGORY_SCREEN_MAP[category];

        if (screenName) {
            navigation.navigate(screenName, { serviceId: membership.service_id });
        } else if (membership.service_id) {
            // Fallback: aller vers les produits du service
            navigation.navigate('MesProduitsScreen', { serviceId: membership.service_id });
        } else {
            Alert.alert(t('mesEquipes.info'), t('mesEquipes.navigationUnavailable'));
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch { return ''; }
    };

    const getCategoryLabel = (category: string | null) => {
        const map: Record<string, string> = {
            pharmacie: '\uD83D\uDC8A Pharmacie',
            hotel: t('mesEquipesScreen.hotel'),
            hopital: t('mesEquipesScreen.hopital'),
            laboratoire: '\uD83D\uDD2C Laboratoire',
            agence_voyage: '✈️ Agence de voyage',
            restaurant: '\uD83C\uDF7D️ Restaurant',
            immobilier: '\uD83C\uDFE0 Immobilier',
            taxi: '\uD83D\uDE95 Taxi',
            covoiturage: '\uD83D\uDE97 Covoiturage',
            bus: '\uD83D\uDE8C Bus',
            assurance: '\uD83D\uDEE1️ Assurance',
        };
        return map[category?.toLowerCase() || ''] || category || 'Service';
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>{t('mesEquipes.chargementDeVosEquipes')}</Text>
            </View>
        );
    }

    const isEmpty = memberships.length === 0 && pendingInvitations.length === 0;

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{t('mesEquipes.mesEquipes')}</Text>
                        <Text style={styles.headerSubtitle}>
                            {memberships.length} service{memberships.length !== 1 ? 's' : ''} co-géré{memberships.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366F1']} />}
            >
                {/* Invitations en attente */}
                {pendingInvitations.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="mail" size={20} color="#F59E0B" />
                            <Text style={styles.sectionTitle}>Invitations en attente ({pendingInvitations.length})</Text>
                        </View>
                        {pendingInvitations.map((inv) => (
                            <NativeCard key={inv.id} style={styles.invitationCard}>
                                <View style={styles.invitationTop}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.serviceName}>{inv.service_name}</Text>
                                        <Text style={styles.categoryLabel}>{getCategoryLabel(inv.category)}</Text>
                                        <Text style={styles.invitedBy}>
                                            Invité par {inv.invited_by_name || 'un administrateur'}
                                        </Text>
                                        <View style={[styles.roleBadge, { backgroundColor: (inv.role_color || '#6366F1') + '20' }]}>
                                            <SafeIcon name={inv.role_icon || 'user'} size={14} color={inv.role_color || '#6366F1'} />
                                            <Text style={[styles.roleText, { color: inv.role_color || '#6366F1' }]}>
                                                {inv.role_name}
                                            </Text>
                                        </View>
                                        {inv.invited_at && (
                                            <Text style={styles.dateText}>{formatDate(inv.invited_at)}</Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.invitationActions}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.rejectBtn]}
                                        onPress={() => handleRejectInvitation(inv.token)}
                                        disabled={processingToken === inv.token}
                                    >
                                        {processingToken === inv.token ? (
                                            <ActivityIndicator size="small" color="#DC2626" />
                                        ) : (
                                            <>
                                                <SafeIcon name="x" size={16} color="#DC2626" />
                                                <Text style={styles.rejectText}>Rejeter</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.acceptBtn]}
                                        onPress={() => handleAcceptInvitation(inv.token)}
                                        disabled={processingToken === inv.token}
                                    >
                                        {processingToken === inv.token ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <>
                                                <SafeIcon name="check" size={16} color="#fff" />
                                                <Text style={styles.acceptText}>Accepter</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </NativeCard>
                        ))}
                    </View>
                )}

                {/* Services co-gérés */}
                {memberships.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <SafeIcon name="briefcase" size={20} color="#6366F1" />
                            <Text style={styles.sectionTitle}>{t('mesEquipesScreen.servicesICoManage')} ({memberships.length})</Text>
                        </View>
                        {memberships.map((m) => (
                            <TouchableOpacity
                                key={m.membership_id}
                                activeOpacity={0.7}
                                onPress={() => navigateToService(m)}
                            >
                                <NativeCard style={styles.membershipCard}>
                                    <View style={styles.membershipTop}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.serviceName}>{m.service_name}</Text>
                                            <Text style={styles.categoryLabel}>{getCategoryLabel(m.category)}</Text>
                                            <Text style={styles.ownerLabel}>
                                                Propriétaire : {m.owner_name || 'Inconnu'}
                                            </Text>
                                        </View>
                                        <SafeIcon name="chevron-right" size={22} color="#9CA3AF" />
                                    </View>
                                    <View style={styles.membershipBottom}>
                                        <View style={[styles.roleBadge, { backgroundColor: (m.role.color || '#6366F1') + '20' }]}>
                                            <SafeIcon name={m.role.icon || 'user'} size={14} color={m.role.color || '#6366F1'} />
                                            <Text style={[styles.roleText, { color: m.role.color || '#6366F1' }]}>
                                                {m.role.name}
                                            </Text>
                                        </View>
                                        {m.added_at && (
                                            <Text style={styles.dateText}>Depuis le {formatDate(m.added_at)}</Text>
                                        )}
                                    </View>
                                </NativeCard>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* État vide */}
                {isEmpty && (
                    <View style={styles.emptyState}>
                        <SafeIcon name="users" size={60} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>{t('mesEquipes.aucuneEquipe')}</Text>
                        <Text style={styles.emptySubtitle}>
                            Vous n'avez pas encore été invité(e) à co-gérer un service.
                            Les propriétaires de services peuvent vous ajouter à leur équipe.
                        </Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
    loadingText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16 },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    content: { flex: 1, padding: 16 },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
    invitationCard: { marginBottom: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
    invitationTop: { flexDirection: 'row', alignItems: 'flex-start' },
    invitationActions: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'flex-end' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    rejectBtn: { backgroundColor: '#FEE2E2' },
    acceptBtn: { backgroundColor: '#10B981' },
    rejectText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
    acceptText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    membershipCard: { marginBottom: 12, padding: 16 },
    membershipTop: { flexDirection: 'row', alignItems: 'center' },
    membershipBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    serviceName: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
    categoryLabel: { fontSize: 13, color: '#6366F1', marginBottom: 4 },
    ownerLabel: { fontSize: 13, color: '#6B7280' },
    invitedBy: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
    roleText: { fontSize: 13, fontWeight: '600' },
    dateText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
    emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
});

export default MesEquipesScreen;
