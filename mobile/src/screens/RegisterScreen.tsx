// @ts-nocheck
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { APP_CONFIG } from '../config/appConfig';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { authApi } from '../services/api';
import SafeStorage from '../utils/safeStorage';
// ✅ NOUVEAU: Utiliser KeyboardAwareScreen pour une meilleure gestion du clavier
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import SafeIcon from '../components/SafeIcon';
import { theme } from '../theme/theme';

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguageSafe();
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    lang: "fr",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    // Validation du mot de passe
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setError(t('auth.passwordWeak'));
      setLoading(false);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      setLoading(false);
      return;
    }

    if (!form.email || !form.password || !form.nom) {
      setError(t('auth.fillRequired'));
      setLoading(false);
      return;
    }

    console.log('[RegisterScreen] Tentative d\'inscription pour:', form.email);

    try {
      const userData = {
        nom: form.nom,
        prenom: form.prenom || form.nom,
        name: form.name || form.nom,
        email: form.email,
        password: form.password,
        phone: "",
        lang: form.lang,
      };

      console.log('[RegisterScreen] Données d\'inscription:', { ...userData, password: '***' });

      const response = await authApi.register(userData);

      console.log('[RegisterScreen] Réponse API:', response);

      if (response.success && response.data?.token) {
        console.log('[RegisterScreen] Inscription réussie, token reçu');

        // Sauvegarder le token
        await SafeStorage.setItem('auth_token', response.data.token);

        // Sauvegarder le solde de tokens
        if (response.data.tokens_balance !== undefined) {
          await SafeStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
          console.log('[RegisterScreen] Solde initial sauvegardé:', response.data.tokens_balance);
        }

        Alert.alert(
          t('auth.registerSuccess'),
          t('auth.accountCreated'),
          [
            {
              text: 'OK',
              onPress: () => {
                // Redirection vers l'accueil
                navigation.navigate('Home' as never);
              }
            }
          ]
        );

      } else {
        console.error('[RegisterScreen] Erreur d\'inscription:', response.error);
        setError(response.error || t('auth.registerError'));
      }
    } catch (error: any) {
      console.error('[RegisterScreen] Erreur lors de l\'inscription:', error);
      setError(t('auth.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    navigation.navigate('Login' as never);
  };

  return (
    <KeyboardAwareScreen
      style={styles.container}
      contentContainerStyle={styles.scrollContainer}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.registerTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>

        {/* Formulaire d'inscription */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.lastName')} *</Text>
            <TextInput
              style={styles.input}
              value={form.nom}
              onChangeText={(value) => handleChange('nom', value)}
              placeholder={t('auth.lastNamePlaceholder')}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.firstName')}</Text>
            <TextInput
              style={styles.input}
              value={form.prenom}
              onChangeText={(value) => handleChange('prenom', value)}
              placeholder={t('auth.firstNamePlaceholder')}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.emailLabel')} *</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(value) => handleChange('email', value)}
              placeholder={t('auth.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.passwordLabel')} *</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={styles.passwordInputField}
                value={form.password}
                onChangeText={(value) => handleChange('password', value)}
                placeholder={t('auth.passwordPlaceholder')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <SafeIcon
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.passwordHint}>
              {t('auth.passwordHint')}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('auth.confirmPassword')} *</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={styles.passwordInputField}
                value={form.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
              >
                <SafeIcon
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={22}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>{t('auth.registerButton')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleLogin} style={styles.loginLink}>
          <Text style={styles.loginText}>
            {t('auth.hasAccount')} <Text style={styles.loginLinkText}>{t('auth.signIn')}</Text>
          </Text>
        </TouchableOpacity>

        {/* Debug info */}
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Debug Info:</Text>
          <Text style={styles.debugText}>API URL: {APP_CONFIG.API_BASE_URL}</Text>
        </View>
      </View>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  formContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  passwordInputField: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  errorText: {
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },
  registerButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLinkText: {
    color: '#27ae60',
    fontWeight: '600',
  },
  debugContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});

export default RegisterScreen;
