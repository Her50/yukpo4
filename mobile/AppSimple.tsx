// @ts-nocheck
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// BLOC 1 : Contexts de base (sans GPS)
import ErrorBoundary from './src/components/ErrorBoundary';
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';
import { AuthProvider } from './src/contexts/AuthContext';
import { theme } from './src/theme/theme';

// BLOC 2 : Navigation moderne
import AppNavigator from './src/navigation/AppNavigator';

export default function AppSimple() {
    console.log('[AppSimple] 🚀 Yukpomnang - Version simplifiée sans GPS');
    console.log('[AppSimple] 📱 Version: 1.0.0 - Production Ready (Sans GPS)');

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <PaperProvider theme={theme}>
                        <AuthProvider>
                            <GlobalIAStatsProvider>
                                <StatusBar style="auto" />
                                <AppNavigator />
                            </GlobalIAStatsProvider>
                        </AuthProvider>
                    </PaperProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
