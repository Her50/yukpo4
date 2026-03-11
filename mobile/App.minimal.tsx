/**
 * VERSION MINIMALE POUR DIAGNOSTIC DE CRASH
 * Cette version charge le strict minimum pour identifier le problème
 */

import * as React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const MinimalApp = () => {
  const [step, setStep] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const testSteps = async () => {
      try {
        // Étape 1: App démarre
        console.log('[MinimalApp] ✅ Étape 1: React fonctionne');
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep(2);

        // Étape 2: Test polyfills
        console.log('[MinimalApp] ✅ Étape 2: Test polyfills...');
        require('./polyfills');
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep(3);

        // Étape 3: Test AsyncStorage
        console.log('[MinimalApp] ✅ Étape 3: Test AsyncStorage...');
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('test_key', 'test_value');
        await AsyncStorage.removeItem('test_key');
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep(4);

        // Étape 4: Test Navigation
        console.log('[MinimalApp] ✅ Étape 4: Test Navigation...');
        const { NavigationContainer } = require('@react-navigation/native');
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep(5);

        // Étape 5: Test AuthContext
        console.log('[MinimalApp] ✅ Étape 5: Test AuthContext...');
        const { AuthProvider } = require('./src/contexts/AuthContext');
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep(6);

        console.log('[MinimalApp] ✅ TOUS LES TESTS RÉUSSIS !');
      } catch (err: any) {
        const errorMsg = `Erreur à l'étape ${step}: ${err?.message || String(err)}`;
        console.error('[MinimalApp] ❌', errorMsg);
        console.error('[MinimalApp] Stack:', err?.stack);
        setError(errorMsg);
      }
    };

    testSteps();
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorTitle}>Crash détecté !</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.hint}>
          Le crash se produit à l'étape {step}. Vérifiez les logs pour plus de détails.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.title}>Test de diagnostic</Text>
        <Text style={styles.step}>Étape {step}/6</Text>
        <Text style={styles.description}>
          {step === 1 && 'Démarrage de React...'}
          {step === 2 && 'Chargement des polyfills...'}
          {step === 3 && 'Test AsyncStorage...'}
          {step === 4 && 'Test Navigation...'}
          {step === 5 && 'Test AuthContext...'}
          {step === 6 && '✅ Tous les tests réussis !'}
        </Text>
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 10,
  },
  step: {
    fontSize: 18,
    color: '#6366F1',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default MinimalApp;
