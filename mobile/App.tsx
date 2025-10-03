import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts
import { AuthProvider } from './src/contexts/AuthContext';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Theme
import { theme } from './src/theme/theme';

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <PaperProvider theme={theme}>
                    <AuthProvider>
                        <NavigationContainer>
                            <StatusBar style="auto" />
                            <AppNavigator />
                        </NavigationContainer>
                    </AuthProvider>
                </PaperProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
