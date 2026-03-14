// ✅ Phase 10 - Écran Analytics Dashboard pour prestataires (Mobile)
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface DeliveryStats {
  total_deliveries: number;
  completed_deliveries: number;
  cancelled_deliveries: number;
  pending_deliveries: number;
  success_rate: number;
  avg_delivery_time_minutes: number | null;
  total_revenue: number;
  avg_revenue_per_delivery: number;
}

interface ServiceStats {
  total_services: number;
  active_services: number;
  total_views: number;
  total_interactions: number;
  avg_rating: number | null;
  total_reviews: number;
}

interface RevenueStats {
  total_revenue: number;
  revenue_this_month: number;
  revenue_last_month: number;
  revenue_growth: number;
  avg_revenue_per_delivery: number;
  total_commissions: number;
}

interface TopProduct {
  service_id: number;
  product_index: number | null;
  product_name: string;
  order_count: number;
  total_revenue: number;
}

interface TopDeliveryZone {
  zone_id: string | null;
  zone_name: string | null;
  delivery_count: number;
  avg_distance_km: number | null;
}

interface PerformanceDataPoint {
  date: string;
  deliveries: number;
  revenue: number;
  success_rate: number;
}

interface ProviderAnalytics {
  delivery_stats: DeliveryStats;
  service_stats: ServiceStats;
  revenue_stats: RevenueStats;
  top_products: TopProduct[];
  top_delivery_zones: TopDeliveryZone[];
  performance_over_time: PerformanceDataPoint[];
  period_start: string;
  period_end: string;
}

const AnalyticsDashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<ProviderAnalytics | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(30);

  useEffect(() => {
    if (user?.id) {
      loadAnalytics();
    }
  }, [user?.id, selectedDays]);

  const loadAnalytics = async () => {
    try {
      const response = await apiCall(`/api/analytics/provider?days=${selectedDays}`);
      if (response.success && response.data) {
        setAnalytics(response.data as any);
      } else {
        throw new Error(response.error || 'Erreur lors du chargement des analytics');
      }
    } catch (error: any) {
      console.error('[AnalyticsDashboard] Erreur:', error);
      Alert.alert('Erreur', error.message || 'Impossible de charger les analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={modernColors.primary} />
        <Text style={styles.loadingText}>Chargement des analytics...</Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.container}>
        <NativeCard style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune donnée disponible</Text>
          <NativeButton onPress={loadAnalytics} variant="primary" style={styles.retryButton}>
            Réessayer
          </NativeButton>
        </NativeCard>
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
        <Text style={styles.title}>📊 Analytics Dashboard</Text>
        <Text style={styles.subtitle}>
          {new Date(analytics.period_start).toLocaleDateString('fr-FR')} -{' '}
          {new Date(analytics.period_end).toLocaleDateString('fr-FR')}
        </Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[styles.periodButton, selectedDays === 7 && styles.periodButtonActive]}
          onPress={() => setSelectedDays(7)}
        >
          <Text style={[styles.periodButtonText, selectedDays === 7 && styles.periodButtonTextActive]}>
            7 jours
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedDays === 30 && styles.periodButtonActive]}
          onPress={() => setSelectedDays(30)}
        >
          <Text style={[styles.periodButtonText, selectedDays === 30 && styles.periodButtonTextActive]}>
            30 jours
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodButton, selectedDays === 90 && styles.periodButtonActive]}
          onPress={() => setSelectedDays(90)}
        >
          <Text style={[styles.periodButtonText, selectedDays === 90 && styles.periodButtonTextActive]}>
            90 jours
          </Text>
        </TouchableOpacity>
      </View>

      {/* KPIs */}
      <View style={styles.kpiGrid}>
        <NativeCard style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <SafeIcon name="dollar-sign" size={20} color={modernColors.primary} />
            <Text style={styles.kpiTitle}>Revenus totaux</Text>
          </View>
          <Text style={styles.kpiValue}>{formatCurrency(analytics.revenue_stats.total_revenue)}</Text>
          <Text style={styles.kpiSubtext}>
            {analytics.revenue_stats.revenue_growth >= 0 ? '📈' : '📉'}{' '}
            {analytics.revenue_stats.revenue_growth >= 0 ? '+' : ''}
            {analytics.revenue_stats.revenue_growth.toFixed(1)}% vs mois précédent
          </Text>
        </NativeCard>

        <NativeCard style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <SafeIcon name="truck" size={20} color={modernColors.primary} />
            <Text style={styles.kpiTitle}>Livraisons</Text>
          </View>
          <Text style={styles.kpiValue}>{formatNumber(analytics.delivery_stats.total_deliveries)}</Text>
          <Text style={styles.kpiSubtext}>
            ✅ {analytics.delivery_stats.completed_deliveries} complétées
          </Text>
        </NativeCard>

        <NativeCard style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <SafeIcon name="bar-chart-3" size={20} color={modernColors.primary} />
            <Text style={styles.kpiTitle}>Taux de succès</Text>
          </View>
          <Text style={styles.kpiValue}>{analytics.delivery_stats.success_rate.toFixed(1)}%</Text>
          <Text style={styles.kpiSubtext}>
            {analytics.delivery_stats.avg_delivery_time_minutes
              ? `⏱️ ${Math.round(analytics.delivery_stats.avg_delivery_time_minutes)} min en moyenne`
              : 'Temps moyen: N/A'}
          </Text>
        </NativeCard>

        <NativeCard style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <SafeIcon name="package" size={20} color={modernColors.primary} />
            <Text style={styles.kpiTitle}>Services actifs</Text>
          </View>
          <Text style={styles.kpiValue}>{analytics.service_stats.active_services}</Text>
          <Text style={styles.kpiSubtext}>sur {analytics.service_stats.total_services} services</Text>
        </NativeCard>
      </View>

      {/* Delivery Stats */}
      <NativeCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <SafeIcon name="truck" size={24} color={modernColors.primary} />
          <Text style={styles.sectionTitle}>Statistiques de livraison</Text>
        </View>
        <View style={styles.statsList}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total livraisons</Text>
            <Text style={styles.statValue}>{formatNumber(analytics.delivery_stats.total_deliveries)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Complétées</Text>
            <Text style={[styles.statValue, styles.statValueSuccess]}>
              {formatNumber(analytics.delivery_stats.completed_deliveries)}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Annulées</Text>
            <Text style={[styles.statValue, styles.statValueError]}>
              {formatNumber(analytics.delivery_stats.cancelled_deliveries)}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>En attente</Text>
            <Text style={[styles.statValue, styles.statValueWarning]}>
              {formatNumber(analytics.delivery_stats.pending_deliveries)}
            </Text>
          </View>
          <View style={[styles.statRow, styles.statRowBorder]}>
            <Text style={[styles.statLabel, styles.statLabelBold]}>Revenu moyen par livraison</Text>
            <Text style={[styles.statValue, styles.statValueBold]}>
              {formatCurrency(analytics.delivery_stats.avg_revenue_per_delivery)}
            </Text>
          </View>
        </View>
      </NativeCard>

      {/* Service Stats */}
      <NativeCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <SafeIcon name="package" size={24} color={modernColors.primary} />
          <Text style={styles.sectionTitle}>Statistiques de services</Text>
        </View>
        <View style={styles.statsList}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total services</Text>
            <Text style={styles.statValue}>{formatNumber(analytics.service_stats.total_services)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Services actifs</Text>
            <Text style={[styles.statValue, styles.statValueSuccess]}>
              {formatNumber(analytics.service_stats.active_services)}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total vues</Text>
            <Text style={styles.statValue}>{formatNumber(analytics.service_stats.total_views)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total interactions</Text>
            <Text style={styles.statValue}>{formatNumber(analytics.service_stats.total_interactions)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Note moyenne</Text>
            <Text style={styles.statValue}>
              {analytics.service_stats.avg_rating
                ? `${analytics.service_stats.avg_rating.toFixed(1)} ⭐`
                : 'N/A'}
            </Text>
          </View>
          <View style={[styles.statRow, styles.statRowBorder]}>
            <Text style={[styles.statLabel, styles.statLabelBold]}>Total avis</Text>
            <Text style={[styles.statValue, styles.statValueBold]}>
              {formatNumber(analytics.service_stats.total_reviews)}
            </Text>
          </View>
        </View>
      </NativeCard>

      {/* Top Products */}
      {analytics.top_products.length > 0 && (
        <NativeCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <SafeIcon name="bar-chart-3" size={24} color={modernColors.primary} />
            <Text style={styles.sectionTitle}>Top produits/services</Text>
          </View>
          <View style={styles.topList}>
            {analytics.top_products.map((product, index) => (
              <View key={`${product.service_id}-${product.product_index}`} style={styles.topItem}>
                <View style={styles.topItemLeft}>
                  <Text style={styles.topItemRank}>#{index + 1}</Text>
                  <View style={styles.topItemInfo}>
                    <Text style={styles.topItemName}>{product.product_name}</Text>
                    <Text style={styles.topItemSubtext}>
                      {formatNumber(product.order_count)} commande{product.order_count > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.topItemValue}>{formatCurrency(product.total_revenue)}</Text>
              </View>
            ))}
          </View>
        </NativeCard>
      )}

      {/* Top Delivery Zones */}
      {analytics.top_delivery_zones.length > 0 && (
        <NativeCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <SafeIcon name="map-pin" size={24} color={modernColors.primary} />
            <Text style={styles.sectionTitle}>Zones de livraison les plus fréquentes</Text>
          </View>
          <View style={styles.topList}>
            {analytics.top_delivery_zones.map((zone, index) => (
              <View key={zone.zone_id || index} style={styles.topItem}>
                <View style={styles.topItemLeft}>
                  <Text style={styles.topItemRank}>#{index + 1}</Text>
                  <View style={styles.topItemInfo}>
                    <Text style={styles.topItemName}>{zone.zone_name || 'Zone inconnue'}</Text>
                    <Text style={styles.topItemSubtext}>
                      {formatNumber(zone.delivery_count)} livraison{zone.delivery_count > 1 ? 's' : ''}
                      {zone.avg_distance_km && ` • ${zone.avg_distance_km.toFixed(1)} km en moyenne`}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </NativeCard>
      )}

      {/* Performance Over Time */}
      {analytics.performance_over_time.length > 0 && (
        <NativeCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <SafeIcon name="trending-up" size={24} color={modernColors.primary} />
            <Text style={styles.sectionTitle}>Performance dans le temps</Text>
          </View>
          <View style={styles.performanceList}>
            {analytics.performance_over_time.slice(-7).map((point) => (
              <View key={point.date} style={styles.performanceItem}>
                <View style={styles.performanceItemLeft}>
                  <Text style={styles.performanceItemDate}>
                    {new Date(point.date).toLocaleDateString('fr-FR')}
                  </Text>
                  <Text style={styles.performanceItemSubtext}>
                    {formatNumber(point.deliveries)} livraison{point.deliveries > 1 ? 's' : ''} •{' '}
                    {point.success_rate.toFixed(1)}% succès
                  </Text>
                </View>
                <Text style={styles.performanceItemValue}>{formatCurrency(point.revenue)}</Text>
              </View>
            ))}
          </View>
        </NativeCard>
      )}

      <View style={styles.footer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: modernColors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: modernColors.text,
  },
  header: {
    padding: 16,
    backgroundColor: modernColors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: modernColors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: modernColors.surface,
    borderWidth: 1,
    borderColor: modernColors.border,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    color: modernColors.text,
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    padding: 16,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  kpiTitle: {
    fontSize: 12,
    color: modernColors.textSecondary,
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: modernColors.text,
    marginBottom: 4,
  },
  kpiSubtext: {
    fontSize: 11,
    color: modernColors.textSecondary,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: modernColors.text,
  },
  statsList: {
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statRowBorder: {
    borderTopWidth: 1,
    borderTopColor: modernColors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  statLabelBold: {
    fontWeight: '600',
    color: modernColors.text,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
  },
  statValueBold: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statValueSuccess: {
    color: '#10B981',
  },
  statValueError: {
    color: '#EF4444',
  },
  statValueWarning: {
    color: '#F59E0B',
  },
  topList: {
    gap: 12,
  },
  topItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: modernColors.surface,
    borderRadius: 8,
  },
  topItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  topItemRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: modernColors.primary,
    minWidth: 30,
  },
  topItemInfo: {
    flex: 1,
  },
  topItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 2,
  },
  topItemSubtext: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  topItemValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  performanceList: {
    gap: 8,
  },
  performanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: modernColors.border,
  },
  performanceItemLeft: {
    flex: 1,
  },
  performanceItemDate: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 2,
  },
  performanceItemSubtext: {
    fontSize: 12,
    color: modernColors.textSecondary,
  },
  performanceItemValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: modernColors.text,
  },
  emptyCard: {
    margin: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: modernColors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
  footer: {
    height: 32,
  },
});

export default AnalyticsDashboardScreen;


