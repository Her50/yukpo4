// @ts-nocheck
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { APP_CONFIG } from '../config/appConfig';
import { authApi } from '../services/api';
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../utils/safeStorage';

const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  console.log('[LoginScreen] Configuration API:', APP_CONFIG.API_BASE_URL);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);

    console.log('[LoginScreen] Tentative de connexion pour:', email);

    try {
      const response = await authApi.login(email, password);

      console.log('[LoginScreen] R�ponse API:', response);

      if (response.success && response.data?.token) {
        console.log('[LoginScreen] Connexion r�ussie, token re�u');

        // Sauvegarder le token
        await SafeStorage.setItem('auth_token', response.data.token);

        // Sauvegarder le solde de tokens
        if (response.data.tokens_balance !== undefined) {
          await SafeStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
          console.log('[LoginScreen] Solde sauvegard�:', response.data.tokens_balance);
        }

        // Redirection vers l'accueil
        navigation.navigate('Home' as never);

      } else {
        console.error('[LoginScreen] Erreur de connexion:', response.error);
        setError(response.error || 'Erreur de connexion');
      }
    } catch (error: any) {
      console.error('[LoginScreen] Erreur lors de la connexion:', error);
      setError('Erreur de connexion au serveur. V�rifiez votre connexion internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Register' as never);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Connexion Yukpo</Text>

          <Text style={styles.subtitle}>
            Connectez-vous avec votre compte Google ou Facebook
          </Text>

          {/* Boutons OAuth */}
          <TouchableOpacity style={[styles.oauthButton, styles.googleButton]}>
            <Text style={styles.oauthButtonText}>Continuer avec Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.oauthButton, styles.facebookButton]}>
            <Text style={styles.oauthButtonText}>Continuer avec Facebook</Text>
          </TouchableOpacity>

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>ou utilisez vos identifiants :</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* Formulaire de connexion */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Adresse email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Votre email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Mot de passe</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Votre mot de passe"
                secureTextEntry
              />
            </View>

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Se connecter</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleRegister} style={styles.registerLink}>
            <Text style={styles.registerText}>
              Pas encore inscrit ? <Text style={styles.registerLinkText}>Cr�er un compte</Text>
            </Text>
          </TouchableOpacity>

          {/* Debug info */}
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>Debug Info:</Text>
            <Text style={styles.debugText}>API URL: {APP_CONFIG.API_BASE_URL}</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  oauthButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: '#db4437',
  },
  facebookButton: {
    backgroundColor: '#3b5998',
  },
  oauthButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  separatorText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
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
  errorText: {
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    alignItems: 'center',
    marginBottom: 30,
  },
  registerText: {
    fontSize: 14,
    color: '#666',
  },
  registerLinkText: {
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

export default LoginScreen;
