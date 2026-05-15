// ✅ NOUVEAU Phase 4.1: Carte de statistiques de marché
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { immobilierService } from '../../services/immobilierService';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';

interface MarketStatsCardProps {
    filters?: {
        ville?: string;
        quartier?: string;
        type_bien?: string;
    };
}

const MarketStatsCard: React.FC<MarketStatsCardProps> = ({ filters }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, [filters]);

    const loadStats = async () => {
        try {
            setLoading(true);
            const response = await immobilierService.getMarketStats(filters);
            if (response.success && response.stats) {
                setStats(response.stats);
            }
        } catch (error) {
            console.error('[MarketStatsCard] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !stats) {
        return null;
    }

    const formatPrice = (price: number) => {
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
        return `${(price / 1000).toFixed(0)}K`;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="trending-up" size={20} color={modernColors.primary} />
                <Text style={styles.title}>Statistiques du marché</Text>
            </View>

            <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Prix moyen / m²</Text>
                    <Text style={styles.statValue}>
                        {formatPrice(stats.average_price_per_m2)} FCFA
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Prix médian</Text>
                    <Text style={styles.statValue}>
                        {formatPrice(stats.median_price)} FCFA
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Biens disponibles</Text>
                    <Text style={styles.statValue}>
                        {stats.total_properties}
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Superficie moyenne</Text>
                    <Text style={styles.statValue}>
                        {stats.average_superficie.toFixed(0)} m²
                    </Text>
                </View>
            </View>

            {stats.price_trend && (
                <View style={styles.trendContainer}>
                    <SafeIcon
                        name={stats.price_trend === 'up' ? 'arrow-up' : stats.price_trend === 'down' ? 'arrow-down' : 'minus'}
                        size={16}
                        color={stats.price_trend === 'up' ? '#10B981' : stats.price_trend === 'down' ? '#EF4444' : '#6B7280'}
                    />
                    <Text style={[
                        styles.trendText,
                        stats.price_trend === 'up' && styles.trendTextUp,
                        stats.price_trend === 'down' && styles.trendTextDown,
                    ]}>
                        Tendance: {stats.price_trend === 'up' ? 'Hausse' : stats.price_trend === 'down' ? 'Baisse' : 'Stable'}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        margin: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    statItem: {
        flex: 1,
        minWidth: '45%',
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 6,
    },
    trendText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    trendTextUp: {
        color: '#10B981',
    },
    trendTextDown: {
        color: '#EF4444',
    },
});

export default MarketStatsCard;

