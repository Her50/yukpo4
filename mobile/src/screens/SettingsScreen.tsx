// @ts-nocheck
// Migration vers des composants React Native natifs pour éviter les crashes
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { useNavigation, useRoute } from '@react-navigation/native'; // ✅ NOUVEAU 2026-02-06: Pour gérer les paramètres de route
import * as React from 'react';
import { useEffect, useState } from 'react';
import ReactNative from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiPatch, apiPost } from '../services/api'; // ✅ NOUVEAU 2026-02-06: Ajouter apiPost pour changement de mot de passe
import { theme } from '../theme/theme';
import SafeStorage from '../utils/safeStorage';
const { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, Modal } = ReactNative;

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
  const navigation = useNavigation();
  const route = useRoute();
  const { user, updateUser } = useAuth();
  const { themeMode, setThemeMode, isDark } = useTheme(); // ✅ NOUVEAU: Utiliser ThemeContext
  const [loading, setLoading] = useState(false);

  // ✅ NOUVEAU 2026-02-06: État pour le changement de mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    // Profil
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    bio: '',

    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    marketingEmails: false,

    // Confidentialité
    profileVisibility: 'public',
    showLocation: true,
    showOnlineStatus: true,
    allowDataCollection: true,
    gpsEnabled: true,

    // Apparence
    theme: themeMode, // ✅ NOUVEAU: Utiliser le thème du context
    fontSize: 'medium',
    compactMode: false,

    // Sécurité
    twoFactorAuth: false,
    sessionTimeout: 30,
    loginAlerts: true,
  });

  const [activeSection, setActiveSection] = useState<string>('profile');

  // ✅ NOUVEAU 2026-02-06: Vérifier les paramètres de route au montage
  useEffect(() => {
    // @ts-ignore - route peut avoir des paramètres
    const routeParams = (route as any)?.params;
    if (routeParams) {
      if (routeParams.initialSection) {
        setActiveSection(routeParams.initialSection);
      }
      if (routeParams.showPasswordModal) {
        setShowPasswordModal(true);
      }
    }
  }, [route]);

  const handleSave = async () => {
    try {
      setLoading(true);

      // Sauvegarder les paramètres localement
      await SafeStorage.setItem('userSettings', JSON.stringify(settings));

      // Mettre à jour le profil utilisateur si nécessaire
      if (settings.name !== user?.name || settings.email !== user?.email) {
        const updateData = {
          name: settings.name,
          email: settings.email,
          phone: settings.phone,
          bio: settings.bio,
        };

        const response = await apiPatch('/api/users/profile', updateData);

        if (response.success) {
          updateUser(response.data);
          Alert.alert('Succès', 'Paramètres sauvegardés avec succès');
        } else {
          Alert.alert('Erreur', 'Impossible de sauvegarder les paramètres');
        }
      } else {
        Alert.alert('Succès', 'Paramètres sauvegardés avec succès');
      }
    } catch (error) {
      console.error('Erreur sauvegarde paramètres:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    try {
      setChangingPassword(true);

      const response = await apiPost('/api/users/change-password', {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      });

      if (response.success) {
        Alert.alert('Succès', 'Votre mot de passe a été modifié avec succès', [
          {
            text: 'OK', onPress: () => {
              setShowPasswordModal(false);
              setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }
          }
        ]);
      } else {
        throw new Error(response.error || 'Erreur lors du changement de mot de passe');
      }
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      Alert.alert('Erreur', error.message || 'Impossible de modifier le mot de passe');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Réinitialiser les paramètres',
      'Êtes-vous sûr de vouloir réinitialiser tous les paramètres aux valeurs par défaut ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => {
            setSettings({
              firstName: user?.name?.split(' ')[0] || '',
              lastName: user?.name?.split(' ').slice(1).join(' ') || '',
              name: user?.name || '',
              email: user?.email || '',
              phone: '',
              bio: '',
              emailNotifications: true,
              pushNotifications: true,
              smsNotifications: false,
              marketingEmails: false,
              profileVisibility: 'public',
              showLocation: true,
              showOnlineStatus: true,
              allowDataCollection: true,
              gpsEnabled: true,
              theme: 'light',
              fontSize: 'medium',
              compactMode: false,
              twoFactorAuth: false,
              sessionTimeout: 30,
              loginAlerts: true,
            });
          }
        }
      ]
    );
  };

  const updateSetting = (key: keyof UserSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const renderProfileSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>👤 Profil</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Prénom</Text>
        <TextInput
          style={styles.input}
          value={settings.firstName}
          onChangeText={(value) => {
            updateSetting('firstName', value);
            updateSetting('name', `${value} ${settings.lastName}`.trim());
          }}
          placeholder="Votre prénom"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nom</Text>
        <TextInput
          style={styles.input}
          value={settings.lastName}
          onChangeText={(value) => {
            updateSetting('lastName', value);
            updateSetting('name', `${settings.firstName} ${value}`.trim());
          }}
          placeholder="Votre nom"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={settings.email}
          onChangeText={(value) => updateSetting('email', value)}
          placeholder="votre@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Téléphone</Text>
        <TextInput
          style={styles.input}
          value={settings.phone}
          onChangeText={(value) => updateSetting('phone', value)}
          placeholder="+237 6XX XXX XXX"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Biographie</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={settings.bio}
          onChangeText={(value) => updateSetting('bio', value)}
          placeholder="Parlez-nous de vous..."
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderNotificationsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔔 Notifications</Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Notifications email</Text>
          <Text style={styles.settingDescription}>Recevoir des notifications par email</Text>
        </View>
        <Switch
          value={settings.emailNotifications}
          onValueChange={(value) => updateSetting('emailNotifications', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.emailNotifications ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Notifications push</Text>
          <Text style={styles.settingDescription}>Recevoir des notifications push</Text>
        </View>
        <Switch
          value={settings.pushNotifications}
          onValueChange={(value) => updateSetting('pushNotifications', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.pushNotifications ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Notifications SMS</Text>
          <Text style={styles.settingDescription}>Recevoir des notifications par SMS</Text>
        </View>
        <Switch
          value={settings.smsNotifications}
          onValueChange={(value) => updateSetting('smsNotifications', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.smsNotifications ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Emails marketing</Text>
          <Text style={styles.settingDescription}>Recevoir des offres et promotions</Text>
        </View>
        <Switch
          value={settings.marketingEmails}
          onValueChange={(value) => updateSetting('marketingEmails', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.marketingEmails ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  const renderPrivacySection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔒 Confidentialité</Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Visibilité du profil</Text>
          <Text style={styles.settingDescription}>Qui peut voir votre profil</Text>
        </View>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => {
            Alert.alert(
              'Visibilité du profil',
              'Choisissez qui peut voir votre profil',
              [
                { text: 'Public', onPress: () => updateSetting('profileVisibility', 'public') },
                { text: 'Privé', onPress: () => updateSetting('profileVisibility', 'private') },
                { text: 'Amis seulement', onPress: () => updateSetting('profileVisibility', 'friends') },
                { text: 'Annuler', style: 'cancel' }
              ]
            );
          }}
        >
          <Text style={styles.selectorText}>
            {settings.profileVisibility === 'public' ? 'Public' :
              settings.profileVisibility === 'private' ? 'Privé' : 'Amis seulement'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Afficher la localisation</Text>
          <Text style={styles.settingDescription}>Partager votre position</Text>
        </View>
        <Switch
          value={settings.showLocation}
          onValueChange={(value) => updateSetting('showLocation', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.showLocation ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Statut en ligne</Text>
          <Text style={styles.settingDescription}>Afficher quand vous êtes en ligne</Text>
        </View>
        <Switch
          value={settings.showOnlineStatus}
          onValueChange={(value) => updateSetting('showOnlineStatus', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.showOnlineStatus ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Collecte de données</Text>
          <Text style={styles.settingDescription}>Autoriser la collecte de données d'usage</Text>
        </View>
        <Switch
          value={settings.allowDataCollection}
          onValueChange={(value) => updateSetting('allowDataCollection', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.allowDataCollection ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  const renderAppearanceSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🎨 Apparence</Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Thème</Text>
          <Text style={styles.settingDescription}>Choisir le thème de l'application</Text>
        </View>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => {
            Alert.alert(
              'Thème',
              'Choisissez le thème de l\'application',
              [
                {
                  text: 'Clair',
                  onPress: () => {
                    updateSetting('theme', 'light');
                    setThemeMode('light'); // ✅ NOUVEAU: Mettre à jour le context
                  }
                },
                {
                  text: 'Sombre',
                  onPress: () => {
                    updateSetting('theme', 'dark');
                    setThemeMode('dark'); // ✅ NOUVEAU: Mettre à jour le context
                  }
                },
                {
                  text: 'Automatique',
                  onPress: () => {
                    updateSetting('theme', 'auto');
                    setThemeMode('auto'); // ✅ NOUVEAU: Mettre à jour le context
                  }
                },
                { text: 'Annuler', style: 'cancel' }
              ]
            );
          }}
        >
          <Text style={styles.selectorText}>
            {themeMode === 'light' ? 'Clair' :
              themeMode === 'dark' ? 'Sombre' : 'Automatique'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Taille de police</Text>
          <Text style={styles.settingDescription}>Ajuster la taille du texte</Text>
        </View>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => {
            Alert.alert(
              'Taille de police',
              'Choisissez la taille de police',
              [
                { text: 'Petite', onPress: () => updateSetting('fontSize', 'small') },
                { text: 'Moyenne', onPress: () => updateSetting('fontSize', 'medium') },
                { text: 'Grande', onPress: () => updateSetting('fontSize', 'large') },
                { text: 'Annuler', style: 'cancel' }
              ]
            );
          }}
        >
          <Text style={styles.selectorText}>
            {settings.fontSize === 'small' ? 'Petite' :
              settings.fontSize === 'medium' ? 'Moyenne' : 'Grande'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Mode compact</Text>
          <Text style={styles.settingDescription}>Interface plus compacte</Text>
        </View>
        <Switch
          value={settings.compactMode}
          onValueChange={(value) => updateSetting('compactMode', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.compactMode ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  const renderSecuritySection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🛡️ Sécurité</Text>

      {/* ✅ NOUVEAU 2026-02-06: Bouton pour changer le mot de passe */}
      <TouchableOpacity
        style={styles.passwordButton}
        onPress={() => setShowPasswordModal(true)}
      >
        <Text style={styles.passwordButtonText}>🔐 Changer le mot de passe</Text>
      </TouchableOpacity>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Authentification à deux facteurs</Text>
          <Text style={styles.settingDescription}>Sécuriser votre compte avec 2FA</Text>
        </View>
        <Switch
          value={settings.twoFactorAuth}
          onValueChange={(value) => updateSetting('twoFactorAuth', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.twoFactorAuth ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Délai de session</Text>
          <Text style={styles.settingDescription}>Temps avant déconnexion automatique</Text>
        </View>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => {
            Alert.alert(
              'Délai de session',
              'Choisissez le délai de déconnexion automatique',
              [
                { text: '15 minutes', onPress: () => updateSetting('sessionTimeout', 15) },
                { text: '30 minutes', onPress: () => updateSetting('sessionTimeout', 30) },
                { text: '1 heure', onPress: () => updateSetting('sessionTimeout', 60) },
                { text: '2 heures', onPress: () => updateSetting('sessionTimeout', 120) },
                { text: 'Annuler', style: 'cancel' }
              ]
            );
          }}
        >
          <Text style={styles.selectorText}>
            {settings.sessionTimeout === 15 ? '15 minutes' :
              settings.sessionTimeout === 30 ? '30 minutes' :
                settings.sessionTimeout === 60 ? '1 heure' : '2 heures'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Alertes de connexion</Text>
          <Text style={styles.settingDescription}>Être notifié des nouvelles connexions</Text>
        </View>
        <Switch
          value={settings.loginAlerts}
          onValueChange={(value) => updateSetting('loginAlerts', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.loginAlerts ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSection();
      case 'notifications':
        return renderNotificationsSection();
      case 'privacy':
        return renderPrivacySection();
      case 'appearance':
        return renderAppearanceSection();
      case 'security':
        return renderSecuritySection();
      default:
        return renderProfileSection();
    }
  };

  return (
    <SafeNativeView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Paramètres</Text>
        <Text style={styles.subtitle}>Personnalisez votre expérience</Text>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {[
            { id: 'profile', title: '👤 Profil', icon: '👤' },
            { id: 'notifications', title: '🔔 Notifications', icon: '🔔' },
            { id: 'privacy', title: '🔒 Confidentialité', icon: '🔒' },
            { id: 'appearance', title: '🎨 Apparence', icon: '🎨' },
            { id: 'security', title: '🛡️ Sécurité', icon: '🛡️' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeSection === tab.id && styles.activeTab
              ]}
              onPress={() => setActiveSection(tab.id)}
            >
              <Text style={[
                styles.tabText,
                activeSection === tab.id && styles.activeTabText
              ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderSection()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleReset}
        >
          <Text style={styles.resetButtonText}>🔄 Réinitialiser</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ✅ NOUVEAU 2026-02-06: Modal de changement de mot de passe */}
      {showPasswordModal && (
        <Modal
          visible={showPasswordModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🔐 Changer le mot de passe</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe actuel</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.currentPassword}
                  onChangeText={(value) => setPasswordData(prev => ({ ...prev, currentPassword: value }))}
                  placeholder="Entrez votre mot de passe actuel"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nouveau mot de passe</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.newPassword}
                  onChangeText={(value) => setPasswordData(prev => ({ ...prev, newPassword: value }))}
                  placeholder="Entrez votre nouveau mot de passe"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmer le mot de passe</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.confirmPassword}
                  onChangeText={(value) => setPasswordData(prev => ({ ...prev, confirmPassword: value }))}
                  placeholder="Confirmez votre nouveau mot de passe"
                  secureTextEntry
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                >
                  <Text style={styles.modalButtonTextCancel}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  <Text style={styles.modalButtonTextSave}>
                    {changingPassword ? '⏳...' : '💾 Enregistrer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeNativeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tabsContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabs: {
    paddingHorizontal: 10,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTab: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  selector: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
  },
  selectorText: {
    fontSize: 14,
    color: '#2c3e50',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // ✅ NOUVEAU 2026-02-06: Styles pour le changement de mot de passe
  passwordButton: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  passwordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonSave: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default SettingsScreen;