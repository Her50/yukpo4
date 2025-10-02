import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Version ultra-simple SANS aucune dépendance complexe
export default function App() {
  console.log('[App Ultra-Simple] Démarrage sans dépendances complexes');

  const handleTest = () => {
    Alert.alert('Test', 'Application fonctionnelle !');
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />

        <View style={styles.content}>
          <Text style={styles.title}>🎉 Yukpomnang</Text>
          <Text style={styles.subtitle}>Version Ultra-Simple</Text>

          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>✅ Application fonctionnelle</Text>
            <Text style={styles.statusText}>
              Cette version fonctionne sans crash.
              Aucune dépendance complexe chargée.
            </Text>
          </View>

          <TouchableOpacity style={styles.testButton} onPress={handleTest}>
            <Text style={styles.testButtonText}>Tester l'application</Text>
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Diagnostic</Text>
            <Text style={styles.infoText}>
              • Pas d'AuthContext{'\n'}
              • Pas de Navigation{'\n'}
              • Pas d'AsyncStorage{'\n'}
              • Pas de JWT Decode{'\n'}
              • Pas d'API calls{'\n'}
              • Version de base uniquement
            </Text>
          </View>

          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>Prochaines étapes</Text>
            <Text style={styles.nextStepsText}>
              1. Si cette version fonctionne → Le problème vient des dépendances{'\n'}
              2. Ajouter progressivement les fonctionnalités{'\n'}
              3. Identifier la dépendance qui cause le crash
            </Text>
          </View>
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
  nextStepsCard: {
    backgroundColor: '#FEF3C7',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 12,
    textAlign: 'center',
  },
  nextStepsText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    textAlign: 'center',
  },
});




