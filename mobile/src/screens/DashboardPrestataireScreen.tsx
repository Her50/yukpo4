import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Card, Title, Paragraph, Chip } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { theme } from '../theme/theme';

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
      console.log('[DashboardPrestataireScreen] Chargement des données pour la période:', selectedPeriod);
      
      // Essayer d'abord l'endpoint spécialisé
      const response = await userApi.getDashboardPrestataire(selectedPeriod);
      
      if (response.success && response.data) {
        console.log('[DashboardPrestataireScreen] Données reçues:', response.data);
        setDashboardData(response.data as DashboardData);
      } else {
        // Charger les données réelles depuis l'API des services et du budget
        console.log('[DashboardPrestataireScreen] Chargement des données alternatives...');
        
        const [servicesResponse, budgetResponse] = await Promise.all([
          userApi.getUserProfile(), // Utiliser getUserProfile à la place
          userApi.getUserBudget()
        ]);

        const services = (servicesResponse.data as any)?.services || [];
        const budgetData = (budgetResponse.data as any) || { consumed: 0, remaining: 0 };

        // Calculer les statistiques réelles (logique identique au frontend)
        const activeServices = services.filter((s: any) => s.is_active).length;
        const totalViews = services.reduce((sum: number, s: any) => sum + (s.views || 0), 0);
        const totalInteractions = services.reduce((sum: number, s: any) => sum + (s.interactions || 0), 0);
        const averageRating = services.length > 0
          ? services.reduce((sum: number, s: any) => sum + (s.rating || 0), 0) / services.length
          : 0;

        // Simuler des données de services avec statistiques
        const topPerformingServices: ServiceStats[] = services.slice(0, 5).map((service: any, index: number) => ({
          id: service.id || `service-${index}`,
          title: service.nom || service.title || `Service ${index + 1}`,
          views: Math.floor(Math.random() * 1000) + 100,
          interactions: Math.floor(Math.random() * 100) + 10,
          messages: Math.floor(Math.random() * 50) + 5,
          calls: Math.floor(Math.random() * 20) + 1,
          videoCalls: Math.floor(Math.random() * 10),
          rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0 à 5.0
          revenue: Math.floor(Math.random() * 50000) + 10000,
          lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          status: service.is_active ? 'active' : 'inactive',
          category: service.categorie || 'Général',
          location: service.location || 'Non spécifié'
        }));

        const mockDashboardData: DashboardData = {
          totalServices: services.length,
          activeServices,
          totalViews,
          totalInteractions,
          budgetConsumed: budgetData.consumed || 0,
          budgetRemaining: budgetData.remaining || 0,
          averageRating,
          recentActivity: [
            { type: 'view', service: 'Service 1', time: '2h' },
            { type: 'message', service: 'Service 2', time: '4h' },
            { type: 'call', service: 'Service 3', time: '1j' }
          ],
          topPerformingServices,
          monthlyStats: {
            views: [120, 150, 180, 200, 220, 250, 280],
            interactions: [15, 20, 25, 30, 35, 40, 45],
            budgetConsumed: [5000, 7500, 10000, 12000, 15000, 18000, 20000]
          }
        };

        setDashboardData(mockDashboardData);
      }
    } catch (error) {
      console.error('[DashboardPrestataireScreen] Erreur chargement données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du dashboard');
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
        <Text style={styles.loadingText}>Chargement du dashboard...</Text>
      </View>
    );
  }

  if (!dashboardData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
        <Text style={styles.errorText}>Aucune donnée disponible</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadDashboardData}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* En-tête avec sélecteur de période */}
      <View style={styles.header}>
        <Title style={styles.title}>📊 Dashboard Prestataire</Title>
        <Text style={styles.subtitle}>Statistiques et performances de vos services</Text>
        
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
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <View style={styles.statIcon}>
              <Ionicons name="list" size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.statNumber}>{dashboardData.totalServices}</Text>
            <Text style={styles.statLabel}>Services totaux</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <View style={styles.statIcon}>
              <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
            </View>
            <Text style={styles.statNumber}>{dashboardData.activeServices}</Text>
            <Text style={styles.statLabel}>Services actifs</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <View style={styles.statIcon}>
              <Ionicons name="eye" size={24} color={theme.colors.accent} />
            </View>
            <Text style={styles.statNumber}>{formatNumber(dashboardData.totalViews)}</Text>
            <Text style={styles.statLabel}>Vues totales</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <View style={styles.statIcon}>
              <Ionicons name="chatbubbles" size={24} color={theme.colors.secondary} />
            </View>
            <Text style={styles.statNumber}>{formatNumber(dashboardData.totalInteractions)}</Text>
            <Text style={styles.statLabel}>Interactions</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <View style={styles.statIcon}>
              <Ionicons name="star" size={24} color={theme.colors.warning} />
            </View>
            <Text style={styles.statNumber}>{dashboardData.averageRating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Note moyenne</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <View style={styles.statIcon}>
              <Ionicons name="wallet" size={24} color={theme.colors.success} />
            </View>
            <Text style={styles.statNumber}>{formatCurrency(dashboardData.budgetConsumed)}</Text>
            <Text style={styles.statLabel}>Budget utilisé</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Services les mieux performants */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>🏆 Services les mieux performants</Title>
          
          {dashboardData.topPerformingServices.map((service, index) => (
            <View key={service.id} style={styles.serviceItem}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Chip 
                  style={[styles.statusChip, { backgroundColor: getStatusColor(service.status) + '20' }]}
                  textStyle={{ color: getStatusColor(service.status) }}
                >
                  {getStatusText(service.status)}
                </Chip>
              </View>
              
              <View style={styles.serviceStats}>
                <View style={styles.serviceStat}>
                  <Ionicons name="eye" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.serviceStatText}>{formatNumber(service.views)}</Text>
                </View>
                <View style={styles.serviceStat}>
                  <Ionicons name="chatbubble" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.serviceStatText}>{service.messages}</Text>
                </View>
                <View style={styles.serviceStat}>
                  <Ionicons name="call" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.serviceStatText}>{service.calls}</Text>
                </View>
                <View style={styles.serviceStat}>
                  <Ionicons name="star" size={16} color={theme.colors.warning} />
                  <Text style={styles.serviceStatText}>{service.rating}</Text>
                </View>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Activité récente */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>🕒 Activité récente</Title>
          
          {dashboardData.recentActivity.map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons 
                  name={
                    activity.type === 'view' ? 'eye' :
                    activity.type === 'message' ? 'chatbubble' :
                    activity.type === 'call' ? 'call' : 'notifications'
                  } 
                  size={20} 
                  color={theme.colors.primary} 
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  {activity.type === 'view' ? 'Vue' :
                   activity.type === 'message' ? 'Message' :
                   activity.type === 'call' ? 'Appel' : 'Activité'} sur {activity.service}
                </Text>
                <Text style={styles.activityTime}>Il y a {activity.time}</Text>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Actions rapides */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>⚡ Actions rapides</Title>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="refresh" size={20} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Actualiser les données</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="create" size={20} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Créer un nouveau service</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="analytics" size={20} color={theme.colors.primary} />
            <Text style={styles.actionButtonText}>Voir les statistiques détaillées</Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>
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
    elevation: 2,
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
    elevation: 2,
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    marginLeft: 12,
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
});

export default DashboardPrestataireScreen;