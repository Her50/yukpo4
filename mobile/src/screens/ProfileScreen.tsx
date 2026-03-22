// @ts-nocheck
// Remplacement des Ionicons par des emojis pour éviter les crashes
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiPatch, servicesApi, userApi } from '../services/api';
import { theme } from '../theme/theme';
import { isAdminRole } from '../utils/roleHelpers'; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

// ✅ NOUVEAU: Fonction pour nettoyer le nom et supprimer les doublons
const FALLBACK_SENTINEL = '__FALLBACK__';

const cleanUserName = (name: string | undefined | null, fallback: string = FALLBACK_SENTINEL): string => {
  if (!name || typeof name !== 'string') {
    return fallback;
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return fallback;
  }

  // ✅ CORRECTION : Détecter et supprimer les doublons (ex: "LELE Hernandez LELE Hernandez" -> "LELE Hernandez")
  const words = trimmed.split(/\s+/);

  // Méthode 1: Vérifier si la première moitié = deuxième moitié (ex: "LELE Hernandez LELE Hernandez")
  if (words.length >= 4) {
    const firstHalf = words.slice(0, Math.floor(words.length / 2)).join(' ');
    const secondHalf = words.slice(Math.floor(words.length / 2)).join(' ');
    if (firstHalf === secondHalf) {
      return firstHalf;
    }
  }

  // Méthode 2: Vérifier si les 2 premiers mots se répètent (ex: "LELE Hernandez LELE Hernandez")
  if (words.length >= 4) {
    const firstTwo = words.slice(0, 2).join(' ');
    const nextTwo = words.slice(2, 4).join(' ');
    if (firstTwo === nextTwo) {
      return firstTwo;
    }
  }

  // Méthode 3: Vérifier si le nom complet est répété (ex: "LELE Hernandez LELE Hernandez")
  const midPoint = Math.floor(words.length / 2);
  if (words.length > 2 && midPoint > 0) {
    const firstPart = words.slice(0, midPoint).join(' ');
    const secondPart = words.slice(midPoint).join(' ');
    if (firstPart === secondPart) {
      return firstPart;
    }
  }

  return trimmed;
};

const ProfileScreen: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const { t } = useLanguageSafe();
  const navigation = useNavigation();
  const [stats, setStats] = useState([
    { labelKey: 'services.title', value: '0' },
    { labelKey: 'stats.interactions', value: '0' },
    { labelKey: 'stats.views', value: '0' },
  ]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [accountInfo, setAccountInfo] = useState({
    memberSince: '',
    accountType: t('monProfil.utilisateur'),
    status: t('profile.active'),
    isActive: true
  });

  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    }
  }, [user?.id]);

  const loadProfileData = async () => {
    try {
      setLoading(true);

      // ✅ CORRIGÉ: Vérifier que les fonctions API existent avant de les appeler
      if (!userApi || typeof userApi.getUserProfile !== 'function') {
        console.error('[ProfileScreen] userApi.getUserProfile non disponible');
        Alert.alert(t('message.error'), t('profile.cannotAccess'));
        return;
      }

      if (!servicesApi || typeof servicesApi.getUserServices !== 'function') {
        console.error('[ProfileScreen] servicesApi.getUserServices non disponible');
        Alert.alert(t('message.error'), t('profile.cannotAccess'));
        return;
      }

      // Charger les données du profil utilisateur
      const [profileResponse, servicesResponse] = await Promise.all([
        userApi.getUserProfile(),
        servicesApi.getUserServices()
      ]);

      // ✅ CORRIGÉ: Vérifier que les réponses sont valides
      if (profileResponse && profileResponse.success && profileResponse.data) {
        const profileData = profileResponse.data as any;
        setAccountInfo({
          memberSince: profileData.created_at ? new Date(profileData.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long'
          }) : t('profile.unavailable'),
          // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
          accountType: isAdminRole(profileData.role) ? t('profile.administrator') :
            profileData.role === 'prestataire' ? t('profile.provider') : t('profile.user'),
          status: profileData.is_active ? t('profile.active') : t('profile.inactive'),
          isActive: !!profileData.is_active
        });
      }

      if (servicesResponse && servicesResponse.success && servicesResponse.data) {
        const services = Array.isArray(servicesResponse.data) ? servicesResponse.data : [];
        const totalServices = services.length;
        const activeServices = services.filter((s: any) => s && s.is_active).length;
        const totalInteractions = services.reduce((sum: number, s: any) => sum + (s?.interactions || 0), 0);
        const averageRating = services.length > 0
          ? (services.reduce((sum: number, s: any) => sum + (s?.rating || 0), 0) / services.length).toFixed(1)
          : '0';

        setStats([
          { labelKey: 'services.title', value: totalServices.toString() },
          { labelKey: 'stats.interactions', value: totalInteractions.toString() },
          { labelKey: 'stats.views', value: averageRating },
        ]);
      }
    } catch (error: any) {
      console.error('Erreur chargement profil:', error);
      const errorMessage = error?.message || t('profile.uneErreurInattendueSestProduite');
      Alert.alert(t('message.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        { text: t('button.cancel'), style: 'cancel' },
        { text: t('profile.logout'), style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleActionPress = (action: any) => {
    try {
      if (action.route) {
        // ✅ NOUVEAU: Passer les paramètres si disponibles
        if (action.params) {
          navigation.navigate(action.route as never, action.params);
        } else {
          navigation.navigate(action.route as never);
        }
      } else {
        Alert.alert(t('message.success'), t('profile.featureComingSoon'));
      }
    } catch (error) {
      console.error('Erreur navigation:', error);
      Alert.alert(t('message.error'), t('profile.cannotAccess'));
    }
  };

  // ✅ NOUVEAU: Fonction pour changer la photo de profil
  const handleChangePhoto = async () => {
    try {
      // Demander les permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('profile.permissionRequired'), t('profile.allowPhotos'));
        return;
      }

      // Afficher les options (galerie ou caméra)
      Alert.alert(
        t('profile.changePhoto'),
        t('profile.chooseOption'),
        [
          {
            text: t('profile.gallery'),
            onPress: async () => {
              // ✅ CORRIGÉ: Protection contre undefined pour MediaType.Images
              if (!ImagePicker || !ImagePicker.MediaType) {
                console.error('[ProfileScreen] ImagePicker ou MediaType est undefined');
                Alert.alert(t('message.error'), t('profile.cannotAccess'));
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaType.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadPhoto(result.assets[0].base64 || '');
              }
            },
          },
          {
            text: t('profile.camera'),
            onPress: async () => {
              const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraStatus.status !== 'granted') {
                Alert.alert(t('profile.permissionRequired'), t('profile.allowCamera'));
                return;
              }

              // ✅ CORRIGÉ: Protection contre undefined pour MediaType.Images
              if (!ImagePicker || !ImagePicker.MediaType) {
                console.error('[ProfileScreen] ImagePicker ou MediaType est undefined');
                Alert.alert(t('message.error'), t('profile.cannotAccess'));
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaType.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadPhoto(result.assets[0].base64 || '');
              }
            },
          },
          { text: t('button.cancel'), style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Erreur changement photo:', error);
      Alert.alert(t('message.error'), t('profile.cannotAccess'));
    }
  };

  // ✅ NOUVEAU: Fonction pour uploader la photo
  const uploadPhoto = async (base64Image: string) => {
    try {
      setUploadingPhoto(true);

      // Préparer l'URL de l'image (format data URI)
      const imageUri = `data:image/jpeg;base64,${base64Image}`;

      // Envoyer la photo via l'API
      const response = await apiPatch('/api/user/me', {
        avatar_url: imageUri,
        photo_profil: imageUri,
      });

      if (response.success) {
        // Mettre à jour l'utilisateur dans le contexte
        updateUser({
          photo: imageUri,
          avatar: imageUri,
        });

        // Recharger les données du profil
        await loadProfileData();

        Alert.alert(t('message.success'), t('profile.photoUpdated'));
      } else {
        throw new Error(response.error || t('message.error'));
      }
    } catch (error: any) {
      console.error('Erreur upload photo:', error);
      Alert.alert(t('message.error'), error.message || t('profile.cannotAccess'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ✅ SUPPRIMÉ: getActionIcon remplacé par SafeIcon directement

  const profileActions = [
    {
      title: t('profile.rechargeTokens'),
      icon: 'wallet',
      color: '#EC4899',
      route: 'RechargeTokens',
      description: t('profile.rechargeTokensDesc')
    },
    {
      title: t('profile.financialTracking'),
      icon: 'trending-up',
      color: '#8B5CF6',
      route: 'WalletFinancial',
      description: t('profile.financialTrackingDesc')
    },
    {
      title: '🎥 ' + t('profile.startLive'),
      icon: 'radio',
      color: '#DC2626',
      route: 'StartLive',
      description: t('profile.startLiveDesc')
    },
    {
      title: t('profile.myFollows'),
      icon: 'heart',
      color: '#FF2D55',
      route: 'MesSuivis',
      description: t('profile.myFollowsDesc')
    },
    {
      title: t('profile.myVideos'),
      icon: 'video',
      color: '#EC4899',
      route: 'VideoFeed',
      params: { showOnlyMyVideos: true },
      description: t('profile.myVideosDesc')
    },
    {
      title: t('profile.videoAnalytics'),
      icon: 'bar-chart',
      color: '#8B5CF6',
      route: 'VideoAnalytics',
      description: t('profile.videoAnalyticsDesc')
    },
    // ✅ SUPPRIMÉ 2026-03-05: Accès services spécialisés retiré de "Mon compte"
    // Les partenaires sont redirigés automatiquement vers leur écran après connexion
    {
      title: t('profile.travelTickets'),
      icon: 'ticket',
      color: '#8B5CF6',
      route: 'MyBusTickets',
      description: t('profile.travelTicketsDesc')
    },
    {
      title: t('profile.bloodDonation'),
      icon: 'activity',
      color: '#DC2626',
      route: 'BloodGroupManagement',
      description: t('profile.bloodDonationDesc')
    },
    {
      title: t('profile.becomeCourier'),
      icon: 'truck',
      color: '#10B981',
      route: 'CourierRegistration',
      description: t('profile.becomeCourierDesc')
    },
    {
      title: t('profile.myHistory'),
      icon: 'history',
      color: '#F59E0B',
      route: 'SoldeDetail',
      description: t('profile.myHistoryDesc')
    },
    {
      title: t('profile.viewedProducts'),
      icon: 'clock',
      color: '#6366F1',
      route: 'HistoriqueProduitsConsultes',
      description: t('profile.viewedProductsDesc')
    },
    {
      title: t('profile.settings'),
      icon: 'settings',
      color: '#757575',
      route: 'Settings',
      params: { initialSection: 'security' },
      description: t('profile.settingsDesc')
    },
    {
      title: t('profile.changePassword'),
      icon: 'key',
      color: '#6366F1',
      route: 'ChangePassword',
      description: t('profile.changePasswordDesc')
    },
    {
      title: t('profile.contactSupport'),
      icon: 'message-circle',
      color: '#2196F3',
      route: 'Contact',
      description: t('profile.contactSupportDesc')
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('profile.loadingProfile')}</Text>
      </View>
    );
  }

  return (
    <SafeNativeView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Header avec photo de profil */}
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleChangePhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <View style={styles.avatar}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : user?.photo || user?.avatar ? (
                <Image
                  source={{ uri: user.photo || user.avatar }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(() => {
                      const cleanedName = cleanUserName(user?.name || user?.nom_complet);
                      if (cleanedName && cleanedName !== FALLBACK_SENTINEL) {
                        return cleanedName
                          .split(' ')
                          .map(word => word.charAt(0))
                          .join('')
                          .toUpperCase()
                          .slice(0, 2);
                      }
                      return t('monProfil.utilisateur').charAt(0).toUpperCase();
                    })()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditIcon}>📷</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.userName}>{cleanUserName(user?.name || user?.nom_complet, t('monProfil.utilisateur'))}</Text>
            <Text style={styles.userEmail}>{user?.email || t('profile.noEmail')}</Text>
            <View style={styles.verificationBadge}>
              <Text style={styles.verificationIcon}>✓</Text>
              <Text style={styles.verificationText}>{t('profile.verified')}</Text>
            </View>
          </View>
        </View>

        {/* Statistiques */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{t(stat.labelKey)}</Text>
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
                  Alert.alert(t('message.success'), t('profile.featureComingSoon'));
                }
              }}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                  <SafeIcon
                    name={action.icon}
                    size={20}
                    color={action.color}
                    type="lucide"
                  />
                </View>
                <View>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  {action.description && (
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  )}
                </View>
              </View>
              <Text style={styles.chevronIcon}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Informations du compte */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardContent}>
            <Text style={styles.cardTitle}>{t('profile.accountInfo')}</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.memberSince')}</Text>
              <Text style={styles.infoValue}>{accountInfo.memberSince}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.accountType')}</Text>
              <Text style={styles.infoValue}>{accountInfo.accountType}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.status')}</Text>
              <Text style={[styles.infoValue, { color: accountInfo.isActive ? '#4CAF50' : '#F44336' }]}>
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
            <Text style={{ color: "#DC2626" }}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeNativeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
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
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    color: theme.colors.primary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarEditIcon: {
    fontSize: 14,
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