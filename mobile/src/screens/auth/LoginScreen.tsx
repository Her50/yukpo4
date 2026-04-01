// @ts-nocheck
// Écran de connexion ultra-moderne avec gradients et glassmorphism
import { useNavigation } from '@react-navigation/native';
import * as Google from 'expo-auth-session/providers/google';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle, Envelope, Lock, WarningCircle } from 'phosphor-react-native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Card, Paragraph, TextInput, Title } from 'react-native-paper';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { modernColors, modernStyles, modernTheme } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import SmartLanguageSelector from '../../components/SmartLanguageSelector';

// Configuration WebBrowser pour OAuth
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (error) {
  console.warn('[LoginScreen] maybeCompleteAuthSession indisponible:', error);
}

const { width, height } = Dimensions.get('window');

const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguageSafe();
  const { login, loading, updateUser } = useAuth();

  // États du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Configuration Google OAuth
  // Note: Le GOOGLE_CLIENT_ID doit être configuré dans les variables d'environnement
  // Pour mobile, utilisez le client ID Android ou iOS selon la plateforme
  // ✅ CORRECTION ALIGNEMENT: Utiliser Linking.createURL() pour garantir l'alignement avec app.config.js
  const redirectUri = Linking.createURL('/');

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '376093909298-nd9ss04u338rpr0d3mdk1t8g5u9o35hq.apps.googleusercontent.com',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '376093909298-j8mqqo5ddokjr4rj66955in8fr2nlc89.apps.googleusercontent.com',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '376093909298-fghg1v2quhl3eb0pj1lq21s6sdfshska.apps.googleusercontent.com',
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '376093909298-nd9ss04u338rpr0d3mdk1t8g5u9o35hq.apps.googleusercontent.com',
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
      // expo-auth-session retourne idToken (camelCase), pas id_token
      const idToken = (googleResponse.authentication as any)?.idToken
        || (googleResponse.authentication as any)?.id_token;
      if (idToken) {
        handleOAuthLogin('google', idToken);
      }
    } else if (googleResponse?.type === 'error') {
      console.error('[LoginScreen] Erreur Google OAuth complète:', JSON.stringify(googleResponse, null, 2));
      console.error('[LoginScreen] Code erreur:', googleResponse.error?.code);
      console.error('[LoginScreen] Message erreur:', googleResponse.error?.message);
      console.error('[LoginScreen] URL erreur:', googleResponse.error?.url);

      // Messages d'erreur spécifiques selon le type d'erreur
      let errorMessage = t('loginScreen.erreurDeConnexionGoogleVeuillezReessayer');

      if (googleResponse.error?.code === 'invalid_request' ||
        googleResponse.error?.message?.includes('Custom URI scheme') ||
        googleResponse.error?.message?.includes('invalid_request')) {
        errorMessage = t('loginScreen.configurationOauthManquanteLeSchemaUriPersonnalise') +
          t('loginScreen.uriUtilisee') + (googleRequest?.redirectUri || t('login.nonDefinie')) + '\n\n' +
          t('login.consultezLeGuide');
      } else if (googleResponse.error?.code === 'access_denied') {
        errorMessage = t('loginScreen.connexionGoogleAnnulee');
      } else if (googleResponse.error?.code === 'popup_closed') {
        errorMessage = t('loginScreen.laFenetreDeConnexionAEte');
      }

      setError(errorMessage);
      setFormLoading(false);
    }
  }, [googleResponse]);

  // Fonction de connexion OAuth
  const handleOAuthLogin = async (provider: string, token: string) => {
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
            name: decoded.name || decoded.email?.split('@')[0] || t('login.utilisateur'),
            token: data.token,
            credits: decoded.tokens_balance ?? 0,
            role: decoded.role || 'user',
          });

          Alert.alert(t('loginScreen.succes'), t('loginScreen.bienvenueVousEtesConnecteAvecGoogle'));
        } else {
          throw new Error(t('loginScreen.tokenNonRecuDuServeur'));
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || t('login.erreurOauth'));
      }
    } catch (error: any) {
      console.error('[LoginScreen] Erreur OAuth:', error);
      setError(error.message || t('login.connexionEchoueeVeuillezReessayer'));
      Alert.alert(t('login.erreur'), error.message || t('loginScreen.connexionEchouee'));
    } finally {
      setFormLoading(false);
    }
  };

  // Fonction pour déclencher la connexion Google
  const handleGoogleLogin = async () => {
    try {
      setFormLoading(true);
      setError(null);

      // Vérifier que le Client ID Android est configuré sur Android
      if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
        const errorMsg = t('login.configOauthAndroidManquante') +
          t('loginScreen.veuillezDefinirExpopublicgoogleandroidclientidDansVosVa') +
          t('login.consultezGuideOauth');
        setError(errorMsg);
        Alert.alert(t('login.configurationRequise'), errorMsg);
        setFormLoading(false);
        return;
      }

      await googlePromptAsync();
    } catch (error: any) {
      console.error('[LoginScreen] Erreur lors du lancement Google OAuth:', error);
      let errorMessage = t('loginScreen.impossibleDeLancerLaConnexionGoogle');

      if (error?.message?.includes('Custom URI scheme') || error?.message?.includes('invalid_request')) {
        errorMessage = t('loginScreen.configurationOauthManquanteLeSchemaUriPersonnalise') +
          t('login.consultezLeGuide');
      }

      setError(errorMessage);
      Alert.alert(t('login.erreurOauth'), errorMessage);
      setFormLoading(false);
    }
  };

  // Connexion classique
  const handleLogin = async () => {
    console.log('[LoginScreen] handleLogin appelé');

    if (!email || !password) {
      console.log('[LoginScreen] Champs manquants');
      setError(t('loginScreen.veuillezRemplirTousLesChamps'));
      return;
    }

    console.log('[LoginScreen] Champs remplis, démarrage connexion');
    setError(null);
    setFormLoading(true);

    try {
      console.log('[LoginScreen] Tentative de connexion pour:', email);
      console.log('[LoginScreen] Appel de login()...');
      await login(email, password);
      console.log('[LoginScreen] Connexion réussie, utilisateur défini dans AuthContext');
      // La navigation est gérée automatiquement par AppNavigator basé sur l'état user
    } catch (error: any) {
      console.error('[LoginScreen] Erreur de connexion:', error);
      console.error('[LoginScreen] Type d\'erreur:', typeof error);
      console.error('[LoginScreen] Message d\'erreur:', error.message);

      // ✅ CORRIGÉ 2025-12-24: Améliorer le message d'erreur pour l'utilisateur
      let errorMessage = error.message || t('login.erreurDeConnexion');

      // ✅ Messages plus clairs pour les erreurs d'authentification
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Identifiants')) {
        errorMessage = t('login.emailOuMotDePasseIncorrect');
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        errorMessage = t('loginScreen.erreurDeConnexionAuServeurVerifiez');
      }

      setError(errorMessage);
    } finally {
      console.log('[LoginScreen] Fin de handleLogin, setFormLoading(false)');
      setFormLoading(false);
    }
  };

  // Composant OAuth Button ultra-moderne avec gradients
  const OAuthButton = ({ provider, onPress }: { provider: 'google' | 'facebook'; onPress: () => void }) => {
    const isGoogle = provider === 'google';
    const gradientColors = isGoogle ? ['#DB4437', '#EA4335'] : ['#4267B2', '#365899'];
    const label = isGoogle ? 'Google' : 'Facebook';

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={formLoading || loading}
        style={styles.oauthButtonContainer}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.oauthButton}
        >
          <Envelope size={20} color="white" weight="bold" />
          <Text style={styles.oauthButtonText}>{t('login.continuerAvec', { label })}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.gradientContainer}
    >
      <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* ✅ Sélecteur de langue intelligent GPS — coin supérieur droit */}
        <View style={styles.languageSelectorRow}>
          <SmartLanguageSelector compact showCountryHint />
        </View>

        <View style={styles.header}>
          <Title style={styles.title}>
            <Text style={styles.brandYuk}>Yuk</Text><Text style={styles.brandPo}>po</Text>
          </Title>
          <Paragraph style={styles.subtitle}>
            {t('login.connectezVousAvecVotreCompte')}{' '}
            <Text style={styles.bold}>Google</Text> {t('login.ou')}{' '}
            <Text style={styles.bold}>Facebook</Text>
          </Paragraph>
        </View>

        {/* Messages d'état avec glassmorphism */}
        {showLogoutMessage && (
          <View style={styles.glassCard}>
            <Card style={styles.successCard}>
              <Card.Content style={styles.successContent}>
                <CheckCircle size={24} color={modernColors.success} weight="fill" />
                <Text style={styles.successText}>{t('login.vousEtesBienDeconnecte')}</Text>
              </Card.Content>
            </Card>
          </View>
        )}

        {error && (
          <View style={styles.glassCard}>
            <Card style={styles.errorCard}>
              <Card.Content style={styles.errorContent}>
                <WarningCircle size={24} color={modernColors.error} weight="fill" />
                <Text style={styles.errorText}>{String(error)}</Text>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Boutons OAuth */}
        <View style={styles.oauthContainer}>
          <OAuthButton
            provider="google"
            onPress={handleGoogleLogin}
          />
          <OAuthButton
            provider="facebook"
            onPress={() => Alert.alert('OAuth', t('loginScreen.fonctionnaliteFacebookAImplementer'))}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('login.ouUtilisezVosIdentifiants')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Formulaire de connexion */}
        <Card style={styles.formCard}>
          <Card.Content>
            <TextInput
              label={t('loginScreen.adresseEmail')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              disabled={formLoading || loading}
              style={styles.modernInput}
              theme={modernTheme}
              left={<TextInput.Icon icon={() => <Envelope size={20} color={modernColors.primary} weight="bold" />} />}
            />

            <TextInput
              label={t('login.motDePasse')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              disabled={formLoading || loading}
              style={styles.modernInput}
              theme={modernTheme}
              left={<TextInput.Icon icon={() => <Lock size={20} color={modernColors.primary} weight="bold" />} />}
            />

            <TouchableOpacity
              onPress={handleLogin}
              disabled={formLoading || loading}
              style={styles.loginButtonContainer}
            >
              <LinearGradient
                colors={modernColors.secondaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonLabel}>
                  {formLoading || loading ? t('login.connexionEnCours') : t('login.seConnecter')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Lien vers l'inscription */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('login.pasEncoreInscrit')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register' as never)}>
              <Text style={styles.footerLink}>{t('login.creerUnCompte')}</Text>
            </TouchableOpacity>
        </View>

        {/* ✅ NOUVEAU: Bouton Devenir partenaire avec confirmation */}
        <View style={styles.partnerContainer}>
          <TouchableOpacity
            onPress={() => {
              const normalizeAlertText = (value: string) =>
                String(value || '')
                  .replace(/\\\\n/g, '\n')
                  .replace(/\\n/g, '\n')
                  .replace(/\\\\'/g, '\'')
                  .replace(/\\'/g, '\'')
                  .trim();

              // ✅ NOUVEAU: Afficher un modal de confirmation avant de naviguer
              const partnerAlertMessage = [
                normalizeAlertText(t('loginScreen.ceBoutonEstUniquementDestineAuxPartenaires')),
                '',
                t('login.important'),
                `• ${normalizeAlertText(t('loginScreen.lesFonctionnalitesUtilisateursClassiquesNeSeront'))}`,
                `• ${normalizeAlertText(t('loginScreen.votreCompteDevraEtreValideParUn'))}`,
                `• ${normalizeAlertText(t('loginScreen.vousRecevrezUnEmailDeConfirmation'))}`,
                `• ${normalizeAlertText(t('loginScreen.pourLesPrestatairesUtilisezUnCompteNormal'))}`,
                '',
                normalizeAlertText(t('loginScreen.etesvousSurDeVouloirContinuer')),
              ].join('\n');

              Alert.alert(
                t('login.inscriptionPartenaire'),
                partnerAlertMessage,
                [
                  {
                    text: t('common.cancel'),
                    style: 'cancel',
                    onPress: () => {
                      console.log('[LoginScreen] Inscription partenaire annulée par l\'utilisateur');
                    }
                  },
                  {
                    text: t('login.ouiJeSuisPartenaire'),
                    style: 'default',
                    onPress: () => {
                      console.log('[LoginScreen] Confirmation inscription partenaire acceptée');
                      navigation.navigate('PartnerRegister' as never);
                    }
                  }
                ],
                { cancelable: true }
              );
            }}
            style={styles.partnerButton}
          >
            <Text style={styles.partnerButtonText}>
              {t('login.devenirPartenaire')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Informations de support */}
        <View style={styles.supportContainer}>
          <Text style={styles.supportText}>
            {t('login.supportContact')}
          </Text>
        </View>
      </KeyboardAwareScreen>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: modernStyles.spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: modernStyles.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: modernStyles.spacing.md,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  brandYuk: {
    color: '#3B82F6', // Bleu (cohérent avec le logo officiel)
  },
  brandPo: {
    color: '#7C3AED', // Violet (cohérent avec le logo officiel)
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  glassCard: {
    ...modernStyles.glass,
    borderRadius: modernStyles.borderRadius.large,
    marginBottom: modernStyles.spacing.md,
  },
  modernInput: {
    marginBottom: modernStyles.spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: modernStyles.borderRadius.medium,
  },
  oauthButtonContainer: {
    flex: 1,
    marginHorizontal: modernStyles.spacing.xs,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: modernStyles.spacing.md,
    paddingHorizontal: modernStyles.spacing.lg,
    borderRadius: modernStyles.borderRadius.medium,
    gap: modernStyles.spacing.sm,
  },
  loginButtonContainer: {
    marginTop: modernStyles.spacing.sm,
  },
  loginButton: {
    paddingVertical: modernStyles.spacing.md,
    paddingHorizontal: modernStyles.spacing.xl,
    borderRadius: modernStyles.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bold: {
    fontWeight: 'bold',
    color: 'white',
  },
  successCard: {
    backgroundColor: 'transparent',
  },
  successContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  successText: {
    marginLeft: 8,
    color: modernColors.success,
    fontWeight: '500',
  },
  errorCard: {
    backgroundColor: 'transparent',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  errorText: {
    marginLeft: 8,
    color: modernColors.error,
    fontWeight: '500',
  },
  oauthContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: modernStyles.spacing.lg,
    gap: modernStyles.spacing.sm,
  },
  oauthButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: modernStyles.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    marginHorizontal: modernStyles.spacing.md,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    backgroundColor: 'transparent',
    paddingHorizontal: modernStyles.spacing.sm,
  },
  formCard: {
    marginBottom: modernStyles.spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: modernStyles.borderRadius.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: modernStyles.spacing.lg,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  footerLink: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  supportContainer: {
    alignItems: 'center',
    marginTop: modernStyles.spacing.lg,
  },
  supportText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  partnerContainer: {
    marginTop: modernStyles.spacing.md,
    marginBottom: modernStyles.spacing.lg,
    alignItems: 'center',
  },
  partnerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: modernStyles.spacing.sm,
    paddingHorizontal: modernStyles.spacing.lg,
    borderRadius: modernStyles.borderRadius.medium,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  partnerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  languageSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: modernStyles.spacing.sm,
  },
});

export default LoginScreen;









