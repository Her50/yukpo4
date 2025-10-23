// @ts-nocheck
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeBadge, NativeButton, NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi, userApi } from '../services/api';
import { modernColors, modernStyles } from '../theme/modernTheme';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

interface DashboardData {
  totalServices: number;
  activeServices: number;
  totalViews: number;
  totalInteractions: number;
  budgetConsumed: number;
  budgetRemaining: number;
  averageRating: number;
  recentActivity: any[];
  topPerformingServices: any[];
  monthlyStats: {
    views: number[];
    interactions: number[];
    budgetConsumed: number[];
  };
}

const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '180d' | '365d'>('30d');

  const getPeriodLabel = (period: string) => {
    const labels = {
      '7d': '7 derniers jours',
      '30d': '30 derniers jours',
      '90d': '90 derniers jours',
      '180d': '6 derniers mois',
      '365d': '1 derni�re ann�e'
    };
    return labels[period as keyof typeof labels] || period;
  };

  const getPeriodDescription = (period: string) => {
    const descriptions = {
      '7d': 'Tendance r�cente',
      '30d': 'Performance mensuelle',
      '90d': 'Analyse trimestrielle',
      '180d': '�volution semestrielle',
      '365d': 'Bilan annuel'
    };
    return descriptions[period as keyof typeof descriptions] || 'Analyse';
  };

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id, selectedPeriod]);

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      console.log('[DashboardScreen] D�but du chargement des donn�es...');

      // Appeler l'API dashboard prestataire (comme frontend)
      const response = await userApi.getDashboardPrestataire(selectedPeriod);
      console.log('[DashboardScreen] R�ponse API dashboard:', response);

      if (response.success && response.data) {
        const data = response.data as any;
        setDashboardData(data);
      } else {
        // Fallback: charger depuis l'API des services
        console.log('[DashboardScreen] Utilisation du fallback - chargement depuis services...');
        const servicesResponse = await servicesApi.getUserServices();

        if (servicesResponse.success && servicesResponse.data) {
          const services = servicesResponse.data as any[];
          const activeServices = services.filter(s => s.is_active).length;
          const totalViews = services.reduce((sum, s) => sum + (s.views || 0), 0);
          const totalInteractions = services.reduce((sum, s) => sum + (s.interactions || 0), 0);
          const averageRating = services.length > 0
            ? services.reduce((sum, s) => sum + (s.rating || 0), 0) / services.length
            : 0;

          // R�cup�rer le budget depuis l'API utilisateur
          const budgetResponse = await userApi.getTokensBalance();
          const budgetData = budgetResponse.success ? (budgetResponse.data as any) : { consumed: 0, remaining: 0 };

          // Services les plus performants
          const topPerformingServices = services
            .sort((a: any, b: any) => (b.interactions || 0) - (a.interactions || 0))
            .slice(0, 5)
            .map((s: any) => {
              try {
                return {
                  id: s.id || 'unknown',
                  title: getServiceFieldValue(s.data?.title || s.data?.titre_service) || 'Service sans titre',
                  category: getServiceFieldValue(s.data?.category) || 'Non sp�cifi�',
                  views: Number(s.views) || 0,
                  interactions: Number(s.interactions) || 0,
                  rating: Number(s.rating) || 0,
                  status: s.is_active ? 'active' : 'inactive'
                };
              } catch (error) {
                console.warn('[DashboardScreen] Erreur mapping service:', s, error);
                return {
                  id: s.id || 'unknown',
                  title: 'Service sans titre',
                  category: 'Non sp�cifi�',
                  views: 0,
                  interactions: 0,
                  rating: 0,
                  status: 'inactive'
                };
              }
            });

          const fallbackData: DashboardData = {
            totalServices: services.length,
            activeServices,
            totalViews,
            totalInteractions,
            budgetConsumed: budgetData.consumed || 0,
            budgetRemaining: budgetData.remaining || 0,
            averageRating: Math.round(averageRating * 10) / 10,
            recentActivity: [],
            topPerformingServices,
            monthlyStats: {
              views: [totalViews * 0.8, totalViews * 0.9, totalViews],
              interactions: [totalInteractions * 0.7, totalInteractions * 0.85, totalInteractions],
              budgetConsumed: [budgetData.consumed * 0.6, budgetData.consumed * 0.8, budgetData.consumed]
            }
          };
          setDashboardData(fallbackData);
        }
      }
    } catch (error) {
      console.error('[DashboardScreen] Erreur chargement dashboard:', error);
      Alert.alert('Erreur', 'Impossible de charger les donn�es du dashboard. V�rifiez votre connexion.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('[DashboardScreen] Chargement termin�');
    }
  };

  const onRefresh = () => {
    loadDashboardData(true);
  };

  // Fonction pour extraire la valeur d'un champ de service
  const getServiceFieldValue = (field: any): string => {
    if (!field) return 'Non sp�cifi�';

    if (typeof field === 'string') return field;

    if (field && typeof field === 'object') {
      if (field.valeur !== undefined) {
        const value = field.valeur;
        if (typeof value === 'string') return value;
        if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
        if (typeof value === 'number') return value.toString();
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
      }

      if (Object.keys(field).length > 0) {
        const possibleValues = ['value', 'content', 'text', 'data', 'info'];
        for (const key of possibleValues) {
          if (field[key] !== undefined) {
            const value = field[key];
            if (typeof value === 'string') return value;
            if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
            if (typeof value === 'number') return value.toString();
          }
        }
      }
    }

    if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
    if (typeof field === 'number') return field.toString();

    // S'assurer que la valeur retourn�e est toujours une string
    try {
      return String(field);
    } catch (error) {
      console.warn('[DashboardScreen] Erreur conversion field:', field, error);
      return 'Non sp�cifi�';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  // Composant StatCard moderne
  const StatCard = ({ title, value, subtitle, icon, color, trend }: any) => (
    <NativeCard style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
          <SafeIcon name={icon} size={24} color={color} />
        </View>
        <View style={styles.statInfo}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
      {trend && (
        <View style={styles.trendContainer}>
          <NativeBadge
            text={`${trend.isPositive ? '?' : '?'} ${trend.value}%`}
            variant={trend.isPositive ? 'success' : 'error'}
            size="small"
          />
        </View>
      )}
    </NativeCard>
  );

  // Composant SimpleChart moderne
  const SimpleChart = ({ data, title, type, height }: any) => (
    <NativeCard style={[styles.chartCard, { height }]}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        <SafeIcon name="bar-chart" size={20} color={modernColors.primary} />
      </View>
      <View style={styles.chartContainer}>
        {type === 'line' ? (
          <View style={styles.lineChart}>
            {data.map((item: any, index: number) => (
              <View key={index} style={styles.lineBar}>
                <View
                  style={[
                    styles.lineBarFill,
                    {
                      height: `${(item.value / Math.max(...data.map((d: any) => d.value))) * 100}%`,
                      backgroundColor: item.color
                    }
                  ]}
                />
                <Text style={styles.lineBarLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.barChart}>
            {data.map((item: any, index: number) => (
              <View key={index} style={styles.barItem}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${(item.value / Math.max(...data.map((d: any) => d.value))) * 100}%`,
                        backgroundColor: item.color
                      }
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{item.label}</Text>
                <Text style={styles.barValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </NativeCard>
  );

  // Composant TopServicesCard moderne
  const TopServicesCard = ({ services, onServicePress, onViewAllPress }: any) => (
    <NativeCard style={styles.topServicesCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <SafeIcon name="star" size={20} color={modernColors.primary} />
          <Text style={styles.cardTitle}>Services les Plus Performants</Text>
        </View>
        <TouchableOpacity onPress={onViewAllPress} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>Voir tout</Text>
          <SafeIcon name="arrow-right" size={16} color={modernColors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.servicesList}>
        {services.length > 0 ? (
          services.slice(0, 3).map((service: any, index: number) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceItem}
              onPress={() => onServicePress(service)}
              activeOpacity={0.8}
            >
              <View style={[styles.serviceRank, { backgroundColor: modernColors.primary }]}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceCategory}>{service.category}</Text>
              </View>
              <View style={styles.serviceStats}>
                <View style={styles.serviceStatItem}>
                  <SafeIcon name="eye" size={14} color={modernColors.textSecondary} />
                  <Text style={styles.serviceViews}>{service.views}</Text>
                </View>
                <View style={styles.serviceStatItem}>
                  <SafeIcon name="message" size={14} color={modernColors.textSecondary} />
                  <Text style={styles.serviceInteractions}>{service.interactions}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyServices}>
            <SafeIcon name="briefcase" size={40} color={modernColors.textSecondary} />
            <Text style={styles.emptyServicesText}>Aucun service pour le moment</Text>
          </View>
        )}
      </View>
    </NativeCard>
  );

  // Composant RecentActivityCard moderne
  const RecentActivityCard = ({ activities, onActivityPress, onViewAllPress }: any) => (
    <NativeCard style={styles.recentActivityCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <SafeIcon name="clock" size={20} color={modernColors.primary} />
          <Text style={styles.cardTitle}>Activit� R�cente</Text>
        </View>
        <TouchableOpacity onPress={onViewAllPress} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>Voir tout</Text>
          <SafeIcon name="arrow-right" size={16} color={modernColors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.activityList}>
        {activities.length > 0 ? (
          activities.slice(0, 3).map((activity: any, index: number) => (
            <TouchableOpacity
              key={index}
              style={styles.activityItem}
              onPress={() => onActivityPress(activity)}
              activeOpacity={0.8}
            >
              <View style={[styles.activityIconContainer, { backgroundColor: modernColors.primary + '20' }]}>
                <SafeIcon name="trending-up" size={16} color={modernColors.primary} />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{activity.title || 'Activit� r�cente'}</Text>
                <Text style={styles.activityTime}>{activity.time || 'Il y a 2h'}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyActivity}>
            <SafeIcon name="clock" size={40} color={modernColors.textSecondary} />
            <Text style={styles.emptyActivityText}>Aucune activit� r�cente</Text>
          </View>
        )}
      </View>
    </NativeCard>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={modernColors.primaryGradient}
        style={styles.loadingContainer}
      >
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Chargement du dashboard...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.emptyContent}>
          <SafeIcon name="bar-chart" size={64} color={modernColors.textSecondary} />
          <Text style={styles.emptyTitle}>Aucune donn�e disponible</Text>
          <Text style={styles.emptyText}>
            Cr�ez votre premier service pour voir les statistiques
          </Text>
          <NativeButton
            title="R�essayer"
            onPress={() => loadDashboardData()}
            variant="primary"
            size="medium"
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  // Donn�es pour les graphiques
  const performanceData = [
    { label: 'Sem 1', value: Number(dashboardData.monthlyStats.views[0]) || 0, color: '#3B82F6' },
    { label: 'Sem 2', value: Number(dashboardData.monthlyStats.views[1]) || 0, color: '#3B82F6' },
    { label: 'Sem 3', value: Number(dashboardData.monthlyStats.views[2]) || 0, color: '#3B82F6' },
  ];

  const interactionsData = [
    { label: 'Messages', value: Math.floor(Number(dashboardData.totalInteractions) * 0.6), color: '#10B981' },
    { label: 'Appels', value: Math.floor(Number(dashboardData.totalInteractions) * 0.3), color: '#8B5CF6' },
    { label: 'Vid�os', value: Math.floor(Number(dashboardData.totalInteractions) * 0.1), color: '#F59E0B' },
  ];

  return (
    <View style={styles.container}>
      {/* Header moderne avec gradient */}
      <LinearGradient
        colors={modernColors.primaryGradient}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.title}>Dashboard Prestataire</Text>
          <Text style={styles.subtitle}>Tableau de bord intelligent avec statistiques en temps r�el</Text>
          <View style={styles.periodIndicator}>
            <Text style={styles.periodIndicatorText}>
              📊 {getPeriodDescription(selectedPeriod)} - {getPeriodLabel(selectedPeriod)}
            </Text>
          </View>
        </View>

        <View style={styles.headerControls}>
          <View style={styles.periodSelector}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.periodScrollContainer}
            >
              {[
                { key: '7d', label: '7 jours', icon: '📅' },
                { key: '30d', label: '30 jours', icon: '📆' },
                { key: '90d', label: '90 jours', icon: '🗓️' },
                { key: '180d', label: '6 mois', icon: '📊' },
                { key: '365d', label: '1 an', icon: '📈' }
              ].map((period) => (
                <TouchableOpacity
                  key={period.key}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period.key && styles.periodButtonActive
                  ]}
                  onPress={() => setSelectedPeriod(period.key as any)}
                >
                  <Text style={styles.periodButtonIcon}>{period.icon}</Text>
                  <Text style={[
                    styles.periodButtonText,
                    selectedPeriod === period.key && styles.periodButtonTextActive
                  ]}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => loadDashboardData()}
            disabled={loading}
          >
            <SafeIcon name="refresh" size={20} color="#fff" />
            <Text style={styles.refreshButtonText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* Cartes de statistiques modernes */}
        <View style={styles.statsContainer}>
          <StatCard
            title="Services Actifs"
            value={Number(dashboardData.activeServices) || 0}
            subtitle={`sur ${Number(dashboardData.totalServices) || 0} total`}
            icon="briefcase"
            color={modernColors.success}
            trend={{ value: 12, isPositive: true }}
          />

          <StatCard
            title="Vues Total"
            value={formatNumber(Number(dashboardData.totalViews) || 0)}
            subtitle="+12% ce mois"
            icon="eye"
            color={modernColors.info}
            trend={{ value: 8, isPositive: true }}
          />

          <StatCard
            title="Interactions"
            value={formatNumber(Number(dashboardData.totalInteractions) || 0)}
            subtitle="Messages + Appels"
            icon="message"
            color={modernColors.warning}
            trend={{ value: 15, isPositive: true }}
          />

          <StatCard
            title="Budget Consomm�"
            value={formatCurrency(Number(dashboardData.budgetConsumed) || 0)}
            subtitle={`Restant: ${formatCurrency(Number(dashboardData.budgetRemaining) || 0)}`}
            icon="zap"
            color={modernColors.error}
            trend={{ value: 5, isPositive: false }}
          />
        </View>

        {/* Graphiques de performance */}
        <View style={styles.chartsContainer}>
          <SimpleChart
            data={performanceData}
            title="�volution des Performances"
            type="line"
            height={200}
          />

          <SimpleChart
            data={interactionsData}
            title="Types d'Interactions"
            type="bar"
            height={200}
          />
        </View>

        {/* Services les plus performants */}
        <TopServicesCard
          services={dashboardData.topPerformingServices}
          onServicePress={(service: any) => {
            Alert.alert('Service', `D�tails du service: ${service.title}`);
          }}
          onViewAllPress={() => {
            Alert.alert('Info', 'Redirection vers la liste compl�te des services');
          }}
        />

        {/* Activit� r�cente */}
        <RecentActivityCard
          activities={dashboardData.recentActivity}
          onActivityPress={(activity: any) => {
            Alert.alert('Activit�', `D�tails: ${activity.title}`);
          }}
          onViewAllPress={() => {
            Alert.alert('Info', 'Redirection vers l\'historique complet');
          }}
        />
      </ScrollView>
    </View>
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
  },
  loadingContent: {
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  emptyContent: {
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: modernColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    marginTop: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 24,
  },
  headerContent: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  periodIndicator: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  periodIndicatorText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  periodSelector: {
    flex: 1,
  },
  periodScrollContainer: {
    paddingHorizontal: 4,
    gap: 8,
  },
  periodButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: modernStyles.borderRadius.medium,
    minWidth: 70,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  periodButtonIcon: {
    fontSize: 14,
  },
  periodButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  periodButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: modernStyles.borderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statCard: {
    borderLeftWidth: 4,
    ...modernStyles.shadowMedium,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: modernColors.text,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 16,
    color: modernColors.text,
    fontWeight: '600',
  },
  statSubtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    marginBottom: 12,
  },
  trendContainer: {
    alignSelf: 'flex-end',
  },
  chartsContainer: {
    padding: 16,
    gap: 16,
  },
  chartCard: {
    ...modernStyles.shadowMedium,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: modernColors.text,
  },
  chartContainer: {
    flex: 1,
  },
  lineChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 100,
  },
  lineBar: {
    alignItems: 'center',
    flex: 1,
  },
  lineBarFill: {
    width: 20,
    borderRadius: 10,
    marginBottom: 8,
  },
  lineBarLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  barChart: {
    gap: 8,
  },
  barItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
  },
  barLabel: {
    fontSize: 12,
    color: theme.colors.text,
    minWidth: 60,
  },
  barValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.text,
    minWidth: 40,
    textAlign: 'right',
  },
  topServicesCard: {
    margin: 16,
    ...modernStyles.shadowMedium,
  },
  recentActivityCard: {
    margin: 16,
    ...modernStyles.shadowMedium,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: modernColors.text,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: modernColors.primary,
    fontWeight: '600',
  },
  servicesList: {
    gap: 16,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: modernColors.surfaceVariant,
    borderRadius: modernStyles.borderRadius.medium,
  },
  serviceRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 4,
  },
  serviceCategory: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  serviceStats: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceViews: {
    fontSize: 12,
    color: modernColors.textSecondary,
    fontWeight: '500',
  },
  serviceInteractions: {
    fontSize: 12,
    color: modernColors.textSecondary,
    fontWeight: '500',
  },
  emptyServices: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyServicesText: {
    fontSize: 16,
    color: modernColors.textSecondary,
    marginTop: 12,
    fontWeight: '500',
  },
  activityList: {
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: modernColors.surfaceVariant,
    borderRadius: modernStyles.borderRadius.medium,
  },
  activityIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyActivityText: {
    fontSize: 16,
    color: modernColors.textSecondary,
    marginTop: 12,
    fontWeight: '500',
  },
});

export default DashboardScreen;
