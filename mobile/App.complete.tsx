import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts
import { AuthProvider } from './src/contexts/AuthContext';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Components
import ErrorBoundary from './src/components/ErrorBoundary';

// Theme
import { theme } from './src/theme/theme';

// Composant de fallback en cas d'erreur critique
const FallbackScreen = ({ onRetry }: { onRetry: () => void }) => (
    <View style={styles.fallbackContainer}>
        <View style={styles.fallbackContent}>
            <Text style={styles.fallbackIcon}>⚠️</Text>
            <Text style={styles.fallbackTitle}>Erreur de démarrage</Text>
            <Text style={styles.fallbackMessage}>
                L'application a rencontré une erreur au démarrage.
                Toutes les fonctionnalités ne sont pas disponibles.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
        </View>
    </View>
);

export default function App() {
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    console.log('[App Complete] Démarrage de l\'application Yukpomnang avec toutes les fonctionnalités');

    const handleRetry = () => {
        setHasError(false);
        setRetryCount(prev => prev + 1);
        console.log('[App Complete] Tentative de redémarrage:', retryCount + 1);
    };

    // Gestion d'erreur avec retry automatique
    const handleError = (error: Error) => {
        console.error('[App Complete] Erreur critique:', error);
        setHasError(true);

        // Retry automatique après 3 secondes (max 3 tentatives)
        if (retryCount < 3) {
            setTimeout(() => {
                console.log('[App Complete] Retry automatique...');
                handleRetry();
            }, 3000);
        }
    };

    // Si erreur critique et max retry atteint
    if (hasError && retryCount >= 3) {
        return <FallbackScreen onRetry={handleRetry} />;
    }

    try {
        return (
            <ErrorBoundary>
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
            </ErrorBoundary>
        );
    } catch (error) {
        handleError(error as Error);
        return <FallbackScreen onRetry={handleRetry} />;
    }
}

const styles = StyleSheet.create({
    fallbackContainer: {
        flex: 1,
        backgroundColor: '#FEF2F2',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    fallbackContent: {
        backgroundColor: '#FFFFFF',
        padding: 32,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        maxWidth: 400,
        width: '100%',
    },
    fallbackIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    fallbackTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#DC2626',
        textAlign: 'center',
        marginBottom: 12,
    },
    fallbackMessage: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#DC2626',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});






