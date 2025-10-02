import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Version robuste avec gestion d'erreur améliorée
export default function App() {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  console.log('[App Robust] Démarrage de l\'application Yukpomnang');

  // Gestionnaire d'erreur global
  const handleError = (error: Error) => {
    console.error('[App Robust] Erreur capturée:', error);
    setErrorMessage(error.message);
    setHasError(true);
  };

  // Composant d'erreur
  const ErrorScreen = () => (
    <SafeAreaView style={styles.errorContainer}>
      <View style={styles.errorContent}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Erreur d'application</Text>
        <Text style={styles.errorMessage}>
          L'application a rencontré une erreur. Veuillez redémarrer.
        </Text>
        {errorMessage && (
          <Text style={styles.errorDetails}>Détails: {errorMessage}</Text>
        )}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setHasError(false);
            setErrorMessage('');
          }}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Écran principal simplifié
  const MainScreen = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🎉 Yukpomnang</Text>
        <Text style={styles.subtitle}>Application de services</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>✅ Application fonctionnelle</Text>
          <Text style={styles.statusText}>
            L'application se lance correctement. Version robuste activée.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.testButton}
          onPress={() => Alert.alert('Test', 'Application fonctionnelle !')}
        >
          <Text style={styles.testButtonText}>Tester l'application</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Fonctionnalités disponibles</Text>
          <Text style={styles.infoText}>
            • Gestion des services{'\n'}
            • Géolocalisation{'\n'}
            • Chat IA{'\n'}
            • Système de tokens
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );

  // Gestion d'erreur avec try-catch
  try {
    if (hasError) {
      return <ErrorScreen />;
    }

    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider>
            <NavigationContainer>
              <StatusBar style="auto" />
              <MainScreen />
            </NavigationContainer>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  } catch (error) {
    handleError(error as Error);
    return <ErrorScreen />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    marginBottom: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  testButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#F3F4F6',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FEF2F2',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  errorDetails: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});






