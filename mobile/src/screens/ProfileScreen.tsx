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
import { apiPatch, servicesApi, userApi } from '../services/api';
import { theme } from '../theme/theme';
import { isAdminRole } from '../utils/roleHelpers'; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

// ✅ NOUVEAU: Fonction pour nettoyer le nom et supprimer les doublons
const cleanUserName = (name: string | undefined | null): string => {
  if (!name || typeof name !== 'string') {
    return 'Utilisateur';
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return 'Utilisateur';
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
  const navigation = useNavigation();
  const [stats, setStats] = useState([
    { label: 'Services', value: '0' },
    { label: 'Clients', value: '0' },
    { label: 'Évaluations', value: '0' },
  ]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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

      // ✅ CORRIGÉ: Vérifier que les fonctions API existent avant de les appeler
      if (!userApi || typeof userApi.getUserProfile !== 'function') {
        console.error('[ProfileScreen] userApi.getUserProfile non disponible');
        Alert.alert('Erreur', 'Service de profil non disponible');
        return;
      }

      if (!servicesApi || typeof servicesApi.getUserServices !== 'function') {
        console.error('[ProfileScreen] servicesApi.getUserServices non disponible');
        Alert.alert('Erreur', 'Service de services non disponible');
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
          memberSince: profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long'
          }) : 'Non disponible',
          // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
          accountType: isAdminRole(profileData.role) ? 'Administrateur' :
            profileData.role === 'prestataire' ? 'Prestataire' : 'Utilisateur',
          status: profileData.is_active ? 'Actif' : 'Inactif'
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
          { label: 'Services', value: totalServices.toString() },
          { label: 'Interactions', value: totalInteractions.toString() },
          { label: 'Évaluations', value: averageRating },
        ]);
      }
    } catch (error: any) {
      console.error('Erreur chargement profil:', error);
      const errorMessage = error?.message || 'Une erreur inattendue s\'est produite';
      Alert.alert('Erreur', `Impossible de charger les données du profil: ${errorMessage}`);
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
        // ✅ NOUVEAU: Passer les paramètres si disponibles
        if (action.params) {
          navigation.navigate(action.route as never, action.params);
        } else {
          navigation.navigate(action.route as never);
        }
      } else {
        Alert.alert('Information', 'Cette fonctionnalité sera bientôt disponible');
      }
    } catch (error) {
      console.error('Erreur navigation:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à cette section');
    }
  };

  // ✅ NOUVEAU: Fonction pour changer la photo de profil
  const handleChangePhoto = async () => {
    try {
      // Demander les permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à vos photos');
        return;
      }

      // Afficher les options (galerie ou caméra)
      Alert.alert(
        'Changer la photo de profil',
        'Choisissez une option',
        [
          {
            text: 'Galerie',
            onPress: async () => {
              // ✅ CORRIGÉ: Protection contre undefined pour MediaType.Images
              if (!ImagePicker || !ImagePicker.MediaType) {
                console.error('[ProfileScreen] ImagePicker ou MediaType est undefined');
                Alert.alert('Erreur', 'Impossible d\'accéder à la galerie. Veuillez réessayer.');
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
            text: 'Caméra',
            onPress: async () => {
              const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraStatus.status !== 'granted') {
                Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la caméra');
                return;
              }

              // ✅ CORRIGÉ: Protection contre undefined pour MediaType.Images
              if (!ImagePicker || !ImagePicker.MediaType) {
                console.error('[ProfileScreen] ImagePicker ou MediaType est undefined');
                Alert.alert('Erreur', 'Impossible d\'accéder à la caméra. Veuillez réessayer.');
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
          { text: 'Annuler', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Erreur changement photo:', error);
      Alert.alert('Erreur', 'Impossible de changer la photo');
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

        Alert.alert('Succès', 'Photo de profil mise à jour avec succès');
      } else {
        throw new Error(response.error || 'Erreur lors de la mise à jour');
      }
    } catch (error: any) {
      console.error('Erreur upload photo:', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour la photo de profil');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ✅ SUPPRIMÉ: getActionIcon remplacé par SafeIcon directement

  const profileActions = [
    {
      title: 'Recharger Tokens',
      icon: 'wallet', // ✅ CORRIGÉ: Icône Lucide pour wallet
      color: '#EC4899',
      route: 'RechargeTokens',
      description: 'Ajouter des tokens à votre compte'
    },
    {
      title: 'Mes Vidéos',
      icon: 'video', // ✅ NOUVEAU: Accès aux vidéos créées
      color: '#EC4899',
      route: 'VideoFeed',
      params: { showOnlyMyVideos: true }, // ✅ NOUVEAU: Afficher uniquement les vidéos du prestataire
      description: 'Voir et gérer vos vidéos créées'
    },
    {
      title: 'Analytiques Vidéos',
      icon: 'bar-chart', // ✅ NOUVEAU: Statistiques des vidéos
      color: '#8B5CF6',
      route: 'VideoAnalytics',
      description: 'Statistiques et performances de vos vidéos'
    },
    // ✅ Masqué pour non-partenaires - Les partenaires sont redirigés automatiquement vers leur écran
    ...(user?.role === 'partenaire' ? [{
      title: 'Mes Services Spécialisés',
      icon: 'layout-grid', // ✅ CORRIGÉ: Icône Lucide pour interface de gestion (tablette/grille)
      color: '#6366F1',
      route: 'SpecializedServicesHub',
      description: 'Gérer vos services de santé et transport'
    }] : []),
    {
      title: 'Mes tickets de voyage',
      icon: 'ticket', // ✅ CORRIGÉ: Icône Lucide pour tickets
      color: '#8B5CF6',
      route: 'MyBusTickets',
      description: 'Voir et gérer vos tickets de bus'
    },
    {
      title: 'Don de sang',
      icon: 'activity', // ✅ CORRIGÉ: Icône Lucide pour don de sang (pouls/cœur) avec fallback emoji 💊
      color: '#DC2626',
      route: 'BloodGroupManagement',
      description: 'Enregistrer votre groupe sanguin et être notifié en cas d\'urgence'
    },
    {
      title: 'Devenir coursier Yukpo',
      icon: 'truck', // ✅ CORRIGÉ: Icône Lucide pour coursier (camion de livraison) avec fallback emoji 🚚
      color: '#10B981',
      route: 'CourierRegistration',
      description: 'Rejoignez notre équipe de coursiers'
    },
    {
      title: 'Mon historique',
      icon: 'history', // ✅ CORRIGÉ: Icône Lucide pour historique
      color: '#F59E0B',
      route: 'History',
      description: 'Voir mon historique de transactions'
    },
    {
      title: 'Produits consultés',
      icon: 'clock', // ✅ NOUVEAU 2026-01-23: Icône pour produits consultés
      color: '#6366F1',
      route: 'HistoriqueProduitsConsultes',
      description: 'Voir les produits que vous avez consultés'
    },
    {
      title: 'Paramètres',
      icon: 'settings', // ✅ CORRIGÉ: Icône Lucide pour paramètres
      color: '#757575',
      route: 'Settings',
      params: { initialSection: 'security' }, // ✅ NOUVEAU 2026-02-06: Ouvrir directement l'onglet sécurité
      description: 'Configurer votre compte'
    },
    {
      title: 'Changer le mot de passe',
      icon: 'key', // ✅ NOUVEAU 2026-02-06: Icône pour changement de mot de passe
      color: '#6366F1',
      route: 'Settings',
      params: { initialSection: 'security', showPasswordModal: true }, // ✅ NOUVEAU: Ouvrir le modal de changement de mot de passe
      description: 'Modifier votre mot de passe'
    },
    {
      title: 'Contacter le Support',
      icon: 'message-circle', // ✅ CORRIGÉ: Icône Lucide pour support
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
                    if (cleanedName && cleanedName !== 'Utilisateur') {
                      return cleanedName
                        .split(' ')
                        .map(word => word.charAt(0))
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);
                    }
                    return 'U';
                  })()}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{cleanUserName(user?.name || user?.nom_complet)}</Text>
          <Text style={styles.userEmail}>{user?.email || 'email@example.com'}</Text>
          <View style={styles.verificationBadge}>
            <Text style={styles.verificationIcon}>✓</Text>
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