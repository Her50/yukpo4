import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function App() {
    console.log('[App] BLOC 3 - Test simplifié des services');

    // État pour contrôler le chargement progressif
    const [isReady, setIsReady] = React.useState(false);
    const [loadingStep, setLoadingStep] = React.useState('Initialisation...');
    const [testResults, setTestResults] = React.useState<string[]>([]);

    React.useEffect(() => {
        const testServices = async () => {
            const results: string[] = [];
            
            try {
                // BLOC 1 + 2 (déjà testés)
                results.push('✅ BLOC 1 - Contexts OK (précédent)');
                results.push('✅ BLOC 2 - Navigation OK (précédent)');

                console.log('[App] Test 12: LocationContext');
                setLoadingStep('Test LocationContext...');
                
                try {
                    require('./src/contexts/LocationContext');
                    results.push('✅ LocationContext OK');
                    console.log('[App] ✅ LocationContext chargé avec succès');
                } catch (error) {
                    results.push('❌ LocationContext ERREUR: ' + error.message);
                    console.error('[App] ❌ LocationContext erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 13: useLocation Hook');
                setLoadingStep('Test useLocation Hook...');
                
                try {
                    require('./src/hooks/useLocation');
                    results.push('✅ useLocation Hook OK');
                    console.log('[App] ✅ useLocation Hook chargé avec succès');
                } catch (error) {
                    results.push('❌ useLocation Hook ERREUR: ' + error.message);
                    console.error('[App] ❌ useLocation Hook erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 14: useGeocoding Hook');
                setLoadingStep('Test useGeocoding Hook...');
                
                try {
                    require('./src/hooks/useGeocoding');
                    results.push('✅ useGeocoding Hook OK');
                    console.log('[App] ✅ useGeocoding Hook chargé avec succès');
                } catch (error) {
                    results.push('❌ useGeocoding Hook ERREUR: ' + error.message);
                    console.error('[App] ❌ useGeocoding Hook erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 15: useWeather Hook');
                setLoadingStep('Test useWeather Hook...');
                
                try {
                    require('./src/hooks/useWeather');
                    results.push('✅ useWeather Hook OK');
                    console.log('[App] ✅ useWeather Hook chargé avec succès');
                } catch (error) {
                    results.push('❌ useWeather Hook ERREUR: ' + error.message);
                    console.error('[App] ❌ useWeather Hook erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 16: useNearbyServices Hook');
                setLoadingStep('Test useNearbyServices Hook...');
                
                try {
                    require('./src/hooks/useNearbyServices');
                    results.push('✅ useNearbyServices Hook OK');
                    console.log('[App] ✅ useNearbyServices Hook chargé avec succès');
                } catch (error) {
                    results.push('❌ useNearbyServices Hook ERREUR: ' + error.message);
                    console.error('[App] ❌ useNearbyServices Hook erreur:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] Test 17: useAIServices Hook');
                setLoadingStep('Test useAIServices Hook...');
                
                try {
                    require('./src/hooks/useAIServices');
                    results.push('✅ useAIServices Hook OK');
                    console.log('[App] ✅ useAIServices Hook chargé avec succès');
                } catch (error) {
                    results.push('❌ useAIServices Hook ERREUR: ' + error.message);
                    console.error('[App] ❌ useAIServices Hook erreur:', error);
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

        const timeoutId = setTimeout(testServices, 1000);
        return () => clearTimeout(timeoutId);
    }, []);

    // Écran de chargement
    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingTitle}>🧪 BLOC 3 - Test Services</Text>
                <Text style={styles.loadingStep}>{loadingStep}</Text>
                <ActivityIndicator size="large" color="#0F52BA" />
            </View>
        );
    }

    // Affichage des résultats
    return (
        <View style={styles.container}>
            <StatusBar style="auto" />
            <Text style={styles.title}>🧪 BLOC 3 - Résultats Tests</Text>
            <Text style={styles.subtitle}>Test des services (sans navigation)</Text>
            
            <View style={styles.resultsContainer}>
                {testResults.map((result, index) => (
                    <Text key={index} style={styles.resultText}>
                        {result}
                    </Text>
                ))}
            </View>

            <Text style={styles.info}>
                Si tous les tests sont ✅, le problème vient de la navigation.
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
