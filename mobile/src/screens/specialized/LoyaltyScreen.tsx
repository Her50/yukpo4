/**
 * Écran Programme Fidélité Yukpo — solde, historique, récompenses
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import SafeIcon from '../../components/SafeIcon';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface PointsBalance {
    user_id: number;
    balance: number;
    total_earned: number;
    total_spent: number;
}

interface PointsEntry {
    id: number;
    points: number;
    action: string;
    description?: string;
    created_at: string;
}

interface LoyaltyReward {
    id: number;
    title: string;
    description?: string;
    points_cost: number;
    reward_type: string;
    reward_value: number;
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    trip_completed:  { icon: 'check-circle', color: '#10B981', label: 'Trajet terminé' },
    rating_given:    { icon: 'star',         color: '#F59E0B', label: 'Avis laissé' },
    referral:        { icon: 'users',        color: '#6366F1', label: 'Parrainage' },
    redemption:      { icon: 'gift',         color: '#EF4444', label: 'Échange' },
    default:         { icon: 'zap',          color: '#06B6D4', label: 'Bonus' },
};

const REWARD_ICONS: Record<string, string> = {
    discount_pct:    'percent',
    free_trip:       'car',
    free_insurance:  'shield',
};

const LoyaltyScreen: React.FC = () => {
    const navigation = useNavigation();
    const [balance, setBalance] = useState<PointsBalance | null>(null);
    const [history, setHistory] = useState<PointsEntry[]>([]);
    const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [redeeming, setRedeeming] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards');

    const load = useCallback(async () => {
        try {
            const res = await apiGet('/api/loyalty/balance');
            const data = (res?.data || res) as any;
            if (data?.success) {
                setBalance(data.balance);
                setHistory(data.history || []);
                setRewards(data.rewards || []);
            }
        } catch { } finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleRedeem = (reward: LoyaltyReward) => {
        if (!balance || balance.balance < reward.points_cost) {
            Alert.alert(
                'Points insuffisants',
                `Il vous faut ${reward.points_cost} pts. Vous avez ${balance?.balance || 0} pts.\n\nComplétez des trajets pour gagner plus de points !`
            );
            return;
        }
        Alert.alert(
            `Échanger ${reward.points_cost} pts`,
            `Obtenir : "${reward.title}"\n\nVotre solde passera à ${(balance.balance - reward.points_cost)} pts.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Confirmer', onPress: async () => {
                        try {
                            setRedeeming(reward.id);
                            const res = await apiPost('/api/loyalty/redeem', { reward_id: reward.id });
                            const data = (res?.data || res) as any;
                            if (data?.success) {
                                Alert.alert('Récompense activée !',
                                    `Code : ${data.redemption?.coupon_code}\nValable 30 jours.`);
                                load();
                            } else {
                                Alert.alert('Erreur', data?.error || 'Échange impossible.');
                            }
                        } catch (err: any) {
                            Alert.alert('Erreur', err?.message || 'Erreur réseau.');
                        } finally { setRedeeming(null); }
                    }
                },
            ]
        );
    };

    if (loading) {
        return <View style={st.center}><ActivityIndicator size="large" color="#F59E0B" /></View>;
    }

    const progressToNext = balance ? Math.min((balance.balance % 100) / 100, 1) : 0;
    const ptsToNext = balance ? 100 - (balance.balance % 100) : 100;

    return (
        <View style={st.container}>
            {/* Hero solde */}
            <LinearGradient colors={['#92400E', '#D97706', '#FBBF24']} style={st.hero}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={st.heroTitle}>Programme Fidélité</Text>
                <View style={st.balanceCard}>
                    <Text style={st.balanceLabel}>Votre solde</Text>
                    <Text style={st.balanceValue}>{balance?.balance || 0}</Text>
                    <Text style={st.balancePts}>points</Text>
                </View>
                <View style={st.statsRow}>
                    <View style={st.statItem}>
                        <Text style={st.statValue}>{balance?.total_earned || 0}</Text>
                        <Text style={st.statLabel}>Gagnés</Text>
                    </View>
                    <View style={st.statDivider} />
                    <View style={st.statItem}>
                        <Text style={st.statValue}>{balance?.total_spent || 0}</Text>
                        <Text style={st.statLabel}>Dépensés</Text>
                    </View>
                    <View style={st.statDivider} />
                    <View style={st.statItem}>
                        <Text style={st.statValue}>{ptsToNext}</Text>
                        <Text style={st.statLabel}>Avant bonus</Text>
                    </View>
                </View>
                {/* Barre de progression niveau */}
                <View style={st.progressWrap}>
                    <View style={st.progressBg}>
                        <View style={[st.progressFill, { width: `${progressToNext * 100}%` as any }]} />
                    </View>
                    <Text style={st.progressLabel}>Prochain palier dans {ptsToNext} pts</Text>
                </View>
            </LinearGradient>

            {/* Comment gagner */}
            <View style={st.earnCard}>
                <Text style={st.earnTitle}>Comment gagner des points ?</Text>
                <View style={st.earnRow}>
                    {[
                        { icon: 'car', label: 'Trajet terminé', pts: '+10 pts' },
                        { icon: 'star', label: 'Laisser un avis', pts: '+5 pts' },
                        { icon: 'users', label: 'Parrainage', pts: '+50 pts' },
                        { icon: 'zap', label: '1er trajet', pts: '+30 pts' },
                    ].map((item, i) => (
                        <View key={i} style={st.earnItem}>
                            <SafeIcon name={item.icon} size={18} color="#D97706" />
                            <Text style={st.earnLabel}>{item.label}</Text>
                            <Text style={st.earnPts}>{item.pts}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Onglets */}
            <View style={st.tabs}>
                {(['rewards', 'history'] as const).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[st.tab, activeTab === tab && st.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[st.tabText, activeTab === tab && st.tabTextActive]}>
                            {tab === 'rewards' ? `Récompenses (${rewards.length})` : `Historique (${history.length})`}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
                contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            >
                {activeTab === 'rewards' ? (
                    rewards.length === 0 ? (
                        <Text style={st.empty}>Aucune récompense disponible.</Text>
                    ) : (
                        rewards.map(reward => {
                            const canAfford = (balance?.balance || 0) >= reward.points_cost;
                            return (
                                <View key={reward.id} style={[st.rewardCard, !canAfford && { opacity: 0.6 }]}>
                                    <View style={[st.rewardIcon, { backgroundColor: canAfford ? '#FEF3C7' : '#F3F4F6' }]}>
                                        <SafeIcon name={REWARD_ICONS[reward.reward_type] || 'gift'} size={24} color={canAfford ? '#D97706' : '#9CA3AF'} />
                                    </View>
                                    <View style={st.rewardInfo}>
                                        <Text style={st.rewardTitle}>{reward.title}</Text>
                                        {reward.description && <Text style={st.rewardDesc}>{reward.description}</Text>}
                                        <Text style={st.rewardCost}>{reward.points_cost} pts requis</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[st.redeemBtn, !canAfford && { backgroundColor: '#E5E7EB' }]}
                                        onPress={() => handleRedeem(reward)}
                                        disabled={redeeming === reward.id}
                                    >
                                        {redeeming === reward.id
                                            ? <ActivityIndicator color="#fff" size="small" />
                                            : <Text style={[st.redeemBtnText, !canAfford && { color: '#9CA3AF' }]}>
                                                {canAfford ? 'Échanger' : 'Insuffisant'}
                                              </Text>}
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )
                ) : (
                    history.length === 0 ? (
                        <Text style={st.empty}>Aucun mouvement de points.</Text>
                    ) : (
                        history.map(entry => {
                            const cfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.default;
                            const isPositive = entry.points > 0;
                            return (
                                <View key={entry.id} style={st.historyRow}>
                                    <View style={[st.historyIcon, { backgroundColor: cfg.color + '18' }]}>
                                        <SafeIcon name={cfg.icon} size={18} color={cfg.color} />
                                    </View>
                                    <View style={st.historyInfo}>
                                        <Text style={st.historyLabel}>{entry.description || cfg.label}</Text>
                                        <Text style={st.historyDate}>
                                            {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                                        </Text>
                                    </View>
                                    <Text style={[st.historyPoints, { color: isPositive ? '#10B981' : '#EF4444' }]}>
                                        {isPositive ? '+' : ''}{entry.points} pts
                                    </Text>
                                </View>
                            );
                        })
                    )
                )}
            </ScrollView>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    hero: { paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center' },
    backBtn: { position: 'absolute', top: 48, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 16 },
    balanceCard: { alignItems: 'center', marginBottom: 16 },
    balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    balanceValue: { fontSize: 52, fontWeight: '900', color: '#fff', lineHeight: 60 },
    balancePts: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
    statsRow: { flexDirection: 'row', gap: 0, marginBottom: 14 },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 4 },
    progressWrap: { width: '100%', gap: 6 },
    progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
    progressLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
    earnCard: { margin: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    earnTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
    earnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    earnItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
    earnLabel: { fontSize: 11, color: '#374151' },
    earnPts: { fontSize: 11, fontWeight: '700', color: '#D97706' },
    tabs: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 4, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 3 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
    tabText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
    tabTextActive: { color: '#111827', fontWeight: '700' },
    rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    rewardIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    rewardInfo: { flex: 1 },
    rewardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
    rewardDesc: { fontSize: 12, color: '#6B7280', marginTop: 1 },
    rewardCost: { fontSize: 11, color: '#D97706', fontWeight: '600', marginTop: 3 },
    redeemBtn: { backgroundColor: '#D97706', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    redeemBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6 },
    historyIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
    historyInfo: { flex: 1 },
    historyLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
    historyDate: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
    historyPoints: { fontSize: 15, fontWeight: '800' },
    empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 32, fontSize: 14 },
});

export default LoyaltyScreen;
