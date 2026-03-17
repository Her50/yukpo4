// @ts-nocheck
// Écran dédié au changement de mot de passe pour un accès direct depuis le profil
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiPost } from '../services/api';
import { theme } from '../theme/theme';
import SafeIcon from '../components/SafeIcon';

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguageSafe();
  
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async () => {
    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert(t('message.error'), t('settings.allFieldsRequired'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert(t('message.error'), t('settings.passwordMismatch'));
      return;
    }

    if (passwordData.newPassword.length < 8) {
      Alert.alert(t('message.error'), t('settings.passwordTooShort'));
      return;
    }

    // Validation de la complexité du mot de passe
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(passwordData.newPassword)) {
      Alert.alert(
        t('message.error'), 
        t('settings.passwordComplexity') || 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.'
      );
      return;
    }

    try {
      setLoading(true);

      const response = await apiPost('/api/users/change-password', {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      });

      if (response.success) {
        Alert.alert(
          t('message.success'), 
          t('settings.passwordChanged') || 'Mot de passe changé avec succès',
          [
            {
              text: 'OK',
              onPress: () => {
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        throw new Error(response.error || t('settings.passwordChangeError'));
      }
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      Alert.alert(t('message.error'), error.message || t('settings.passwordChangeError'));
    } finally {
      setLoading(false);
    }
  };

  const updatePasswordData = (field: keyof PasswordData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <SafeNativeView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <SafeIcon name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.changePassword')}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <SafeIcon name="info" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            {t('settings.passwordInfo') || 'Pour des raisons de sécurité, veuillez saisir votre mot de passe actuel.'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t('settings.currentPassword') || 'Mot de passe actuel'}
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={passwordData.currentPassword}
                onChangeText={(value) => updatePasswordData('currentPassword', value)}
                placeholder={t('settings.enterCurrentPassword') || 'Entrez votre mot de passe actuel'}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <SafeIcon 
                  name={showCurrentPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color={theme.colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t('settings.newPassword') || 'Nouveau mot de passe'}
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={passwordData.newPassword}
                onChangeText={(value) => updatePasswordData('newPassword', value)}
                placeholder={t('settings.enterNewPassword') || 'Entrez votre nouveau mot de passe'}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <SafeIcon 
                  name={showNewPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color={theme.colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {t('settings.passwordRequirements') || '8 caractères minimum, 1 majuscule, 1 chiffre'}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t('settings.confirmPassword') || 'Confirmer le mot de passe'}
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={passwordData.confirmPassword}
                onChangeText={(value) => updatePasswordData('confirmPassword', value)}
                placeholder={t('settings.confirmNewPassword') || 'Confirmez votre nouveau mot de passe'}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <SafeIcon 
                  name={showConfirmPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color={theme.colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.changeButton, loading && styles.disabledButton]}
            onPress={handleChangePassword}
            disabled={loading}
          >
            <Text style={styles.changeButtonText}>
              {loading ? '⏳...' : '🔐 ' + (t('settings.changePassword') || 'Changer le mot de passe')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeNativeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
    marginLeft: 10,
    lineHeight: 20,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: theme.colors.text,
  },
  eyeButton: {
    padding: 15,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 5,
    fontStyle: 'italic',
  },
  changeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: theme.colors.border,
  },
  changeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChangePasswordScreen;
