import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
// import { Bug, List } from 'phosphor-react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// BLOC 1 : Contexts de base
import ErrorBoundary from './src/components/ErrorBoundary';
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';
import { AuthProvider } from './src/contexts/AuthContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { theme } from './src/theme/theme';

// BLOC 2 : Navigation moderne
import AppNavigator from './src/navigation/AppNavigator';

// BLOC 3 : Debug et diagnostic (désactivé pour le build)
// import CrashDiagnostic from './src/components/CrashDiagnostic';
// import DebugLogger from './src/components/DebugLogger';

export default function App() {

    console.log('[App] 🚀 Yukpomnang - Application complète de production avec navigation moderne');
    console.log('[App] 📱 Version: 1.0.0 - Production Ready');
    console.log('[App] 🔧 Debug tools available');

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <PaperProvider theme={theme}>
                        <AuthProvider>
                            <LocationProvider>
                                <GlobalIAStatsProvider>
                                    <NavigationContainer>
                                        <StatusBar style="auto" />
                                        <AppNavigator />

                                        {/* Debug Tools - Désactivé pour le build */}
                                    </NavigationContainer>
                                </GlobalIAStatsProvider>
                            </LocationProvider>
                        </AuthProvider>
                    </PaperProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>

            {/* Debug Modals - Désactivé pour le build */}
        </ErrorBoundary>
    );
}

// Styles supprimés - debug désactivé

