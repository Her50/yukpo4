import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, TextInput, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import * as SplashScreen from 'expo-splash-screen';

// Empêcher l'écran de démarrage de se fermer automatiquement
SplashScreen.preventAutoHideAsync();

const Stack = createStackNavigator();

// Écran de connexion simplifié
const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      // Simuler une connexion
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Succès', 'Connexion réussie !');
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Erreur', 'Connexion échouée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Yukpo</Text>
          <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Écran d'accueil simplifié
const HomeScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>🏠 Accueil</Text>
          <Text style={styles.subtitle}>Bienvenue dans Yukpo !</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.welcomeText}>
            L'application fonctionne correctement ! 🎉
          </Text>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => Alert.alert('Info', 'Fonctionnalité en développement')}
          >
            <Text style={styles.buttonText}>Tester une fonctionnalité</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Écran de chargement
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <Text style={styles.loadingText}>Yukpo</Text>
    <Text style={styles.loadingSubtext}>Chargement...</Text>
  </View>
);

// Composant principal
export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('[App] 🚀 Démarrage de l\'application Yukpo (version minimale)');
        
        // Attendre un délai minimal
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('[App] ✅ Application prête');
        setIsAppReady(true);
        
        // Masquer l'écran de démarrage
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('[App] ❌ Erreur lors de la préparation:', error);
        setHasError(true);
      }
    }

    prepare();
  }, []);

  if (hasError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>❌ Erreur de démarrage</Text>
        <Text style={styles.errorSubtext}>
          L'application a rencontré une erreur. Veuillez redémarrer.
        </Text>
      </View>
    );
  }

  if (!isAppReady) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{
              headerStyle: {
                backgroundColor: '#0F52BA',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          >
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ title: 'Connexion' }}
            />
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ title: 'Accueil' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#0F52BA',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0F52BA',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 20,
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 28,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F52BA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  loadingSubtext: {
    fontSize: 18,
    color: '#F59E0B',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});



