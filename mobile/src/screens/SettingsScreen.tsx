// @ts-nocheck
// Migration vers des composants React Native natifs pour éviter les crashes
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'; // ✅ NOUVEAU 2026-02-06: Pour gérer les paramètres de route
import * as React from 'react';
import { useEffect, useState } from 'react';
import ReactNative from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiPatch, apiPost } from '../services/api';
import { appUpdateService } from '../services/appUpdateService';
import { coachingNotificationService } from '../services/coachingNotificationService';
import { notificationUiPreferences } from '../services/notificationUiPreferences';
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
  const { t } = useLanguageSafe();
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
  const [checkingUpdate, setCheckingUpdate] = useState(false);
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
  const [coachIaSoundFull, setCoachIaSoundFull] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      notificationUiPreferences.getCoachIaSoundFull().then(setCoachIaSoundFull).catch(() => { });
    }, []),
  );

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
          Alert.alert(t('message.success'), t('settings.savedSuccess'));
        } else {
          Alert.alert(t('message.error'), t('settings.saveError'));
        }
      } else {
        Alert.alert(t('message.success'), t('settings.savedSuccess'));
      }
    } catch (error) {
      console.error('Erreur sauvegarde paramètres:', error);
      Alert.alert(t('message.error'), t('settings.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert(t('message.error'), t('settings.passwordMismatch'));
      return;
    }

    if (passwordData.newPassword.length < 8) {
      Alert.alert(t('message.error'), t('settings.passwordTooShort'));
      return;
    }

    try {
      setChangingPassword(true);

      const response = await apiPost('/api/users/change-password', {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      });

      if (response.success) {
        Alert.alert(t('message.success'), t('settings.passwordChanged'), [
          {
            text: 'OK', onPress: () => {
              setShowPasswordModal(false);
              setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            }
          }
        ]);
      } else {
        throw new Error(response.error || t('settingsScreen.errorChangingPassword'));
      }
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      Alert.alert(t('message.error'), error.message || t('settings.passwordChangeError'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      t('settings.resetTitle'),
      t('settings.resetConfirm'),
      [
        { text: t('button.cancel'), style: 'cancel' },
        {
          text: t('settings.reset'),
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

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const hasUpdate = await appUpdateService.checkForUpdatesManually();
      if (!hasUpdate) {
        Alert.alert(
          t('settingsScreen.appUpToDate'),
          t('settingsScreen.usingLatestVersion')
        );
      }
    } catch (error) {
      console.error('[Settings] Erreur verification MAJ:', error);
      Alert.alert(t('settingsScreen.error'), t('settingsScreen.cannotCheckUpdates'));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const updateSetting = (key: keyof UserSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const renderProfileSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settingsScreen.profilSection')}</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('settings.prenom')}</Text>
        <TextInput
          style={styles.input}
          value={settings.firstName}
          onChangeText={(value) => {
            updateSetting('firstName', value);
            updateSetting('name', `${value} ${settings.lastName}`.trim());
          }}
          placeholder={t('settings.votrePrenom')}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('settingsScreen.nom')}</Text>
        <TextInput
          style={styles.input}
          value={settings.lastName}
          onChangeText={(value) => {
            updateSetting('lastName', value);
            updateSetting('name', `${settings.firstName} ${value}`.trim());
          }}
          placeholder={t('settings.votreNom')}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('settingsScreen.email')}</Text>
        <TextInput
          style={styles.input}
          value={settings.email}
          onChangeText={(value) => updateSetting('email', value)}
          placeholder={t('settingsScreen.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('settings.telephone')}</Text>
        <TextInput
          style={styles.input}
          value={settings.phone}
          onChangeText={(value) => updateSetting('phone', value)}
          placeholder="+XXX XXXXXXXXX"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('settingsScreen.biographie')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={settings.bio}
          onChangeText={(value) => updateSetting('bio', value)}
          placeholder={t('settingsScreen.bioPlaceholder')}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderNotificationsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settings.notificationsEmail')}</Text>
          <Text style={styles.settingDescription}>{t('settingsScreen.emailNotifDesc')}</Text>
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
          <Text style={styles.settingTitle}>{t('settings.notificationsPush')}</Text>
          <Text style={styles.settingDescription}>{t('settingsScreen.pushNotifDesc')}</Text>
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
          <Text style={styles.settingTitle}>{t('settings.notificationsSms')}</Text>
          <Text style={styles.settingDescription}>{t('settingsScreen.smsNotifDesc')}</Text>
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
          <Text style={styles.settingTitle}>{t('settingsScreen.marketingEmails')}</Text>
          <Text style={styles.settingDescription}>{t('settingsScreen.marketingEmailsDesc')}</Text>
        </View>
        <Switch
          value={settings.marketingEmails}
          onValueChange={(value) => updateSetting('marketingEmails', value)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.marketingEmails ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={[styles.settingRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' }]}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            {t('settings.coachIaNavTitle')}
          </Text>
          <Text style={styles.settingDescription}>
            {t('settings.coachIaNavDesc')}
          </Text>
        </View>
        <Switch
          value={coachIaSoundFull}
          onValueChange={async (value) => {
            setCoachIaSoundFull(value);
            await notificationUiPreferences.setCoachIaSoundFull(value);
            await coachingNotificationService.refreshScheduleIfActive();
          }}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={coachIaSoundFull ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  const renderPrivacySection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.confidentialite')}</Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settings.visibiliteDuProfil')}</Text>
          <Text style={styles.settingDescription}>{t('settingsScreen.whoCanSeeProfile')}</Text>
        </View>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => {
            Alert.alert(
              t('settings.profileVisibility'),
              t('settings.profileVisibilityDesc'),
              [
                { text: t('settings.public'), onPress: () => updateSetting('profileVisibility', 'public') },
                { text: t('settings.private'), onPress: () => updateSetting('profileVisibility', 'private') },
                { text: t('settings.contactsOnly'), onPress: () => updateSetting('profileVisibility', 'friends') },
                { text: t('button.cancel'), style: 'cancel' }
              ]
            );
          }}
        >
          <Text style={styles.selectorText}>
            {settings.profileVisibility === 'public' ? t('settings.public') :
              settings.profileVisibility === 'private' ? t('settings.private') : t('settings.contactsOnly')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settings.afficherLaLocalisation')}</Text>
          <Text style={styles.settingDescription}>{t('settingsScreen.partagerVotrePosition')}</Text>
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
          <Text style={styles.settingTitle}>{t('settingsScreen.onlineStatus')}</Text>
          <Text style={styles.settingDescription}>{t('settings.afficherQuandVousEtesEn')}</Text>
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
          <Text style={styles.settingTitle}>{t('settings.collecteDeDonnees')}</Text>
          <Text style={styles.settingDescription}>{t('settings.autoriserLaCollecteDeDonnees')}</Text>
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
      <Text style={styles.sectionTitle}>{t('settingsScreen.appearanceSection')}</Text>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settings.theme')}</Text>
          <Text style={styles.settingDescription}>{t('settings.choisirLeThemeDeLapplication')}</Text>
        </View>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => {
            Alert.alert(
              t('settings.themeTitle'),
              t('settings.themeDesc'),
              [
                {
                  text: t('settings.themeLight'),
                  onPress: () => {
                    updateSetting('theme', 'light');
                    setThemeMode('light'); // ✅ NOUVEAU: Mettre à jour le context
                  }
                },
                {
                  text: t('settings.themeDark'),
                  onPress: () => {
                    updateSetting('theme', 'dark');
                    setThemeMode('dark'); // ✅ NOUVEAU: Mettre à jour le context
                  }
                },
                {
                  text: t('settings.themeSystem'),
                  onPress: () => {
                    updateSetting('theme', 'auto');
                    setThemeMode('auto'); // ✅ NOUVEAU: Mettre à jour le context
                  }
                },
                { text: t('button.cancel'), style: 'cancel' }
              ]
            );
          }}
        >
          <Text style={styles.selectorText}>
            {themeMode === 'light' ? t('settings.themeLight') :
              themeMode === 'dark' ? t('settings.themeDark') : t('settings.themeSystem')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settingsScreen.fontSize')}</Text>
          <Text style={styles.settingDescription}>{t('settingsScreen.adjustFontSize')}</Text>
        </View>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => {
            Alert.alert(
              t('settings.fontSizeTitle'),
              t('settings.fontSizeDesc'),
              [
                { text: t('settings.fontSmall'), onPress: () => updateSetting('fontSize', 'small') },
                { text: t('settings.fontMedium'), onPress: () => updateSetting('fontSize', 'medium') },
                { text: t('settings.fontLarge'), onPress: () => updateSetting('fontSize', 'large') },
                { text: t('button.cancel'), style: 'cancel' }
              ]
            );
          }}
        >
          <Text style={styles.selectorText}>
            {settings.fontSize === 'small' ? t('settings.fontSmall') :
              settings.fontSize === 'medium' ? t('settings.fontMedium') : t('settings.fontLarge')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settings.modeCompact')}</Text>
          <Text style={styles.settingDescription}>{t('settingsScreen.compactInterface')}</Text>
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
      <Text style={styles.sectionTitle}>{t('settings.securite')}</Text>

      {/* ✅ NOUVEAU 2026-02-06: Bouton pour changer le mot de passe */}
      <TouchableOpacity
        style={styles.passwordButton}
        onPress={() => setShowPasswordModal(true)}
      >
        <Text style={styles.passwordButtonText}>{t('settingsScreen.changePassword')}</Text>
      </TouchableOpacity>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settings.authentificationADeuxFacteurs')}</Text>
          <Text style={styles.settingDescription}>{t('settings.securiserVotreCompteAvec2fa')}</Text>
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
          <Text style={styles.settingTitle}>{t('settings.delaiDeSession')}</Text>
          <Text style={styles.settingDescription}>{t('settings.tempsAvantDeconnexionAutomatique')}</Text>
        </View>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => {
            Alert.alert(
              t('settings.sessionTimeoutTitle'),
              t('settings.sessionTimeoutDesc'),
              [
                { text: t('settings.timeout15'), onPress: () => updateSetting('sessionTimeout', 15) },
                { text: t('settings.timeout30'), onPress: () => updateSetting('sessionTimeout', 30) },
                { text: t('settings.timeout60'), onPress: () => updateSetting('sessionTimeout', 60) },
                { text: t('settings.timeoutNever'), onPress: () => updateSetting('sessionTimeout', 120) },
                { text: t('button.cancel'), style: 'cancel' }
              ]
            );
          }}
        >
          <Text style={styles.selectorText}>
            {settings.sessionTimeout === 15 ? t('settings.timeout15') :
              settings.sessionTimeout === 30 ? t('settings.timeout30') :
                settings.sessionTimeout === 60 ? t('settings.timeout60') : t('settings.timeoutNever')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{t('settingsScreen.loginAlerts')}</Text>
          <Text style={styles.settingDescription}>{t('settings.etreNotifieDesNouvellesConnexions')}</Text>
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
        <Text style={styles.title}>{t('settings.parametres')}</Text>
        <Text style={styles.subtitle}>{t('settings.personnalisezVotreExperience')}</Text>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {[
            { id: 'profile', title: t('settingsScreen.profil'), icon: '👤' },
            { id: 'notifications', title: t('settings.notifications'), icon: '🔔' },
            { id: 'privacy', title: t('settings.confidentialite'), icon: '🔒' },
            { id: 'appearance', title: t('settingsScreen.appearanceSection'), icon: '🎨' },
            { id: 'security', title: t('settings.securite'), icon: '🛡️' },
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

        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleCheckForUpdates}
          disabled={checkingUpdate}
        >
          <Text style={styles.updateButtonText}>
            {checkingUpdate ? t('settingsScreen.checking') : t('settingsScreen.checkUpdates')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleReset}
        >
          <Text style={styles.resetButtonText}>{t('settings.reinitialiser')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? t('settingsScreen.saving') : t('settingsScreen.saveButton')}
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
              <Text style={styles.modalTitle}>{t('settingsScreen.changePassword')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('settings.motDePasseActuel')}</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.currentPassword}
                  onChangeText={(value) => setPasswordData(prev => ({ ...prev, currentPassword: value }))}
                  placeholder={t('settings.entrezVotreMotDePasse')}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('settings.nouveauMotDePasse')}</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.newPassword}
                  onChangeText={(value) => setPasswordData(prev => ({ ...prev, newPassword: value }))}
                  placeholder={t('settings.entrezVotreNouveauMotDe')}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('settingsScreen.confirmerLeMotDePasse')}</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.confirmPassword}
                  onChangeText={(value) => setPasswordData(prev => ({ ...prev, confirmPassword: value }))}
                  placeholder={t('settings.confirmezVotreNouveauMotDe')}
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
                  <Text style={styles.modalButtonTextCancel}>{t('settingsScreen.annuler')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  <Text style={styles.modalButtonTextSave}>
                    {changingPassword ? t('settingsScreen.processingShort') : t('settingsScreen.register')}
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
  updateButton: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#4caf50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  updateButtonText: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: '600',
  },
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