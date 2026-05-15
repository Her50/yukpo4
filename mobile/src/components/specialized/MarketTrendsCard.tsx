// ✅ NOUVEAU: Composant tendances du marché
// Date: 2026-01-26

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface MarketTrend {
    month: string;
    count: number;
    avg_price?: number;
    min_price?: number;
    max_price?: number;
}

interface MarketTrendsCardProps {
    ville?: string;
    quartier?: string;
    typeBien?: string;
    statut?: 'vente' | 'location';
}

const MarketTrendsCard: React.FC<MarketTrendsCardProps> = ({
    ville,
    quartier,
    typeBien,
    statut = 'vente',
}) => {
    const [trends, setTrends] = useState<MarketTrend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadMarketTrends();
    }, [ville, quartier, typeBien, statut]);

    const loadMarketTrends = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (ville) params.append('ville', ville);
            if (quartier) params.append('quartier', quartier);
            if (typeBien) params.append('type_bien', typeBien);
            params.append('statut', statut);
            params.append('months', '12');

            const response = await apiGet<{ success: boolean; data: MarketTrend[] }>(
                `/api/immobilier/market-trends?${params.toString()}`
            );

            if (response.success && response.data) {
                setTrends(response.data);
            } else {
                setError('Impossible de charger les tendances');
            }
        } catch (err) {
            console.error('[MarketTrendsCard] Erreur:', err);
            setError('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={modernColors.primary} />
            </View>
        );
    }

    if (error || trends.length === 0) {
        return (
            <View style={styles.container}>
                <SafeIcon name="info" size={24} color={modernColors.textSecondary} />
                <Text style={styles.emptyText}>
                    {error || 'Aucune donnée de tendance disponible'}
                </Text>
            </View>
        );
    }

    const labels = trends.map(t => {
        const date = new Date(t.month);
        return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
    });

    const prices = trends.map(t => t.avg_price || 0);
    const counts = trends.map(t => t.count);

    const screenWidth = Dimensions.get('window').width - 32;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                📊 Tendances du marché
            </Text>
            <Text style={styles.subtitle}>
                {ville && `${ville}${quartier ? ` - ${quartier}` : ''}`}
                {typeBien && ` • ${typeBien}`}
            </Text>
            
            <BarChart
                data={{
                    labels: labels.length > 6 ? labels.filter((_, i) => i % 2 === 0) : labels,
                    datasets: [
                        {
                            data: prices,
                        },
                    ],
                }}
                width={screenWidth}
                height={220}
                chartConfig={{
                    backgroundColor: modernColors.surface,
                    backgroundGradientFrom: modernColors.surface,
                    backgroundGradientTo: modernColors.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                    style: {
                        borderRadius: 16,
                    },
                }}
                style={styles.chart}
                yAxisLabel=""
                yAxisSuffix=" FCFA"
                showValuesOnTopOfBars
            />

            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Prix moyen</Text>
                    <Text style={styles.statValue}>
                        {trends[trends.length - 1]?.avg_price?.toLocaleString('fr-FR') || 'N/A'} FCFA
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Transactions</Text>
                    <Text style={styles.statValue}>
                        {trends.reduce((sum, t) => sum + t.count, 0)}
                    </Text>
                </View>
                {trends.length > 1 && (
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Tendance</Text>
                        <Text style={[
                            styles.statValue,
                            (trends[trends.length - 1]?.avg_price || 0) > (trends[0]?.avg_price || 0)
                                ? styles.statPositive
                                : styles.statNegative
                        ]}>
                            {(trends[trends.length - 1]?.avg_price || 0) > (trends[0]?.avg_price || 0) ? '↗️' : '↘️'}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    statPositive: {
        color: modernColors.success,
    },
    statNegative: {
        color: modernColors.error,
    },
    emptyText: {
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
});

export default MarketTrendsCard;

