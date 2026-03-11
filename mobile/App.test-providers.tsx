/**
 * VERSION TEST DES PROVIDERS POUR DIAGNOSTIC DE CRASH
 * Désactive progressivement les providers suspects pour identifier le coupable
 */

// ✅ CRITIQUE: Polyfills pour React Native/Expo - DOIT être en premier
import './polyfills';

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

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ✅ CRITIQUE: Imports des providers et composants
import AsyncStorageGate from './src/components/AsyncStorageGate';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { DeliveryProvider } from './src/contexts/DeliveryContext';
import { FeatureFlagProvider } from './src/contexts/FeatureFlagContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { ShoppingProvider } from './src/contexts/ShoppingContext';
import { WebSocketProvider } from './src/contexts/WebSocketContext';

// Imports des thèmes et services
import GPSTrackingManager from './src/components/GPSTrackingManager';
import AppNavigator from './src/navigation/AppNavigator';
import { initObservability } from './src/services/observability';
import RemoteLoggingInitializer from './src/services/remoteLoggingInitializer';
import { componentDebugger } from './src/utils/componentDebugger';

// Configuration du thème
import { linking } from './src/config/linking';
import { theme } from './src/theme/modernTheme';

// ✅ CRITIQUE: Initialiser l'observabilité et le debugger de composants AU PLUS TÔT
initObservability();
componentDebugger.init();

// ✅ CRITIQUE: Wrapper pour tester les providers progressivement
const TestProvidersWrapper = ({ children, step }: { children: React.ReactNode; step: number }) => {
  console.log(`[App] 🧪 Test providers - Étape ${step}/9`);

  // Étape 1: Test base (ErrorBoundary, SafeAreaProvider, AsyncStorageGate)
  if (step === 1) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AsyncStorageGate>
              <PaperProvider theme={theme}>
                <LanguageProvider>
                  <AuthProvider>
                    <StatusBar style="auto" />
                    <NavigationContainer
                      linking={linking}
                      fallback={null}
                      onReady={() => console.log('[NavigationContainer] ✅ Navigation étape 1 prête')}
                    >
                      {children}
                    </NavigationContainer>
                  </AuthProvider>
                </LanguageProvider>
              </PaperProvider>
            </AsyncStorageGate>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  // Étape 2: Ajouter LocationProvider
  if (step === 2) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AsyncStorageGate>
              <PaperProvider theme={theme}>
                <LanguageProvider>
                  <LocationProvider>
                    <AuthProvider>
                      <StatusBar style="auto" />
                      <NavigationContainer
                        linking={linking}
                        fallback={null}
                        onReady={() => console.log('[NavigationContainer] ✅ Navigation étape 2 prête')}
                      >
                        {children}
                      </NavigationContainer>
                    </AuthProvider>
                  </LocationProvider>
                </LanguageProvider>
              </PaperProvider>
            </AsyncStorageGate>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  // Étape 3: Ajouter WebSocketProvider
  if (step === 3) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AsyncStorageGate>
              <PaperProvider theme={theme}>
                <LanguageProvider>
                  <LocationProvider>
                    <AuthProvider>
                      <RemoteLoggingInitializer />
                      <WebSocketProvider>
                        <StatusBar style="auto" />
                        <NavigationContainer
                          linking={linking}
                          fallback={null}
                          onReady={() => console.log('[NavigationContainer] ✅ Navigation étape 3 prête')}
                        >
                          {children}
                        </NavigationContainer>
                      </WebSocketProvider>
                    </AuthProvider>
                  </LocationProvider>
                </LanguageProvider>
              </PaperProvider>
            </AsyncStorageGate>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  // Étape 4: Ajouter FeatureFlagProvider
  if (step === 4) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AsyncStorageGate>
              <PaperProvider theme={theme}>
                <LanguageProvider>
                  <LocationProvider>
                    <AuthProvider>
                      <RemoteLoggingInitializer />
                      <WebSocketProvider>
                        <FeatureFlagProvider>
                          <StatusBar style="auto" />
                          <NavigationContainer
                            linking={linking}
                            fallback={null}
                            onReady={() => console.log('[NavigationContainer] ✅ Navigation étape 4 prête')}
                          >
                            {children}
                          </NavigationContainer>
                        </FeatureFlagProvider>
                      </WebSocketProvider>
                    </AuthProvider>
                  </LocationProvider>
                </LanguageProvider>
              </PaperProvider>
            </AsyncStorageGate>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  // Étape 5: Ajouter DeliveryProvider
  if (step === 5) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AsyncStorageGate>
              <PaperProvider theme={theme}>
                <LanguageProvider>
                  <LocationProvider>
                    <AuthProvider>
                      <RemoteLoggingInitializer />
                      <WebSocketProvider>
                        <FeatureFlagProvider>
                          <DeliveryProvider>
                            <StatusBar style="auto" />
                            <NavigationContainer
                              linking={linking}
                              fallback={null}
                              onReady={() => console.log('[NavigationContainer] ✅ Navigation étape 5 prête')}
                            >
                              {children}
                            </NavigationContainer>
                          </DeliveryProvider>
                        </FeatureFlagProvider>
                      </WebSocketProvider>
                    </AuthProvider>
                  </LocationProvider>
                </LanguageProvider>
              </PaperProvider>
            </AsyncStorageGate>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  // Étape 6: Ajouter ShoppingProvider (version complète)
  if (step === 6) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AsyncStorageGate>
              <PaperProvider theme={theme}>
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
                                  console.log('[NavigationContainer] ✅ Navigation étape 6 prête (COMPLETE)');
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
              </PaperProvider>
            </AsyncStorageGate>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  // Par défaut, retourner la version complète
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AsyncStorageGate>
            <PaperProvider theme={theme}>
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
            </PaperProvider>
          </AsyncStorageGate>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
  const [testStep, setTestStep] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Commencer avec l'étape 1 et progresser automatiquement
    const timer = setTimeout(() => {
      if (testStep < 6) {
        console.log(`[App] 🧪 Passage à l'étape ${testStep + 1}/6`);
        setTestStep(testStep + 1);
      } else {
        console.log('[App] ✅ Tous les providers testés avec succès !');
      }
    }, 3000); // 3 secondes par étape

    return () => clearTimeout(timer);
  }, [testStep]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 24, color: 'red', marginBottom: 10 }}>❌ Crash détecté !</Text>
        <Text style={{ fontSize: 16, textAlign: 'center' }}>Erreur: {error}</Text>
        <Text style={{ fontSize: 14, marginTop: 10, color: 'gray' }}>
          Le crash se produit à l'étape {testStep} des providers
        </Text>
      </View>
    );
  }

  return (
    <TestProvidersWrapper step={testStep}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Test Providers - Étape {testStep}/6</Text>
        <Text style={{ fontSize: 14, marginTop: 10, color: 'gray' }}>
          {testStep === 1 && 'Test base (ErrorBoundary, SafeArea, Auth)'}
          {testStep === 2 && 'Ajout LocationProvider (GPS)'}
          {testStep === 3 && 'Ajout WebSocketProvider (connexion)'}
          {testStep === 4 && 'Ajout FeatureFlagProvider (API)'}
          {testStep === 5 && 'Ajout DeliveryProvider (livraison)'}
          {testStep === 6 && 'Ajout ShoppingProvider (panier) - COMPLET'}
        </Text>
      </View>
    </TestProvidersWrapper>
  );
};

export default App;
