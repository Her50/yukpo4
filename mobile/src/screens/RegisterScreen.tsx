// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { APP_CONFIG } from '../config/appConfig';
import { authApi } from '../services/api';

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation();
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

  const handleChange = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    // Validation du mot de passe
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setError("Mot de passe trop faible : 8 caractères, 1 majuscule, 1 chiffre minimum.");
      setLoading(false);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    if (!form.email || !form.password || !form.nom) {
      setError("Veuillez remplir tous les champs obligatoires.");
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
        await AsyncStorage.setItem('auth_token', response.data.token);

        // Sauvegarder le solde de tokens
        if (response.data.tokens_balance !== undefined) {
          await AsyncStorage.setItem('tokens_balance', response.data.tokens_balance.toString());
          console.log('[RegisterScreen] Solde initial sauvegardé:', response.data.tokens_balance);
        }

        Alert.alert(
          'Inscription réussie',
          'Votre compte a été créé avec succès !',
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
        setError(response.error || 'Erreur lors de l\'inscription');
      }
    } catch (error: any) {
      console.error('[RegisterScreen] Erreur lors de l\'inscription:', error);
      setError('Erreur de connexion au serveur. Vérifiez votre connexion internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    navigation.navigate('Login' as never);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez la communauté Yukpo</Text>

          {/* Formulaire d'inscription */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nom *</Text>
              <TextInput
                style={styles.input}
                value={form.nom}
                onChangeText={(value) => handleChange('nom', value)}
                placeholder="Votre nom"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Prénom</Text>
              <TextInput
                style={styles.input}
                value={form.prenom}
                onChangeText={(value) => handleChange('prenom', value)}
                placeholder="Votre prénom"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(value) => handleChange('email', value)}
                placeholder="votre@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Mot de passe *</Text>
              <TextInput
                style={styles.input}
                value={form.password}
                onChangeText={(value) => handleChange('password', value)}
                placeholder="Votre mot de passe"
                secureTextEntry
              />
              <Text style={styles.passwordHint}>
                8 caractères minimum, 1 majuscule, 1 chiffre
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirmer le mot de passe *</Text>
              <TextInput
                style={styles.input}
                value={form.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
                placeholder="Confirmez votre mot de passe"
                secureTextEntry
              />
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
                <Text style={styles.registerButtonText}>Créer mon compte</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleLogin} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Déjà un compte ? <Text style={styles.loginLinkText}>Se connecter</Text>
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
