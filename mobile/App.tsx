// ✅ CRITIQUE: Polyfills pour React Native/Expo - DOIT être en premier
import './polyfills';

// ✅ i18next — initialisation avant tout composant React
import './src/i18n';

import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => { });

// ✅ Import dynamique pour NavigationContainer (évite les erreurs TypeScript)
const { NavigationContainer } = require('@react-navigation/native');

// ✅ Composants essentiels
import { AsyncStorageGate } from './src/components/AsyncStorageGate';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ToasterProvider } from './src/components/ToasterProvider';
import { linking } from './src/config/linking';
import { AuthProvider } from './src/contexts/AuthContext';
import { DeliveryProvider } from './src/contexts/DeliveryContext';
import { FeatureFlagProvider } from './src/contexts/FeatureFlagContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { ShoppingProvider } from './src/contexts/ShoppingContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { WebSocketProvider } from './src/contexts/WebSocketContext';

// ✅ CORRECTION CRASH: africanLocations chargé en lazy loading pour éviter surcharge mémoire au démarrage
import AppNavigator from './src/navigation/AppNavigator.optimized';
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
  const RemoteLoggingInitializer = React.useMemo(() => {
    try {
      return require('./src/components/RemoteLoggingInitializer').default;
    } catch (error) {
      console.warn('[App] ⚠️ RemoteLoggingInitializer indisponible:', error);
      return () => null;
    }
  }, []);

  const GPSTrackingManager = React.useMemo(() => {
    try {
      return require('./src/components/GPSTrackingManager').default;
    } catch (error) {
      console.warn('[App] ⚠️ GPSTrackingManager indisponible:', error);
      return () => null;
    }
  }, []);

  const PushNotificationManager = React.useMemo(() => {
    try {
      return require('./src/components/PushNotificationManager').default;
    } catch (error) {
      console.warn('[App] ⚠️ PushNotificationManager indisponible:', error);
      return () => null;
    }
  }, []);

  const AppUpdateChecker = React.useMemo(() => {
    try {
      return require('./src/components/AppUpdateChecker').default;
    } catch (error) {
      console.warn('[App] ⚠️ AppUpdateChecker indisponible:', error);
      return () => null;
    }
  }, []);

  const CommunityAlertBackgroundManager = React.useMemo(() => {
    try {
      return require('./src/components/CommunityAlertBackgroundManager').default;
    } catch (error) {
      console.warn('[App] ⚠️ CommunityAlertBackgroundManager indisponible:', error);
      return () => null;
    }
  }, []);

  // ✅ SÉCURITÉ: Envelopper dans try-catch pour éviter crash au démarrage
  try {
    console.log('[App] 🚀 Yukpomnang - Démarrage avec Deep Linking');
  } catch (logError) {
    // Ignorer les erreurs de log
  }

  // ✅ CORRECTION CRASH: initObservability dans useEffect pour éviter blocage
  // ✅ NOTE: L'initialisation d'AsyncStorage est maintenant gérée par AsyncStorageGate
  // qui bloque le rendu jusqu'à ce qu'AsyncStorage soit prêt
  React.useEffect(() => {
    try {
      // Import dynamique pour éviter les erreurs si le module n'existe pas
      const { initObservability } = require('./src/observability');
      if (typeof initObservability === 'function') {
        initObservability();
        console.log('[App] ✅ Observabilité initialisée');
      }
    } catch (error) {
      console.warn('[App] ⚠️ Erreur initialisation observabilité:', error);
    }

    // ✅ CRITIQUE: Initialiser ComponentDebugger au démarrage pour capturer toutes les erreurs
    try {
      const { componentDebugger } = require('./src/utils/componentDebugger');
      componentDebugger.enable();
      console.log('[App] ✅ ComponentDebugger initialisé et activé');
    } catch (error) {
      console.warn('[App] ⚠️ Erreur initialisation ComponentDebugger:', error);
    }
  }, []);

  // ✅ CORRECTION CRASH: Prefetch des données de localisation en lazy loading avec délai
  React.useEffect(() => {
    // Charger les données de localisation après 2 secondes pour ne pas bloquer le démarrage
    const timer = setTimeout(() => {
      try {
        const { TOUS_LES_PAYS } = require('./src/data/africanLocations');
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
      } catch (error) {
        console.error('[App] ⚠️ Erreur chargement données localisation:', error);
      }
    }, 2000); // Délai de 2 secondes

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* ✅ CRITIQUE: AsyncStorageGate bloque le rendu jusqu'à ce qu'AsyncStorage soit prêt */}
          {/* Cela garantit qu'aucun provider n'appelle SafeStorage avant l'initialisation */}
          <AsyncStorageGate>
            <ThemeProvider>
              <PaperProvider theme={theme}>
                <ToasterProvider>
                  <LanguageProvider>
                    <LocationProvider>
                      <AuthProvider>
                        <RemoteLoggingInitializer />
                        <AppUpdateChecker />
                        {/* ✅ DIAGNOSTIC: WebSocketProvider réactivé pour test */}
                        <WebSocketProvider>
                          <FeatureFlagProvider>
                            <DeliveryProvider>
                              <ShoppingProvider>
                                <StatusBar style="auto" />
                                <CommunityAlertBackgroundManager />
                                <GPSTrackingManager />
                                <NavigationContainer
                                  linking={linking}
                                  fallback={null}
                                  onReady={() => {
                                    SplashScreen.hideAsync().catch(() => { });
                                  }}
                                  onStateChange={() => {
                                    console.log('[NavigationContainer] 📍 Navigation changée');
                                  }}
                                  onUnhandledAction={(action: any) => {
                                    console.warn('[NavigationContainer] ⚠️ Action non gérée:', action);
                                  }}
                                >
                                  <AppNavigator />
                                  <PushNotificationManager />
                                </NavigationContainer>
                              </ShoppingProvider>
                            </DeliveryProvider>
                          </FeatureFlagProvider>
                        </WebSocketProvider>
                      </AuthProvider>
                    </LocationProvider>
                  </LanguageProvider>
                </ToasterProvider>
              </PaperProvider>
            </ThemeProvider>
          </AsyncStorageGate>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
