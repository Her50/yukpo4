/**
 * 📊 Graphiques de statistiques pour coursier
 * Design moderne avec visualisations animées
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { modernColors, modernStyles } from '../../theme/modernTheme';
import { SafeIcon } from '../SafeIcon';

const { width } = Dimensions.get('window');

interface CourierStatsChartProps {
    completedDeliveries: number;
    totalEarnings: number;
    currentMonthEarnings: number;
    avgDeliveryTime?: number;
    successRate?: number;
    style?: any;
}

const CourierStatsChart: React.FC<CourierStatsChartProps> = ({
    completedDeliveries,
    totalEarnings,
    currentMonthEarnings,
    avgDeliveryTime,
    successRate,
    style,
}) => {
    // ✅ CORRIGÉ: S'assurer que toutes les valeurs sont définies et numériques AVANT les animations
    const safeCurrentMonthEarnings = typeof currentMonthEarnings === 'number' && !isNaN(currentMonthEarnings) ? currentMonthEarnings : 0;
    const safeCompletedDeliveries = typeof completedDeliveries === 'number' && !isNaN(completedDeliveries) ? completedDeliveries : 0;
    const safeSuccessRate = typeof successRate === 'number' && !isNaN(successRate) ? successRate : 0;
    const safeAvgDeliveryTime = typeof avgDeliveryTime === 'number' && !isNaN(avgDeliveryTime) ? avgDeliveryTime : 0;

    const earningsAnim = useRef(new Animated.Value(0)).current;
    const deliveriesAnim = useRef(new Animated.Value(0)).current;
    const successRateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Animer les valeurs avec les valeurs sécurisées
        Animated.parallel([
            Animated.timing(earningsAnim, {
                toValue: safeCurrentMonthEarnings,
                duration: 1500,
                useNativeDriver: false,
            }),
            Animated.timing(deliveriesAnim, {
                toValue: safeCompletedDeliveries,
                duration: 1500,
                useNativeDriver: false,
            }),
            Animated.timing(successRateAnim, {
                toValue: safeSuccessRate,
                duration: 1500,
                useNativeDriver: false,
            }),
        ]).start();
    }, [safeCurrentMonthEarnings, safeCompletedDeliveries, safeSuccessRate]);

    const animatedEarnings = earningsAnim.interpolate({
        inputRange: [0, Math.max(safeCurrentMonthEarnings, 1)],
        outputRange: [0, Math.max(safeCurrentMonthEarnings, 1)],
    });

    const animatedDeliveries = deliveriesAnim.interpolate({
        inputRange: [0, Math.max(safeCompletedDeliveries, 1)],
        outputRange: [0, Math.max(safeCompletedDeliveries, 1)],
    });

    const animatedSuccessRate = successRateAnim.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 100],
    });

    return (
        <View style={[styles.container, style]}>
            {/* Graphique de gains mensuels */}
            <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <SafeIcon name="trending-up" size={20} color={modernColors.primary} />
                    <Text style={styles.chartTitle}>Gains ce mois</Text>
                </View>
                <Text style={styles.chartValue}>
                    {String(safeCurrentMonthEarnings.toLocaleString('fr-FR'))} FCFA
                </Text>
                <View style={styles.barContainer}>
                    <Animated.View
                        style={[
                            styles.bar,
                            {
                                width: animatedEarnings.interpolate({
                                    inputRange: [0, Math.max(safeCurrentMonthEarnings, 1)],
                                    outputRange: ['0%', '100%'],
                                }),
                            },
                        ]}
                    />
                </View>
            </View>

            {/* Graphique de livraisons */}
            <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <SafeIcon name="package" size={20} color={modernColors.success} />
                    <Text style={styles.chartTitle}>Livraisons complétées</Text>
                </View>
                <Text style={styles.chartValue}>
                    {String(safeCompletedDeliveries)}
                </Text>
                <View style={styles.barContainer}>
                    <Animated.View
                        style={[
                            styles.bar,
                            styles.barSuccess,
                            {
                                width: animatedDeliveries.interpolate({
                                    inputRange: [0, Math.max(safeCompletedDeliveries, 1)],
                                    outputRange: ['0%', '100%'],
                                }),
                            },
                        ]}
                    />
                </View>
            </View>

            {/* Taux de réussite */}
            {successRate !== undefined && successRate !== null && (
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                        <SafeIcon name="check-circle" size={20} color={modernColors.success} />
                        <Text style={styles.chartTitle}>Taux de réussite</Text>
                    </View>
                    <Text style={styles.chartValue}>
                        {String(safeSuccessRate)}%
                    </Text>
                    <View style={styles.barContainer}>
                        <Animated.View
                            style={[
                                styles.bar,
                                styles.barSuccess,
                                {
                                    width: animatedSuccessRate.interpolate({
                                        inputRange: [0, 100],
                                        outputRange: ['0%', '100%'],
                                    }),
                                },
                            ]}
                        />
                    </View>
                </View>
            )}

            {/* Temps moyen */}
            {avgDeliveryTime !== undefined && avgDeliveryTime !== null && avgDeliveryTime > 0 && (
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                        <SafeIcon name="clock" size={20} color={modernColors.info} />
                        <Text style={styles.chartTitle}>Temps moyen de livraison</Text>
                    </View>
                    <Text style={styles.chartValue}>
                        {String(Math.round(safeAvgDeliveryTime))} min
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    chartCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 20,
        ...modernStyles.shadowMedium,
    },
    chartHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    chartValue: {
        fontSize: 32,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 12,
    },
    barContainer: {
        height: 8,
        backgroundColor: modernColors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 4,
    },
    barSuccess: {
        backgroundColor: modernColors.success,
    },
});

export default CourierStatsChart;

