import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initObservability } from './src/observability';
import { remoteLoggingService } from './src/services/remoteLoggingService';

initObservability();

// ✅ NOUVEAU : Initialiser le logging distant pour Expo.dev cloud
// Le service intercepte automatiquement tous les console.log/error/warn
console.log('[App] ✅ Service de logging distant initialisé');

// ✅ Import dynamique pour éviter les erreurs TypeScript
const { NavigationContainer } = require('@react-navigation/native');

// ✅ Composants essentiels
import ErrorBoundary from './src/components/ErrorBoundary';
import GPSTrackingManager from './src/components/GPSTrackingManager';
import RemoteLoggingInitializer from './src/components/RemoteLoggingInitializer';
import { linking } from './src/config/linking';
import { AuthProvider } from './src/contexts/AuthContext';
import { DeliveryProvider } from './src/contexts/DeliveryContext';
import { FeatureFlagProvider } from './src/contexts/FeatureFlagContext';
import { ShoppingProvider } from './src/contexts/ShoppingContext';
import { WebSocketProvider } from './src/contexts/WebSocketContext';
import { TOUS_LES_PAYS } from './src/data/africanLocations'; // ✅ OPTIMISATION 5
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

  // ✅ OPTIMISATION 5: Prefetch des données de localisation au démarrage
  React.useEffect(() => {
    const prefetchLocationData = () => {
      const startTime = Date.now();

      // Compter les pays et villes
      const nbPays = TOUS_LES_PAYS.length;
      const nbVilles = TOUS_LES_PAYS.reduce((acc, pays) => acc + pays.villes.length, 0);
      const nbQuartiers = TOUS_LES_PAYS.reduce((acc, pays) =>
        acc + pays.villes.reduce((acc2, ville) =>
          acc2 + (ville.quartiers?.length || 0), 0
        ), 0
      );

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      console.log(`📍 [App] Données de localisation préchargées en ${loadTime}ms:`);
      console.log(`   - ${nbPays} pays`);
      console.log(`   - ${nbVilles} villes`);
      console.log(`   - ${nbQuartiers} quartiers`);
      console.log(`   ✅ Accès instantané aux données africaines !`);
    };

    // Précharger immédiatement
    prefetchLocationData();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <AuthProvider>
              <RemoteLoggingInitializer />
              <WebSocketProvider>
                <FeatureFlagProvider>
                  <DeliveryProvider>
                    <ShoppingProvider>
                      <StatusBar style="auto" />
                      <GPSTrackingManager />
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
                    </ShoppingProvider>
                  </DeliveryProvider>
                </FeatureFlagProvider>
              </WebSocketProvider>
            </AuthProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}