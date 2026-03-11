// ✅ REFONTE UX 2026-03-11: Hub principal offres d'emploi - Design moderne et aéré
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
import { useAuth } from '../../contexts/AuthContext';
import { offreEmploiService } from '../../services/offreEmploiService';
import { hapticPress } from '../../utils/hapticFeedback';

interface DashboardStats {
    total_offres?: number;
    total_candidatures?: number;
    candidatures_attente?: number;
    meilleurs_matchings?: number;
}

// Grille d'actions rapides
const QUICK_ACTIONS = [
    { id: 'search', label: 'Rechercher', icon: 'search', color: '#6366F1', screen: 'OffresEmploiHome' },
    { id: 'matching', label: 'Pour moi', icon: 'target', color: '#8B5CF6', screen: 'OffresEmploiHome' },
    { id: 'candidatures', label: 'Candidatures', icon: 'file-text', color: '#10B981', screen: 'OffreCandidatures' },
    { id: 'profil', label: 'Mon profil', icon: 'user', color: '#F59E0B', screen: 'ProfilCandidat' },
    { id: 'alertes', label: 'Alertes', icon: 'bell', color: '#EF4444', screen: 'AlertesEmploi' },
    { id: 'mesoffres', label: 'Mes offres', icon: 'briefcase', color: '#EC4899', screen: 'MesOffres' },
];

// Outils IA compacts
const AI_TOOLS = [
    { id: 'cv', label: 'Analyse CV', icon: 'file-text', color: '#8B5CF6', bg: '#F5F3FF', screen: 'AICVAnalysis' },
    { id: 'salary', label: 'Salaire IA', icon: 'trending-up', color: '#F59E0B', bg: '#FFFBEB', screen: 'AISalaryPrediction' },
    { id: 'formations', label: 'Formations', icon: 'graduation-cap', color: '#10B981', bg: '#ECFDF5', screen: 'AISuggestFormations' },
];

const OffresEmploiHubScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [])
    );

    const loadStats = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            if (user) {
                const response = await offreEmploiService.getDashboardCandidat();
                const resData = (response?.data || response) as any;
                if (resData?.success && resData?.data) {
                    setStats(resData.data);
                } else if (resData?.total_candidatures !== undefined) {
                    setStats(resData);
                }
            }
        } catch (error) {
            console.error('[OffresEmploiHub] Erreur:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const nav = (screen: string) => {
        hapticPress();
        (navigation as any).navigate(screen);
    };

    if (loading) {
        return (
            <View style={s.centerContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={s.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <ScrollView
                style={s.scrollView}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStats(true)} />}
            >
                {/* ── Header Gradient ── */}
                <LinearGradient colors={['#6366F1', '#8B5CF6']} style={s.header}>
                    <View style={s.headerTop}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={s.headerTitleWrap}>
                            <Text style={s.headerTitle}>Offres d'Emploi</Text>
                            <Text style={s.headerSubtitle}>Trouvez ou publiez un emploi</Text>
                        </View>
                    </View>

                    {/* Barre de recherche */}
                    <TouchableOpacity style={s.searchBar} onPress={() => nav('OffreSearch')} activeOpacity={0.8}>
                        <SafeIcon name="search" size={18} color="#9CA3AF" type="lucide" />
                        <Text style={s.searchPlaceholder}>Rechercher un emploi...</Text>
                        <SafeIcon name="chevron-right" size={18} color="#9CA3AF" type="lucide" />
                    </TouchableOpacity>
                </LinearGradient>

                {/* ── Statistiques 2x2 ── */}
                {stats && (
                    <View style={s.statsGrid}>
                        <View style={[s.statCard, { borderLeftColor: '#6366F1' }]}>
                            <SafeIcon name="briefcase" size={18} color="#6366F1" type="lucide" />
                            <Text style={s.statValue}>{String(stats.total_offres || 0)}</Text>
                            <Text style={s.statLabel}>Offres</Text>
                        </View>
                        <View style={[s.statCard, { borderLeftColor: '#10B981' }]}>
                            <SafeIcon name="send" size={18} color="#10B981" type="lucide" />
                            <Text style={s.statValue}>{String(stats.total_candidatures || 0)}</Text>
                            <Text style={s.statLabel}>Candidatures</Text>
                        </View>
                        <View style={[s.statCard, { borderLeftColor: '#F59E0B' }]}>
                            <SafeIcon name="clock" size={18} color="#F59E0B" type="lucide" />
                            <Text style={s.statValue}>{String(stats.candidatures_attente || 0)}</Text>
                            <Text style={s.statLabel}>En attente</Text>
                        </View>
                        <View style={[s.statCard, { borderLeftColor: '#8B5CF6' }]}>
                            <SafeIcon name="zap" size={18} color="#8B5CF6" type="lucide" />
                            <Text style={s.statValue}>{String(stats.meilleurs_matchings || 0)}</Text>
                            <Text style={s.statLabel}>Matchings</Text>
                        </View>
                    </View>
                )}

                {/* ── Actions Rapides (grille 3x2) ── */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Actions rapides</Text>
                    <View style={s.actionsGrid}>
                        {QUICK_ACTIONS.map(action => (
                            <TouchableOpacity
                                key={action.id}
                                style={s.actionItem}
                                onPress={() => nav(action.screen)}
                                activeOpacity={0.7}
                            >
                                <View style={[s.actionIcon, { backgroundColor: action.color + '15' }]}>
                                    <SafeIcon name={action.icon} size={22} color={action.color} type="lucide" />
                                </View>
                                <Text style={s.actionLabel} numberOfLines={1}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Outils IA (horizontal) ── */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Outils IA</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.aiScrollContent}>
                        {AI_TOOLS.map(tool => (
                            <TouchableOpacity
                                key={tool.id}
                                style={[s.aiMiniCard, { backgroundColor: tool.bg }]}
                                onPress={() => nav(tool.screen)}
                                activeOpacity={0.7}
                            >
                                <View style={[s.aiMiniIcon, { backgroundColor: tool.color + '20' }]}>
                                    <SafeIcon name={tool.icon} size={20} color={tool.color} type="lucide" />
                                </View>
                                <Text style={[s.aiMiniLabel, { color: tool.color }]}>{tool.label}</Text>
                                <SafeIcon name="chevron-right" size={16} color={tool.color} type="lucide" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ── Accès Employeur ── */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Espace Employeur</Text>
                    <TouchableOpacity style={s.employerCard} onPress={() => nav('CreateOffre')} activeOpacity={0.7}>
                        <LinearGradient colors={['#7C3AED', '#6366F1']} style={s.employerCardGradient}>
                            <View style={s.employerCardIcon}>
                                <SafeIcon name="plus-circle" size={28} color="#FFFFFF" type="lucide" />
                            </View>
                            <View style={s.employerCardContent}>
                                <Text style={s.employerCardTitle}>Publier une offre</Text>
                                <Text style={s.employerCardSub}>Trouvez le candidat idéal</Text>
                            </View>
                            <SafeIcon name="chevron-right" size={22} color="#FFFFFF" type="lucide" />
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={s.employerActions}>
                        <TouchableOpacity style={s.employerActionBtn} onPress={() => nav('MesOffres')} activeOpacity={0.7}>
                            <SafeIcon name="list" size={18} color="#6366F1" type="lucide" />
                            <Text style={s.employerActionText}>Mes offres</Text>
                        </TouchableOpacity>
                        <View style={s.employerActionDivider} />
                        <TouchableOpacity style={s.employerActionBtn} onPress={() => nav('OffreCandidatures')} activeOpacity={0.7}>
                            <SafeIcon name="users" size={18} color="#6366F1" type="lucide" />
                            <Text style={s.employerActionText}>Candidatures</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* ── FAB: Créer une offre ── */}
            <TouchableOpacity
                style={s.fab}
                onPress={() => nav('CreateOffre')}
                activeOpacity={0.85}
            >
                <LinearGradient colors={['#7C3AED', '#6366F1']} style={s.fabGradient}>
                    <SafeIcon name="plus" size={26} color="#FFFFFF" type="lucide" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
    loadingText: { marginTop: 12, color: '#6B7280', fontSize: 15 },

    // Header
    header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16 },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backBtn: { marginRight: 12, padding: 4 },
    headerTitleWrap: { flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
    headerSubtitle: { fontSize: 13, color: '#FFFFFFCC', marginTop: 2 },

    // Search
    searchBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10,
    },
    searchPlaceholder: { flex: 1, color: '#9CA3AF', fontSize: 15 },

    // Stats 2x2
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16,
        marginTop: -8, gap: 10,
    },
    statCard: {
        flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', borderRadius: 12,
        padding: 14, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center', gap: 10,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
    statLabel: { fontSize: 11, color: '#6B7280', marginTop: 1 },

    // Sections
    section: { marginTop: 24, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 14 },

    // Actions grid 3x2
    actionsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    },
    actionItem: {
        width: '30%', flexGrow: 1, alignItems: 'center', backgroundColor: '#FFFFFF',
        borderRadius: 14, paddingVertical: 18, paddingHorizontal: 8,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    actionIcon: {
        width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    },
    actionLabel: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },

    // AI tools horizontal
    aiScrollContent: { gap: 12, paddingRight: 16 },
    aiMiniCard: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 14,
        paddingVertical: 14, paddingHorizontal: 16, gap: 12, minWidth: 180,
    },
    aiMiniIcon: {
        width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    },
    aiMiniLabel: { fontSize: 14, fontWeight: '600', flex: 1 },

    // Employer section
    employerCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
    employerCardGradient: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, gap: 14,
    },
    employerCardIcon: {
        width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF20',
        justifyContent: 'center', alignItems: 'center',
    },
    employerCardContent: { flex: 1 },
    employerCardTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
    employerCardSub: { fontSize: 13, color: '#FFFFFFCC', marginTop: 2 },

    employerActions: {
        flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    employerActionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14,
    },
    employerActionText: { fontSize: 14, fontWeight: '600', color: '#374151' },
    employerActionDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 10 },

    // FAB
    fab: {
        position: 'absolute', bottom: 28, right: 20,
        shadowColor: '#6366F1', shadowOpacity: 0.35, shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }, elevation: 8,
    },
    fabGradient: {
        width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center',
    },
});

export default OffresEmploiHubScreen;

