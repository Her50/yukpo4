// @ts-nocheck
// Écran de connexion ultra-moderne avec gradients et glassmorphism
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Envelope, Lock, WarningCircle } from 'phosphor-react-native';
import * as React from 'react';
import { useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Card, Paragraph, TextInput, Title } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { modernColors, modernStyles, modernTheme } from '../../theme/modernTheme';

const { width, height } = Dimensions.get('window');
// TODO: Ajouter les packages OAuth pour React Native
// import * as WebBrowser from 'expo-web-browser';
// import * as Google from 'expo-auth-session/providers/google';
// import * as Facebook from 'expo-auth-session/providers/facebook';

const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const { login, loading } = useAuth();

  // États du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // TODO: Configuration OAuth (à implémenter quand les packages seront disponibles)
  // const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({...});
  // const [facebookRequest, facebookResponse, facebookPromptAsync] = Facebook.useAuthRequest({...});

  // Fonction de connexion OAuth
  const handleOAuthLogin = async (provider: string, token: string) => {
    try {
      setFormLoading(true);
      setError(null);

      const response = await fetch('/auth/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: token, provider }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          await login(data.email, data.password); // Utiliser les credentials du OAuth
          Alert.alert('Succès', `Bienvenue ${data.email} ! Vous êtes connecté.`);
        }
      } else {
        throw new Error('Erreur OAuth');
      }
    } catch (error) {
      console.error('Erreur OAuth:', error);
      Alert.alert('Erreur', 'Connexion échouée.');
    } finally {
      setFormLoading(false);
    }
  };

  // Connexion classique
  const handleLogin = async () => {
    console.log('[LoginScreen] handleLogin appelé');

    if (!email || !password) {
      console.log('[LoginScreen] Champs manquants');
      setError('Veuillez remplir tous les champs');
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
      setError(error.message || 'Erreur de connexion');
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
          <Text style={styles.oauthButtonText}>Continuer avec {label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={modernColors.primaryGradient}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Title style={styles.title}>
              Connexion{' '}
              <Text style={styles.yukpoText}>Yukpo</Text>
            </Title>
            <Paragraph style={styles.subtitle}>
              Connectez-vous avec votre compte{' '}
              <Text style={styles.bold}>Google</Text> ou{' '}
              <Text style={styles.bold}>Facebook</Text>
            </Paragraph>
          </View>

          {/* Messages d'état avec glassmorphism */}
          {showLogoutMessage && (
            <View style={styles.glassCard}>
              <Card style={styles.successCard}>
                <Card.Content style={styles.successContent}>
                  <CheckCircle size={24} color={modernColors.success} weight="fill" />
                  <Text style={styles.successText}>Vous êtes bien déconnecté.</Text>
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
              onPress={() => Alert.alert('OAuth', 'Fonctionnalité Google à implémenter')}
            />
            <OAuthButton
              provider="facebook"
              onPress={() => Alert.alert('OAuth', 'Fonctionnalité Facebook à implémenter')}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou utilisez vos identifiants :</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Formulaire de connexion */}
          <Card style={styles.formCard}>
            <Card.Content>
              <TextInput
                label="Adresse email"
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
                label="Mot de passe"
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
                    {formLoading || loading ? 'Connexion...' : 'Se connecter'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Card.Content>
          </Card>

          {/* Lien vers l'inscription */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas encore inscrit ? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register' as never)}>
              <Text style={styles.footerLink}>Créer un compte</Text>
            </TouchableOpacity>
          </View>


          {/* Informations de support */}
          <View style={styles.supportContainer}>
            <Text style={styles.supportText}>
              En cas de problème, contactez notre support à support@yukpo.com
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: modernStyles.spacing.md,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  yukpoText: {
    color: '#FFD700',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: modernStyles.borderRadius.large,
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
});

export default LoginScreen;









