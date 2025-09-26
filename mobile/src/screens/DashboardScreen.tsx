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

      // Charger les données du dashboard
      const [servicesResponse, budgetResponse] = await Promise.all([
        servicesApi.getUserServices(),
        userApi.getUserBudget()
      ]);

      if (servicesResponse.success && servicesResponse.data) {
        const services = servicesResponse.data as any[];
        const activeServices = services.filter(s => s.is_active).length;
        const totalViews = services.reduce((sum, s) => sum + (s.views || 0), 0);
        const totalInteractions = services.reduce((sum, s) => sum + (s.interactions || 0), 0);
        const averageRating = services.length > 0
          ? (services.reduce((sum, s) => sum + (s.rating || 0), 0) / services.length).toFixed(1)
          : '0';

        setStats([
          { title: 'Services Actifs', value: activeServices.toString(), icon: 'briefcase', color: '#4CAF50' },
          { title: 'Interactions', value: totalInteractions.toString(), icon: 'people', color: '#2196F3' },
          { title: 'Vues Total', value: totalViews.toString(), icon: 'eye', color: '#FF9800' },
          { title: 'Évaluations', value: `${averageRating}/5`, icon: 'star', color: '#9C27B0' },
        ]);

        // Générer l'activité récente basée sur les services
        const activity = services.slice(0, 3).map((service, index) => ({
          id: service.id,
          title: `Service "${service.nom || service.title}" ${index === 0 ? 'créé' : index === 1 ? 'mis à jour' : 'visualisé'}`,
          time: index === 0 ? 'Il y a 2 heures' : index === 1 ? 'Il y a 4 heures' : 'Il y a 6 heures',
          icon: index === 0 ? 'checkmark-circle' : index === 1 ? 'star' : 'eye',
          color: index === 0 ? '#4CAF50' : index === 1 ? '#FF9800' : '#2196F3'
        }));
        setRecentActivity(activity);
      }

      if (budgetResponse.success && budgetResponse.data) {
        const budgetData = budgetResponse.data as any;
        // Mettre à jour les stats avec les données de budget si disponibles
        setStats(prevStats => prevStats.map(stat => {
          if (stat.title === 'Revenus du Mois') {
            return {
              ...stat,
              value: budgetData.revenue ? `${budgetData.revenue}€` : '0€'
            };
          }
          return stat;
        }));
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du dashboard');
    } finally {
      setLoading(false);
    }
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



