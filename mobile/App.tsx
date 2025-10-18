// @ts-nocheck
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// BLOC 1 : Contexts de base
import ErrorBoundary from './src/components/ErrorBoundary';
import GPSTrackingManager from './src/components/GPSTrackingManager';
import PushNotificationManager from './src/components/PushNotificationManager'; // ✅ NOUVEAU: Gestionnaire de push notifications
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';
import { AuthProvider } from './src/contexts/AuthContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { theme } from './src/theme/theme';

// BLOC 2 : Navigation moderne
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { linking } from './src/config/linking';

export default function App() {
  console.log('[App] 🚀 Yukpomnang - Application complète de production avec navigation moderne');
  console.log('[App] 📱 Version: 1.0.0 - Production Ready');

  return (
    <ErrorBoundary>
      {/* @ts-ignore */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <AuthProvider>
              <LocationProvider>
                <GlobalIAStatsProvider>
                  {/* Tracking GPS automatique en arrière-plan */}
                  <GPSTrackingManager />
                  <StatusBar style="auto" />
                  <NavigationContainer linking={linking}>
                    {/* ✅ NOUVEAU: Gestionnaire de push notifications et appels - DÉPLACÉ À L'INTÉRIEUR */}
                    <PushNotificationManager />
                    <AppNavigator />
                  </NavigationContainer>
                </GlobalIAStatsProvider>
              </LocationProvider>
            </AuthProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}


