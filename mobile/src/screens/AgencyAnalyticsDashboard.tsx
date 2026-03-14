/**
 * Dashboard analytics pour agences de voyage
 * Affiche statistiques, graphiques, top trajets, revenus
 */

import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import SafeIcon from '../components/SafeIcon';
import SkeletonCard from '../components/SkeletonCard';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnalyticsData {
    overview: {
        total_tickets: number;
        total_revenue: number;
        occupancy_rate: number;
        average_price: number;
    };
    revenue_by_period: Array<{ period: string; revenue: number }>;
    tickets_by_period: Array<{ period: string; tickets: number }>;
    top_routes: Array<{ route: string; tickets: number; revenue: number }>;
    occupancy_by_period: Array<{ period: string; occupancy: number }>;
}

const AgencyAnalyticsDashboard: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');

    useEffect(() => {
        loadAnalytics();
    }, [period]);

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            // TODO: Remplacer par le vrai endpoint backend
            const response = await apiGet(`/api/agencies/${(user as any)?.service_id}/analytics?period=${period}`);

            if (response.success && response.data) {
                setData(response.data);
            } else {
                // Données mockées pour démonstration
                setData(generateMockData());
            }
        } catch (error) {
            console.error('[Analytics] Erreur:', error);
            setData(generateMockData());
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const generateMockData = (): AnalyticsData => {
        const periods = period === 'day' ? 7 : period === 'week' ? 4 : 12;
        return {
            overview: {
                total_tickets: 245,
                total_revenue: 6125000,
                occupancy_rate: 78.5,
                average_price: 25000,
            },
            revenue_by_period: Array.from({ length: periods }, (_, i) => ({
                period: `P${i + 1}`,
                revenue: Math.floor(Math.random() * 1000000) + 500000,
            })),
            tickets_by_period: Array.from({ length: periods }, (_, i) => ({
                period: `P${i + 1}`,
                tickets: Math.floor(Math.random() * 50) + 20,
            })),
            top_routes: [
                { route: 'Yaoundé → Douala', tickets: 89, revenue: 2225000 },
                { route: 'Douala → Yaoundé', tickets: 76, revenue: 1900000 },
                { route: 'Yaoundé → Bafoussam', tickets: 45, revenue: 1125000 },
                { route: 'Bafoussam → Yaoundé', tickets: 35, revenue: 875000 },
            ],
            occupancy_by_period: Array.from({ length: periods }, (_, i) => ({
                period: `P${i + 1}`,
                occupancy: Math.floor(Math.random() * 30) + 60,
            })),
        };
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadAnalytics();
    };

    const chartConfig = {
        backgroundColor: '#fff',
        backgroundGradientFrom: '#fff',
        backgroundGradientTo: '#fff',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
        style: {
            borderRadius: 16,
        },
        propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: modernColors.primary,
        },
    };

    if (loading && !data) {
        return (
            <View style={styles.container}>
                <SkeletonCard count={5} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Dashboard Analytics</Text>
                <View style={styles.periodSelector}>
                    {(['day', 'week', 'month'] as const).map((p) => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.periodButton, period === p && styles.periodButtonActive]}
                            onPress={() => setPeriod(p)}
                        >
                            <Text style={[styles.periodButtonText, period === p && styles.periodButtonTextActive]}>
                                {p === 'day' ? 'Jour' : p === 'week' ? 'Semaine' : 'Mois'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Vue d'ensemble */}
            {data && (
                <>
                    <View style={styles.overview}>
                        <View style={styles.statCard}>
                            <SafeIcon name="ticket" size={24} color={modernColors.primary} />
                            <Text style={styles.statValue}>{data.overview.total_tickets}</Text>
                            <Text style={styles.statLabel}>Tickets vendus</Text>
                        </View>
                        <View style={styles.statCard}>
                            <SafeIcon name="dollar-sign" size={24} color="#10B981" />
                            <Text style={styles.statValue}>
                                {(data.overview.total_revenue / 1000).toFixed(0)}k
                            </Text>
                            <Text style={styles.statLabel}>Revenus (FCFA)</Text>
                        </View>
                        <View style={styles.statCard}>
                            <SafeIcon name="users" size={24} color="#F59E0B" />
                            <Text style={styles.statValue}>{data.overview.occupancy_rate.toFixed(1)}%</Text>
                            <Text style={styles.statLabel}>Taux occupation</Text>
                        </View>
                        <View style={styles.statCard}>
                            <SafeIcon name="trending-up" size={24} color="#EF4444" />
                            <Text style={styles.statValue}>
                                {(data.overview.average_price / 1000).toFixed(0)}k
                            </Text>
                            <Text style={styles.statLabel}>Prix moyen</Text>
                        </View>
                    </View>

                    {/* Graphique revenus */}
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>Évolution des revenus</Text>
                        <LineChart
                            data={{
                                labels: data.revenue_by_period.map((d) => d.period),
                                datasets: [
                                    {
                                        data: data.revenue_by_period.map((d) => d.revenue / 1000),
                                    },
                                ],
                            }}
                            width={SCREEN_WIDTH - 32}
                            height={220}
                            chartConfig={chartConfig}
                            bezier
                            style={styles.chart}
                        />
                    </View>

                    {/* Graphique tickets */}
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>Tickets vendus</Text>
                        <BarChart
                            data={{
                                labels: data.tickets_by_period.map((d) => d.period),
                                datasets: [
                                    {
                                        data: data.tickets_by_period.map((d) => d.tickets),
                                    },
                                ],
                            }}
                            width={SCREEN_WIDTH - 32}
                            height={220}
                            chartConfig={chartConfig}
                            style={styles.chart}
                            showValuesOnTopOfBars
                        />
                    </View>

                    {/* Top trajets */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Top trajets</Text>
                        {data.top_routes.map((route, index) => (
                            <View key={index} style={styles.routeCard}>
                                <View style={styles.routeRank}>
                                    <Text style={styles.routeRankText}>#{index + 1}</Text>
                                </View>
                                <View style={styles.routeInfo}>
                                    <Text style={styles.routeName}>{route.route}</Text>
                                    <View style={styles.routeStats}>
                                        <Text style={styles.routeStat}>
                                            {route.tickets} tickets
                                        </Text>
                                        <Text style={styles.routeStat}>
                                            {(route.revenue / 1000).toFixed(0)}k FCFA
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Taux d'occupation */}
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>Taux d'occupation</Text>
                        <LineChart
                            data={{
                                labels: data.occupancy_by_period.map((d) => d.period),
                                datasets: [
                                    {
                                        data: data.occupancy_by_period.map((d) => d.occupancy),
                                    },
                                ],
                            }}
                            width={SCREEN_WIDTH - 32}
                            height={220}
                            chartConfig={{
                                ...chartConfig,
                                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                            }}
                            bezier
                            style={styles.chart}
                        />
                    </View>
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    periodSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    periodButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
    },
    periodButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    periodButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    periodButtonTextActive: {
        color: '#fff',
    },
    overview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    chartContainer: {
        margin: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    section: {
        margin: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    routeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    routeRank: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    routeRankText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    routeInfo: {
        flex: 1,
    },
    routeName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    routeStats: {
        flexDirection: 'row',
        gap: 16,
    },
    routeStat: {
        fontSize: 12,
        color: '#6B7280',
    },
});

export default AgencyAnalyticsDashboard;


