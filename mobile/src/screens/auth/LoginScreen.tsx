import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { TextInput, Button, Card, Title, Paragraph } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../theme/theme';
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
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setError(null);
    setFormLoading(true);

    try {
      await login(email, password);
      console.log('[LoginScreen] Connexion réussie, utilisateur défini dans AuthContext');
      // La navigation est gérée automatiquement par AppNavigator basé sur l'état user
    } catch (error: any) {
      setError(error.message || 'Erreur de connexion');
    } finally {
      setFormLoading(false);
    }
  };

  // Composant OAuth Button
  const OAuthButton = ({ provider, onPress }: { provider: 'google' | 'facebook'; onPress: () => void }) => {
    const isGoogle = provider === 'google';
    const bgColor = isGoogle ? '#DB4437' : '#4267B2';
    const iconName = isGoogle ? 'logo-google' : 'logo-facebook';
    const label = isGoogle ? 'Google' : 'Facebook';

    return (
      <TouchableOpacity
        style={[styles.oauthButton, { backgroundColor: bgColor }]}
        onPress={onPress}
        disabled={formLoading || loading}
      >
        <Ionicons name={iconName} size={20} color="white" />
        <Text style={styles.oauthButtonText}>Continuer avec {label}</Text>
      </TouchableOpacity>
    );
  };

  return (
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

        {/* Messages d'état */}
        {showLogoutMessage && (
          <Card style={styles.successCard}>
            <Card.Content style={styles.successContent}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.successText}>Vous êtes bien déconnecté.</Text>
            </Card.Content>
          </Card>
        )}

        {error && (
          <Card style={styles.errorCard}>
            <Card.Content style={styles.errorContent}>
              <Ionicons name="alert-circle" size={24} color="#F44336" />
              <Text style={styles.errorText}>{error}</Text>
            </Card.Content>
          </Card>
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
              style={styles.input}
              left={<TextInput.Icon icon="email" />}
            />
            
            <TextInput
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              disabled={formLoading || loading}
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
            />
            
            <TouchableOpacity
              onPress={handleLogin}
              disabled={formLoading || loading}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonLabel}>
                {formLoading || loading ? 'Connexion...' : 'Se connecter'}
              </Text>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: theme.colors.text,
  },
  yukpoText: {
    color: '#FF8C00',
  },
  subtitle: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  bold: {
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  successCard: {
    marginBottom: 16,
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  successContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  successText: {
    marginLeft: 8,
    color: '#4CAF50',
    fontWeight: '500',
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
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
  },
  formCard: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  loginButton: {
    marginTop: 8,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
    marginBottom: 20,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  supportContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  supportText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default LoginScreen;







