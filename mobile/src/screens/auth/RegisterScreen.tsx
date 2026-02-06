// @ts-nocheck
// Migration vers Lucide React Native pour un design moderne
import { useNavigation } from '@react-navigation/native';
import { CheckCircle, Envelope, WarningCircle } from 'phosphor-react-native';
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Card, Paragraph, TextInput, Title } from 'react-native-paper';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../theme/theme';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Linking from 'expo-linking';
import { API_BASE_URL } from '../../config/api';

// Configuration WebBrowser pour OAuth
WebBrowser.maybeCompleteAuthSession();

interface RegisterForm {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation();
  const { register, loading, updateUser } = useAuth();

  // États du formulaire
  const [form, setForm] = useState<RegisterForm>({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Configuration Google OAuth
  // ✅ CORRECTION ALIGNEMENT: Utiliser Linking.createURL() pour garantir l'alignement avec app.config.js
  const redirectUri = Linking.createURL('/');
  
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com',
    redirectUri: redirectUri, // ✅ Forcer le redirect URI pour garantir l'alignement
  });

  // 🔍 Debug: Log de la configuration OAuth
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
      let errorMessage = 'Erreur de connexion Google. Veuillez réessayer.';
      
      if (googleResponse.error?.code === 'invalid_request' || 
          googleResponse.error?.message?.includes('Custom URI scheme') ||
          googleResponse.error?.message?.includes('invalid_request')) {
        errorMessage = 'Configuration OAuth manquante. Le schéma URI personnalisé n\'est pas activé pour Android.\n\n' +
          'URI utilisée: ' + (googleRequest?.redirectUri || 'non définie') + '\n\n' +
          'Veuillez consulter le guide: mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md';
      } else if (googleResponse.error?.code === 'access_denied') {
        errorMessage = 'Connexion Google annulée.';
      } else if (googleResponse.error?.code === 'popup_closed') {
        errorMessage = 'La fenêtre de connexion a été fermée.';
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
          Alert.alert('Succès', `Bienvenue ! Votre compte a été créé avec Google.`);
        } else {
          throw new Error('Token non reçu du serveur');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur OAuth');
      }
    } catch (error: any) {
      console.error('[RegisterScreen] Erreur OAuth:', error);
      setError(error.message || 'Inscription échouée. Veuillez réessayer.');
      Alert.alert('Erreur', error.message || 'Inscription échouée.');
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
          'Veuillez définir EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID dans vos variables d\'environnement.\n\n' +
          'Consultez: mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md';
        setError(errorMsg);
        Alert.alert('Configuration requise', errorMsg);
        setFormLoading(false);
        return;
      }
      
      await googlePromptAsync();
    } catch (error: any) {
      console.error('[RegisterScreen] Erreur lors du lancement Google OAuth:', error);
      let errorMessage = 'Impossible de lancer l\'inscription Google. Veuillez réessayer.';
      
      if (error?.message?.includes('Custom URI scheme') || error?.message?.includes('invalid_request')) {
        errorMessage = 'Configuration OAuth manquante. Le schéma URI personnalisé n\'est pas activé pour Android.\n\n' +
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
      return "Mot de passe trop faible : 8 caractères, 1 majuscule, 1 chiffre minimum.";
    }
    return null;
  };

  // Inscription classique
  const handleRegister = async () => {
    // Validation des champs
    if (!form.nom || !form.prenom || !form.email || !form.password || !form.confirmPassword) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    // Validation du mot de passe
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setError(null);
    setFormLoading(true);

    try {
      // Logique identique au frontend
      const response = await register({
        name: `${form.nom} ${form.prenom}`.trim(),
        email: form.email,
        password: form.password,
      });

      console.log('[RegisterScreen] Réponse inscription:', response);

      // Si l'inscription réussit, afficher le message de succès (comme le frontend)
      if (response.success) {
        console.log('[RegisterScreen] Inscription réussie, utilisateur défini dans AuthContext');
        setRegistrationSuccess(true);
      } else {
        throw new Error('Erreur lors de l\'inscription');
      }
    } catch (error: any) {
      console.error('[RegisterScreen] Erreur inscription:', error);

      // Détection des erreurs spécifiques
      let errorMessage = error.message || 'Erreur lors de l\'inscription';

      // Email déjà utilisé (409 Conflict)
      if (error.message?.includes('409') || error.message?.includes('deja utilise') || error.message?.includes('already exists')) {
        errorMessage = '❌ Cet email est déjà utilisé. Essayez de vous connecter ou utilisez un autre email.';
      }
      // Erreur de validation (400 Bad Request)
      else if (error.message?.includes('400') || error.message?.includes('validation')) {
        errorMessage = '❌ Données invalides. Vérifiez vos informations.';
      }
      // Erreur réseau
      else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = '❌ Problème de connexion. Vérifiez votre internet.';
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
        <Text style={styles.oauthButtonText}>Continuer avec {label}</Text>
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
                Inscription réussie ! 🎉
              </Title>

              <Paragraph style={styles.successText}>
                Votre compte{' '}
                <Text style={styles.successEmail}>{form.email}</Text>{' '}
                a été créé avec succès.
              </Paragraph>

              <Paragraph style={styles.successSubtext}>
                Vous pouvez maintenant vous connecter pour accéder à toutes les fonctionnalités de Yukpo.
              </Paragraph>

              <View style={styles.successActions}>
                <TouchableOpacity
                  onPress={goToLogin}
                  style={styles.successButton}
                >
                  <Text style={styles.successButtonLabel}>
                    Se connecter maintenant →
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('Home' as never)}
                  style={styles.homeButton}
                >
                  <Text style={styles.homeButtonLabel}>
                    Retour à l'accueil
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.supportText}>
                En cas de problème, contactez notre support à support@yukpo.com
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
            Créer un compte{' '}
            <Text style={styles.yukpoText}>Yukpo</Text>
          </Title>
          <Paragraph style={styles.subtitle}>
            Utilisez votre compte{' '}
            <Text style={styles.bold}>Google</Text> ou{' '}
            <Text style={styles.bold}>Facebook</Text> pour vous inscrire rapidement :
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
            onPress={() => Alert.alert('OAuth', 'Fonctionnalité Facebook à implémenter')}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou créez un compte manuellement</Text>
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
              label="Nom de famille"
              value={form.nom}
              onChangeText={(text) => setForm({ ...form, nom: text })}
              disabled={formLoading || loading}
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
            />

            <TextInput
              label="Prénom"
              value={form.prenom}
              onChangeText={(text) => setForm({ ...form, prenom: text })}
              disabled={formLoading || loading}
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
            />

            <TextInput
              label="Adresse email"
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              disabled={formLoading || loading}
              style={styles.input}
              left={<TextInput.Icon icon="email" />}
            />

            <TextInput
              label="Mot de passe"
              value={form.password}
              onChangeText={(text) => setForm({ ...form, password: text })}
              secureTextEntry
              disabled={formLoading || loading}
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
            />

            <TextInput
              label="Confirmer le mot de passe"
              value={form.confirmPassword}
              onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
              secureTextEntry
              disabled={formLoading || loading}
              style={styles.input}
              left={<TextInput.Icon icon="lock-check" />}
            />

            <Text style={styles.passwordHint}>
              Mot de passe requis : 8 caractères, 1 majuscule, 1 chiffre.
            </Text>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={formLoading || loading}
              style={styles.registerButton}
            >
              <Text style={styles.registerButtonLabel}>
                {formLoading || loading ? 'Création du compte...' : 'Créer mon compte'}
              </Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Lien vers la connexion */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Vous avez déjà un compte ? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
            <Text style={styles.footerLink}>Connectez-vous</Text>
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
  yukpoText: {
    color: '#FF8C00', // Orange comme le frontend
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






