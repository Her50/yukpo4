// Écran utilisateur: Mes polices d'assurance
// Affiche les polices souscrites par le client connecté

import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import assuranceService, { type InsurancePolicy } from '../../services/assuranceService';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    brouillon: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6', icon: 'edit' },
    en_attente: { label: 'En attente', color: '#D97706', bg: '#FEF3C7', icon: 'clock' },
    active: { label: 'Active', color: '#059669', bg: '#D1FAE5', icon: 'check-circle' },
    suspendue: { label: 'Suspendue', color: '#D97706', bg: '#FEF3C7', icon: 'pause-circle' },
    resiliee: { label: 'Résiliée', color: '#DC2626', bg: '#FEE2E2', icon: 'x-circle' },
    expiree: { label: 'Expirée', color: '#6B7280', bg: '#F3F4F6', icon: 'clock' },
    annulee: { label: 'Annulée', color: '#DC2626', bg: '#FEE2E2', icon: 'x-circle' },
};

const MesPolicesAssuranceScreen: React.FC = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const devise = getCurrencyIntelligently() || 'FCFA';

    const loadData = useCallback(async () => {
        try {
            const data = await assuranceService.getClientPolicies();
            setPolicies(data);
        } catch (e) {
            console.error('[MesPolicesAssurance] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    const filtered = filter === 'all' ? policies : policies.filter(p => p.statut === filter);
    const activesCount = policies.filter(p => p.statut === 'active').length;
    const expiringCount = policies.filter(p => {
        if (!p.date_expiration) return false;
        const diff = new Date(p.date_expiration).getTime() - Date.now();
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    }).length;

    if (loading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#6366F1" /><Text style={s.loadingText}>Chargement...</Text></View>;
    }

    return (
        <View style={s.container}>
            <LinearGradient colors={['#6366F1', '#4F46E5']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>Mes polices d'assurance</Text>
                        <Text style={s.headerSub}>{policies.length} police(s) - {activesCount} active(s)</Text>
                    </View>
                </View>
            </LinearGradient>

            {expiringCount > 0 && (
                <View style={s.alertBanner}>
                    <SafeIcon name="alert-circle" size={18} color="#D97706" />
                    <Text style={s.alertText}>{expiringCount} police(s) expire(nt) dans les 30 jours</Text>
                </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {[
                    { key: 'all', label: 'Toutes' },
                    { key: 'active', label: 'Actives' },
                    { key: 'suspendue', label: 'Suspendues' },
                    { key: 'expiree', label: 'Expirées' },
                ].map(f => (
                    <TouchableOpacity key={f.key} style={[s.filterChip, filter === f.key && s.filterChipActive]} onPress={() => setFilter(f.key)}>
                        <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
                {filtered.length === 0 ? (
                    <View style={s.emptyState}>
                        <SafeIcon name="file-text" size={48} color="#9CA3AF" />
                        <Text style={s.emptyTitle}>Aucune police</Text>
                        <Text style={s.emptyText}>Vos polices d'assurance souscrites apparaîtront ici.</Text>
                        <TouchableOpacity style={s.searchBtn} onPress={() => (navigation as any).navigate('InsuranceServicesSearch')}>
                            <SafeIcon name="search" size={16} color="#fff" />
                            <Text style={s.searchBtnText}>Rechercher une assurance</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    filtered.map(p => {
                        const st = STATUS_MAP[p.statut] || STATUS_MAP.en_attente;
                        const isExpiringSoon = p.date_expiration && (new Date(p.date_expiration).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000 && (new Date(p.date_expiration).getTime() - Date.now()) > 0;
                        return (
                            <View key={p.id} style={[s.policyCard, isExpiringSoon && { borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
                                <View style={s.policyHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.policyNum}>{p.numero_police}</Text>
                                        <Text style={s.policyProduct}>{p.nom_produit || 'Produit d\'assurance'}</Text>
                                    </View>
                                    <View style={[s.badge, { backgroundColor: st.bg }]}>
                                        <SafeIcon name={st.icon as any} size={12} color={st.color} />
                                        <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                                    </View>
                                </View>

                                <View style={s.policyBody}>
                                    {p.type_assurance && <Text style={s.policyType}>{p.type_assurance.toUpperCase()}{p.sous_categorie ? ` - ${p.sous_categorie}` : ''}</Text>}
                                    {p.compagnie && <Text style={s.policyCompany}>{p.compagnie}</Text>}

                                    <View style={s.datesRow}>
                                        <View style={s.dateItem}>
                                            <Text style={s.dateLabel}>Début</Text>
                                            <Text style={s.dateValue}>{p.date_effet ? new Date(p.date_effet).toLocaleDateString('fr-FR') : '—'}</Text>
                                        </View>
                                        <View style={s.dateSep} />
                                        <View style={s.dateItem}>
                                            <Text style={s.dateLabel}>Expiration</Text>
                                            <Text style={[s.dateValue, isExpiringSoon && { color: '#D97706', fontWeight: '700' }]}>
                                                {p.date_expiration ? new Date(p.date_expiration).toLocaleDateString('fr-FR') : '—'}
                                            </Text>
                                        </View>
                                    </View>

                                    {p.prime_totale && (
                                        <View style={s.primeRow}>
                                            <Text style={s.primeLabel}>Prime totale</Text>
                                            <Text style={s.primeValue}>{parseFloat(p.prime_totale).toLocaleString()} {devise}</Text>
                                        </View>
                                    )}

                                    {p.couverture_max && (
                                        <View style={s.primeRow}>
                                            <Text style={s.primeLabel}>Couverture maximale</Text>
                                            <Text style={s.coverageValue}>{parseFloat(p.couverture_max).toLocaleString()} {devise}</Text>
                                        </View>
                                    )}

                                    {p.renouvellement_auto && (
                                        <View style={s.autoRenewBadge}>
                                            <SafeIcon name="refresh-cw" size={12} color="#059669" />
                                            <Text style={s.autoRenewText}>Renouvellement automatique</Text>
                                        </View>
                                    )}
                                </View>

                                {p.statut === 'active' && (
                                    <View style={s.actionRow}>
                                        <TouchableOpacity style={s.actionBtn} onPress={() => (navigation as any).navigate('DeclarationSinistre', { policy: p })}>
                                            <SafeIcon name="alert-triangle" size={14} color="#D97706" />
                                            <Text style={[s.actionText, { color: '#D97706' }]}>Déclarer un sinistre</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={s.actionBtn} onPress={() => (navigation as any).navigate('SuiviSinistre', { policy_id: p.id })}>
                                            <SafeIcon name="eye" size={14} color="#6366F1" />
                                            <Text style={[s.actionText, { color: '#6366F1' }]}>Mes sinistres</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
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
    alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 12, gap: 8, marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' },
    alertText: { flex: 1, fontSize: 13, color: '#D97706', fontWeight: '600' },
    filterRow: { marginTop: 12, maxHeight: 44 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
    filterChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    filterText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
    filterTextActive: { color: '#fff' },
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
    searchBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366F1', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, gap: 8, marginTop: 20 },
    searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    policyCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, elevation: 2, overflow: 'hidden' },
    policyHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    policyNum: { fontSize: 12, fontWeight: '700', color: '#6366F1' },
    policyProduct: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    policyBody: { padding: 14 },
    policyType: { fontSize: 11, color: '#6366F1', fontWeight: '600' },
    policyCompany: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    datesRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10 },
    dateItem: { flex: 1, alignItems: 'center' },
    dateLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' },
    dateValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', marginTop: 2 },
    dateSep: { width: 1, height: 30, backgroundColor: '#E5E7EB' },
    primeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    primeLabel: { fontSize: 12, color: '#6B7280' },
    primeValue: { fontSize: 14, fontWeight: '700', color: '#059669' },
    coverageValue: { fontSize: 14, fontWeight: '700', color: '#3B82F6' },
    autoRenewBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
    autoRenewText: { fontSize: 11, color: '#059669', fontWeight: '600' },
    actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
    actionText: { fontSize: 12, fontWeight: '600' },
});

export default MesPolicesAssuranceScreen;
