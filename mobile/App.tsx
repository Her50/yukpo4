import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
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

export default function App() {
    console.log('[App] 🚀 Yukpomnang - Application complète de production avec navigation moderne');

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
