// TrendPulse Dashboard — Yukpo
// Tendances chaudes, brouillons auto, publication directe.

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, RefreshControl,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';

interface TrendTopic {
    topic: string;
    score: number;
    trend_direction: string;
    region: string;
    forecast_day3?: number;
    confidence?: number;
    categories?: string[];
}

interface AutoDraft {
    id: number;
    topic: string;
    opportunity_score: number;
    draft_caption: string;
    draft_instagram?: string;
    draft_facebook?: string;
    draft_tiktok?: string;
    status: string;
    generated_at: string;
}

const DIR_COLOR: Record<string, string> = {
    rising: '#10B981', stable: '#64748B', declining: '#EF4444',
};

export default function TrendPulseDashboardScreen() {
    const route = useRoute<any>();
    const serviceId: number = route.params?.serviceId ?? 0;
    const { user } = useAuth();
    const [trends, setTrends] = useState<TrendTopic[]>([]);
    const [drafts, setDrafts] = useState<AutoDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<'trends' | 'drafts'>('trends');
    const [selectedDraft, setSelectedDraft] = useState<AutoDraft | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [tData, dData] = await Promise.all([
                apiGet(`/api/trends/pulse/${serviceId}`),
                apiGet(`/api/trends/auto-drafts/${serviceId}`),
            ]);
            setTrends(tData.trends ?? []);
            setDrafts(dData.drafts ?? []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    }, [serviceId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const publishDraft = async (draftId: number, platform: string) => {
        Alert.alert('Publier', `Publier ce brouillon sur ${platform} ?`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Publier', onPress: async () => {
                try {
                    await apiPost(`/api/trends/auto-drafts/${draftId}/publish`, { platform });
                    setDrafts(p => p.map(d => d.id === draftId ? { ...d, status: 'published' } : d));
                    Alert.alert('Succès', 'Post publié !');
                } catch { Alert.alert('Erreur', 'Publication échouée'); }
            }}
        ]);
    };

    const dismissDraft = async (draftId: number) => {
        try {
            await apiPost(`/api/trends/auto-drafts/${draftId}/dismiss`, {});
            setDrafts(p => p.filter(d => d.id !== draftId));
        } catch { }
    };

    const pendingDrafts = drafts.filter(d => d.status === 'draft');

    if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#6366F1" /></View>;

    return (
        <ScrollView style={s.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}>
            <View style={s.header}>
                <Text style={s.title}>TrendPulse</Text>
                <Text style={s.sub}>Tendances + brouillons IA</Text>
            </View>
            {pendingDrafts.length > 0 && (
                <TouchableOpacity style={s.draftAlert} onPress={() => setTab('drafts')}>
                    <SafeIcon name="flash" size={16} color="#FFF" />
                    <Text style={s.draftAlertText}>{pendingDrafts.length} brouillon(s) prêt(s) à publier →</Text>
                </TouchableOpacity>
            )}
            <View style={s.tabs}>
                <TouchableOpacity style={[s.tab, tab === 'trends' && s.tabA]} onPress={() => setTab('trends')}>
                    <Text style={[s.tabT, tab === 'trends' && s.tabTA]}>Tendances ({trends.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, tab === 'drafts' && s.tabA]} onPress={() => setTab('drafts')}>
                    <Text style={[s.tabT, tab === 'drafts' && s.tabTA]}>
                        Brouillons{pendingDrafts.length > 0 ? ` (${pendingDrafts.length})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>
            <View style={s.section}>
                {tab === 'trends' && <>
                    {trends.map((t, i) => (
                        <View key={`${t.topic}-${i}`} style={s.trendCard}>
                            <View style={s.trendHead}>
                                <View style={s.trendRank}><Text style={s.trendRankT}>#{i + 1}</Text></View>
                                <View style={s.trendInfo}>
                                    <Text style={s.trendTopic}>{t.topic}</Text>
                                    <Text style={s.trendRegion}>{t.region}</Text>
                                </View>
                                <View style={[s.dirBadge, { backgroundColor: DIR_COLOR[t.trend_direction] ?? '#888' }]}>
                                    <Text style={s.dirText}>{t.trend_direction}</Text>
                                </View>
                            </View>
                            <View style={s.trendStats}>
                                <View style={s.scoreBar}>
                                    <View style={[s.scoreBarFill, { width: `${t.score}%` }]} />
                                </View>
                                <Text style={s.scoreText}>{t.score?.toFixed(0)}/100</Text>
                                {t.forecast_day3 && (
                                    <Text style={s.forecast}>J+3: {t.forecast_day3?.toFixed(0)}</Text>
                                )}
                            </View>
                            {t.categories && t.categories.length > 0 && (
                                <View style={s.catRow}>
                                    {t.categories.slice(0, 3).map(cat => (
                                        <View key={cat} style={s.catChip}>
                                            <Text style={s.catText}>{cat}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}
                    {trends.length === 0 && <Text style={s.empty}>Aucune tendance disponible</Text>}
                </>}
                {tab === 'drafts' && <>
                    {pendingDrafts.length === 0
                        ? <Text style={s.empty}>Aucun brouillon en attente</Text>
                        : pendingDrafts.map(d => (
                            <View key={d.id} style={s.draftCard}>
                                <View style={s.draftHead}>
                                    <View style={s.draftScore}>
                                        <Text style={s.draftScoreT}>{d.opportunity_score?.toFixed(0)}</Text>
                                        <Text style={s.draftScoreL}>score</Text>
                                    </View>
                                    <View style={s.draftInfo}>
                                        <Text style={s.draftTopic}>{d.topic}</Text>
                                        <Text style={s.draftDate}>{new Date(d.generated_at).toLocaleDateString('fr-FR')}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => dismissDraft(d.id)}>
                                        <SafeIcon name="close" size={18} color="#475569" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={s.draftCaption} numberOfLines={3}>{d.draft_caption}</Text>
                                <View style={s.publishRow}>
                                    {['instagram', 'facebook', 'tiktok'].map(plat => (
                                        <TouchableOpacity key={plat} style={s.publishBtn} onPress={() => publishDraft(d.id, plat)}>
                                            <Text style={s.publishBtnT}>{plat}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
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
    draftAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#6366F1', marginHorizontal: 20, borderRadius: 10, padding: 12, marginBottom: 12 },
    draftAlertText: { color: '#FFF', fontWeight: '600' },
    tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#1E293B' },
    tabA: { backgroundColor: '#6366F1' },
    tabT: { color: '#64748B', fontSize: 13 },
    tabTA: { color: '#FFF', fontWeight: '600' },
    section: { paddingHorizontal: 20, paddingBottom: 40 },
    trendCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 10 },
    trendHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    trendRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },
    trendRankT: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    trendInfo: { flex: 1 },
    trendTopic: { color: '#F1F5F9', fontWeight: '600', fontSize: 15 },
    trendRegion: { color: '#64748B', fontSize: 12 },
    dirBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    dirText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
    trendStats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    scoreBar: { flex: 1, height: 6, backgroundColor: '#0F172A', borderRadius: 3, overflow: 'hidden' },
    scoreBarFill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 3 },
    scoreText: { color: '#6366F1', fontWeight: '700', fontSize: 13 },
    forecast: { color: '#10B981', fontSize: 12 },
    catRow: { flexDirection: 'row', gap: 6 },
    catChip: { backgroundColor: '#0F172A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    catText: { color: '#94A3B8', fontSize: 11 },
    empty: { color: '#475569', textAlign: 'center', marginTop: 32, fontSize: 14 },
    draftCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#6366F1' },
    draftHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    draftScore: { alignItems: 'center', width: 44, backgroundColor: '#0F172A', borderRadius: 8, padding: 6 },
    draftScoreT: { color: '#6366F1', fontWeight: '700', fontSize: 18 },
    draftScoreL: { color: '#64748B', fontSize: 10 },
    draftInfo: { flex: 1 },
    draftTopic: { color: '#F1F5F9', fontWeight: '600', fontSize: 14 },
    draftDate: { color: '#64748B', fontSize: 12 },
    draftCaption: { color: '#CBD5E1', fontSize: 13, lineHeight: 20, marginBottom: 12 },
    publishRow: { flexDirection: 'row', gap: 8 },
    publishBtn: { flex: 1, backgroundColor: '#6366F1', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
    publishBtnT: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
