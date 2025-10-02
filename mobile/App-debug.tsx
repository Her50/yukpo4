import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Theme
import { theme } from './src/theme/theme';

// Composant de test simple
const TestScreen = () => (
    <View style={styles.testContainer}>
        <Text style={styles.testText}>🎉 App Yukpomnang fonctionne !</Text>
        <Text style={styles.testSubtext}>Si vous voyez ce message, l'app se lance correctement.</Text>
    </View>
);

// Composant de test avec Paper
const TestScreenWithPaper = () => (
    <View style={styles.testContainer}>
        <Text style={styles.testText}>🎉 App Yukpomnang avec Paper !</Text>
        <Text style={styles.testSubtext}>Paper Provider fonctionne correctement.</Text>
    </View>
);

// Composant de test avec SafeArea
const TestScreenWithSafeArea = () => (
    <SafeAreaProvider>
        <View style={styles.testContainer}>
            <Text style={styles.testText}>🎉 App Yukpomnang avec SafeArea !</Text>
            <Text style={styles.testSubtext}>SafeAreaProvider fonctionne correctement.</Text>
        </View>
    </SafeAreaProvider>
);

export default function App() {
    console.log('[App] Démarrage de l\'application Yukpomnang - Version Debug');

    // État pour contrôler le chargement progressif
    const [isReady, setIsReady] = React.useState(false);
    const [loadingStep, setLoadingStep] = React.useState('Initialisation...');

    React.useEffect(() => {
        const initializeApp = async () => {
            try {
                console.log('[App] Étape 1: Initialisation des composants de base');
                setLoadingStep('Initialisation des composants...');

                // Attendre un peu pour que le splash screen se termine
                await new Promise(resolve => setTimeout(resolve, 2000));

                console.log('[App] Étape 2: Test des composants un par un');
                setLoadingStep('Test des composants...');

                // Test 1: PaperProvider
                try {
                    console.log('[App] Test PaperProvider...');
                    // Test réussi
                    console.log('[App] ✅ PaperProvider OK');
                } catch (error) {
                    console.error('[App] ❌ Erreur PaperProvider:', error);
                }

                // Test 2: SafeAreaProvider
                try {
                    console.log('[App] Test SafeAreaProvider...');
                    // Test réussi
                    console.log('[App] ✅ SafeAreaProvider OK');
                } catch (error) {
                    console.error('[App] ❌ Erreur SafeAreaProvider:', error);
                }

                console.log('[App] Étape 3: Finalisation');
                setLoadingStep('Finalisation...');
                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] ✅ Application prête - Version Debug');
                setIsReady(true);

            } catch (error) {
                console.error('[App] ❌ Erreur d\'initialisation:', error);
            }
        };

        // Démarrer l'initialisation avec un petit délai
        const timeoutId = setTimeout(initializeApp, 500);
        
        return () => clearTimeout(timeoutId);
    }, []);

    // Écran de chargement
    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingTitle}>🚀 Yukpomnang Debug</Text>
                <Text style={styles.loadingStep}>{loadingStep}</Text>
                <ActivityIndicator size="large" color="#0F52BA" />
            </View>
        );
    }

    // Application principale - Version debug progressive
    console.log('[App] 🎯 Rendu de l\'application principale - Version Debug');
    
    try {
        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <PaperProvider theme={theme}>
                        <StatusBar style="auto" />
                        <TestScreenWithPaper />
                    </PaperProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        );
    } catch (error) {
        console.error('[App] ❌ Erreur critique lors du rendu:', error);
        return <TestScreen />;
    }
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
});
