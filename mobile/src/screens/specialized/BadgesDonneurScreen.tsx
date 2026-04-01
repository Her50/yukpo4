import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const ALL_BADGES = [
    { key: 'premier_don', icon: '🩸', title: 'Premier Don', desc: 'Effectuer son 1er don', threshold: 1 },
    { key: 'regulier', icon: '⭐', title: 'Donneur Régulier', desc: '5 dons effectués', threshold: 5 },
    { key: 'heros', icon: '🦸', title: 'Héros du Sang', desc: '10 dons effectués', threshold: 10 },
    { key: 'veteran', icon: '🏆', title: 'Vétéran', desc: '25 dons effectués', threshold: 25 },
    { key: 'sos', icon: '🆘', title: 'Répondant SOS', desc: 'Répondre à une urgence', threshold: 0 },
    { key: 'rare', icon: '💎', title: 'Groupe Rare', desc: 'Groupe sanguin rare (AB-)', threshold: 0 },
    { key: 'ambassadeur', icon: '📣', title: 'Ambassadeur', desc: 'Recruter 3 donneurs', threshold: 0 },
    { key: 'annuel', icon: '📅', title: 'Don Annuel', desc: 'Donner chaque année', threshold: 0 },
];

const BadgesDonneurScreen: React.FC = () => {
    const [badges, setBadges] = useState<string[]>([]);
    const [stats, setStats] = useState<any>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [badgesRes, statsRes] = await Promise.allSettled([
                apiGet('/api/users/blood-donor-badges'),
                apiGet('/api/banques-sang/my-donor-stats'),
            ]);
            if (badgesRes.status === 'fulfilled') setBadges(badgesRes.value?.data?.badges || []);
            if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data || {});
        } catch { setBadges([]); setStats({}); }
        finally { setLoading(false); }
    };

    const totalDons = stats.total_dons || 0;
    const nextBadge = ALL_BADGES.find(b => b.threshold > 0 && totalDons < b.threshold);
    const progress = nextBadge ? Math.min(totalDons / nextBadge.threshold, 1) : 1;

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.statsCard}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{totalDons}</Text>
                    <Text style={styles.statLabel}>Dons effectués</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{badges.length}</Text>
                    <Text style={styles.statLabel}>Badges obtenus</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.vies_sauvees || Math.floor(totalDons * 3)}</Text>
                    <Text style={styles.statLabel}>Vies aidées</Text>
                </View>
            </View>

            {nextBadge && (
                <View style={styles.progressCard}>
                    <Text style={styles.progressTitle}>Prochain badge : {nextBadge.icon} {nextBadge.title}</Text>
                    <Text style={styles.progressDesc}>{totalDons} / {nextBadge.threshold} dons</Text>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                </View>
            )}

            <Text style={styles.sectionTitle}>Vos badges</Text>
            <View style={styles.grid}>
                {ALL_BADGES.map(b => {
                    const earned = badges.includes(b.key) || (b.threshold > 0 && totalDons >= b.threshold);
                    return (
                        <View key={b.key} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                            <Text style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>{b.icon}</Text>
                            <Text style={[styles.badgeTitle, !earned && styles.badgeTitleLocked]}>{b.title}</Text>
                            <Text style={styles.badgeDesc}>{b.desc}</Text>
                            {earned && <View style={styles.earnedBadge}><Text style={styles.earnedText}>✓</Text></View>}
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statsCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3 },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '800', color: '#DC2626' },
    statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' },
    statDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
    progressCard: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FCA5A5' },
    progressTitle: { fontSize: 14, fontWeight: '700', color: '#991B1B', marginBottom: 4 },
    progressDesc: { fontSize: 13, color: '#B91C1C', marginBottom: 10 },
    progressBar: { height: 8, backgroundColor: '#FEE2E2', borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#DC2626', borderRadius: 4 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    badgeCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2, position: 'relative' },
    badgeCardLocked: { backgroundColor: '#F9FAFB', opacity: 0.5 },
    badgeIcon: { fontSize: 36, marginBottom: 8 },
    badgeIconLocked: { filter: 'grayscale(100%)' },
    badgeTitle: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 4 },
    badgeTitleLocked: { color: '#9CA3AF' },
    badgeDesc: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
    earnedBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' },
    earnedText: { fontSize: 10, color: '#fff', fontWeight: '700' },
});

export default BadgesDonneurScreen;
