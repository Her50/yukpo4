import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

// Configuration

// Empêcher l'écran de démarrage de se fermer automatiquement
SplashScreen.preventAutoHideAsync();

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
    const [isAppReady, setIsAppReady] = useState(false);

    console.log('[App] 🚀 Démarrage de l\'application Yukpomnang');

    // Initialisation de l'application
    useEffect(() => {
        async function prepare() {
            try {
                // Précharger les ressources nécessaires
                console.log('[App] 📱 Préparation de l\'application...');

                // Attendre un délai minimal pour s'assurer que tout est prêt
                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] ✅ Application prête');
                setIsAppReady(true);

                // Masquer l'écran de démarrage
                await SplashScreen.hideAsync();
            } catch (error) {
                console.error('[App] ❌ Erreur lors de la préparation:', error);
                handleError(error as Error);
            }
        }

        prepare();
    }, []);

    const handleRetry = () => {
        setHasError(false);
        setRetryCount(prev => prev + 1);
        console.log('[App] 🔄 Tentative de redémarrage:', retryCount + 1);
    };

    // Gestion d'erreur avec retry automatique
    const handleError = (error: Error) => {
        console.error('[App] ❌ Erreur critique:', error);
        setHasError(true);

        // Afficher une alerte pour informer l'utilisateur
        Alert.alert(
            'Erreur de démarrage',
            'L\'application a rencontré une erreur. Voulez-vous réessayer ?',
            [
                { text: 'Réessayer', onPress: handleRetry },
                { text: 'Fermer', onPress: () => { } }
            ]
        );

        // Retry automatique après 5 secondes (max 2 tentatives)
        if (retryCount < 2) {
            setTimeout(() => {
                console.log('[App] 🔄 Retry automatique...');
                handleRetry();
            }, 5000);
        }
    };

    // Si erreur critique et max retry atteint
    if (hasError && retryCount >= 2) {
        return <FallbackScreen onRetry={handleRetry} />;
    }

    // Si l'application n'est pas encore prête, afficher l'écran de démarrage
    if (!isAppReady) {
        return (
            <View style={styles.splashContainer}>
                <Text style={styles.splashText}>Yukpo</Text>
                <Text style={styles.splashSubtext}>Chargement...</Text>
            </View>
        );
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
    splashContainer: {
        flex: 1,
        backgroundColor: '#0F52BA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    splashText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 16,
    },
    splashSubtext: {
        fontSize: 18,
        color: '#F59E0B',
        fontWeight: '600',
    },
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