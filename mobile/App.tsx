// @ts-nocheck
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// BLOC 1 : Contexts de base - APPLICATION COMPLÈTE POUR PRODUCTION
import ErrorBoundary from './src/components/ErrorBoundary';
import GPSTrackingManager from './src/components/GPSTrackingManager';
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';
import { AuthProvider } from './src/contexts/AuthContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { LanguageProvider } from './src/contexts/LanguageContext'; // ✅ AJOUT: Provider de langue
import { theme } from './src/theme/theme';

// BLOC 2 : Navigation moderne - ÉTAPE 2: Réactiver NavigationContainer
import { NavigationContainer } from '@react-navigation/native';
import { linking } from './src/config/linking';
import AppNavigator from './src/navigation/AppNavigator';

// ✅ APPLICATION COMPLÈTE POUR PRODUCTION

export default function App() {
  console.log('[App] 🚀 Yukpomnang - APPLICATION COMPLÈTE POUR PRODUCTION');
  console.log('[App] 📱 Version: 1.0.0 - Production Ready avec toutes les fonctionnalités');

  return (
    <ErrorBoundary>
      {/* @ts-ignore */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <LanguageProvider> {/* ✅ AJOUT: Provider de langue */}
              <AuthProvider>
                <LocationProvider>
                  <GlobalIAStatsProvider>
                    {/* Tracking GPS automatique en arrière-plan */}
                    <GPSTrackingManager />
                    <StatusBar style="auto" />
                    <NavigationContainer linking={linking}>
                      <AppNavigator />
                    </NavigationContainer>
                  </GlobalIAStatsProvider>
                </LocationProvider>
              </AuthProvider>
            </LanguageProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}



