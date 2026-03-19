import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { modernColors } from '../styles/theme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface TimeSeriesData {
    date: string;
    vues: number;
    clics: number;
    conversions: number;
    budget: number;
    impressions: number;
}

interface CampaignComparison {
    campaign_id: number;
    titre: string;
    vues: number;
    clics: number;
    conversion_rate: number;
    budget: number;
    roi: number;
}

interface ConversionFunnel {
    impressions: number;
    views: number;
    clicks: number;
    conversions: number;
    drop_off_rates: Array<{
        step: string;
        count: number;
        drop_off_pct: number;
    }>;
}

interface PlacementPerformance {
    placement: string;
    vues: number;
    clics: number;
    conversion_rate: number;
    ctr: number;
}

interface AdvancedAnalyticsData {
    time_series: TimeSeriesData[];
    campaign_comparison: CampaignComparison[];
    conversion_funnel: ConversionFunnel;
    performance_by_placement: PlacementPerformance[];
    performance_by_targeting: Array<{
        targeting_type: string;
        count: number;
        avg_conversion: number;
        avg_ctr: number;
    }>;
}

interface AdvancedAnalyticsChartProps {
    userId: number;
    periodDays?: number;
}

const AdvancedAnalyticsChart: React.FC<AdvancedAnalyticsChartProps> = ({
    userId,
    periodDays = 30,
}) => {
        const { t } = useLanguageSafe();
const [data, setData] = useState<AdvancedAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'time' | 'campaigns' | 'funnel' | 'placement' | 'targeting'>('time');

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                const response = await axios.get<AdvancedAnalyticsData>(
                    `${API_BASE_URL}/api/publicites/analytics/advanced?user_id=${userId}&period_days=${periodDays}`
                );
                setData(response.data);
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Erreur lors du chargement des analytics');
                console.error('Erreur analytics:', err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchAnalytics();
        }
    }, [userId, periodDays]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('advancedAnalyticsChart.chargementDesAnalytics')}</Text>
            </View>
        );
    }

    if (error) {
        return (
            <NativeCard style={styles.errorCard}>
                <Text style={styles.errorText}>❌ {error}</Text>
            </NativeCard>
        );
    }

    if (!data) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('advancedAnalyticsChart.aucuneDonneeDisponible')}</Text>
            </View>
        );
    }

    const renderTimeSeries = () => {
        if (!data.time_series.length) return null;

        const maxValue = Math.max(
            ...data.time_series.map(d => Math.max(d.vues, d.clics, d.budget))
        );

        return (
            <NativeCard style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <SafeIcon name="trending-up" size={24} color={modernColors.primary} />
                    <Text style={styles.chartTitle}>Tendances Temporelles</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chartContainer}>
                        {data.time_series.map((item, index) => (
                            <View key={index} style={styles.timeBar}>
                                <View style={styles.barGroup}>
                                    <View
                                        style={[
                                            styles.bar,
                                            {
                                                height: `${(item.vues / maxValue) * 100}%`,
                                                backgroundColor: '#0088FE',
                                            },
                                        ]}
                                    />
                                    <View
                                        style={[
                                            styles.bar,
                                            {
                                                height: `${(item.clics / maxValue) * 100}%`,
                                                backgroundColor: '#00C49F',
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.barLabel} numberOfLines={1}>
                                    {new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                </Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#0088FE' }]} />
                        <Text style={styles.legendText}>Vues</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#00C49F' }]} />
                        <Text style={styles.legendText}>Clics</Text>
                    </View>
                </View>
            </NativeCard>
        );
    };

    const renderCampaignComparison = () => {
        if (!data.campaign_comparison.length) return null;

        return (
            <NativeCard style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <SafeIcon name="bar-chart" size={24} color={modernColors.primary} />
                    <Text style={styles.chartTitle}>Comparaison des Campagnes</Text>
                </View>
                <ScrollView>
                    {data.campaign_comparison.map((campaign, index) => (
                        <View key={index} style={styles.campaignItem}>
                            <Text style={styles.campaignTitle} numberOfLines={1}>
                                {campaign.titre}
                            </Text>
                            <View style={styles.metricsRow}>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{campaign.vues.toLocaleString()}</Text>
                                    <Text style={styles.metricLabel}>Vues</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{campaign.clics.toLocaleString()}</Text>
                                    <Text style={styles.metricLabel}>Clics</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{campaign.conversion_rate.toFixed(1)}%</Text>
                                    <Text style={styles.metricLabel}>Conversion</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </NativeCard>
        );
    };

    const renderFunnel = () => {
        const steps = [
            { label: 'Impressions', value: data.conversion_funnel.impressions, color: '#0088FE' },
            { label: 'Vues', value: data.conversion_funnel.views, color: '#00C49F' },
            { label: 'Clics', value: data.conversion_funnel.clicks, color: '#FFBB28' },
            { label: 'Conversions', value: data.conversion_funnel.conversions, color: '#FF8042' },
        ];
        const maxValue = data.conversion_funnel.impressions;

        return (
            <NativeCard style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <SafeIcon name="filter" size={24} color={modernColors.primary} />
                    <Text style={styles.chartTitle}>Funnel de Conversion</Text>
                </View>
                <View style={styles.funnelContainer}>
                    {steps.map((step, index) => {
                        const percentage = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
                        return (
                            <View key={index} style={styles.funnelStep}>
                                <View style={styles.funnelStepHeader}>
                                    <Text style={styles.funnelStepLabel}>{step.label}</Text>
                                    <Text style={styles.funnelStepValue}>{step.value.toLocaleString()}</Text>
                                </View>
                                <View style={styles.funnelBarContainer}>
                                    <View
                                        style={[
                                            styles.funnelBar,
                                            {
                                                width: `${percentage}%`,
                                                backgroundColor: step.color,
                                            },
                                        ]}
                                    />
                                </View>
                            </View>
                        );
                    })}
                </View>
            </NativeCard>
        );
    };

    const renderPlacement = () => {
        if (!data.performance_by_placement.length) return null;

        return (
            <NativeCard style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <SafeIcon name="map-pin" size={24} color={modernColors.primary} />
                    <Text style={styles.chartTitle}>Performance par Placement</Text>
                </View>
                <ScrollView>
                    {data.performance_by_placement.map((placement, index) => (
                        <View key={index} style={styles.placementItem}>
                            <Text style={styles.placementName}>{placement.placement}</Text>
                            <View style={styles.metricsRow}>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{placement.vues.toLocaleString()}</Text>
                                    <Text style={styles.metricLabel}>Vues</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{placement.ctr.toFixed(2)}%</Text>
                                    <Text style={styles.metricLabel}>CTR</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{placement.conversion_rate.toFixed(2)}%</Text>
                                    <Text style={styles.metricLabel}>Conversion</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </NativeCard>
        );
    };

    const renderTargeting = () => {
        if (!data.performance_by_targeting.length) return null;

        return (
            <NativeCard style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <SafeIcon name="target" size={24} color={modernColors.primary} />
                    <Text style={styles.chartTitle}>Performance par Ciblage</Text>
                </View>
                <ScrollView>
                    {data.performance_by_targeting.map((targeting, index) => (
                        <View key={index} style={styles.targetingItem}>
                            <Text style={styles.targetingType}>{targeting.targeting_type}</Text>
                            <View style={styles.metricsRow}>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{targeting.count}</Text>
                                    <Text style={styles.metricLabel}>Campagnes</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{targeting.avg_conversion.toFixed(2)}%</Text>
                                    <Text style={styles.metricLabel}>Conversion</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{targeting.avg_ctr.toFixed(2)}%</Text>
                                    <Text style={styles.metricLabel}>CTR</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </NativeCard>
        );
    };

    const tabs = [
        { key: 'time', label: '📈 Tendances', icon: 'trending-up' },
        { key: 'campaigns', label: '📊 Campagnes', icon: 'bar-chart' },
        { key: 'funnel', label: '🔄 Funnel', icon: 'filter' },
        { key: 'placement', label: '📍 Placements', icon: 'map-pin' },
        { key: 'targeting', label: '🎯 Ciblage', icon: 'target' },
    ];

    return (
        <View style={styles.container}>
            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => setActiveTab(tab.key as any)}
                        style={[
                            styles.tab,
                            activeTab === tab.key && styles.tabActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === tab.key && styles.tabTextActive,
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'time' && renderTimeSeries()}
                {activeTab === 'campaigns' && renderCampaignComparison()}
                {activeTab === 'funnel' && renderFunnel()}
                {activeTab === 'placement' && renderPlacement()}
                {activeTab === 'targeting' && renderTargeting()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: modernColors.textSecondary,
    },
    errorCard: {
        padding: 16,
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
    },
    errorText: {
        color: '#DC2626',
        textAlign: 'center',
    },
    emptyContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: modernColors.textSecondary,
    },
    tabsContainer: {
        marginBottom: 16,
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
        backgroundColor: modernColors.backgroundSecondary,
    },
    tabActive: {
        backgroundColor: modernColors.primary,
    },
    tabText: {
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    chartCard: {
        padding: 16,
        marginBottom: 16,
    },
    chartHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
        color: modernColors.textPrimary,
    },
    chartContainer: {
        flexDirection: 'row',
        height: 200,
        alignItems: 'flex-end',
        paddingBottom: 30,
    },
    timeBar: {
        marginRight: 8,
        alignItems: 'center',
        width: 40,
    },
    barGroup: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 150,
        gap: 2,
    },
    bar: {
        width: 18,
        minHeight: 4,
        borderRadius: 2,
    },
    barLabel: {
        marginTop: 4,
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
        gap: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendColor: {
        width: 12,
        height: 12,
        borderRadius: 2,
        marginRight: 4,
    },
    legendText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    campaignItem: {
        padding: 12,
        marginBottom: 8,
        backgroundColor: modernColors.backgroundSecondary,
        borderRadius: 8,
    },
    campaignTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
        marginBottom: 8,
    },
    metricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    metric: {
        alignItems: 'center',
    },
    metricValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.textPrimary,
    },
    metricLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    funnelContainer: {
        gap: 12,
    },
    funnelStep: {
        marginBottom: 12,
    },
    funnelStepHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    funnelStepLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
    },
    funnelStepValue: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    funnelBarContainer: {
        height: 24,
        backgroundColor: modernColors.backgroundSecondary,
        borderRadius: 12,
        overflow: 'hidden',
    },
    funnelBar: {
        height: '100%',
        borderRadius: 12,
    },
    placementItem: {
        padding: 12,
        marginBottom: 8,
        backgroundColor: modernColors.backgroundSecondary,
        borderRadius: 8,
    },
    placementName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
        marginBottom: 8,
    },
    targetingItem: {
        padding: 12,
        marginBottom: 8,
        backgroundColor: modernColors.backgroundSecondary,
        borderRadius: 8,
    },
    targetingType: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textPrimary,
        marginBottom: 8,
        textTransform: 'capitalize',
    },
});

export default AdvancedAnalyticsChart;

