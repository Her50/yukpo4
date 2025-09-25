import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

const DashboardScreen: React.FC = () => {
  const stats = [
    { title: 'Services Actifs', value: '12', icon: 'briefcase', color: '#4CAF50' },
    { title: 'Clients Satisfaits', value: '89', icon: 'people', color: '#2196F3' },
    { title: 'Revenus du Mois', value: '2,450€', icon: 'cash', color: '#FF9800' },
    { title: 'Évaluations', value: '4.8/5', icon: 'star', color: '#9C27B0' },
  ];

  const quickActions = [
    { title: 'Créer un Service', icon: 'add-circle', color: theme.colors.primary },
    { title: 'Voir Mes Services', icon: 'list', color: '#4CAF50' },
    { title: 'Messages', icon: 'chatbubbles', color: '#2196F3' },
    { title: 'Paramètres', icon: 'settings', color: '#757575' },
  ];

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
            <View style={styles.activityItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <View style={styles.activityText}>
                <Text style={styles.activityTitle}>Service "Plomberie" créé</Text>
                <Text style={styles.activityTime}>Il y a 2 heures</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="star" size={20} color="#FF9800" />
              <View style={styles.activityText}>
                <Text style={styles.activityTitle}>Nouvelle évaluation 5⭐</Text>
                <Text style={styles.activityTime}>Il y a 4 heures</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="chatbubble" size={20} color="#2196F3" />
              <View style={styles.activityText}>
                <Text style={styles.activityTitle}>Nouveau message reçu</Text>
                <Text style={styles.activityTime}>Il y a 6 heures</Text>
              </View>
            </View>
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