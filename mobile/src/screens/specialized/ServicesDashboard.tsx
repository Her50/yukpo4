// ✅ NOUVEAU Phase 5.4: Dashboard statistiques pour services spécialisés (Mobile)
// Affiche statistiques détaillées avec graphiques

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import SimpleChart from '../../components/SimpleChart';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface DetailedStatistics {
    total: number;
    active: number;
    inactive: number;
    by_type: Record<string, { total: number; active: number; inactive: number }>;
    evolution: Array<{
        date: string;
        created: number;
        activated: number;
        deactivated: number;
    }>;
    recent_activity: {
        last_7_days: number;
        last_30_days: number;
        this_month: number;
    };
}

const ServicesDashboard: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<DetailedStatistics | null>(null);

    useEffect(() => {
        loadStatistics();
    }, []);

    const loadStatistics = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await apiGet('/api/specialized-services/statistics/detailed');
            const data = response.data as any;

            if (response.success && data?.data) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('[ServicesDashboard] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des statistiques...</Text>
            </View>
        );
    }

    if (!stats) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyTitle}>Aucune statistique disponible</Text>
                <Text style={styles.emptyText}>
                    Créez des services spécialisés pour voir vos statistiques
                </Text>
            </View>
        );
    }

    // Préparer données pour graphique par type
    const typeChartData = Object.entries(stats.by_type).map(([type, data]: [string, any]) => {
        const typeLabels: Record<string, string> = {
            pharmacie: 'Pharmacie',
            hopital: 'Hôpital',
            laboratoire: 'Laboratoire',
            banque_sang: 'Banque Sang',
            agence_voyage: 'Agence',
            covoiturage: 'Covoiturage',
            taxi: 'Taxi',
        };
        const typeColors: Record<string, string> = {
            pharmacie: '#10B981',
            hopital: '#EF4444',
            laboratoire: '#3B82F6',
            banque_sang: '#DC2626',
            agence_voyage: '#F59E0B',
            covoiturage: '#8B5CF6',
            taxi: '#F97316',
        };
        return {
            label: typeLabels[type] || type,
            value: data.total || 0,
            color: typeColors[type] || modernColors.primary,
        };
    });

    // Préparer données pour graphique évolution (7 derniers jours pour lisibilité)
    const evolutionChartData = stats.evolution.slice(-7).map((point) => ({
        label: new Date(point.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        value: point.created,
        color: modernColors.primary,
    }));

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => loadStatistics(true)}
                    colors={[modernColors.primary]}
                />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Dashboard Statistiques</Text>
            </View>

            {/* Statistiques principales */}
            <View style={styles.statsGrid}>
                <NativeCard style={styles.statCard}>
                    <Text style={styles.statLabel}>Total</Text>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <SafeIcon name="layers" size={24} color={modernColors.primary} />
                </NativeCard>
                <NativeCard style={styles.statCard}>
                    <Text style={styles.statLabel}>Actifs</Text>
                    <Text style={[styles.statValue, { color: modernColors.success }]}>
                        {stats.active}
                    </Text>
                    <SafeIcon name="check-circle" size={24} color={modernColors.success} />
                </NativeCard>
                <NativeCard style={styles.statCard}>
                    <Text style={styles.statLabel}>Inactifs</Text>
                    <Text style={[styles.statValue, { color: modernColors.warning }]}>
                        {stats.inactive}
                    </Text>
                    <SafeIcon name="x-circle" size={24} color={modernColors.warning} />
                </NativeCard>
            </View>

            {/* Activité récente */}
            <NativeCard style={styles.activityCard}>
                <Text style={styles.sectionTitle}>Activité Récente</Text>
                <View style={styles.activityRow}>
                    <View style={styles.activityItem}>
                        <Text style={styles.activityValue}>{stats.recent_activity.last_7_days}</Text>
                        <Text style={styles.activityLabel}>7 derniers jours</Text>
                    </View>
                    <View style={styles.activityItem}>
                        <Text style={styles.activityValue}>{stats.recent_activity.last_30_days}</Text>
                        <Text style={styles.activityLabel}>30 derniers jours</Text>
                    </View>
                    <View style={styles.activityItem}>
                        <Text style={styles.activityValue}>{stats.recent_activity.this_month}</Text>
                        <Text style={styles.activityLabel}>Ce mois</Text>
                    </View>
                </View>
            </NativeCard>

            {/* Graphique répartition par type */}
            {typeChartData.length > 0 && (
                <SimpleChart
                    data={typeChartData}
                    title="Répartition par Type"
                    type="bar"
                    height={250}
                />
            )}

            {/* Graphique évolution */}
            {evolutionChartData.length > 0 && (
                <SimpleChart
                    data={evolutionChartData}
                    title="Évolution (7 derniers jours)"
                    type="line"
                    height={200}
                />
            )}

            {/* Détails par type */}
            {Object.keys(stats.by_type).length > 0 && (
                <NativeCard style={styles.detailsCard}>
                    <Text style={styles.sectionTitle}>Détails par Type</Text>
                    {Object.entries(stats.by_type).map(([type, data]: [string, any]) => {
                        const typeLabels: Record<string, string> = {
                            pharmacie: '💊 Pharmacie',
                            hopital: '🏥 Hôpital',
                            laboratoire: '🔬 Laboratoire',
                            banque_sang: '🩸 Banque Sang',
                            agence_voyage: '🚌 Agence',
                            covoiturage: '🚗 Covoiturage',
                            taxi: '🚕 Taxi',
                        };
                        return (
                            <View key={type} style={styles.typeRow}>
                                <Text style={styles.typeLabel}>
                                    {typeLabels[type] || type}
                                </Text>
                                <View style={styles.typeStats}>
                                    <View style={styles.typeStatItem}>
                                        <Text style={styles.typeStatValue}>{data.total}</Text>
                                        <Text style={styles.typeStatLabel}>Total</Text>
                                    </View>
                                    <View style={styles.typeStatItem}>
                                        <Text
                                            style={[styles.typeStatValue, { color: modernColors.success }]}
                                        >
                                            {data.active}
                                        </Text>
                                        <Text style={styles.typeStatLabel}>Actifs</Text>
                                    </View>
                                    <View style={styles.typeStatItem}>
                                        <Text
                                            style={[styles.typeStatValue, { color: modernColors.warning }]}
                                        >
                                            {data.inactive}
                                        </Text>
                                        <Text style={styles.typeStatLabel}>Inactifs</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </NativeCard>
            )}

            {/* Bouton retour gestion */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.backToManagementButton}
                    onPress={() => (navigation as any).navigate('GestionServicesSpecialises')}
                >
                    <SafeIcon name="arrow-left" size={18} color="#fff" />
                    <Text style={styles.backToManagementText}>Retour à la gestion</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    statsGrid: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    activityCard: {
        margin: 16,
        marginTop: 0,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    activityRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    activityItem: {
        alignItems: 'center',
    },
    activityValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    activityLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    detailsCard: {
        margin: 16,
        marginTop: 0,
        padding: 16,
    },
    typeRow: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    typeLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    typeStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    typeStatItem: {
        alignItems: 'center',
    },
    typeStatValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    typeStatLabel: {
        fontSize: 11,
        color: '#6B7280',
    },
    footer: {
        padding: 16,
        paddingBottom: 32,
    },
    backToManagementButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        backgroundColor: modernColors.primary,
        borderRadius: 12,
    },
    backToManagementText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
});

export default ServicesDashboard;



