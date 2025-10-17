import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts de base
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { theme } from './src/theme/theme';

// Navigation de test
import TestNavigator from './src/navigation/TestNavigator';

export default function AppTest() {
    console.log('[AppTest] 🧪 Mode test - Écrans simplifiés pour débogage');

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <PaperProvider theme={theme}>
                        <AuthProvider>
                            <LocationProvider>
                                <NavigationContainer>
                                    <StatusBar style="auto" />
                                    <TestNavigator />
                                </NavigationContainer>
                            </LocationProvider>
                        </AuthProvider>
                    </PaperProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}






