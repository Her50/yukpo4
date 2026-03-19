import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Test complet avec tous les providers pour détecter d'autres crashes
import './polyfills';
import './src/i18n';

import { AsyncStorageGate } from './src/components/AsyncStorageGate';
import { ToasterProvider } from './src/components/ToasterProvider';
import { AuthProvider } from './src/contexts/AuthContext';
import { DeliveryProvider } from './src/contexts/DeliveryContext';
import { FeatureFlagProvider } from './src/contexts/FeatureFlagContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { ShoppingProvider } from './src/contexts/ShoppingContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { WebSocketProvider } from './src/contexts/WebSocketContext';

// Import dynamique pour NavigationContainer
const { NavigationContainer } = require('@react-navigation/native');

// Test avec AppNavigator complet
import AppNavigator from './src/navigation/AppNavigator.optimized';

function WelcomeNotifier() {
  // useWelcomeNotification(); // Éviter pour le moment
  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AsyncStorageGate>
          <ThemeProvider>
            <PaperProvider theme={{}}>
              <ToasterProvider>
                <LanguageProvider>
                  <WelcomeNotifier />
                  <LocationProvider>
                    <AuthProvider>
                      <WebSocketProvider>
                        <FeatureFlagProvider>
                          <DeliveryProvider>
                            <ShoppingProvider>
                              <StatusBar style="auto" />
                              <NavigationContainer>
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
        </AsyncStorageGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
