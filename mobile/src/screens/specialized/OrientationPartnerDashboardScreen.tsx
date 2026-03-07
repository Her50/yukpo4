// Dashboard professionnel pour prestataires Établissement scolaire
// Gestion des programmes, inscriptions, événements et analytics

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
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';

type TabType = 'overview' | 'programs' | 'students' | 'analytics';

interface Program {
    id: number;
    nom: string;
    niveau?: string;
    duree?: string;
    places_disponibles?: number;
    is_active: boolean;
}

const OrientationPartnerDashboardScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [programs, setPrograms] = useState<Program[]>([]);
    const [stats, setStats] = useState({ totalPrograms: 0, activePrograms: 0, totalPlaces: 0, inscriptions: 0 });

    const loadData = useCallback(async () => {
        try {
            const resp = await apiGet('/api/orientation/etablissements/mine');
            const data = (resp as any)?.data;
            const progs = data?.programs || data?.formations || [];
            setPrograms(progs);
            setStats({
                totalPrograms: progs.length,
                activePrograms: progs.filter((p: any) => p.is_active !== false).length,
                totalPlaces: progs.reduce((sum: number, p: any) => sum + (p.places_disponibles || 0), 0),
                inscriptions: data?.inscriptions_count || 0,
            });
        } catch (e) {
            console.error('[OrientationPartnerDashboard] Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'overview', label: 'Accueil', icon: 'layout-dashboard' },
        { key: 'programs', label: 'Programmes', icon: 'book-open' },
        { key: 'students', label: 'Étudiants', icon: 'users' },
        { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
    ];

    if (loading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#2563EB" /><Text style={s.loadingText}>Chargement...</Text></View>;
    }

    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: 'Programmes', value: stats.totalPrograms, icon: 'book-open', color: '#2563EB' },
                    { label: 'Actifs', value: stats.activePrograms, icon: 'check-circle', color: '#10B981' },
                    { label: 'Places dispo.', value: stats.totalPlaces, icon: 'users', color: '#F59E0B' },
                    { label: 'Inscriptions', value: stats.inscriptions, icon: 'user-plus', color: '#8B5CF6' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            <Text style={s.sectionTitle}>Actions rapides</Text>
            <View style={s.quickRow}>
                {[
                    { label: 'Modifier établissement', icon: 'edit', color: '#2563EB', onPress: () => (navigation as any).navigate('CreateEtablissement', { mode: 'edit' }) },
                    { label: 'Hub Orientation', icon: 'compass', color: '#10B981', onPress: () => (navigation as any).navigate('OrientationScolaireHub') },
                    { label: 'IA Recommandations', icon: 'brain', color: '#7C3AED', onPress: () => (navigation as any).navigate('OrientationAIRecommendations') },
                    { label: 'Programmes', icon: 'book-open', color: '#F59E0B', onPress: () => (navigation as any).navigate('ProgrammesList') },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}>
                            <SafeIcon name={a.icon as any} size={22} color={a.color} />
                        </View>
                        <Text style={s.quickLabel} numberOfLines={2}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {programs.length > 0 && (
                <>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionTitle}>Mes programmes</Text>
                        <TouchableOpacity onPress={() => setActiveTab('programs')}><Text style={s.seeAll}>Tout voir</Text></TouchableOpacity>
                    </View>
                    {programs.slice(0, 4).map((p, i) => (
                        <View key={i} style={s.programCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.programName}>{p.nom}</Text>
                                <Text style={s.programDetail}>
                                    {p.niveau || ''}{p.duree ? ` · ${p.duree}` : ''}{p.places_disponibles ? ` · ${p.places_disponibles} places` : ''}
                                </Text>
                            </View>
                            <View style={[s.statusDot, { backgroundColor: p.is_active !== false ? '#10B981' : '#EF4444' }]} />
                        </View>
                    ))}
                </>
            )}

            {programs.length === 0 && (
                <View style={s.emptyState}>
                    <SafeIcon name="graduation-cap" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Aucun programme</Text>
                    <Text style={s.emptyText}>Configurez votre établissement et ajoutez des programmes de formation.</Text>
                    <NativeButton title="Configurer" onPress={() => (navigation as any).navigate('CreateEtablissement')} style={{ marginTop: 16 }} />
                </View>
            )}
        </ScrollView>
    );

    const renderPrograms = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <NativeButton title="+ Ajouter un programme" onPress={() => (navigation as any).navigate('CreateEtablissement', { tab: 'programs' })} variant="primary" style={{ marginBottom: 16 }} />
            {programs.length === 0 ? (
                <View style={s.emptyState}>
                    <SafeIcon name="book-open" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>Aucun programme</Text>
                </View>
            ) : (
                programs.map((p, i) => (
                    <View key={i} style={s.programCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.programName}>{p.nom}</Text>
                            <Text style={s.programDetail}>
                                {p.niveau || ''}{p.duree ? ` · ${p.duree}` : ''}{p.places_disponibles ? ` · ${p.places_disponibles} places` : ''}
                            </Text>
                        </View>
                        <View style={[s.statusDot, { backgroundColor: p.is_active !== false ? '#10B981' : '#EF4444' }]} />
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderStudents = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.emptyState}>
                <SafeIcon name="users" size={48} color="#9CA3AF" />
                <Text style={s.emptyTitle}>Inscriptions</Text>
                <Text style={s.emptyText}>Les demandes d'inscription des étudiants apparaîtront ici.</Text>
            </View>
        </ScrollView>
    );

    const renderAnalytics = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.analyticsCard}>
                <Text style={s.analyticsTitle}>Résumé</Text>
                {[
                    { label: 'Programmes actifs', value: stats.activePrograms, color: '#10B981' },
                    { label: 'Places disponibles', value: stats.totalPlaces, color: '#F59E0B' },
                    { label: 'Inscriptions', value: stats.inscriptions, color: '#8B5CF6' },
                ].map((item, i) => (
                    <View key={i} style={s.analyticsRow}>
                        <View style={[s.analyticsDot, { backgroundColor: item.color }]} />
                        <Text style={s.analyticsLabel}>{item.label}</Text>
                        <Text style={[s.analyticsValue, { color: item.color }]}>{item.value}</Text>
                    </View>
                ))}
            </View>
            <NativeButton title="Comparer programmes IA" onPress={() => (navigation as any).navigate('OrientationAIComparePrograms')} variant="outline" style={{ marginTop: 16 }} />
        </ScrollView>
    );

    return (
        <View style={s.container}>
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={s.header}>
                <View style={s.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.headerTitle}>Dashboard Établissement</Text>
                        <Text style={s.headerSub}>{user?.name || 'Partenaire'}</Text>
                    </View>
                </View>
                <View style={s.tabRow}>
                    {TABS.map(t => (
                        <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabActive]} onPress={() => setActiveTab(t.key)}>
                            <SafeIcon name={t.icon as any} size={16} color={activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.6)'} />
                            <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>
            <View style={s.content}>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'programs' && renderPrograms()}
                {activeTab === 'students' && renderStudents()}
                {activeTab === 'analytics' && renderAnalytics()}
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
    tabRow: { flexDirection: 'row', gap: 4 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 4 },
    tabActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
    tabLabelActive: { color: '#fff' },
    content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 1 },
    statValue: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginTop: 6 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 20, marginBottom: 10 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
    seeAll: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
    quickRow: { flexDirection: 'row', gap: 10 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    programCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
    programName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    programDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 12 },
    emptyText: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 1 },
    analyticsTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
    analyticsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    analyticsLabel: { flex: 1, fontSize: 14, color: '#374151' },
    analyticsValue: { fontSize: 18, fontWeight: '700' },
});

export default OrientationPartnerDashboardScreen;
