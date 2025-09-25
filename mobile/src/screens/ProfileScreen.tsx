import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, Avatar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: logout },
      ]
    );
  };

  const profileActions = [
    { title: 'Modifier le Profil', icon: 'person-outline', color: theme.colors.primary },
    { title: 'Paramètres', icon: 'settings-outline', color: '#757575' },
    { title: 'Support', icon: 'help-circle-outline', color: '#2196F3' },
    { title: 'À propos', icon: 'information-circle-outline', color: '#4CAF50' },
  ];

  const stats = [
    { label: 'Services', value: '12' },
    { label: 'Clients', value: '89' },
    { label: 'Évaluations', value: '4.8' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header avec photo de profil */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <Avatar.Text 
            size={80} 
            label={user?.name?.charAt(0) || 'U'} 
            style={styles.avatar}
          />
          <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'email@example.com'}</Text>
          <View style={styles.verificationBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.verificationText}>Compte vérifié</Text>
          </View>
        </View>
      </View>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        {stats.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Actions du profil */}
      <View style={styles.actionsContainer}>
        {profileActions.map((action, index) => (
          <TouchableOpacity key={index} style={styles.actionItem}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon as any} size={20} color={action.color} />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Informations du compte */}
      <Card style={styles.infoCard}>
        <Card.Content>
          <Title style={styles.cardTitle}>Informations du Compte</Title>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Membre depuis</Text>
            <Text style={styles.infoValue}>Janvier 2024</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Type de compte</Text>
            <Text style={styles.infoValue}>Prestataire</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Statut</Text>
            <Text style={[styles.infoValue, { color: '#4CAF50' }]}>Actif</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Bouton de déconnexion */}
      <View style={styles.logoutContainer}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutButton}
          textColor="#DC2626"
          icon="log-out-outline"
        >
          Se déconnecter
        </Button>
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
    backgroundColor: theme.colors.primary,
    paddingBottom: 30,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  avatar: {
    backgroundColor: 'white',
    marginBottom: 15,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 10,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  verificationText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
  actionsContainer: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 2,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionTitle: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  infoCard: {
    margin: 20,
    marginTop: 0,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: theme.colors.text,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  logoutContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  logoutButton: {
    borderColor: '#DC2626',
  },
});

export default ProfileScreen;