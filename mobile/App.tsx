import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts
import { AuthProvider } from './src/contexts/AuthContext';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Components
import CrashDiagnostic from './src/components/CrashDiagnostic';
import DebugLogger from './src/components/DebugLogger';
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
    const [showDebugLogs, setShowDebugLogs] = useState(true); // FORCER LES LOGS DE DEBUG
    const [showCrashDiagnostic, setShowCrashDiagnostic] = useState(false);

    // FORCER L'AFFICHAGE DES LOGS AU DÉMARRAGE
    useEffect(() => {
        console.log('[App Complete] 🚀 DÉMARRAGE DE L\'APPLICATION YUKPOMNANG');
        console.log('[App Complete] 📱 Version: 1.0.0 - Build EAS Preview');
        console.log('[App Complete] 🔧 Mode debug activé automatiquement');
        console.log('[App Complete] ⏰ Timestamp:', new Date().toISOString());

        // Logs détaillés pour diagnostic
        console.log('[App Complete] 📋 Composants chargés:');
        console.log('[App Complete]   - NavigationContainer ✅');
        console.log('[App Complete]   - AuthProvider ✅');
        console.log('[App Complete]   - ErrorBoundary ✅');
        console.log('[App Complete]   - DebugLogger ✅');
        console.log('[App Complete]   - CrashDiagnostic ✅');

        // Test de connexion API
        console.log('[App Complete] 🌐 Test de configuration API...');
        console.log('[App Complete]   - API_URL:', process.env.EXPO_PUBLIC_API_URL || 'Non définie');
        console.log('[App Complete]   - ENVIRONMENT:', process.env.EXPO_PUBLIC_ENVIRONMENT || 'Non définie');

        // Affichage automatique des logs après 2 secondes
        setTimeout(() => {
            console.log('[App Complete] 🔍 Affichage automatique des logs de debug...');
            setShowDebugLogs(true);
        }, 2000);

    }, []);

    const handleRetry = () => {
        setHasError(false);
        setRetryCount(prev => prev + 1);
        console.log('[App Complete] 🔄 Tentative de redémarrage:', retryCount + 1);
    };

    // Gestion d'erreur avec retry automatique ET diagnostic
    const handleError = (error: Error) => {
        console.error('[App Complete] ❌ ERREUR CRITIQUE DÉTECTÉE:', error);
        console.error('[App Complete] 📊 Stack trace:', error.stack);
        console.error('[App Complete] 🔍 Type d\'erreur:', error.name);
        console.error('[App Complete] 💬 Message:', error.message);

        setHasError(true);

        // AFFICHER AUTOMATIQUEMENT LE DIAGNOSTIC DE CRASH
        setTimeout(() => {
            console.log('[App Complete] 🩺 Affichage du diagnostic de crash automatique...');
            setShowCrashDiagnostic(true);
        }, 1000);

        // Retry automatique après 5 secondes (max 3 tentatives)
        if (retryCount < 3) {
            setTimeout(() => {
                console.log('[App Complete] 🔄 Retry automatique...');
                handleRetry();
            }, 5000);
        }
    };

    // Si erreur critique et max retry atteint - AFFICHER LES LOGS
    if (hasError && retryCount >= 3) {
        return (
            <View style={styles.fallbackContainer}>
                <FallbackScreen onRetry={handleRetry} />
                {/* FORCER L'AFFICHAGE DES LOGS EN CAS D'ERREUR */}
                <DebugLogger visible={true} onClose={() => { }} />
                <CrashDiagnostic visible={showCrashDiagnostic} onClose={() => setShowCrashDiagnostic(false)} />
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

                {/* BOUTON DEBUG FLOTTANT - TOUJOURS VISIBLE */}
                <TouchableOpacity
                    style={styles.debugButton}
                    onPress={() => setShowDebugLogs(true)}
                >
                    <Text style={styles.debugButtonText}>🔍</Text>
                </TouchableOpacity>

                {/* FORCER L'AFFICHAGE DES LOGS DE DEBUG AU DÉMARRAGE */}
                {showDebugLogs && (
                    <DebugLogger
                        visible={true}
                        onClose={() => setShowDebugLogs(false)}
                    />
                )}

                {/* DIAGNOSTIC DE CRASH AUTOMATIQUE */}
                <CrashDiagnostic
                    visible={showCrashDiagnostic}
                    onClose={() => setShowCrashDiagnostic(false)}
                />
            </ErrorBoundary>
        );
    } catch (error) {
        handleError(error as Error);
        return (
            <View style={styles.fallbackContainer}>
                <FallbackScreen onRetry={handleRetry} />
                {/* LOGS FORCÉS EN CAS DE CRASH */}
                <DebugLogger visible={true} onClose={() => { }} />
                <CrashDiagnostic visible={true} onClose={() => { }} />
            </View>
        );
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
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    fallbackIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    fallbackTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#DC2626',
        marginBottom: 12,
        textAlign: 'center',
    },
    fallbackMessage: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    debugButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        zIndex: 999,
    },
    debugButtonText: {
        fontSize: 20,
        color: '#FFF',
    },
});