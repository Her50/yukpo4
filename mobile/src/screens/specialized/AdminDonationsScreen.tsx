// ✅ Écran Admin — Gestion des demandes de don de livres scolaires
// Permet à l'admin de voir, approuver ou refuser les demandes de don

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
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
import SafeIcon from '../../components/SafeIcon';
import { useToaster } from '../../components/ToasterProvider';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

// ============================================================================
// TYPES
// ============================================================================

interface DonationRequestEnriched {
    id: number;
    demandeur_id: number;
    demandeur_nom: string;
    livre_id: number;
    livre_titre: string;
    livre_matiere: string;
    livre_classe: string;
    livre_ville: string;
    donneur_nom: string;
    motif: string;
    justificatif_url?: string;
    statut: 'en_attente' | 'approuve' | 'refuse';
    created_at: string;
}

type FilterStatus = 'all' | 'en_attente' | 'approuve' | 'refuse';

// ============================================================================
// CONSTANTES
// ============================================================================

const STATUT_CONFIG: Record<string, { color: string; bg: string; icon: string; labelKey: string }> = {
    en_attente: { color: '#f59e0b', bg: '#fef3c7', icon: 'clock', labelKey: 'adminDonations.enAttente' },
    approuve: { color: '#22c55e', bg: '#dcfce7', icon: 'check-circle', labelKey: 'adminDonations.approuve' },
    refuse: { color: '#ef4444', bg: '#fee2e2', icon: 'x-circle', labelKey: 'adminDonations.refuse' },
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

const AdminDonationsScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const toaster = useToaster();
    const { t } = useLanguageSafe();
    const { user } = useAuth();

    // Vérification rôle admin côté frontend
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    const [donations, setDonations] = useState<DonationRequestEnriched[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

    // ============================
    // CHARGEMENT
    // ============================

    const loadDonations = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const response = await apiGet<any>('/api/bourse-livre/v2/admin/donations');
            const r = response.data as any;
            const items = r?.donation_requests || [];
            setDonations(items);
        } catch (error) {
            console.error('[AdminDonations] Erreur chargement:', error);
            toaster.show(t('adminDonations.erreurChargement'), 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toaster]);

    useEffect(() => {
        loadDonations();
    }, []);

    // ============================
    // ACTIONS
    // ============================

    const handleApprove = useCallback(async (donationId: number, livreTitre: string) => {
        Alert.alert(
            t('adminDonations.approuverCeDon'),
            t('adminDonations.confirmerAttribution', { titre: livreTitre }),
            [
                { text: t('mesBesoinsLivres.annuler'), style: 'cancel' },
                {
                    text: t('adminDonations.approuver'),
                    onPress: async () => {
                        try {
                            setProcessing(donationId);
                            await apiPost(`/api/bourse-livre/v2/admin/donations/${donationId}/approve`, {});
                            toaster.show(t('adminDonations.donApprouve'), 'success');
                            // Update local state
                            setDonations(prev =>
                                prev.map(d =>
                                    d.id === donationId ? { ...d, statut: 'approuve' as const } : d
                                )
                            );
                        } catch (error) {
                            console.error('[AdminDonations] Erreur approbation:', error);
                            toaster.show(t('adminDonations.erreurApprobation'), 'error');
                        } finally {
                            setProcessing(null);
                        }
                    },
                },
            ]
        );
    }, [toaster]);

    const handleReject = useCallback(async (donationId: number, livreTitre: string) => {
        Alert.alert(
            t('adminDonations.refuserCeDon'),
            t('adminDonations.refuserDemande', { titre: livreTitre }),
            [
                { text: t('mesBesoinsLivres.annuler'), style: 'cancel' },
                {
                    text: t('adminDonations.refuser'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setProcessing(donationId);
                            await apiPost(`/api/bourse-livre/v2/admin/donations/${donationId}/reject`, {});
                            toaster.show(t('adminDonations.demandeRefusee'), 'info');
                            setDonations(prev =>
                                prev.map(d =>
                                    d.id === donationId ? { ...d, statut: 'refuse' as const } : d
                                )
                            );
                        } catch (error) {
                            console.error('[AdminDonations] Erreur rejet:', error);
                            toaster.show(t('adminDonations.erreurRejet'), 'error');
                        } finally {
                            setProcessing(null);
                        }
                    },
                },
            ]
        );
    }, [toaster]);

    // ============================
    // FILTRAGE
    // ============================

    const filteredDonations = donations.filter(d =>
        filterStatus === 'all' ? true : d.statut === filterStatus
    );

    const stats = {
        total: donations.length,
        en_attente: donations.filter(d => d.statut === 'en_attente').length,
        approuve: donations.filter(d => d.statut === 'approuve').length,
        refuse: donations.filter(d => d.statut === 'refuse').length,
    };

    // ============================
    // RENDERS
    // ============================

    const renderStats = () => (
        <View style={styles.statsContainer}>
            {[
                { key: 'all' as FilterStatus, label: t('adminDonations.tous'), count: stats.total, color: '#6b7280' },
                { key: 'en_attente' as FilterStatus, label: t('adminDonations.enAttente'), count: stats.en_attente, color: '#f59e0b' },
                { key: 'approuve' as FilterStatus, label: t('adminDonations.approuves'), count: stats.approuve, color: '#22c55e' },
                { key: 'refuse' as FilterStatus, label: t('adminDonations.refuses'), count: stats.refuse, color: '#ef4444' },
            ].map(stat => (
                <TouchableOpacity
                    key={stat.key}
                    style={[styles.statCard, filterStatus === stat.key && { borderColor: stat.color, borderWidth: 2 }]}
                    onPress={() => { hapticPress(); setFilterStatus(stat.key); }}
                >
                    <Text style={[styles.statCount, { color: stat.color }]}>{stat.count}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderDonationCard = ({ item }: { item: DonationRequestEnriched }) => {
        const cfg = STATUT_CONFIG[item.statut] || STATUT_CONFIG.en_attente;
        const isProcessing = processing === item.id;
        const isPending = item.statut === 'en_attente';

        return (
            <View style={styles.donationCard}>
                {/* Status badge */}
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <SafeIcon name={cfg.icon} size={14} color={cfg.color} />
                    <Text style={[styles.statusText, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
                </View>

                {/* Book info */}
                <View style={styles.bookSection}>
                    <SafeIcon name="book" size={20} color={modernColors.primary} />
                    <View style={styles.bookInfo}>
                        <Text style={styles.bookTitle} numberOfLines={2}>{item.livre_titre}</Text>
                        <Text style={styles.bookMeta}>
                            {item.livre_classe} • {item.livre_matiere} • {item.livre_ville}
                        </Text>
                    </View>
                </View>

                {/* Donneur → Demandeur */}
                <View style={styles.transferRow}>
                    <View style={styles.personChip}>
                        <SafeIcon name="gift" size={12} color="#059669" />
                        <Text style={styles.personName} numberOfLines={1}>{item.donneur_nom || t('adminDonations.donneur')}</Text>
                    </View>
                    <SafeIcon name="arrow-right" size={16} color="#9ca3af" />
                    <View style={styles.personChip}>
                        <SafeIcon name="user" size={12} color="#3b82f6" />
                        <Text style={styles.personName} numberOfLines={1}>{item.demandeur_nom || t('adminDonations.demandeur')}</Text>
                    </View>
                </View>

                {/* Motif */}
                <View style={styles.motifSection}>
                    <Text style={styles.motifLabel}>{t('adminDonations.motif')}</Text>
                    <Text style={styles.motifText} numberOfLines={3}>{item.motif}</Text>
                </View>

                {/* Date */}
                <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                </Text>

                {/* Actions pour les demandes en attente */}
                {isPending && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() => handleReject(item.id, item.livre_titre)}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                                <>
                                    <SafeIcon name="x" size={16} color="#ef4444" />
                                    <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>{t('adminDonations.refuser')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.approveBtn]}
                            onPress={() => handleApprove(item.id, item.livre_titre)}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <SafeIcon name="check" size={16} color="#fff" />
                                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>{t('adminDonations.approuver')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    // ============================
    // MAIN RENDER
    // ============================

    // Garde admin : accès refusé si l'utilisateur n'est pas admin
    if (!isAdmin) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#1f2937" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>{t('adminDonations.title')}</Text>
                    </View>
                </View>
                <View style={styles.centerContainer}>
                    <SafeIcon name="shield-off" size={48} color="#ef4444" />
                    <Text style={styles.emptyText}>{t('adminDonations.accesRefuse')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#1f2937" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{t('adminDonations.title')}</Text>
                    <Text style={styles.headerSubtitle}>{t('adminDonations.subtitle')}</Text>
                </View>
                <TouchableOpacity onPress={() => loadDonations(true)}>
                    <SafeIcon name="refresh-cw" size={20} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {renderStats()}

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('adminDonations.chargement')}</Text>
                </View>
            ) : filteredDonations.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="inbox" size={48} color="#d1d5db" />
                    <Text style={styles.emptyText}>
                        {filterStatus === 'all'
                            ? t('adminDonations.aucuneDemande')
                            : t('adminDonations.aucuneDemandeFiltre', { filtre: STATUT_CONFIG[filterStatus] ? t(STATUT_CONFIG[filterStatus].labelKey) : filterStatus })
                        }
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredDonations}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderDonationCard}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadDonations(true)} />
                    }
                />
            )}
        </View>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },

    header: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    backBtn: { marginRight: 12 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
    headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

    statsContainer: {
        flexDirection: 'row', padding: 12, gap: 8,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    statCard: {
        flex: 1, alignItems: 'center', padding: 10, borderRadius: 10,
        backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    },
    statCount: { fontSize: 20, fontWeight: '700' },
    statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    loadingText: { fontSize: 14, color: '#6b7280', marginTop: 12 },
    emptyText: { fontSize: 15, color: '#9ca3af', marginTop: 16, textAlign: 'center' },

    listContent: { padding: 12, paddingBottom: 32 },

    donationCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: '#e5e7eb',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    },

    statusBadge: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 12,
    },
    statusText: { fontSize: 12, fontWeight: '600' },

    bookSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
    bookInfo: { flex: 1 },
    bookTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
    bookMeta: { fontSize: 12, color: '#6b7280', marginTop: 4 },

    transferRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginBottom: 12, paddingVertical: 8,
        borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f3f4f6',
    },
    personChip: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#f9fafb', borderRadius: 8, padding: 8,
    },
    personName: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },

    motifSection: { marginBottom: 8 },
    motifLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
    motifText: { fontSize: 13, color: '#374151', lineHeight: 18 },

    dateText: { fontSize: 11, color: '#9ca3af', marginBottom: 12 },

    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 12, borderRadius: 10,
    },
    rejectBtn: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
    approveBtn: { backgroundColor: '#22c55e' },
    actionBtnText: { fontSize: 14, fontWeight: '700' },
});

export default AdminDonationsScreen;
