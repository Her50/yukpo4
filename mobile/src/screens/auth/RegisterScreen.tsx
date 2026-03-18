// @ts-nocheck
// Migration vers Lucide React Native pour un design moderne
import { useNavigation } from '@react-navigation/native';
import * as Google from 'expo-auth-session/providers/google';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle, Envelope, WarningCircle } from 'phosphor-react-native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Card, Paragraph, TextInput, Title } from 'react-native-paper';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { useToaster } from '../../components/ToasterProvider';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { theme } from '../../theme/theme';

// Configuration WebBrowser pour OAuth
WebBrowser.maybeCompleteAuthSession();

interface RegisterForm {
  nom: string;
  prenom: string;
  email: string;
  phone: string;
  phoneCountry: string;
  password: string;
  confirmPassword: string;
}

// Indicatifs téléphoniques par pays africain francophone
const COUNTRY_CODES = [
  { code: 'CM', label: '\uD83C\uDDE8\uD83C\uDDF2 Cameroun', prefix: '+237' },
  { code: 'CI', label: t('register.coteDivoire'), prefix: '+225' },
  { code: 'SN', label: t('register.senegal'), prefix: '+221' },
  { code: 'CD', label: '\uD83C\uDDE8\uD83C\uDDE9 RD Congo', prefix: '+243' },
  { code: 'GA', label: '\uD83C\uDDEC\uD83C\uDDE6 Gabon', prefix: '+241' },
  { code: 'BF', label: '\uD83C\uDDE7\uD83C\uDDEB Burkina Faso', prefix: '+226' },
  { code: 'ML', label: '\uD83C\uDDF2\uD83C\uDDF1 Mali', prefix: '+223' },
  { code: 'GN', label: t('register.guinee'), prefix: '+224' },
  { code: 'TD', label: '\uD83C\uDDF9\uD83C\uDDE9 Tchad', prefix: '+235' },
  { code: 'CG', label: '\uD83C\uDDE8\uD83C\uDDEC Congo', prefix: '+242' },
  { code: 'FR', label: '\uD83C\uDDEB\uD83C\uDDF7 France', prefix: '+33' },
  { code: 'BE', label: '\uD83C\uDDE7\uD83C\uDDEA Belgique', prefix: '+32' },
];

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation();
  const { register, loading, updateUser } = useAuth();
  const { t } = useLanguageSafe();
  const toaster = useToaster();

  // États du formulaire
  const [form, setForm] = useState<RegisterForm>({
    nom: '',
    prenom: '',
    email: '',
    phone: '',
    phoneCountry: 'CM',
    password: '',
    confirmPassword: '',
  });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Configuration Google OAuth
  // ✅ CORRECTION ALIGNEMENT: Utiliser Linking.createURL() pour garantir l'alignement avec app.config.js
  const redirectUri = Linking.createURL('/');

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '376093909298-nd9ss04u338rpr0d3mdk1t8g5u9o35hq.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '376093909298-j8mqqo5ddokjr4rj66955in8fr2nlc89.apps.googleusercontent.com',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '376093909298-fghg1v2quhl3eb0pj1lq21s6sdfshska.apps.googleusercontent.com',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '376093909298-nd9ss04u338rpr0d3mdk1t8g5u9o35hq.apps.googleusercontent.com',
    redirectUri: redirectUri, // ✅ Forcer le redirect URI pour garantir l'alignement
  });

  // \uD83D\uDD0D Debug: Log de la configuration OAuth
  useEffect(() => {
    if (googleRequest) {
      console.log('[OAuth Debug] Request:', JSON.stringify(googleRequest, null, 2));
      console.log('[OAuth Debug] Redirect URI (forcé):', redirectUri);
      console.log('[OAuth Debug] Redirect URI (request):', googleRequest.redirectUri);
      console.log('[OAuth Debug] Platform:', Platform.OS);
      console.log('[OAuth Debug] Android Client ID:', process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
      console.log('[OAuth Debug] Expo Client ID:', process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
      console.log('[OAuth Debug] Linking.createURL("/"):', Linking.createURL('/'));
    }
  }, [googleRequest, redirectUri]);

  // Gérer la réponse Google OAuth
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.authentication || {};
      if (id_token) {
        handleOAuthRegister('google', id_token);
      }
    } else if (googleResponse?.type === 'error') {
      console.error('[RegisterScreen] Erreur Google OAuth complète:', JSON.stringify(googleResponse, null, 2));
      console.error('[RegisterScreen] Code erreur:', googleResponse.error?.code);
      console.error('[RegisterScreen] Message erreur:', googleResponse.error?.message);
      console.error('[RegisterScreen] URL erreur:', googleResponse.error?.url);

      // Messages d'erreur spécifiques selon le type d'erreur
      let errorMessage = t('auth.serverError');

      if (googleResponse.error?.code === 'invalid_request' ||
        googleResponse.error?.message?.includes('Custom URI scheme') ||
        googleResponse.error?.message?.includes('invalid_request')) {
        errorMessage = t('registerScreen.configurationOauthManquanteLeSchemaUriPersonnalise') +
          t('registerScreen.uriUtilisee') + (googleRequest?.redirectUri || t('register.nonDefinie')) + '\n\n' +
          'Veuillez consulter le guide: mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md';
      } else if (googleResponse.error?.code === 'access_denied') {
        errorMessage = t('registerScreen.connexionGoogleAnnulee');
      } else if (googleResponse.error?.code === 'popup_closed') {
        errorMessage = t('registerScreen.laFenetreDeConnexionAEte');
      }

      setError(errorMessage);
      setFormLoading(false);
    }
  }, [googleResponse]);

  // Fonction d'inscription OAuth (le backend crée automatiquement le compte si nécessaire)
  const handleOAuthRegister = async (provider: string, token: string) => {
    try {
      setFormLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/auth/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: token, provider }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          // Sauvegarder le token et mettre à jour le contexte d'authentification
          const { jwtDecode } = await import('../../utils/jwtDecode');
          const SafeStorage = (await import('../../utils/safeStorage')).default;
          await SafeStorage.setItem('auth_token', data.token);

          // Décoder le token pour obtenir les informations utilisateur
          const decoded = jwtDecode(data.token);

          // Mettre à jour le contexte d'authentification
          updateUser({
            id: String(decoded.sub),
            email: decoded.email,
            name: decoded.name || decoded.email?.split('@')[0] || 'Utilisateur',
            token: data.token,
            credits: decoded.tokens_balance ?? 0,
            role: decoded.role || 'user',
          });

          setRegistrationSuccess(true);
          toaster.success(t('auth.welcomeOAuth'));
        } else {
          throw new Error(t('registerScreen.tokenNonRecuDuServeur'));
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur OAuth');
      }
    } catch (error: any) {
      console.error('[RegisterScreen] Erreur OAuth:', error);
      setError(error.message || t('auth.registerError'));
      Alert.alert(t('message.error'), error.message || t('auth.registerError'));
    } finally {
      setFormLoading(false);
    }
  };

  // Fonction pour déclencher l'inscription Google
  const handleGoogleRegister = async () => {
    try {
      setFormLoading(true);
      setError(null);

      // Vérifier que le Client ID Android est configuré sur Android
      if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
        const errorMsg = 'Configuration OAuth Android manquante.\n\n' +
          t('registerScreen.veuillezDefinirExpopublicgoogleandroidclientidDansVosVa') +
          'Consultez: mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md';
        setError(errorMsg);
        Alert.alert('Configuration requise', errorMsg);
        setFormLoading(false);
        return;
      }

      await googlePromptAsync();
    } catch (error: any) {
      console.error('[RegisterScreen] Erreur lors du lancement Google OAuth:', error);
      let errorMessage = t('registerScreen.impossibleDeLancerLinscriptionGoogleVeuillezReessayer');

      if (error?.message?.includes('Custom URI scheme') || error?.message?.includes('invalid_request')) {
        errorMessage = t('registerScreen.configurationOauthManquanteLeSchemaUriPersonnalise') +
          'Veuillez consulter le guide: mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md';
      }

      setError(errorMessage);
      Alert.alert('Erreur OAuth', errorMessage);
      setFormLoading(false);
    }
  };

  // Validation du mot de passe
  const validatePassword = (password: string): string | null => {
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return t('auth.passwordWeak');
    }
    return null;
  };

  // Obtenir le préfixe du pays sélectionné
  const selectedCountry = COUNTRY_CODES.find(c => c.code === form.phoneCountry) || COUNTRY_CODES[0];

  // Inscription classique
  const handleRegister = async () => {
    // Validation des champs
    if (!form.nom || !form.prenom || !form.email || !form.phone || !form.password || !form.confirmPassword) {
      setError(t('auth.fillAllFields'));
      return;
    }

    // Validation du téléphone (au moins 8 chiffres)
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      setError(t('auth.phoneInvalid'));
      return;
    }

    // Validation du mot de passe
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setError(null);
    setFormLoading(true);

    try {
      const fullPhone = `${selectedCountry.prefix}${phoneDigits}`;

      // Appel API d'inscription avec le téléphone
      const response = await register({
        name: `${form.nom} ${form.prenom}`.trim(),
        email: form.email,
        password: form.password,
        phone: fullPhone,
      });

      console.log('[RegisterScreen] Réponse inscription:', response);

      if (response.success) {
        console.log('[RegisterScreen] Inscription réussie, redirection vers OTP');

        // ✅ Toast de confirmation de création du compte
        toaster.success(t('auth.accountCreatedCheck'));

        // Naviguer vers l'écran de vérification OTP
        const userId = response.data?.id || response.data?.user_id;
        if (userId && form.phone) {
          (navigation as any).navigate('OtpVerification', {
            userId: userId,
            phone: fullPhone,
            phoneCountry: form.phoneCountry,
            email: form.email,
            token: response.data?.token,
          });
        } else {
          // Fallback: afficher succès classique
          setRegistrationSuccess(true);
        }
      } else {
        throw new Error(t('auth.registerError'));
      }
    } catch (error: any) {
      console.error('[RegisterScreen] Erreur inscription:', error);

      let errorMessage = error.message || 'Erreur lors de l\'inscription';

      if (error.message?.includes('409') || error.message?.includes('deja utilise') || error.message?.includes('already exists')) {
        errorMessage = t('auth.emailAlreadyUsed');
      } else if (error.message?.includes('400') || error.message?.includes('validation')) {
        errorMessage = t('auth.invalidData');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = t('auth.connectionProblem');
      }

      setError(errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  // Fonction pour naviguer vers la connexion
  const goToLogin = () => {
    navigation.navigate('Login' as never);
  };

  // Composant OAuth Button avec Lucide
  const OAuthButton = ({ provider, onPress }: { provider: 'google' | 'facebook'; onPress: () => void }) => {
    const isGoogle = provider === 'google';
    const bgColor = isGoogle ? '#DB4437' : '#4267B2';
    const label = isGoogle ? 'Google' : 'Facebook';

    return (
      <TouchableOpacity
        style={[styles.oauthButton, { backgroundColor: bgColor }]}
        onPress={onPress}
        disabled={formLoading || loading}
      >
        <Envelope size={20} color="white" />
        <Text style={styles.oauthButtonText}>{t('auth.continueWith', { provider: label })}</Text>
      </TouchableOpacity>
    );
  };

  // Affichage du message de succès
  if (registrationSuccess) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={styles.successCard}>
            <Card.Content style={styles.successContent}>
              <View style={styles.successIcon}>
                <CheckCircle size={48} color="#4CAF50" />
              </View>

              <Title style={styles.successTitle}>
                {t('auth.registerSuccessTitle')}
              </Title>

              <Paragraph style={styles.successText}>
                {t('auth.accountCreatedFor')}{' '}
                <Text style={styles.successEmail}>{form.email}</Text>
              </Paragraph>

              <Paragraph style={styles.successSubtext}>
                {t('auth.canNowLogin')}
              </Paragraph>

              <View style={styles.successActions}>
                <TouchableOpacity
                  onPress={goToLogin}
                  style={styles.successButton}
                >
                  <Text style={styles.successButtonLabel}>
                    {t('auth.loginNow')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('Home' as never)}
                  style={styles.homeButton}
                >
                  <Text style={styles.homeButtonLabel}>
                    {t('auth.backToHome')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.supportText}>
                {t('auth.supportContact')}
              </Text>
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Title style={styles.title}>
          {t('auth.registerTitle')}{' '}
          <Text style={styles.brandYuk}>Yuk</Text><Text style={styles.brandPo}>po</Text>
        </Title>
        <Paragraph style={styles.subtitle}>
          {t('auth.oauthSubtitle')}
        </Paragraph>
      </View>

      {/* Boutons OAuth */}
      <View style={styles.oauthContainer}>
        <OAuthButton
          provider="google"
          onPress={handleGoogleRegister}
        />
        <OAuthButton
          provider="facebook"
          onPress={() => Alert.alert('OAuth', t('registerScreen.fonctionnaliteFacebookAImplementer'))}
        />
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth.orCreateManually')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Messages d'erreur */}
      {error && (
        <Card style={styles.errorCard}>
          <Card.Content style={styles.errorContent}>
            <WarningCircle size={24} color="#F44336" />
            <Text style={styles.errorText}>{String(error)}</Text>
          </Card.Content>
        </Card>
      )}

      {/* Formulaire d'inscription */}
      <Card style={styles.formCard}>
        <Card.Content>
          <TextInput
            label={t('auth.lastName')}
            value={form.nom}
            onChangeText={(text) => setForm({ ...form, nom: text })}
            disabled={formLoading || loading}
            style={styles.input}
            left={<TextInput.Icon icon="account" />}
          />

          <TextInput
            label={t('auth.firstName')}
            value={form.prenom}
            onChangeText={(text) => setForm({ ...form, prenom: text })}
            disabled={formLoading || loading}
            style={styles.input}
            left={<TextInput.Icon icon="account" />}
          />

          <TextInput
            label={t('auth.emailLabel')}
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            disabled={formLoading || loading}
            style={styles.input}
            left={<TextInput.Icon icon="email" />}
          />

          {/* Numéro de téléphone avec indicatif pays */}
          <View style={styles.phoneRow}>
            <TouchableOpacity
              style={styles.countrySelector}
              onPress={() => setShowCountryPicker(!showCountryPicker)}
              disabled={formLoading || loading}
            >
              <Text style={styles.countrySelectorText}>
                {selectedCountry.prefix}
              </Text>
              <Text style={styles.countrySelectorArrow}>▼</Text>
            </TouchableOpacity>
            <TextInput
              label={t('auth.phonePlaceholder')}
              value={form.phone}
              onChangeText={(text) => setForm({ ...form, phone: text.replace(/\D/g, '') })}
              keyboardType="phone-pad"
              disabled={formLoading || loading}
              style={[styles.input, styles.phoneInput]}
              left={<TextInput.Icon icon="phone" />}
              placeholder="6XXXXXXXX"
            />
          </View>

          {/* Sélecteur de pays (dropdown) */}
          {showCountryPicker && (
            <View style={styles.countryDropdown}>
              <ScrollView style={styles.countryDropdownScroll} nestedScrollEnabled>
                {COUNTRY_CODES.map((country) => (
                  <TouchableOpacity
                    key={country.code}
                    style={[
                      styles.countryItem,
                      form.phoneCountry === country.code && styles.countryItemSelected,
                    ]}
                    onPress={() => {
                      setForm({ ...form, phoneCountry: country.code });
                      setShowCountryPicker(false);
                    }}
                  >
                    <Text style={styles.countryItemText}>
                      {country.label} ({country.prefix})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TextInput
            label={t('auth.passwordLabel')}
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
            secureTextEntry
            disabled={formLoading || loading}
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
          />

          <TextInput
            label={t('auth.confirmPassword')}
            value={form.confirmPassword}
            onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
            secureTextEntry
            disabled={formLoading || loading}
            style={styles.input}
            left={<TextInput.Icon icon="lock-check" />}
          />

          <Text style={styles.passwordHint}>
            {t('auth.passwordHint')}
          </Text>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={formLoading || loading}
            style={styles.registerButton}
          >
            <Text style={styles.registerButtonLabel}>
              {formLoading || loading ? t('message.loading') : t('auth.registerButton')}
            </Text>
          </TouchableOpacity>
        </Card.Content>
      </Card>

      {/* Lien vers la connexion */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.hasAccount')} </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
          <Text style={styles.footerLink}>{t('auth.signIn')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8DC', // Jaune clair comme le frontend
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: theme.colors.text,
  },
  brandYuk: {
    color: '#3B82F6', // Bleu (cohérent avec le logo officiel)
  },
  brandPo: {
    color: '#7C3AED', // Violet (cohérent avec le logo officiel)
  },
  subtitle: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginBottom: 10,
  },
  bold: {
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  oauthContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  oauthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  oauthButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: theme.colors.textSecondary,
    fontSize: 14,
    backgroundColor: '#FFF8DC',
    paddingHorizontal: 8,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
    borderWidth: 1,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  errorText: {
    marginLeft: 8,
    color: '#F44336',
    fontWeight: '500',
  },
  formCard: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  // ✅ NOUVEAU: Styles téléphone avec indicatif pays
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 0,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 4,
    paddingHorizontal: 12,
    height: 56,
    marginTop: 6,
    gap: 4,
  },
  countrySelectorText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  countrySelectorArrow: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  phoneInput: {
    flex: 1,
  },
  countryDropdown: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 16,
    maxHeight: 200,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  countryDropdownScroll: {
    maxHeight: 200,
  },
  countryItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  countryItemSelected: {
    backgroundColor: '#FFF8DC',
  },
  countryItemText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  passwordHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  registerButton: {
    marginTop: 8,
    backgroundColor: '#FF8C00', // Orange comme le frontend
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  registerButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: '#FF8C00',
    fontSize: 14,
    fontWeight: '600',
  },
  // Styles pour la page de succès
  successCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 4,
  },
  successContent: {
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    marginBottom: 16,
  },
  successIconText: {
    fontSize: 48,
    textAlign: 'center',
  },
  oauthIcon: {
    fontSize: 20,
  },
  errorIconText: {
    fontSize: 24,
    marginRight: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.text,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  successEmail: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  successSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  successActions: {
    width: '100%',
    gap: 12,
  },
  successButton: {
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  successButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  homeButton: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  homeButtonLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  supportText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 24,
  },
});

export default RegisterScreen;






