import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Bug, List } from 'phosphor-react-native';

// BLOC 1 : Contexts de base
import ErrorBoundary from './src/components/ErrorBoundary';
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';
import { AuthProvider } from './src/contexts/AuthContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { theme } from './src/theme/theme';

// BLOC 2 : Navigation moderne
import AppNavigator from './src/navigation/AppNavigator';

// BLOC 3 : Debug et diagnostic
import DebugLogger from './src/components/DebugLogger';
import CrashDiagnostic from './src/components/CrashDiagnostic';

export default function App() {
    const [showDebugLogger, setShowDebugLogger] = useState(false);
    const [showCrashDiagnostic, setShowCrashDiagnostic] = useState(false);

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

                                        {/* Debug Tools - Visible en développement */}
                                        {__DEV__ && (
                                            <View style={styles.debugTools}>
                                                <TouchableOpacity
                                                    style={styles.debugButton}
                                                    onPress={() => setShowDebugLogger(true)}
                                                >
                                                    <List size={20} color="#FFF" />
                                                    <Text style={styles.debugButtonText}>Logs</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.debugButton}
                                                    onPress={() => setShowCrashDiagnostic(true)}
                                                >
                                                    <Bug size={20} color="#FFF" />
                                                    <Text style={styles.debugButtonText}>Diagnostic</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </NavigationContainer>
                                </GlobalIAStatsProvider>
                            </LocationProvider>
                        </AuthProvider>
                    </PaperProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>

            {/* Debug Modals */}
            <DebugLogger
                visible={showDebugLogger}
                onClose={() => setShowDebugLogger(false)}
            />
            <CrashDiagnostic
                visible={showCrashDiagnostic}
                onClose={() => setShowCrashDiagnostic(false)}
            />
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    debugTools: {
        position: 'absolute',
        top: 50,
        right: 20,
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
    },
    debugButton: {
        backgroundColor: '#6366F1',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    debugButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
});

