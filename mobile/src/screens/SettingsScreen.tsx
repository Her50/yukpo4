// Migration vers Lucide React Native pour un design moderne
import { AlertTriangle, BarChart3, Bell, Clock, Eye, Key, Mail, MapPin, Megaphone, ChatCircle, Radio, Shield } from 'phosphor-react-native';
import * as React from 'react';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet, TouchableOpacity, View
} from 'react-native';
import { Avatar, Card, Switch, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';

interface UserSettings {
  // Profil
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

    // Apparence
    theme: 'light',
    fontSize: 'medium',
    compactMode: false,

    // Sécurité
    twoFactorAuth: false,
    sessionTimeout: 30,
    loginAlerts: true,
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simuler la sauvegarde
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mettre à jour l'utilisateur
      updateUser({
        name: settings.name,
        email: settings.email,
        phone: settings.phone,
      });

      Alert.alert('Succès', 'Paramètres sauvegardés avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderProfileSection = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Profil</Text>

        <View style={styles.avatarContainer}>
          <Avatar.Text
            size={80}
            label={getInitials(settings.name)}
            style={styles.avatar}
          />
          <TouchableOpacity
            onPress={() => Alert.alert('Info', 'Fonctionnalité de changement de photo en cours de développement')}
            style={styles.changePhotoButton}
          >
            <Text>Changer la photo</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          label="Nom complet"
          value={settings.name}
          onChangeText={(text) => setSettings(prev => ({ ...prev, name: text }))}
          style={styles.input}
        />

        <TextInput
          label="Email"
          value={settings.email}
          onChangeText={(text) => setSettings(prev => ({ ...prev, email: text }))}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          label="Téléphone"
          value={settings.phone}
          onChangeText={(text) => setSettings(prev => ({ ...prev, phone: text }))}
          keyboardType="phone-pad"
          style={styles.input}
        />

        <TextInput
          label="Bio (optionnel)"
          value={settings.bio}
          onChangeText={(text) => setSettings(prev => ({ ...prev, bio: text }))}
          multiline
          numberOfLines={3}
          style={styles.input}
        />
      </Card.Content>
    </Card>
  );

  const renderNotificationsSection = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Mail size={20} color={theme.colors.primary} />
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
            <Bell size={20} color={theme.colors.primary} />
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
            <ChatCircle size={20} color={theme.colors.primary} />
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
            <Megaphone size={20} color={theme.colors.primary} />
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
      </Card.Content>
    </Card>
  );

  const renderPrivacySection = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Confidentialité</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Eye size={20} color={theme.colors.primary} />
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
            <Text>{settings.profileVisibility}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <MapPin size={20} color={theme.colors.primary} />
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
            <Radio size={20} color={theme.colors.primary} />
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
            <BarChart3 size={20} color={theme.colors.primary} />
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
      </Card.Content>
    </Card>
  );

  const renderSecuritySection = () => (
    <Card style={styles.sectionCard}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Sécurité</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Shield size={20} color={theme.colors.primary} />
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
            <Clock size={20} color={theme.colors.primary} />
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
            <Text>{settings.sessionTimeout}min</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <AlertTriangle size={20} color={theme.colors.primary} />
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
          <Key size={20} color={theme.colors.primary} />
          <Text>Changer le mot de passe</Text>
        </TouchableOpacity>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderProfileSection()}
        {renderNotificationsSection()}
        {renderPrivacySection()}
        {renderSecuritySection()}

        {/* Test de connectivité pour diagnostiquer les problèmes */}

        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={styles.saveButton}
        >
          <Text>Sauvegarder les paramètres</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  sectionCard: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: theme.colors.primary,
    marginBottom: 12,
  },
  changePhotoButton: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
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
  visibilityButton: {
    minWidth: 80,
  },
  timeoutButton: {
    minWidth: 80,
  },
  changePasswordButton: {
    marginTop: 16,
  },
  saveButton: {
    marginTop: 24,
    marginBottom: 32,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
});

export default SettingsScreen;













