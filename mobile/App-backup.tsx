import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts - Import direct avec gestion d'erreur
import ErrorBoundary from './src/components/ErrorBoundary';
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';
import { AuthProvider } from './src/contexts/AuthContext-simple';
import AppNavigator from './src/navigation/AppNavigator-simple';

// Theme
import { theme } from './src/theme/theme';

// Composant de test simple
const TestScreen = () => (
    <View style={styles.testContainer}>
        <Text style={styles.testText}>🎉 App Yukpomnang fonctionne !</Text>
        <Text style={styles.testSubtext}>Si vous voyez ce message, l'app se lance correctement.</Text>
    </View>
);

export default function App() {
    console.log('[App] Démarrage de l\'application Yukpomnang');

    // État pour contrôler le chargement progressif
    const [isReady, setIsReady] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [loadingStep, setLoadingStep] = React.useState('Initialisation...');

    React.useEffect(() => {
        const initializeApp = async () => {
            try {
                console.log('[App] 🚀 Démarrage de l\'initialisation');
                setLoadingStep('Initialisation des composants...');

                // Attendre un peu pour que le splash screen se termine
                await new Promise(resolve => setTimeout(resolve, 2000));

                console.log('[App] Étape 1: Vérification des dépendances de base');
                setLoadingStep('Vérification des dépendances...');

                // Vérifier que les modules critiques sont disponibles
                if (typeof require !== 'undefined') {
                    try {
                        require('react-native-paper');
                        require('react-native-safe-area-context');
                        require('react-native-gesture-handler');
                        console.log('[App] ✅ Dépendances de base disponibles');
                    } catch (depError) {
                        console.error('[App] ❌ Dépendance manquante:', depError);
                        // Ne pas faire échouer l'app pour les dépendances manquantes
                        console.warn('[App] ⚠️ Continuation malgré les dépendances manquantes');
                    }
                }

                console.log('[App] Étape 2: Test des contextes');
                setLoadingStep('Test des contextes...');

                // Test des contextes de manière sécurisée
                try {
                    if (AuthProvider && typeof AuthProvider === 'function') {
                        console.log('[App] ✅ AuthProvider disponible');
                    }
                    if (GlobalIAStatsProvider && typeof GlobalIAStatsProvider === 'function') {
                        console.log('[App] ✅ GlobalIAStatsProvider disponible');
                    }
                    if (AppNavigator && typeof AppNavigator === 'function') {
                        console.log('[App] ✅ AppNavigator disponible');
                    }
                } catch (contextError) {
                    console.warn('[App] ⚠️ Erreur dans les contextes:', contextError);
                }

                console.log('[App] Étape 3: Finalisation');
                setLoadingStep('Finalisation...');
                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] ✅ Application prête - Passage à l\'interface principale');
                setIsReady(true);

            } catch (error) {
                console.error('[App] ❌ Erreur critique d\'initialisation:', error);
                setHasError(true);
                setErrorMessage(error?.message || 'Erreur d\'initialisation');
            }
        };

        // Démarrer l'initialisation avec un petit délai
        const timeoutId = setTimeout(initializeApp, 500);

        return () => clearTimeout(timeoutId);
    }, []);

    // Écran de chargement
    if (!isReady && !hasError) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingTitle}>🚀 Yukpomnang</Text>
                <Text style={styles.loadingStep}>{loadingStep}</Text>
                <ActivityIndicator size="large" color="#0F52BA" />
            </View>
        );
    }

    // Écran d'erreur
    if (hasError) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>⚠️ Erreur de démarrage</Text>
                <Text style={styles.errorMessage}>{errorMessage}</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                        setHasError(false);
                        setErrorMessage('');
                        setIsReady(false);
                    }}
                >
                    <Text style={styles.retryButtonText}>Réessayer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Application principale - Version complète
    console.log('[App] 🎯 Rendu de l\'application principale');

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <PaperProvider theme={theme}>
                        <AuthProvider>
                            <GlobalIAStatsProvider>
                                <NavigationContainer>
                                    <StatusBar style="auto" />
                                    <AppNavigator />
                                </NavigationContainer>
                            </GlobalIAStatsProvider>
                        </AuthProvider>
                    </PaperProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    testContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        padding: 20,
    },
    testText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 10,
    },
    testSubtext: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#dc3545',
        textAlign: 'center',
        marginBottom: 20,
    },
    errorMessage: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    retryButton: {
        backgroundColor: '#007bff',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    loadingTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0F52BA',
        textAlign: 'center',
        marginBottom: 20,
    },
    loadingStep: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
        marginBottom: 30,
    },
    loadingSpinner: {
        width: 40,
        height: 40,
        borderWidth: 4,
        borderColor: '#e3e3e3',
        borderTopColor: '#0F52BA',
        borderRadius: 20,
        // Animation sera ajoutée par React Native
    },
});