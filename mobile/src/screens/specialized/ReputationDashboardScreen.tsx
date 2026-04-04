// Reputation Dashboard — Yukpo
// Monitoring mentions multi-plateformes + alertes crise + résolution.

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, RefreshControl,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { apiGet, apiPost } from '../../services/api';

interface Mention {
    id: number; platform: string; content: string;
    author_name?: string; sentiment: string;
    is_read: boolean; is_handled: boolean; detected_at: string;
}
interface CrisisEvent {
    id: number; crisis_type: string; severity: string;
    description: string; is_resolved: boolean;
    started_at: string; resolved_at?: string;
}

const SCOLOR: Record<string, string> = {
    positive: '#10B981', neutral: '#64748B',
    negative: '#EF4444', very_negative: '#DC2626',
};

export default function ReputationDashboardScreen() {
    const route = useRoute<any>();
    const serviceId: number = route.params?.serviceId ?? 0;
    const [mentions, setMentions] = useState<Mention[]>([]);
    const [crises, setCrises] = useState<CrisisEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<'mentions' | 'crisis'>('mentions');
    const [filter, setFilter] = useState<'all' | 'unread' | 'negative'>('all');

    const fetchData = useCallback(async () => {
        try {
            const [m, c] = await Promise.all([
                apiGet(`/api/reputation/mentions/${serviceId}?limit=50`),
                apiGet(`/api/reputation/crisis/${serviceId}`),
            ]);
            setMentions(m.mentions ?? []);
            setCrises(c.crises ?? []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    }, [serviceId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const markRead = async (id: number) => {
        await apiPost(`/api/reputation/mentions/${id}/read`, {});
        setMentions(p => p.map(m => m.id === id ? { ...m, is_read: true } : m));
    };
    const markHandled = async (id: number) => {
        await apiPost(`/api/reputation/mentions/${id}/handled`, {});
        setMentions(p => p.map(m => m.id === id ? { ...m, is_handled: true } : m));
    };
    const resolveCrisis = (id: number) => Alert.alert('Résoudre', 'Marquer résolu ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Résoudre', onPress: async () => {
            await apiPost(`/api/reputation/crisis/${id}/resolve`, { resolution_notes: 'Résolu via dashboard' });
            setCrises(p => p.map(c => c.id === id ? { ...c, is_resolved: true } : c));
        }}
    ]);

    const filtered = mentions.filter(m =>
        filter === 'unread' ? !m.is_read :
        filter === 'negative' ? (m.sentiment === 'negative' || m.sentiment === 'very_negative') : true
    );
    const activeCrises = crises.filter(c => !c.is_resolved);
    const unread = mentions.filter(m => !m.is_read).length;
    const neg = mentions.filter(m => m.sentiment === 'negative' || m.sentiment === 'very_negative').length;

    if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#EF4444" /></View>;

    return (
        <ScrollView style={s.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
            <View style={s.header}>
                <Text style={s.title}>Réputation</Text>
                <Text style={s.sub}>Mentions &amp; alertes crise</Text>
            </View>
            {activeCrises.length > 0 && (
                <TouchableOpacity style={s.crisisBar} onPress={() => setTab('crisis')}>
                    <SafeIcon name="warning" size={16} color="#FFF" />
                    <Text style={s.crisisBarText}>{activeCrises.length} crise(s) active(s) — Voir →</Text>
                </TouchableOpacity>
            )}
            <View style={s.statsRow}>
                {[{ v: mentions.length, l: 'Mentions', c: '#6366F1' },
                  { v: unread, l: 'Non lues', c: unread > 0 ? '#F59E0B' : '#64748B' },
                  { v: neg, l: 'Négatives', c: neg > 3 ? '#EF4444' : '#64748B' }].map(kpi => (
                    <View key={kpi.l} style={s.statCard}>
                        <Text style={[s.statVal, { color: kpi.c }]}>{kpi.v}</Text>
                        <Text style={s.statLabel}>{kpi.l}</Text>
                    </View>
                ))}
            </View>
            <View style={s.tabs}>
                <TouchableOpacity style={[s.tab, tab === 'mentions' && s.tabA]} onPress={() => setTab('mentions')}>
                    <Text style={[s.tabT, tab === 'mentions' && s.tabTA]}>Mentions ({mentions.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, tab === 'crisis' && s.tabA]} onPress={() => setTab('crisis')}>
                    <Text style={[s.tabT, tab === 'crisis' && s.tabTA]}>
                        Crises{activeCrises.length > 0 ? ` (${activeCrises.length})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>
            <View style={s.section}>
                {tab === 'mentions' && <>
                    <View style={s.filterRow}>
                        {(['all', 'unread', 'negative'] as const).map(f => (
                            <TouchableOpacity key={f} style={[s.fb, filter === f && s.fbA]} onPress={() => setFilter(f)}>
                                <Text style={[s.fbT, filter === f && s.fbTA]}>
                                    {f === 'all' ? 'Toutes' : f === 'unread' ? 'Non lues' : 'Négatives'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {filtered.map(m => (
                        <View key={m.id} style={[s.card, !m.is_read && s.cardUnread]}>
                            <View style={s.cardHead}>
                                <Text style={s.cardPlat}>{m.platform}</Text>
                                <View style={[s.sentBadge, { backgroundColor: SCOLOR[m.sentiment] ?? '#888' }]}>
                                    <Text style={s.sentText}>{m.sentiment}</Text>
                                </View>
                                <Text style={s.cardDate}>{new Date(m.detected_at).toLocaleDateString('fr-FR')}</Text>
                            </View>
                            {m.author_name && <Text style={s.author}>@{m.author_name}</Text>}
                            <Text style={s.content} numberOfLines={3}>{m.content}</Text>
                            <View style={s.actions}>
                                {!m.is_read && <TouchableOpacity style={s.btn} onPress={() => markRead(m.id)}><Text style={s.btnT}>Lu</Text></TouchableOpacity>}
                                {!m.is_handled && <TouchableOpacity style={[s.btn, s.btnP]} onPress={() => markHandled(m.id)}><Text style={[s.btnT, s.btnTP]}>Traité</Text></TouchableOpacity>}
                                {m.is_handled && <Text style={s.handled}>✓ Traité</Text>}
                            </View>
                        </View>
                    ))}
                    {filtered.length === 0 && <Text style={s.empty}>Aucune mention</Text>}
                </>}
                {tab === 'crisis' && <>
                    {crises.length === 0
                        ? <View style={s.noCrisis}><SafeIcon name="shield-checkmark" size={48} color="#10B981" /><Text style={s.noCrisisT}>Aucune crise détectée</Text></View>
                        : crises.map(c => (
                            <View key={c.id} style={[s.crisisCard, c.is_resolved && s.crisisResolved]}>
                                <View style={s.crisisHead}>
                                    <Text style={s.crisisType}>{c.crisis_type}</Text>
                                    <View style={[s.sevBadge, c.severity === 'critical' ? s.sevCrit : c.severity === 'high' ? s.sevHigh : {}]}>
                                        <Text style={s.sevT}>{c.severity}</Text>
                                    </View>
                                </View>
                                <Text style={s.crisisDesc}>{c.description}</Text>
                                <Text style={s.crisisDate}>
                                    Début: {new Date(c.started_at).toLocaleDateString('fr-FR')}
                                    {c.is_resolved && c.resolved_at ? ` · Résolu: ${new Date(c.resolved_at).toLocaleDateString('fr-FR')}` : ''}
                                </Text>
                                {!c.is_resolved && <TouchableOpacity style={s.resolveBtn} onPress={() => resolveCrisis(c.id)}><Text style={s.resolveBtnT}>Marquer résolu</Text></TouchableOpacity>}
                                {c.is_resolved && <Text style={s.resolvedBadge}>✓ Résolu</Text>}
                            </View>
                        ))
                    }
                </>}
            </View>
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
    header: { padding: 20, paddingTop: 40 },
    title: { fontSize: 24, fontWeight: '700', color: '#F1F5F9' },
    sub: { fontSize: 14, color: '#64748B', marginTop: 4 },
    crisisBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DC2626', marginHorizontal: 20, borderRadius: 10, padding: 12, marginBottom: 12 },
    crisisBarText: { color: '#FFF', fontWeight: '600' },
    statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 12, padding: 14, alignItems: 'center' },
    statVal: { fontSize: 22, fontWeight: '700' },
    statLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
    tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#1E293B' },
    tabA: { backgroundColor: '#EF4444' },
    tabT: { color: '#64748B', fontSize: 13 },
    tabTA: { color: '#FFF', fontWeight: '600' },
    section: { paddingHorizontal: 20, paddingBottom: 40 },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    fb: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1E293B' },
    fbA: { backgroundColor: '#6366F1' },
    fbT: { color: '#64748B', fontSize: 12 },
    fbTA: { color: '#FFF' },
    card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 10 },
    cardUnread: { borderLeftWidth: 3, borderLeftColor: '#6366F1' },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    cardPlat: { color: '#6366F1', fontSize: 12, fontWeight: '600' },
    sentBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    sentText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    cardDate: { color: '#475569', fontSize: 11, marginLeft: 'auto' },
    author: { color: '#94A3B8', fontSize: 12, marginBottom: 4 },
    content: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginBottom: 10 },
    actions: { flexDirection: 'row', gap: 8 },
    btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
    btnP: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    btnT: { color: '#94A3B8', fontSize: 12 },
    btnTP: { color: '#FFF' },
    handled: { color: '#10B981', fontSize: 12 },
    empty: { color: '#475569', textAlign: 'center', marginTop: 32, fontSize: 14 },
    noCrisis: { alignItems: 'center', paddingVertical: 60, gap: 16 },
    noCrisisT: { color: '#10B981', fontSize: 18, fontWeight: '600' },
    crisisCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#EF4444' },
    crisisResolved: { opacity: 0.6, borderLeftColor: '#10B981' },
    crisisHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    crisisType: { color: '#F1F5F9', fontWeight: '700', fontSize: 15 },
    sevBadge: { backgroundColor: '#F59E0B', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    sevCrit: { backgroundColor: '#DC2626' },
    sevHigh: { backgroundColor: '#EF4444' },
    sevT: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    crisisDesc: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginBottom: 8 },
    crisisDate: { color: '#64748B', fontSize: 12, marginBottom: 10 },
    resolveBtn: { backgroundColor: '#10B981', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
    resolveBtnT: { color: '#FFF', fontWeight: '600', fontSize: 14 },
    resolvedBadge: { color: '#10B981', fontSize: 13, fontWeight: '600' },
});
