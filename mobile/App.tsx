import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts
import { AuthProvider } from './src/contexts/AuthContext';
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Theme
import { theme } from './src/theme/theme';

// Composant de test simple
const TestScreen = () => (
  <View style={styles.testContainer}>
    <Text style={styles.testText}>🎉 App Yukpomnang fonctionne !</Text>
    <Text style={styles.testSubtext}>Si vous voyez ce message, l'app se lance correctement.</Text>
  </View>
);

export default function App() {
  console.log('[App] Démarrage de l\'application Yukpomnang');

  try {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <AuthProvider>
              <GlobalIAStatsProvider>
                <NavigationContainer>
                  <StatusBar style="auto" />
                  <AppNavigator />
                </NavigationContainer>
              </GlobalIAStatsProvider>
            </AuthProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  } catch (error) {
    console.error('[App] Erreur critique:', error);
    return <TestScreen />;
  }
}

const styles = StyleSheet.create({
  testContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  testText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  testSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});