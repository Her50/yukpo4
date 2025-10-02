import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Test progressif des dépendances
export default function App() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  console.log('[App Progressive] Test progressif des dépendances');

  const testAsyncStorage = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('test', 'value');
      await AsyncStorage.getItem('test');
      await AsyncStorage.removeItem('test');
      return true;
    } catch (err) {
      setError(`AsyncStorage: ${err}`);
      return false;
    }
  };

  const testJWTDecode = async () => {
    try {
      const { jwtDecode } = require('./src/utils/jwtDecode');
      // Test avec un token factice
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      jwtDecode(fakeToken);
      return true;
    } catch (err) {
      setError(`JWT Decode: ${err}`);
      return false;
    }
  };

  const testAuthContext = async () => {
    try {
      const { AuthProvider } = require('./src/contexts/AuthContext');
      return true;
    } catch (err) {
      setError(`AuthContext: ${err}`);
      return false;
    }
  };

  const testNavigation = async () => {
    try {
      const { NavigationContainer } = require('@react-navigation/native');
      return true;
    } catch (err) {
      setError(`Navigation: ${err}`);
      return false;
    }
  };

  const runTests = async () => {
    setError(null);
    
    // Test 1: AsyncStorage
    if (!(await testAsyncStorage())) return;
    setStep(1);
    
    // Test 2: JWT Decode
    if (!(await testJWTDecode())) return;
    setStep(2);
    
    // Test 3: AuthContext
    if (!(await testAuthContext())) return;
    setStep(3);
    
    // Test 4: Navigation
    if (!(await testNavigation())) return;
    setStep(4);
    
    Alert.alert('Succès', 'Toutes les dépendances fonctionnent !');
  };

  const getStepText = () => {
    switch (step) {
      case 0: return 'Prêt à tester les dépendances';
      case 1: return '✅ AsyncStorage fonctionne';
      case 2: return '✅ JWT Decode fonctionne';
      case 3: return '✅ AuthContext fonctionne';
      case 4: return '✅ Navigation fonctionne';
      default: return 'Test terminé';
    }
  };

  const getStepColor = () => {
    switch (step) {
      case 0: return '#6B7280';
      case 1: return '#10B981';
      case 2: return '#10B981';
      case 3: return '#10B981';
      case 4: return '#10B981';
      default: return '#10B981';
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        
        <View style={styles.content}>
          <Text style={styles.title}>🔍 Yukpomnang</Text>
          <Text style={styles.subtitle}>Test Progressif</Text>
          
          <View style={styles.statusCard}>
            <Text style={[styles.statusTitle, { color: getStepColor() }]}>
              {getStepText()}
            </Text>
            {error && (
              <Text style={styles.errorText}>
                ❌ Erreur: {error}
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.testButton} onPress={runTests}>
            <Text style={styles.testButtonText}>
              {step === 0 ? 'Commencer les tests' : 'Relancer les tests'}
            </Text>
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Tests de dépendances</Text>
            <Text style={styles.infoText}>
              1. AsyncStorage (stockage local){'\n'}
              2. JWT Decode (décodage tokens){'\n'}
              3. AuthContext (authentification){'\n'}
              4. Navigation (routage){'\n'}
              5. Toutes les fonctionnalités
            </Text>
          </View>

          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Dépendance problématique identifiée</Text>
              <Text style={styles.errorDetails}>{error}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
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
    marginBottom: 24,
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
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
  },
  testButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
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
    marginBottom: 20,
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
  errorCard: {
    backgroundColor: '#FEF2F2',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
    textAlign: 'center',
  },
});




