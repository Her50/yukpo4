/**
 * VERSION ULTRA-MINIMALE POUR TESTER LE CRASH
 * Cette version ne charge que les composants essentiels
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  console.log('[App.MINIMAL] \uD83D\uDE80 Test minimal - Démarrage');
  
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Yukpomnang Test</Text>
      <Text style={styles.subtitle}>Version minimale - Test crash</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});
