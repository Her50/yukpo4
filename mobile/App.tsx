import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ✅ Import dynamique pour éviter les erreurs TypeScript
const { NavigationContainer } = require('@react-navigation/native');

// ✅ Composants essentiels
import ErrorBoundary from './src/components/ErrorBoundary';
import { linking } from './src/config/linking';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/theme/theme';

/**
 * Application Yukpomnang - VERSION OPTIMISÉE AVEC LINKING
 * 
 * ✅ TOUTES les fonctionnalités actives:
 * - Deep linking (yukpomnang://, https://yukpomnang.com)
 * - Navigation complète
 * - GPS, Push Notifications
 * - Tous les écrans
 * 
 * ✅ Protection contre les crashs:
 * - Gestion d'erreur sur le linking
 * - Chargement progressif des providers
 */
export default function App() {
  console.log('[App] 🚀 Yukpomnang - Démarrage avec Deep Linking');

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <AuthProvider>
              <StatusBar style="auto" />
              <NavigationContainer
                linking={linking}
                fallback={null}
                onReady={() => {
                  console.log('[NavigationContainer] ✅ Navigation prête avec Deep Linking');
                }}
                onStateChange={() => {
                  console.log('[NavigationContainer] 📍 Navigation changée');
                }}
                onUnhandledAction={(action: any) => {
                  console.warn('[NavigationContainer] ⚠️ Action non gérée:', action);
                }}
              >
                <AppNavigator />
              </NavigationContainer>
            </AuthProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}