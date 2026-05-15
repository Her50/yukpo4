// ✅ NOUVEAU: Composant graphique historique des prix
// Date: 2026-01-26

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface PriceHistoryItem {
    id: number;
    prix_vente?: number;
    prix_location_mensuel?: number;
    date_enregistrement: string;
    source: string;
    notes?: string;
}

interface PriceHistoryChartProps {
    propertyId: number;
    propertyType: 'vente' | 'location';
}

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ propertyId, propertyType }) => {
    const [history, setHistory] = useState<PriceHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPriceHistory();
    }, [propertyId]);

    const loadPriceHistory = async () => {
        try {
            setLoading(true);
            const response = await apiGet<{ success: boolean; data: PriceHistoryItem[] }>(
                `/api/immobilier/biens/${propertyId}/price-history`
            );

            if (response.success && response.data) {
                setHistory(response.data.reverse()); // Plus ancien au plus récent
            } else {
                setError('Impossible de charger l\'historique');
            }
        } catch (err) {
            console.error('[PriceHistoryChart] Erreur:', err);
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

    if (error || history.length === 0) {
        return (
            <View style={styles.container}>
                <SafeIcon name="info" size={24} color={modernColors.textSecondary} />
                <Text style={styles.emptyText}>
                    {error || 'Aucun historique de prix disponible'}
                </Text>
            </View>
        );
    }

    // Préparer les données pour le graphique
    const labels = history.map((item, index) => {
        const date = new Date(item.date_enregistrement);
        return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    const prices = history.map(item => {
        if (propertyType === 'vente') {
            return item.prix_vente || 0;
        } else {
            return item.prix_location_mensuel || 0;
        }
    });

    const screenWidth = Dimensions.get('window').width - 32;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                📈 Historique des prix
            </Text>
            <LineChart
                data={{
                    labels: labels.length > 10 ? labels.filter((_, i) => i % 2 === 0) : labels,
                    datasets: [
                        {
                            data: prices,
                            color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                            strokeWidth: 2,
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
                    propsForDots: {
                        r: '4',
                        strokeWidth: '2',
                        stroke: modernColors.primary,
                    },
                }}
                bezier
                style={styles.chart}
            />
            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Prix actuel</Text>
                    <Text style={styles.statValue}>
                        {prices[prices.length - 1]?.toLocaleString('fr-FR')} FCFA
                    </Text>
                </View>
                {prices.length > 1 && (
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Évolution</Text>
                        <Text style={[
                            styles.statValue,
                            prices[prices.length - 1] > prices[0] 
                                ? styles.statPositive 
                                : styles.statNegative
                        ]}>
                            {prices[prices.length - 1] > prices[0] ? '+' : ''}
                            {((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(1)}%
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

export default PriceHistoryChart;

