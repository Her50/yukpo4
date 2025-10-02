import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// BLOC 1 : Contexts (déjà testés et OK)

// BLOC 2 : Navigation et Providers

export default function App() {
    console.log('[App] BLOC 1 + 2 - Test des contextes + navigation');

    // État pour contrôler le chargement progressif
    const [isReady, setIsReady] = React.useState(false);
    const [loadingStep, setLoadingStep] = React.useState('Initialisation...');
    const [testResults, setTestResults] = React.useState<string[]>([]);

    React.useEffect(() => {
        const testNavigation = async () => {
            const results: string[] = [];

            try {
                // BLOC 1 - Contexts (déjà testés)
                results.push('✅ BLOC 1 - Contexts OK (précédent)');

                console.log('[App] Test 5: NavigationContainer');
                setLoadingStep('Test NavigationContainer...');

                try {
                    require('@react-navigation/native');
                    results.push('✅ NavigationContainer OK');
                    console.log('[App] ✅ NavigationContainer chargé avec succès');
                } catch (error) {
                    results.push('❌ NavigationContainer ERREUR: ' + error.message);
                    console.error('[App] ❌ NavigationContainer erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 6: BottomTabNavigator');
                setLoadingStep('Test BottomTabNavigator...');

                try {
                    require('@react-navigation/bottom-tabs');
                    results.push('✅ BottomTabNavigator OK');
                    console.log('[App] ✅ BottomTabNavigator chargé avec succès');
                } catch (error) {
                    results.push('❌ BottomTabNavigator ERREUR: ' + error.message);
                    console.error('[App] ❌ BottomTabNavigator erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 7: StackNavigator');
                setLoadingStep('Test StackNavigator...');

                try {
                    require('@react-navigation/stack');
                    results.push('✅ StackNavigator OK');
                    console.log('[App] ✅ StackNavigator chargé avec succès');
                } catch (error) {
                    results.push('❌ StackNavigator ERREUR: ' + error.message);
                    console.error('[App] ❌ StackNavigator erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 8: Phosphor Icons');
                setLoadingStep('Test Phosphor Icons...');

                try {
                    require('phosphor-react-native');
                    results.push('✅ Phosphor Icons OK');
                    console.log('[App] ✅ Phosphor Icons chargé avec succès');
                } catch (error) {
                    results.push('❌ Phosphor Icons ERREUR: ' + error.message);
                    console.error('[App] ❌ Phosphor Icons erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 9: GestureHandlerRootView');
                setLoadingStep('Test GestureHandlerRootView...');

                try {
                    require('react-native-gesture-handler');
                    results.push('✅ GestureHandlerRootView OK');
                    console.log('[App] ✅ GestureHandlerRootView chargé avec succès');
                } catch (error) {
                    results.push('❌ GestureHandlerRootView ERREUR: ' + error.message);
                    console.error('[App] ❌ GestureHandlerRootView erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 10: PaperProvider');
                setLoadingStep('Test PaperProvider...');

                try {
                    require('react-native-paper');
                    results.push('✅ PaperProvider OK');
                    console.log('[App] ✅ PaperProvider chargé avec succès');
                } catch (error) {
                    results.push('❌ PaperProvider ERREUR: ' + error.message);
                    console.error('[App] ❌ PaperProvider erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 11: SafeAreaProvider');
                setLoadingStep('Test SafeAreaProvider...');

                try {
                    require('react-native-safe-area-context');
                    results.push('✅ SafeAreaProvider OK');
                    console.log('[App] ✅ SafeAreaProvider chargé avec succès');
                } catch (error) {
                    results.push('❌ SafeAreaProvider ERREUR: ' + error.message);
                    console.error('[App] ❌ SafeAreaProvider erreur:', error);
                }

                setTestResults(results);
                setLoadingStep('Tests terminés');
                setIsReady(true);

            } catch (error) {
                console.error('[App] ❌ Erreur générale:', error);
                results.push('❌ ERREUR GÉNÉRALE: ' + error.message);
                setTestResults(results);
                setIsReady(true);
            }
        };

        const timeoutId = setTimeout(testNavigation, 1000);
        return () => clearTimeout(timeoutId);
    }, []);

    // Écran de chargement
    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingTitle}>🧪 BLOC 1+2 - Test Navigation</Text>
                <Text style={styles.loadingStep}>{loadingStep}</Text>
                <ActivityIndicator size="large" color="#0F52BA" />
            </View>
        );
    }

    // Affichage des résultats
    return (
        <View style={styles.container}>
            <StatusBar style="auto" />
            <Text style={styles.title}>🧪 BLOC 1+2 - Résultats Tests</Text>
            <Text style={styles.subtitle}>Test des contextes + navigation</Text>

            <View style={styles.resultsContainer}>
                {testResults.map((result, index) => (
                    <Text key={index} style={styles.resultText}>
                        {result}
                    </Text>
                ))}
            </View>

            <Text style={styles.info}>
                Si tous les tests sont ✅, on passe au BLOC 3 (écrans).
                Si un test est ❌, c'est ce composant qui cause le crash.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        padding: 20,
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
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0F52BA',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        marginBottom: 30,
    },
    resultsContainer: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
    },
    resultText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 8,
        fontFamily: 'monospace',
    },
    info: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
