import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, Card, Paragraph, Title } from 'react-native-paper';
import { logGeneral } from '../config/appConfig';
import { config } from '../config/environment';
import { theme } from '../theme/theme';

interface ConnectivityTestProps {
    onTestComplete?: (results: TestResults) => void;
}

interface TestResults {
    apiReachable: boolean;
    authWorking: boolean;
    networkStatus: string;
    errors: string[];
}

const ConnectivityTest: React.FC<ConnectivityTestProps> = ({ onTestComplete }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<TestResults | null>(null);
    const [currentTest, setCurrentTest] = useState<string>('');

    const runConnectivityTest = async () => {
        setIsRunning(true);
        setResults(null);
        const testResults: TestResults = {
            apiReachable: false,
            authWorking: false,
            networkStatus: 'unknown',
            errors: []
        };

        try {
            // Test 1: Vérifier la connectivité réseau
            setCurrentTest('Vérification de la connectivité réseau...');
            logGeneral('[ConnectivityTest] Test de connectivité réseau');

                   try {
                     const response = await fetch('https://www.google.com', {
                       method: 'HEAD'
                     });
                testResults.networkStatus = response.ok ? 'connected' : 'limited';
            } catch (error) {
                testResults.networkStatus = 'disconnected';
                testResults.errors.push('Pas de connexion internet');
            }

            // Test 2: Vérifier l'accessibilité de l'API
            setCurrentTest('Test de l\'API backend...');
            logGeneral('[ConnectivityTest] Test de l\'API backend', config.API_BASE_URL);

                   try {
                     const response = await fetch(`${config.API_BASE_URL}/api/health`, {
                       method: 'GET',
                       headers: {
                           'Content-Type': 'application/json'
                       }
                     });

                if (response.ok) {
                    testResults.apiReachable = true;
                    logGeneral('[ConnectivityTest] API accessible');
                } else {
                    testResults.errors.push(`API répond avec le code ${response.status}`);
                }
            } catch (error: any) {
                testResults.errors.push(`API inaccessible: ${error.message}`);
                logGeneral('[ConnectivityTest] API inaccessible', error);
            }

            // Test 3: Test d'authentification (si API accessible)
            if (testResults.apiReachable) {
                setCurrentTest('Test d\'authentification...');
                logGeneral('[ConnectivityTest] Test d\'authentification');

                       try {
                         const response = await fetch(`${config.API_BASE_URL}/api/auth/login`, {
                           method: 'POST',
                           headers: {
                               'Content-Type': 'application/json'
                           },
                           body: JSON.stringify({
                               email: 'test@example.com',
                               password: 'testpassword'
                           })
                         });

                    // Même si l'authentification échoue, si on reçoit une réponse, c'est bon
                    if (response.status === 400 || response.status === 401 || response.status === 422) {
                        testResults.authWorking = true;
                        logGeneral('[ConnectivityTest] Endpoint d\'authentification accessible');
                    } else {
                        testResults.errors.push(`Endpoint auth répond avec le code ${response.status}`);
                    }
                } catch (error: any) {
                    testResults.errors.push(`Endpoint auth inaccessible: ${error.message}`);
                    logGeneral('[ConnectivityTest] Endpoint auth inaccessible', error);
                }
            }

        } catch (error: any) {
            testResults.errors.push(`Erreur générale: ${error.message}`);
            logGeneral('[ConnectivityTest] Erreur générale', error);
        }

        setResults(testResults);
        setIsRunning(false);
        setCurrentTest('');

        if (onTestComplete) {
            onTestComplete(testResults);
        }
    };

    const getStatusIcon = (status: boolean) => {
        return status ? 'checkmark-circle' : 'close-circle';
    };

    const getStatusColor = (status: boolean) => {
        return status ? '#4CAF50' : '#F44336';
    };

    const getNetworkStatusText = (status: string) => {
        switch (status) {
            case 'connected': return 'Connecté';
            case 'limited': return 'Connexion limitée';
            case 'disconnected': return 'Déconnecté';
            default: return 'Inconnu';
        }
    };

    const getNetworkStatusColor = (status: string) => {
        switch (status) {
            case 'connected': return '#4CAF50';
            case 'limited': return '#FF9800';
            case 'disconnected': return '#F44336';
            default: return '#757575';
        }
    };

    return (
        <Card style={styles.container}>
            <Card.Content>
                <Title style={styles.title}>Test de Connectivité</Title>
                <Paragraph style={styles.subtitle}>
                    Vérifiez la connectivité de votre application
                </Paragraph>

                {isRunning && (
                    <View style={styles.testingContainer}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={styles.testingText}>{currentTest}</Text>
                    </View>
                )}

                {results && (
                    <View style={styles.resultsContainer}>
                        <View style={styles.resultItem}>
                            <Ionicons
                                name={getStatusIcon(results.networkStatus === 'connected')}
                                size={20}
                                color={getNetworkStatusColor(results.networkStatus)}
                            />
                            <Text style={styles.resultText}>
                                Réseau: {getNetworkStatusText(results.networkStatus)}
                            </Text>
                        </View>

                        <View style={styles.resultItem}>
                            <Ionicons
                                name={getStatusIcon(results.apiReachable)}
                                size={20}
                                color={getStatusColor(results.apiReachable)}
                            />
                            <Text style={styles.resultText}>
                                API Backend: {results.apiReachable ? 'Accessible' : 'Inaccessible'}
                            </Text>
                        </View>

                        <View style={styles.resultItem}>
                            <Ionicons
                                name={getStatusIcon(results.authWorking)}
                                size={20}
                                color={getStatusColor(results.authWorking)}
                            />
                            <Text style={styles.resultText}>
                                Authentification: {results.authWorking ? 'Fonctionnelle' : 'Problématique'}
                            </Text>
                        </View>

                        {results.errors.length > 0 && (
                            <View style={styles.errorsContainer}>
                                <Text style={styles.errorsTitle}>Erreurs détectées:</Text>
                                {results.errors.map((error, index) => (
                                    <Text key={index} style={styles.errorText}>• {error}</Text>
                                ))}
                            </View>
                        )}

                        <View style={styles.apiInfo}>
                            <Text style={styles.apiInfoTitle}>Configuration API:</Text>
                            <Text style={styles.apiInfoText}>URL: {config.API_BASE_URL}</Text>
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    onPress={runConnectivityTest}
                    disabled={isRunning}
                    style={styles.testButton}
                >
                    <Ionicons name="wifi" size={16} color="white" />
                    <Text>{isRunning ? 'Test en cours...' : 'Lancer le test'}</Text>
                </TouchableOpacity>

                {results && (
                    <TouchableOpacity
                        onPress={() => {
                            Alert.alert(
                                'Résultats du test',
                                `Réseau: ${getNetworkStatusText(results.networkStatus)}\n` +
                                `API: ${results.apiReachable ? 'Accessible' : 'Inaccessible'}\n` +
                                `Auth: ${results.authWorking ? 'Fonctionnelle' : 'Problématique'}\n` +
                                `Erreurs: ${results.errors.length}`,
                                [{ text: 'OK' }]
                            );
                        }}
                        style={styles.detailsButton}
                    >
                        Voir les détails
                    </TouchableOpacity>
                )}
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    container: {
        margin: 16,
        elevation: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 16,
    },
    testingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    testingText: {
        marginLeft: 8,
        fontSize: 14,
        color: theme.colors.text,
    },
    resultsContainer: {
        marginBottom: 16,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    resultText: {
        marginLeft: 8,
        fontSize: 14,
        color: theme.colors.text,
    },
    errorsContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#ffebee',
        borderRadius: 8,
    },
    errorsTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#d32f2f',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 12,
        color: '#d32f2f',
        marginBottom: 4,
    },
    apiInfo: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    apiInfoTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    apiInfoText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontFamily: 'monospace',
    },
    testButton: {
        marginBottom: 8,
    },
    detailsButton: {
        borderColor: theme.colors.primary,
    },
});

export default ConnectivityTest;




