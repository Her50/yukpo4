// @ts-nocheck
// Remplacement des Ionicons par des emojis pour éviter les crashes
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// react-native-paper retiré pour éviter le crash useNavigation
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { theme } from '../theme/theme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ServiceStats {
  id: string;
  title: string;
  views: number;
  interactions: number;
  messages: number;
  calls: number;
  videoCalls: number;
  rating: number;
  revenue: number;
  lastActivity: Date;
  status: 'active' | 'inactive' | 'pending';
  category: string;
  location: string;
}

interface DashboardData {
  totalServices: number;
  activeServices: number;
  totalViews: number;
  totalInteractions: number;
  budgetConsumed: number;
  budgetRemaining: number;
  averageRating: number;
  recentActivity: any[];
  topPerformingServices: ServiceStats[];
  monthlyStats: {
    views: number[];
    interactions: number[];
    budgetConsumed: number[];
  };
}

const DashboardPrestataireScreen: React.FC = () => {
  const navigation = useNavigation();
    const { t } = useLanguageSafe();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedService, setSelectedService] = useState<string>('all');

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id, selectedPeriod]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      console.log('[DashboardPrestataireScreen] Chargement des donn�es pour la p�riode:', selectedPeriod);

      // Essayer d'abord l'endpoint sp�cialis�
      const response = await userApi.getDashboardPrestataire(selectedPeriod);

      if (response.success && response.data) {
        console.log('[DashboardPrestataireScreen] Donn�es re�ues:', response.data);
        setDashboardData(response.data as DashboardData);
      } else {
        // Charger les donn�es r�elles depuis l'API des services et du budget
        console.log('[DashboardPrestataireScreen] Chargement des donn�es alternatives...');

        const [servicesResponse, budgetResponse] = await Promise.all([
          userApi.getUserProfile(), // Utiliser getUserProfile � la place
          userApi.getUserBudget()
        ]);

        const services = (servicesResponse.data as any)?.services || [];
        const budgetData = (budgetResponse.data as any) || { consumed: 0, remaining: 0 };

        // Calculer les statistiques r�elles (logique identique au frontend)
        const activeServices = services.filter((s: any) => s.is_active).length;
        const totalViews = services.reduce((sum: number, s: any) => sum + (s.views || 0), 0);
        const totalInteractions = services.reduce((sum: number, s: any) => sum + (s.interactions || 0), 0);
        const averageRating = services.length > 0
          ? services.reduce((sum: number, s: any) => sum + (s.rating || 0), 0) / services.length
          : 0;

        // Utiliser les donn�es r�elles des services
        const topPerformingServices: ServiceStats[] = services.slice(0, 5).map((service: any) => ({
          id: service.id,
          title: service.nom || service.title || 'Service',
          views: service.views || 0,
          interactions: service.interactions || 0,
          messages: service.messages || 0,
          calls: service.calls || 0,
          videoCalls: service.video_calls || 0,
          rating: service.rating || 0,
          revenue: service.revenue || 0,
          lastActivity: new Date(service.last_activity || service.created_at),
          status: service.is_active ? 'active' : 'inactive',
          category: service.categorie || 'G�n�ral',
          location: service.location || 'Non sp�cifi�'
        }));

        const realDashboardData: DashboardData = {
          totalServices: services.length,
          activeServices,
          totalViews,
          totalInteractions,
          budgetConsumed: budgetData.consumed || 0,
          budgetRemaining: budgetData.remaining || 0,
          averageRating,
          recentActivity: [], // Charger depuis l'API si disponible
          topPerformingServices,
          monthlyStats: {
            views: [], // Charger depuis l'API si disponible
            interactions: [], // Charger depuis l'API si disponible
            budgetConsumed: [] // Charger depuis l'API si disponible
          }
        };

        setDashboardData(realDashboardData);
      }
    } catch (error) {
      console.error('[DashboardPrestataireScreen] Erreur chargement donn�es:', error);
      Alert.alert('Erreur', 'Impossible de charger les donn�es du dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme.colors.success;
      case 'inactive': return theme.colors.textSecondary;
      case 'pending': return theme.colors.warning;
      default: return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'inactive': return 'Inactif';
      case 'pending': return 'En attente';
      default: return 'Inconnu';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('dashboardPrestataire.chargementDuDashboard')}</Text>
      </View>
    );
  }

  if (!dashboardData) {
    return (
      <View style={styles.errorContainer}>
        <SafeIcon name="inbox" size={48} color="#D1D5DB" />
        <Text style={styles.errorText}>{t('dashboardPrestataire.aucuneDonneDisponible')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadDashboardData}>
          <Text style={styles.retryButtonText}>R�essayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* En-t�te avec s�lecteur de p�riode */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('dashboardPrestataire.dashboardPrestataire')}/Text>
        <Text style={styles.subtitle}>{t('dashboardPrestataire.statistiquesEtPerformancesDeVos')}/Text>

        <View style={styles.periodSelector}>
          {(['7d', '30d', '90d'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive
              ]}>
                {period === '7d' ? '7 jours' : period === '30d' ? '30 jours' : '90 jours'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Statistiques principales */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <SafeIcon name="briefcase" size={20} color="#6366F1" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statNumber}>{dashboardData.totalServices}</Text>
            <Text style={styles.statLabel}>{t('dashboardPrestataire.servicesTotaux')}/Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <SafeIcon name="check-circle" size={20} color="#10B981" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statNumber}>{dashboardData.activeServices}</Text>
            <Text style={styles.statLabel}>{t('dashboardPrestataire.servicesActifs')}/Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <SafeIcon name="eye" size={20} color="#F59E0B" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statNumber}>{formatNumber(dashboardData.totalViews)}</Text>
            <Text style={styles.statLabel}>Vues totales</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <SafeIcon name="message-square" size={20} color="#EF4444" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statNumber}>{formatNumber(dashboardData.totalInteractions)}</Text>
            <Text style={styles.statLabel}>Interactions</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <SafeIcon name="star" size={20} color="#FCD34D" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statNumber}>{dashboardData.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{t('dashboardPrestataire.noteMoyenne')}/Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <SafeIcon name="wallet" size={20} color="#8B5CF6" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statNumber}>{formatCurrency(dashboardData.budgetConsumed)}</Text>
            <Text style={styles.statLabel}>{t('dashboardPrestataire.budgetUtilise')}</Text>
          </View>
        </View>
      </View>

      {/* Actions rapides */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('CreatePublicite')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionButtonIcon, { backgroundColor: '#D1FAE5' }]}>
              <SafeIcon name="plus-circle" size={28} color="#10B981" />
            </View>
            <Text style={styles.actionButtonTitle}>Nouvelle</Text>
            <Text style={styles.actionButtonSubtitle}>{t('dashboardPrestataire.publicite')}</Text>
            <View style={styles.actionButtonArrow}>
              <SafeIcon name="chevron-right" size={16} color="#10B981" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => (navigation as any).navigate('VideoAnalytics')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionButtonIcon, { backgroundColor: '#DBEAFE' }]}>
              <SafeIcon name="bar-chart-2" size={28} color="#6366F1" />
            </View>
            <Text style={styles.actionButtonTitle}>Analytics</Text>
            <Text style={styles.actionButtonSubtitle}>{t('dashboardPrestataire.videos')}</Text>
            <View style={styles.actionButtonArrow}>
              <SafeIcon name="chevron-right" size={16} color="#6366F1" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Services les mieux performants */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('dashboardPrestataire.servicesLesMieuxPerformants')}/Text>

        {dashboardData.topPerformingServices.map((service, index) => (
          <View key={service.id} style={styles.serviceItem}>
            <View style={styles.serviceHeader}>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <View style={[styles.statusChip, { backgroundColor: getStatusColor(service.status) + '20' }]}>
                <Text style={{ color: getStatusColor(service.status), fontSize: 11, fontWeight: '600' }}>
                  {getStatusText(service.status)}
                </Text>
              </View>
            </View>

            <View style={styles.serviceStats}>
              <View style={styles.serviceStat}>
                <Text style={styles.serviceStatText}>{formatNumber(service.views)} vues</Text>
              </View>
              <View style={styles.serviceStat}>
                <Text style={styles.serviceStatText}>{service.messages} msg</Text>
              </View>
              <View style={styles.serviceStat}>
                <Text style={styles.serviceStatText}>{service.calls} appels</Text>
              </View>
              <View style={styles.serviceStat}>
                <Text style={styles.serviceStatText}>{service.rating} / 5</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Activité récente */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('dashboardPrestataire.activiteRecente')}</Text>

        {dashboardData.recentActivity.map((activity, index) => (
          <View key={index} style={styles.activityItem}>
            <View style={styles.activityIcon}>
              {activity.type === 'view' ? (
                <SafeIcon name="eye" size={16} color="#FFFFFF" />
              ) : activity.type === 'message' ? (
                <SafeIcon name="message-circle" size={16} color="#FFFFFF" />
              ) : activity.type === 'call' ? (
                <SafeIcon name="phone" size={16} color="#FFFFFF" />
              ) : (
                <SafeIcon name="activity" size={16} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>
                {activity.type === 'view' ? 'Vue' :
                  activity.type === 'message' ? 'Message' :
                    activity.type === 'call' ? 'Appel' : t('dashboardPrestataireScreen.activite')} sur {activity.service}
              </Text>
              <Text style={styles.activityTime}>Il y a {activity.time}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Actions rapides */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>

        <TouchableOpacity style={styles.actionButton} onPress={loadDashboardData}>
          <Text style={styles.actionButtonText}>{t('dashboardPrestataire.actualiserLesDonnees')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>{t('dashboardPrestataire.creerUnNouveauService')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => (navigation as any).navigate('AnalyticsDashboard')}>
          <Text style={styles.actionButtonText}>{t('dashboardPrestataire.voirLesStatistiquesDetaillees')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => (navigation as any).navigate('WalletFinancial')}>
          <Text style={styles.actionButtonText}>{t('dashboardPrestataire.monPortefeuilleFinancier')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.liveButton]}
          onPress={() => navigation.navigate('StartLive' as any)}
        >
          <Text style={styles.actionButtonText}>{t('dashboardPrestataire.demarrerUnLive')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  statIconText: {
    fontSize: 24,
  },
  serviceStatIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  activityIconText: {
    fontSize: 20,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    marginTop: 15,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  periodButtonText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 10,
  },
  statCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statContent: {
    alignItems: 'center',
    padding: 15,
  },
  statIcon: {
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  sectionCard: {
    margin: 20,
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: theme.colors.text,
  },
  serviceItem: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
  },
  statusChip: {
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  serviceStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceStatText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  actionsSection: {
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  actionButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  actionButtonSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  actionButtonArrow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveButton: {
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
});

export default DashboardPrestataireScreen;








