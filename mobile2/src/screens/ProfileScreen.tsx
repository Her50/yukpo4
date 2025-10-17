// Remplacement des Ionicons par des emojis pour éviter les crashes
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi, userApi } from '../services/api';
import { theme } from '../theme/theme';

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const [stats, setStats] = useState([
    { label: 'Services', value: '0' },
    { label: 'Clients', value: '0' },
    { label: 'Évaluations', value: '0' },
  ]);
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState({
    memberSince: '',
    accountType: 'Utilisateur',
    status: 'Actif'
  });

  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    }
  }, [user?.id]);

  const loadProfileData = async () => {
    try {
      setLoading(true);

      // Charger les données du profil utilisateur
      const [profileResponse, servicesResponse] = await Promise.all([
        userApi.getUserProfile(),
        servicesApi.getUserServices()
      ]);

      if (profileResponse.success && profileResponse.data) {
        const profileData = profileResponse.data as any;
        setAccountInfo({
          memberSince: profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long'
          }) : 'Non disponible',
          accountType: profileData.role === 'admin' ? 'Administrateur' :
            profileData.role === 'prestataire' ? 'Prestataire' : 'Utilisateur',
          status: profileData.is_active ? 'Actif' : 'Inactif'
        });
      }

      if (servicesResponse.success && servicesResponse.data) {
        const services = servicesResponse.data as any[];
        const totalServices = services.length;
        const activeServices = services.filter(s => s.is_active).length;
        const totalInteractions = services.reduce((sum, s) => sum + (s.interactions || 0), 0);
        const averageRating = services.length > 0
          ? (services.reduce((sum, s) => sum + (s.rating || 0), 0) / services.length).toFixed(1)
          : '0';

        setStats([
          { label: 'Services', value: totalServices.toString() },
          { label: 'Interactions', value: totalInteractions.toString() },
          { label: 'Évaluations', value: averageRating },
        ]);
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du profil');
    } finally {
      setLoading(false);
    }
  };

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

  const handleActionPress = (action: any) => {
    try {
      if (action.route) {
        navigation.navigate(action.route as never);
      } else {
        Alert.alert('Information', 'Cette fonctionnalité sera bientôt disponible');
      }
    } catch (error) {
      console.error('Erreur navigation:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à cette section');
    }
  };

  const getActionIcon = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      'wallet': '💰',
      'person-outline': '👤',
      'settings-outline': '⚙️',
      'help-circle-outline': '❓',
      'information-circle-outline': 'ℹ️',
      'shield-checkmark-outline': '🛡️',
      'star-outline': '⭐',
      'time-outline': '⏰',
      'card-outline': '💳',
      'notifications-outline': '🔔',
      'chatbubbles-outline': '💬',
      'analytics-outline': '📊',
      'document-outline': '📄',
      'camera-outline': '📷',
      'location-outline': '📍',
    };
    return iconMap[iconName] || '📱';
  };

  const profileActions = [
    {
      title: 'Mon historique',
      icon: 'analytics-outline',
      color: '#F59E0B',
      route: 'Historique',
      description: 'Voir mon historique de transactions'
    },
    {
      title: 'Recharger Tokens',
      icon: 'wallet',
      color: '#EC4899',
      route: 'RechargeTokens',
      description: 'Ajouter des tokens à votre compte'
    },
    {
      title: 'Paramètres',
      icon: 'settings-outline',
      color: '#757575',
      route: 'Settings',
      description: 'Configurer votre compte'
    },
    {
      title: 'Contacter le Support',
      icon: 'chatbubbles-outline',
      color: '#2196F3',
      route: 'Contact',
      description: 'Besoin d\'aide ?'
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Header avec photo de profil */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'email@example.com'}</Text>
          <View style={styles.verificationBadge}>
            <Text style={styles.verificationIcon}>✅</Text>
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
          <TouchableOpacity
            key={index}
            style={styles.actionItem}
            onPress={() => {
              if (action.route) {
                (navigation as any).navigate(action.route);
              } else {
                Alert.alert('Information', 'Fonctionnalité en cours de développement');
              }
            }}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                <Text style={[styles.actionIconText, { color: action.color }]}>
                  {getActionIcon(action.icon)}
                </Text>
              </View>
              <View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                {action.description && (
                  <Text style={styles.actionDescription}>{action.description}</Text>
                )}
              </View>
            </View>
            <Text style={styles.chevronIcon}>▶</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Informations du compte */}
      <View style={styles.infoCard}>
        <View style={styles.infoCardContent}>
          <Text style={styles.cardTitle}>Informations du Compte</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Membre depuis</Text>
            <Text style={styles.infoValue}>{accountInfo.memberSince}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Type de compte</Text>
            <Text style={styles.infoValue}>{accountInfo.accountType}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Statut</Text>
            <Text style={[styles.infoValue, { color: accountInfo.status === 'Actif' ? '#4CAF50' : '#F44336' }]}>
              {accountInfo.status}
            </Text>
          </View>
        </View>
      </View>

      {/* Bouton de déconnexion */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={{ color: "#DC2626" }}>Se déconnecter</Text>
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
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 32,
    fontWeight: 'bold',
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
  verificationIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  actionIconText: {
    fontSize: 20,
  },
  chevronIcon: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 8,
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
  actionDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoCardContent: {
    padding: 16,
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



