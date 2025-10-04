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
    { title: 'Services Actifs', value: '0', icon: 'briefcase', color: '#4CAF50' },
    { title: 'Interactions', value: '0', icon: 'people', color: '#2196F3' },
    { title: 'Vues Total', value: '0', icon: 'eye', color: '#FF9800' },
    { title: 'Évaluations', value: '0/5', icon: 'star', color: '#9C27B0' },
  ]);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

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
          { title: 'Services Actifs', value: (data.activeServices || 0).toString(), icon: 'briefcase', color: '#10B981' },
          { title: 'Vues Total', value: (data.totalViews || 0).toString(), icon: 'eye', color: '#3B82F6' },
          { title: 'Interactions', value: (data.totalInteractions || 0).toString(), icon: 'people', color: '#F59E0B' },
          { title: 'Évaluations', value: `${(data.averageRating || 0).toFixed(1)}/5`, icon: 'star', color: '#8B5CF6' },
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
            { title: 'Services Actifs', value: activeServices.toString(), icon: 'briefcase', color: '#10B981' },
            { title: 'Vues Total', value: totalViews.toString(), icon: 'eye', color: '#3B82F6' },
            { title: 'Interactions', value: totalInteractions.toString(), icon: 'people', color: '#F59E0B' },
            { title: 'Évaluations', value: `${averageRating}/5`, icon: 'star', color: '#8B5CF6' },
          ]);
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

  const quickActions = [
    { title: 'Créer un Service', icon: 'add-circle', color: theme.colors.primary },
    { title: 'Voir Mes Services', icon: 'list', color: '#4CAF50' },
    { title: 'Messages', icon: 'chatbubbles', color: '#2196F3' },
    { title: 'Paramètres', icon: 'settings', color: '#757575' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement du dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
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
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>

      {/* Actions Rapides */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Actions Rapides</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity key={index} style={styles.actionCard}>
              <View style={[styles.actionIconContainer, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
  actionsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  actionCard: {
    width: '47%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
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



