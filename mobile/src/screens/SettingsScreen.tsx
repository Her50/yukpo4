// @ts-nocheck
// Migration vers des composants React Native natifs pour éviter les crashes
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { useState } from 'react';
import ReactNative from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { apiPatch } from '../services/api';
import { theme } from '../theme/theme';
const { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } = ReactNative;

interface UserSettings {
  // Profil
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  bio: string;

  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;

  // Confidentialité
  profileVisibility: 'public' | 'private' | 'friends';
  showLocation: boolean;
  showOnlineStatus: boolean;
  allowDataCollection: boolean;
  gpsEnabled: boolean;

  // Apparence
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;

  // Sécurité
  twoFactorAuth: boolean;
  sessionTimeout: number;
  loginAlerts: boolean;
}

const SettingsScreen: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    // Profil
    firstName: user?.name ? user.name.split(' ')[0] || '' : '',
    lastName: user?.name ? user.name.split(' ').slice(1).join(' ') || '' : '',
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: '',

    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    marketingEmails: true,

    // Confidentialité
    profileVisibility: 'public',
    showLocation: true,
    showOnlineStatus: true,
    allowDataCollection: true,
    gpsEnabled: true,

    // Apparence
    theme: 'light',
    fontSize: 'medium',
    compactMode: false,

    // Sécurité
    twoFactorAuth: false,
    sessionTimeout: 30,
    loginAlerts: true,
  });

  // Vérification de l'initialisation
  React.useEffect(() => {
    if (user) {
      const nameParts = user.name ? user.name.split(' ') : ['', ''];
      setSettings(prev => ({
        ...prev,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      }));
    }
  }, [user]);

  // Charger les paramètres GPS au démarrage
  React.useEffect(() => {
    const loadGPSSetting = async () => {
      try {
        const gpsEnabled = await AsyncStorage.getItem('gpsEnabled');
        if (gpsEnabled !== null) {
          setSettings(prev => ({
            ...prev,
            gpsEnabled: JSON.parse(gpsEnabled)
          }));
        } else {
          // Si aucun paramètre GPS n'est défini, l'activer par défaut
          setSettings(prev => ({
            ...prev,
            gpsEnabled: true
          }));
          await AsyncStorage.setItem('gpsEnabled', JSON.stringify(true));
        }
      } catch (error) {
        console.error('Erreur lors du chargement du paramètre GPS:', error);
      }
    };

    loadGPSSetting();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simuler la sauvegarde
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mettre à jour l'utilisateur
      const fullName = `${settings.firstName} ${settings.lastName}`.trim();
      updateUser({
        name: fullName,
        email: settings.email,
        phone: settings.phone,
      });

      // CORRECTION: Sauvegarder le paramètre GPS dans AsyncStorage ET envoyer au backend
      await AsyncStorage.setItem('gpsEnabled', JSON.stringify(settings.gpsEnabled));

      // ? CORRIGÉ: Envoyer le consentement GPS au backend avec apiPatch
      try {
        const response = await apiPatch('/api/user/me/gps_consent', {
          gps_consent: settings.gpsEnabled
        });

        if (response.success) {
          console.log('? [SettingsScreen] Consentement GPS envoyé au backend:', settings.gpsEnabled);
        } else {
          console.warn('?? [SettingsScreen] Erreur envoi consentement GPS au backend');
        }
      } catch (error) {
        console.error('? [SettingsScreen] Erreur réseau consentement GPS:', error);
      }

      Alert.alert('Succès', 'Paramètres sauvegardés avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  };

  const renderProfileSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Mon Profil</Text>

        {/* Avatar compact */}
        <View style={styles.compactAvatarContainer}>
          <View style={styles.compactAvatar}>
            <Text style={styles.compactAvatarText}>{getInitials(settings.firstName, settings.lastName)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert('Info', 'Fonctionnalité de changement de photo en cours de développement')}
            style={styles.compactChangePhotoButton}
          >
            <Text style={styles.compactChangePhotoText}>?? Changer</Text>
          </TouchableOpacity>
        </View>

        {/* Champs nom et prénom côte à côte */}
        <View style={styles.nameRow}>
          <View style={[styles.inputContainer, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Prénom</Text>
            <TextInput
              value={settings.firstName}
              onChangeText={(text) => setSettings(prev => ({ ...prev, firstName: text }))}
              style={styles.input}
              placeholder="Votre prénom"
            />
          </View>
          <View style={[styles.inputContainer, styles.halfWidth]}>
            <Text style={styles.inputLabel}>Nom</Text>
            <TextInput
              value={settings.lastName}
              onChangeText={(text) => setSettings(prev => ({ ...prev, lastName: text }))}
              style={styles.input}
              placeholder="Votre nom"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            value={settings.email}
            onChangeText={(text) => setSettings(prev => ({ ...prev, email: text }))}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            placeholder="votre@email.com"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Téléphone</Text>
          <TextInput
            value={settings.phone}
            onChangeText={(text) => setSettings(prev => ({ ...prev, phone: text }))}
            keyboardType="phone-pad"
            style={styles.input}
            placeholder="+237 6XX XX XX XX"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Bio (optionnel)</Text>
          <TextInput
            value={settings.bio}
            onChangeText={(text) => setSettings(prev => ({ ...prev, bio: text }))}
            multiline
            numberOfLines={2}
            style={[styles.input, styles.bioInput]}
            placeholder="Décrivez-vous en quelques mots..."
          />
        </View>
      </View>
    </View>
  );

  const renderNotificationsSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>??</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Notifications email</Text>
              <Text style={styles.settingDescription}>Recevoir des notifications par email</Text>
            </View>
          </View>
          <Switch
            value={settings.emailNotifications}
            onValueChange={(value) => setSettings(prev => ({ ...prev, emailNotifications: value }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>??</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Notifications push</Text>
              <Text style={styles.settingDescription}>Recevoir des notifications push</Text>
            </View>
          </View>
          <Switch
            value={settings.pushNotifications}
            onValueChange={(value) => setSettings(prev => ({ ...prev, pushNotifications: value }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>??</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Notifications SMS</Text>
              <Text style={styles.settingDescription}>Recevoir des notifications par SMS</Text>
            </View>
          </View>
          <Switch
            value={settings.smsNotifications}
            onValueChange={(value) => setSettings(prev => ({ ...prev, smsNotifications: value }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>??</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Emails marketing</Text>
              <Text style={styles.settingDescription}>Recevoir des offres et nouveautés</Text>
            </View>
          </View>
          <Switch
            value={settings.marketingEmails}
            onValueChange={(value) => setSettings(prev => ({ ...prev, marketingEmails: value }))}
          />
        </View>
      </View>
    </View>
  );

  const renderPrivacySection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Confidentialité</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>???</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Visibilité du profil</Text>
              <Text style={styles.settingDescription}>Qui peut voir votre profil</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              const options = ['public', 'private', 'friends'];
              const currentIndex = options.indexOf(settings.profileVisibility);
              const nextIndex = (currentIndex + 1) % options.length;
              setSettings(prev => ({ ...prev, profileVisibility: options[nextIndex] as any }));
            }}
            style={styles.visibilityButton}
          >
            <Text style={styles.visibilityButtonText}>{settings.profileVisibility}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>??</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Afficher la localisation</Text>
              <Text style={styles.settingDescription}>Partager votre position</Text>
            </View>
          </View>
          <Switch
            value={settings.showLocation}
            onValueChange={(value) => setSettings(prev => ({ ...prev, showLocation: value }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>??</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Statut en ligne</Text>
              <Text style={styles.settingDescription}>Afficher quand vous êtes en ligne</Text>
            </View>
          </View>
          <Switch
            value={settings.showOnlineStatus}
            onValueChange={(value) => setSettings(prev => ({ ...prev, showOnlineStatus: value }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>???</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Localisation en temps réel</Text>
              <Text style={styles.settingDescription}>
                Partager votre position GPS avec vos clients (activé par défaut)
              </Text>
            </View>
          </View>
          <Switch
            value={settings.gpsEnabled}
            onValueChange={async (value) => {
              setSettings(prev => ({ ...prev, gpsEnabled: value }));
              // CORRECTION: Sauvegarder immédiatement pour que le hook détecte le changement
              await AsyncStorage.setItem('gpsEnabled', JSON.stringify(value));
              console.log('[SettingsScreen] GPS', value ? 'activé' : 'désactivé');
            }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>??</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Collecte de données</Text>
              <Text style={styles.settingDescription}>Autoriser l'analyse d'usage</Text>
            </View>
          </View>
          <Switch
            value={settings.allowDataCollection}
            onValueChange={(value) => setSettings(prev => ({ ...prev, allowDataCollection: value }))}
          />
        </View>
      </View>
    </View>
  );

  const renderSecuritySection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Sécurité</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>???</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Authentification à deux facteurs</Text>
              <Text style={styles.settingDescription}>Sécuriser votre compte</Text>
            </View>
          </View>
          <Switch
            value={settings.twoFactorAuth}
            onValueChange={(value) => setSettings(prev => ({ ...prev, twoFactorAuth: value }))}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>?</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Délai de session</Text>
              <Text style={styles.settingDescription}>Minutes avant déconnexion automatique</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              const options = [15, 30, 60, 120];
              const currentIndex = options.indexOf(settings.sessionTimeout);
              const nextIndex = (currentIndex + 1) % options.length;
              setSettings(prev => ({ ...prev, sessionTimeout: options[nextIndex] }));
            }}
            style={styles.timeoutButton}
          >
            <Text style={styles.timeoutButtonText}>{settings.sessionTimeout}min</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.iconEmoji}>??</Text>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Alertes de connexion</Text>
              <Text style={styles.settingDescription}>Être notifié des nouvelles connexions</Text>
            </View>
          </View>
          <Switch
            value={settings.loginAlerts}
            onValueChange={(value) => setSettings(prev => ({ ...prev, loginAlerts: value }))}
          />
        </View>

        <TouchableOpacity
          onPress={() => Alert.alert('Info', 'Fonctionnalité de changement de mot de passe en cours de développement')}
          style={styles.changePasswordButton}
        >
          <Text style={styles.changePasswordIcon}>??</Text>
          <Text style={styles.changePasswordText}>Changer le mot de passe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Gestion d'erreur pour éviter les crashes
  try {
    return (
      <SafeNativeView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {user ? (
            <>
              {renderProfileSection()}
              {renderNotificationsSection()}
              {renderPrivacySection()}
              {renderSecuritySection()}

              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Erreur de chargement des paramètres</Text>
              <TouchableOpacity onPress={() => setLoading(false)} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeNativeView>
    );
  } catch (error) {
    console.error('Erreur dans SettingsScreen:', error);
    return (
      <SafeNativeView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erreur d'affichage des paramètres</Text>
          <Text style={styles.errorSubtext}>Veuillez réessayer plus tard</Text>
        </View>
      </SafeNativeView>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  sectionCard: {
    backgroundColor: 'white',
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  // Styles compacts pour le profil
  compactAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  compactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compactAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  compactChangePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  compactChangePhotoText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfWidth: {
    width: '48%',
  },
  bioInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: 'white',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  iconEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  visibilityButton: {
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  visibilityButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  timeoutButton: {
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeoutButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  changePasswordButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  changePasswordIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  changePasswordText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    marginTop: 24,
    marginBottom: 32,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
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
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;














