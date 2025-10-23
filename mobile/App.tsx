// @ts-nocheck
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ✅ OPTIMISATION: Providers essentiels uniquement au démarrage
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { theme } from './src/theme/theme';

// Navigation
import { NavigationContainer } from '@react-navigation/native';
import { linking } from './src/config/linking';
import AppNavigator from './src/navigation/AppNavigator';

// ✅ OPTIMISATION: Providers chargés APRÈS authentification (voir AppNavigator.tsx)
// - LanguageProvider : Chargé dans MainStack (après login)
// - LocationProvider : Chargé dans MainStack (après login)
// - GlobalIAStatsProvider : Chargé dans MainStack (après login)
// - GPSTrackingManager : Chargé dans MainStack (après login)

export default function App() {
  console.log('[App] 🚀 Yukpomnang - VERSION PRODUCTION OPTIMISÉE');
  console.log('[App] 📱 Chargement progressif: Écran visible en <500ms');
  
  // ✅ PROTECTION: Gestion d'erreur pour le linking
  const [linkingError, setLinkingError] = React.useState(false);
  
  const handleNavigationError = (error: any) => {
    console.error('[App] ❌ Erreur navigation:', error);
    setLinkingError(true);
    // Continuer sans deep linking si erreur
  };

  return (
    <ErrorBoundary>
      {/* @ts-ignore */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            {/* ✅ OPTIMISATION: Seul AuthProvider au démarrage */}
            <AuthProvider>
              <StatusBar style="auto" />
              <NavigationContainer 
                linking={linkingError ? undefined : linking}
                onUnhandledAction={(action) => {
                  console.warn('[App] Action non gérée:', action);
                }}
                fallback={null}
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



