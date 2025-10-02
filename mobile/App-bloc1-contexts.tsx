import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// BLOC 1 : Contexts de base uniquement
// Testons chaque contexte un par un

export default function App() {
    console.log('[App] BLOC 1 - Test des contextes de base');

    // État pour contrôler le chargement progressif
    const [isReady, setIsReady] = React.useState(false);
    const [loadingStep, setLoadingStep] = React.useState('Initialisation...');
    const [testResults, setTestResults] = React.useState<string[]>([]);

    React.useEffect(() => {
        const testContexts = async () => {
            const results: string[] = [];

            try {
                console.log('[App] Test 1: ErrorBoundary');
                setLoadingStep('Test ErrorBoundary...');

                try {
                    const ErrorBoundary = require('./src/components/ErrorBoundary').default;
                    results.push('✅ ErrorBoundary OK');
                    console.log('[App] ✅ ErrorBoundary chargé avec succès');
                } catch (error) {
                    results.push('❌ ErrorBoundary ERREUR: ' + error.message);
                    console.error('[App] ❌ ErrorBoundary erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 2: GlobalIAStatsProvider');
                setLoadingStep('Test GlobalIAStatsProvider...');

                try {
                    const { GlobalIAStatsProvider } = require('./src/components/intelligence/GlobalIAStats');
                    results.push('✅ GlobalIAStatsProvider OK');
                    console.log('[App] ✅ GlobalIAStatsProvider chargé avec succès');
                } catch (error) {
                    results.push('❌ GlobalIAStatsProvider ERREUR: ' + error.message);
                    console.error('[App] ❌ GlobalIAStatsProvider erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 3: AuthProvider');
                setLoadingStep('Test AuthProvider...');

                try {
                    const { AuthProvider } = require('./src/contexts/AuthContext-simple');
                    results.push('✅ AuthProvider OK');
                    console.log('[App] ✅ AuthProvider chargé avec succès');
                } catch (error) {
                    results.push('❌ AuthProvider ERREUR: ' + error.message);
                    console.error('[App] ❌ AuthProvider erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 4: Theme');
                setLoadingStep('Test Theme...');

                try {
                    const { theme } = require('./src/theme/theme');
                    results.push('✅ Theme OK');
                    console.log('[App] ✅ Theme chargé avec succès');
                } catch (error) {
                    results.push('❌ Theme ERREUR: ' + error.message);
                    console.error('[App] ❌ Theme erreur:', error);
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

        const timeoutId = setTimeout(testContexts, 1000);
        return () => clearTimeout(timeoutId);
    }, []);

    // Écran de chargement
    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingTitle}>🧪 BLOC 1 - Test Contextes</Text>
                <Text style={styles.loadingStep}>{loadingStep}</Text>
                <ActivityIndicator size="large" color="#0F52BA" />
            </View>
        );
    }

    // Affichage des résultats
    return (
        <View style={styles.container}>
            <StatusBar style="auto" />
            <Text style={styles.title}>🧪 BLOC 1 - Résultats Tests</Text>
            <Text style={styles.subtitle}>Test des contextes de base</Text>

            <View style={styles.resultsContainer}>
                {testResults.map((result, index) => (
                    <Text key={index} style={styles.resultText}>
                        {result}
                    </Text>
                ))}
            </View>

            <Text style={styles.info}>
                Si tous les tests sont ✅, le problème vient d'un autre bloc.
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
