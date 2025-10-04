import { Ionicons } from '@expo/vector-icons';
import * as React from "react";
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Card } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi, userApi } from '../services/api';
import { theme } from '../theme/theme';

const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState([
    { title: 'Services Actifs', value: '0', icon: 'briefcase', color: '#4CAF50', subtitle: 'sur 0 total' },
    { title: 'Interactions', value: '0', icon: 'people', color: '#2196F3', subtitle: 'Messages + Appels' },
    { title: 'Vues Total', value: '0', icon: 'eye', color: '#FF9800', subtitle: '+12% ce mois' },
    { title: 'Budget Consommé', value: '0 FCFA', icon: 'flash', color: '#FF6B35', subtitle: 'Restant: 0 FCFA' },
  ]);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [topServices, setTopServices] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Appeler l'API dashboard prestataire (comme frontend)
      const response = await userApi.getDashboardPrestataire('30d');

      if (response.success && response.data) {
        const data = response.data as any;

        setStats([
          { title: 'Services Actifs', value: (data.activeServices || 0).toString(), icon: 'briefcase', color: '#10B981', subtitle: `sur ${data.totalServices || 0} total` },
          { title: 'Vues Total', value: (data.totalViews || 0).toLocaleString('fr-FR'), icon: 'eye', color: '#3B82F6', subtitle: '+12% ce mois' },
          { title: 'Interactions', value: (data.totalInteractions || 0).toLocaleString('fr-FR'), icon: 'people', color: '#F59E0B', subtitle: 'Messages + Appels' },
          { title: 'Budget Consommé', value: `${((data.budgetConsumed || 0) / 10).toLocaleString('fr-FR')} FCFA`, icon: 'flash', color: '#FF6B35', subtitle: `Restant: ${((data.budgetRemaining || 0) / 10).toLocaleString('fr-FR')} FCFA` },
        ]);

        // Activité récente
        if (data.recentActivity && data.recentActivity.length > 0) {
          setRecentActivity(data.recentActivity.slice(0, 5).map((activity: any) => ({
            id: activity.id,
            title: activity.title || 'Activité',
            time: formatTime(new Date(activity.timestamp || activity.created_at)),
            icon: activity.type === 'view' ? 'eye' : activity.type === 'message' ? 'chatbubbles' : 'checkmark-circle',
            color: activity.type === 'view' ? '#3B82F6' : activity.type === 'message' ? '#10B981' : '#F59E0B'
          })));
        }

        // Services les plus performants
        if (data.topPerformingServices && data.topPerformingServices.length > 0) {
          setTopServices(data.topPerformingServices.slice(0, 5));
        }
      } else {
        // Fallback: charger depuis l'API des services
        const servicesResponse = await servicesApi.getUserServices();

        if (servicesResponse.success && servicesResponse.data) {
          const services = servicesResponse.data as any[];
          const activeServices = services.filter(s => s.is_active).length;
          const totalViews = services.reduce((sum, s) => sum + (s.views || 0), 0);
          const totalInteractions = services.reduce((sum, s) => sum + (s.interactions || 0), 0);
          const averageRating = services.length > 0
            ? (services.reduce((sum, s) => sum + (s.rating || 0), 0) / services.length).toFixed(1)
            : '0';

          setStats([
            { title: 'Services Actifs', value: activeServices.toString(), icon: 'briefcase', color: '#10B981', subtitle: `sur ${services.length} total` },
            { title: 'Vues Total', value: totalViews.toLocaleString('fr-FR'), icon: 'eye', color: '#3B82F6', subtitle: '+12% ce mois' },
            { title: 'Interactions', value: totalInteractions.toLocaleString('fr-FR'), icon: 'people', color: '#F59E0B', subtitle: 'Messages + Appels' },
            { title: 'Budget Consommé', value: `${((budgetData.consumed || 0) / 10).toLocaleString('fr-FR')} FCFA`, icon: 'flash', color: '#FF6B35', subtitle: `Restant: ${((budgetData.remaining || 0) / 10).toLocaleString('fr-FR')} FCFA` },
          ]);

          // Services les plus performants
          const sortedServices = services
            .sort((a: any, b: any) => (b.interactions || 0) - (a.interactions || 0))
            .slice(0, 5)
            .map((s: any) => ({
              id: s.id,
              title: s.data?.title || 'Service sans titre',
              views: s.views || 0,
              interactions: s.interactions || 0,
              category: s.data?.category || 'Non spécifié'
            }));
          setTopServices(sortedServices);
        }
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du dashboard. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement du dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Vue d'ensemble de votre activité</Text>
      </View>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <Card key={index} style={[styles.statCard, { borderLeftColor: stat.color }]}>
            <Card.Content style={styles.statContent}>
              <View style={styles.statIconContainer}>
                <Ionicons name={stat.icon as any} size={24} color={stat.color} />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statTitle}>{stat.title}</Text>
                {stat.subtitle && <Text style={styles.statSubtitle}>{stat.subtitle}</Text>}
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>

      {/* Services les Plus Performants */}
      <View style={styles.topServicesContainer}>
        <Text style={styles.sectionTitle}>Services les Plus Performants</Text>
        <Card style={styles.topServicesCard}>
          <Card.Content>
            {topServices.length === 0 ? (
              <View style={styles.emptyServices}>
                <Ionicons name="briefcase" size={48} color="#9CA3AF" />
                <Text style={styles.emptyServicesText}>Aucun service pour le moment</Text>
              </View>
            ) : (
              topServices.map((service, index) => (
                <View key={service.id} style={styles.topServiceItem}>
                  <View style={styles.topServiceRank}>
                    <Text style={styles.topServiceRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.topServiceInfo}>
                    <Text style={styles.topServiceTitle}>{service.title}</Text>
                    <Text style={styles.topServiceCategory}>{service.category}</Text>
                  </View>
                  <View style={styles.topServiceStats}>
                    <Text style={styles.topServiceViews}>{service.views.toLocaleString('fr-FR')} vues</Text>
                    <Text style={styles.topServiceInteractions}>{service.interactions} interactions</Text>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </View>

      {/* Activité Récente */}
      <View style={styles.recentActivity}>
        <Text style={styles.sectionTitle}>Activité Récente</Text>
        <Card style={styles.activityCard}>
          <Card.Content>
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <View key={activity.id || index} style={styles.activityItem}>
                  <Ionicons name={activity.icon as any} size={20} color={activity.color} />
                  <View style={styles.activityText}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.activityItem}>
                <Ionicons name="information-circle" size={20} color="#757575" />
                <View style={styles.activityText}>
                  <Text style={styles.activityTitle}>Aucune activité récente</Text>
                  <Text style={styles.activityTime}>Créez votre premier service</Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
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
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statsContainer: {
    padding: 20,
    gap: 15,
  },
  statCard: {
    borderLeftWidth: 4,
    elevation: 2,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statIconContainer: {
    marginRight: 15,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statTitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 15,
  },
  topServicesContainer: {
    padding: 20,
    paddingTop: 0,
  },
  topServicesCard: {
    elevation: 2,
  },
  emptyServices: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyServicesText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  topServiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topServiceRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topServiceRankText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  topServiceInfo: {
    flex: 1,
    marginRight: 12,
  },
  topServiceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  topServiceCategory: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  topServiceStats: {
    alignItems: 'flex-end',
  },
  topServiceViews: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  topServiceInteractions: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  recentActivity: {
    padding: 20,
    paddingTop: 0,
  },
  activityCard: {
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  activityText: {
    marginLeft: 15,
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  activityTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});

export default DashboardScreen;



