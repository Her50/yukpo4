import { useNotificationCounts } from '@/hooks/useNotificationCounts';
import { useUser } from '@/hooks/useUser';
import { userApi } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const HeaderController: React.FC = () => {
  const { user, logout } = useUser();
  const { notifications, conversations, loading: countsLoading, refreshCounts } = useNotificationCounts();
  const navigation = useNavigation();
  const [tokensBalance, setTokensBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [hasFetchedBalance, setHasFetchedBalance] = useState(false);

  // Debug logs
  useEffect(() => {
    console.log('[HeaderController] user from useUser:', user);
    console.log('[HeaderController] user.credits:', user?.credits);

    // Réinitialiser hasFetchedBalance quand l'utilisateur change
    if (user?.id) {
      setHasFetchedBalance(false);
    }

    // Essayer de charger le solde depuis AsyncStorage au démarrage
    const loadStoredBalance = async () => {
      try {
        const storedBalance = await AsyncStorage.getItem('tokens_balance');
        if (storedBalance) {
          const balance = parseInt(storedBalance, 10);
          if (!isNaN(balance)) {
            console.log('[HeaderController] Solde initial depuis AsyncStorage:', balance);
            setTokensBalance(balance);
          }
        }
      } catch (error) {
        console.error('[HeaderController] Erreur chargement solde AsyncStorage:', error);
      }
    };

    loadStoredBalance();
  }, [user?.id]);

  // Récupérer le solde depuis l'API
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.id) {
        setTokensBalance(null);
        return;
      }

      if (hasFetchedBalance || balanceLoading) {
        return;
      }

      setBalanceLoading(true);
      try {
        console.log('[HeaderController] Récupération solde pour user:', user.id);
        const response = await userApi.getTokensBalance();

        if (response.success && response.data?.tokens_balance !== undefined) {
          console.log('[HeaderController] Solde récupéré:', response.data.tokens_balance);
          setTokensBalance(response.data.tokens_balance);
          // Sauvegarder dans AsyncStorage pour affichage immédiat
          await AsyncStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
        }
      } catch (error) {
        console.error('[HeaderController] Erreur récupération solde:', error);
      } finally {
        setBalanceLoading(false);
        setHasFetchedBalance(true);
      }
    };

    fetchBalance();
  }, [user?.id, hasFetchedBalance, balanceLoading]);

  // Écouter les mises à jour de solde
  useEffect(() => {
    const handleBalanceUpdate = (balance: number) => {
      console.log('[HeaderController] Mise à jour solde depuis header:', balance);
      setTokensBalance(balance);
      AsyncStorage.setItem('tokens_balance', balance.toString());
    };

    // Note: Dans React Native, on ne peut pas utiliser CustomEvent
    // On utilisera plutôt un système de callback ou context
    // Pour l'instant, on se contente de la logique existante
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              await AsyncStorage.removeItem('tokens_balance');
              setTokensBalance(null);
              navigation.navigate('Login' as never);
            } catch (error) {
              console.error('[HeaderController] Erreur déconnexion:', error);
              Alert.alert('Erreur', 'Erreur lors de la déconnexion');
            }
          }
        }
      ]
    );
  };

  const handleNotificationsPress = () => {
    // Navigation vers l'historique des notifications
    navigation.navigate('NotificationHistory' as never);
  };

  const handleChatHistoryPress = () => {
    // Navigation vers l'historique des chats
    navigation.navigate('ChatHistory' as never);
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile' as never);
  };

  // Fallback : solde du JWT ou AsyncStorage
  const fallbackBalance = user?.credits ??
    (() => {
      // Cette logique sera gérée par useEffect
      return tokensBalance || 0;
    })();

  const displayBalance = tokensBalance !== null ? tokensBalance : fallbackBalance;

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftSection}>
          <Text style={styles.logo}>Yukpo</Text>
        </View>

        <View style={styles.rightSection}>
          {/* Solde de tokens */}
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Solde:</Text>
            <Text style={styles.balanceAmount}>
              {balanceLoading ? '...' : `${displayBalance} tokens`}
            </Text>
          </View>

          {/* Notifications */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleNotificationsPress}
          >
            <Text style={styles.icon}>🔔</Text>
            {notifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifications}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Messages */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleChatHistoryPress}
          >
            <Text style={styles.icon}>💬</Text>
            {conversations > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{conversations}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Menu profil */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <Text style={styles.profileText}>
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </TouchableOpacity>

          {/* Bouton déconnexion */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 10,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  leftSection: {
    flex: 1,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceContainer: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#666',
  },
  balanceAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#27ae60',
  },
  iconButton: {
    position: 'relative',
    padding: 8,
  },
  icon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27ae60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e74c3c',
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default HeaderController;