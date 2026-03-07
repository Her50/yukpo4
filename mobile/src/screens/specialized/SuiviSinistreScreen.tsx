// Écran utilisateur: Suivi de sinistres
// Affiche les sinistres déclarés par le client et leur progression

import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import assuranceService, { type InsuranceClaim } from '../../services/assuranceService';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const STATUS_FLOW = [
    { key: 'declare', label: 'Déclaré', icon: 'file-plus', color: '#D97706' },
    { key: 'en_cours_instruction', label: 'En instruction', icon: 'search', color: '#2563EB' },
    { key: 'expertise_demandee', label: 'Expertise demandée', icon: 'clipboard', color: '#7C3AED' },
    { key: 'expertise_en_cours', label: 'Expertise en cours', icon: 'activity', color: '#7C3AED' },
    { key: 'en_attente_documents', label: 'Attente documents', icon: 'file', color: '#D97706' },
    { key: 'approuve', label: 'Approuvé', icon: 'check-circle', color: '#059669' },
    { key: 'partiellement_approuve', label: 'Partiellement approuvé', icon: 'check', color: '#059669' },
    { key: 'indemnise', label: 'Indemnisé', icon: 'dollar-sign', color: '#10B981' },
    { key: 'refuse', label: 'Refusé', icon: 'x-circle', color: '#DC2626' },
    { key: 'clos', label: 'Clos', icon: 'archive', color: '#6B7280' },
    { key: 'conteste', label: 'Contesté', icon: 'alert-circle', color: '#DC2626' },
];

const getStatusInfo = (statut: string) => {
    return STATUS_FLOW.find(s => s.key === statut) || { key: statut, label: statut, icon: 'help-circle', color: '#6B7280' };
};

const getStatusIndex = (statut: string) => {
    const idx = STATUS_FLOW.findIndex(s => s.key === statut);
    return idx >= 0 ? idx : 0;
};

const SuiviSinistreScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const policyId = (route.params as any)?.policy_id;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [claims, setClaims] = useState<InsuranceClaim[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const devise = getCurrencyIntelligently() || 'FCFA';

    const loadData = useCallback(async () => {
        try {
            const data = await assuranceService.getClientClaims();
            const filtered = policyId ? data.filter(c => c.policy_id === policyId) : data;
            setClaims(filtered);
        } catch (e) {
            console.error('[SuiviSinistre] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [policyId]);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    const toggleExpand = (id: number) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    if (loading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#D97706" /><Text style={s.loadingText}>Chargement...</Text></View>;
    }

    const openCount = claims.filter(c => !['clos', 'refuse', 'indemnise'].includes(c.statut)).length;

    return (
        <View style={s.container}>
            <LinearGradient colors={['#D97706', '#B45309']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>Suivi des sinistres</Text>
                        <Text style={s.headerSub}>{claims.length} sinistre(s) - {openCount} en cours</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
                {claims.length === 0 ? (
                    <View style={s.emptyState}>
                        <SafeIcon name="shield" size={48} color="#9CA3AF" />
                        <Text style={s.emptyTitle}>Aucun sinistre</Text>
                        <Text style={s.emptyText}>Vous n'avez aucune déclaration de sinistre en cours.</Text>
                    </View>
                ) : (
                    claims.map(c => {
                        const st = getStatusInfo(c.statut);
                        const expanded = expandedId === c.id;
                        const isFinal = ['clos', 'refuse', 'indemnise'].includes(c.statut);

                        return (
                            <TouchableOpacity key={c.id} style={s.claimCard} onPress={() => toggleExpand(c.id)} activeOpacity={0.7}>
                                {/* Header */}
                                <View style={s.claimHeader}>
                                    <View style={[s.statusIcon, { backgroundColor: st.color + '15' }]}>
                                        <SafeIcon name={st.icon as any} size={20} color={st.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.claimNum}>{c.numero_sinistre}</Text>
                                        <Text style={s.claimType}>{c.type_sinistre}</Text>
                                    </View>
                                    <View style={[s.badge, { backgroundColor: st.color + '15' }]}>
                                        <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                                    </View>
                                </View>

                                {/* Summary always visible */}
                                <View style={s.claimSummary}>
                                    {c.nom_produit && <Text style={s.summaryText}>Produit: {c.nom_produit}</Text>}
                                    <Text style={s.summaryText}>Date sinistre: {c.date_sinistre || 'N/A'}</Text>
                                    {c.montant_reclame && <Text style={s.summaryAmount}>Réclamé: {parseFloat(c.montant_reclame).toLocaleString()} {devise}</Text>}
                                    {c.montant_indemnise && (
                                        <Text style={[s.summaryAmount, { color: '#059669' }]}>
                                            Indemnisé: {parseFloat(c.montant_indemnise).toLocaleString()} {devise}
                                        </Text>
                                    )}
                                </View>

                                {/* Expanded details */}
                                {expanded && (
                                    <View style={s.expandedSection}>
                                        {c.numero_police && (
                                            <View style={s.detailRow}>
                                                <Text style={s.detailLabel}>N° Police</Text>
                                                <Text style={s.detailValue}>{c.numero_police}</Text>
                                            </View>
                                        )}
                                        {c.compagnie && (
                                            <View style={s.detailRow}>
                                                <Text style={s.detailLabel}>Compagnie</Text>
                                                <Text style={s.detailValue}>{c.compagnie}</Text>
                                            </View>
                                        )}
                                        {c.lieu_sinistre && (
                                            <View style={s.detailRow}>
                                                <Text style={s.detailLabel}>Lieu</Text>
                                                <Text style={s.detailValue}>{c.lieu_sinistre}</Text>
                                            </View>
                                        )}
                                        {c.description_sinistre && (
                                            <View style={s.descBlock}>
                                                <Text style={s.detailLabel}>Description</Text>
                                                <Text style={s.descText}>{c.description_sinistre}</Text>
                                            </View>
                                        )}
                                        {c.dommages_estimes && (
                                            <View style={s.detailRow}>
                                                <Text style={s.detailLabel}>Dommages estimés</Text>
                                                <Text style={s.detailValue}>{parseFloat(c.dommages_estimes).toLocaleString()} {devise}</Text>
                                            </View>
                                        )}
                                        {c.agent_traitant && (
                                            <View style={s.detailRow}>
                                                <Text style={s.detailLabel}>Agent traitant</Text>
                                                <Text style={s.detailValue}>{c.agent_traitant}</Text>
                                            </View>
                                        )}
                                        {c.priorite && (
                                            <View style={s.detailRow}>
                                                <Text style={s.detailLabel}>Priorité</Text>
                                                <View style={[s.priorityBadge, {
                                                    backgroundColor: c.priorite === 'urgente' ? '#FEE2E2' : c.priorite === 'haute' ? '#FEF3C7' : '#F3F4F6'
                                                }]}>
                                                    <Text style={[s.priorityText, {
                                                        color: c.priorite === 'urgente' ? '#DC2626' : c.priorite === 'haute' ? '#D97706' : '#6B7280'
                                                    }]}>{c.priorite.toUpperCase()}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {c.fraud_score && (
                                            <View style={s.detailRow}>
                                                <Text style={s.detailLabel}>Score vérification</Text>
                                                <Text style={[s.detailValue, { color: parseFloat(c.fraud_score) > 0.5 ? '#DC2626' : '#059669' }]}>
                                                    {(parseFloat(c.fraud_score) * 100).toFixed(0)}%
                                                </Text>
                                            </View>
                                        )}

                                        {/* Status timeline */}
                                        {c.historique_statuts && Array.isArray(c.historique_statuts) && c.historique_statuts.length > 0 && (
                                            <View style={s.timelineSection}>
                                                <Text style={s.timelineTitle}>Historique</Text>
                                                {(c.historique_statuts as any[]).map((h, idx) => {
                                                    const hst = getStatusInfo(h.statut || h.status || '');
                                                    return (
                                                        <View key={idx} style={s.timelineItem}>
                                                            <View style={[s.timelineDot, { backgroundColor: hst.color }]} />
                                                            <View style={s.timelineContent}>
                                                                <Text style={s.timelineStatus}>{hst.label}</Text>
                                                                {h.date && <Text style={s.timelineDate}>{new Date(h.date).toLocaleDateString('fr-FR')}</Text>}
                                                                {h.note && <Text style={s.timelineNote}>{h.note}</Text>}
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        )}

                                        {c.created_at && (
                                            <Text style={s.createdAt}>Déclaré le {new Date(c.created_at).toLocaleDateString('fr-FR')}</Text>
                                        )}
                                    </View>
                                )}

                                {/* Expand indicator */}
                                <View style={s.expandIndicator}>
                                    <SafeIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
                                    <Text style={s.expandText}>{expanded ? 'Réduire' : 'Voir les détails'}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
    claimCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, elevation: 2, overflow: 'hidden' },
    claimHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    statusIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    claimNum: { fontSize: 12, fontWeight: '700', color: '#D97706' },
    claimType: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginTop: 1 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    claimSummary: { paddingHorizontal: 14, paddingBottom: 10, gap: 2 },
    summaryText: { fontSize: 12, color: '#6B7280' },
    summaryAmount: { fontSize: 13, fontWeight: '600', color: '#1F2937', marginTop: 2 },
    expandedSection: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    detailLabel: { fontSize: 12, color: '#6B7280' },
    detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
    descBlock: { marginTop: 8 },
    descText: { fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 20 },
    priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    priorityText: { fontSize: 10, fontWeight: '700' },
    timelineSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
    timelineTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
    timelineItem: { flexDirection: 'row', marginBottom: 12 },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, marginRight: 10 },
    timelineContent: { flex: 1 },
    timelineStatus: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
    timelineDate: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
    timelineNote: { fontSize: 12, color: '#6B7280', marginTop: 2, fontStyle: 'italic' },
    createdAt: { fontSize: 11, color: '#9CA3AF', marginTop: 12, textAlign: 'right' },
    expandIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    expandText: { fontSize: 11, color: '#9CA3AF' },
});

export default SuiviSinistreScreen;
