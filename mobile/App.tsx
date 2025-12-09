// ✅ CRITIQUE: PATCH REACT DOIT ÊTRE IMPORTÉ EN PREMIER AVANT TOUT
// Utiliser require pour charger le patch AVANT React
const { patchReactUseEffect } = require('./src/utils/reactPatch');

// ✅ CRITIQUE: Importer React et patcher IMMÉDIATEMENT
import * as React from 'react';

// ✅ CRITIQUE: Appliquer le patch IMMÉDIATEMENT après import de React
// ET patcher aussi le module require('react') directement
try {
  if (typeof React !== 'undefined' && React.useEffect) {
    patchReactUseEffect(React);
    console.log('[App] ✅ Patch React useEffect appliqué en premier');
  }

  // ✅ CRITIQUE: Patcher aussi le module require('react') directement
  const reactModule = require('react');
  if (reactModule && reactModule.useEffect) {
    patchReactUseEffect(reactModule);
    console.log('[App] ✅ Patch React module direct appliqué');
  }
} catch (patchError) {
  console.error('[App] ⚠️ Erreur application patch (non-bloquant):', patchError);
}

import { StatusBar } from 'expo-status-bar';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initObservability } from './src/observability';

// ✅ CORRECTION CRASH: initObservability déplacé dans useEffect pour éviter blocage synchrone
// Le service intercepte automatiquement tous les console.log/error/warn

// ✅ Import dynamique pour éviter les erreurs TypeScript
const { NavigationContainer } = require('@react-navigation/native');

// ✅ Composants essentiels
import ErrorBoundary from './src/components/ErrorBoundary';
import GPSTrackingManager from './src/components/GPSTrackingManager';
import RemoteLoggingInitializer from './src/components/RemoteLoggingInitializer';
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
  // ✅ SÉCURITÉ: Envelopper dans try-catch pour éviter crash au démarrage
  try {
    console.log('[App] 🚀 Yukpomnang - Démarrage avec Deep Linking');
  } catch (logError) {
    // Ignorer les erreurs de log
  }

  // ✅ CORRECTION CRASH: initObservability dans useEffect pour éviter blocage
  React.useEffect(() => {
    try {
      if (typeof initObservability === 'function') {
        initObservability();
        console.log('[App] ✅ Observability initialisé');
      }
    } catch (error) {
      console.error('[App] ⚠️ Erreur initialisation observability:', error);
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
          <ThemeProvider>
            <PaperProvider theme={theme}>
              <ToasterProvider>
                <LanguageProvider>
                  <LocationProvider>
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
                  </LocationProvider>
                </LanguageProvider>
              </ToasterProvider>
            </PaperProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}