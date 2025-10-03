import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// BLOC 1 : Contexts (déjà testés et OK)
import { useAuth } from './src/contexts/AuthContext-simple';

// BLOC 2 : Navigation (déjà testés et OK)
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { House, User } from 'phosphor-react-native';

// BLOC 3 : Écrans et Services
import { useLocation } from './src/hooks/useLocation';
import { useWeather } from './src/hooks/useWeather';

// Écrans de test simplifiés
const TestHomeScreen = () => {
    const { location, loading: locationLoading } = useLocation();
    const { weather, loading: weatherLoading } = useWeather();

    return (
        <View style={styles.fallbackContainer}>
            <Text style={styles.fallbackText}>🏠 Accueil (Test BLOC 3)</Text>
            <Text style={styles.infoText}>
                Location: {location ? 'OK' : 'Chargement...'}
            </Text>
            <Text style={styles.infoText}>
                Weather: {weather ? 'OK' : 'Chargement...'}
            </Text>
        </View>
    );
};

const TestProfileScreen = () => (
    <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>👤 Profil (Test BLOC 3)</Text>
    </View>
);

const TestLoginScreen = () => (
    <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>🔐 Connexion (Test BLOC 3)</Text>
    </View>
);

const TestRegisterScreen = () => (
    <View style={styles.fallbackContainer}>
        <Text style={styles.fallbackText}>📝 Inscription (Test BLOC 3)</Text>
    </View>
);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Composant de chargement
const LoadingScreen = () => (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement...</Text>
    </View>
);

// Stack Navigator pour l'authentification
const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={TestLoginScreen} />
        <Stack.Screen name="Register" component={TestRegisterScreen} />
    </Stack.Navigator>
);

// Tab Navigator simplifié
const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }: any) => ({
                tabBarIcon: ({ focused, color, size }: any) => {
                    const iconProps = {
                        size: size,
                        color: color,
                        weight: (focused ? 'fill' : 'regular') as any,
                    };

                    switch (route.name) {
                        case 'Home':
                            return <House {...iconProps} />;
                        case 'Account':
                            return <User {...iconProps} />;
                        default:
                            return <House {...iconProps} />;
                    }
                },
                tabBarActiveTintColor: '#6366F1',
                tabBarInactiveTintColor: '#94a3b8',
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopWidth: 0,
                    paddingBottom: 8,
                    paddingTop: 8,
                    height: 70,
                    borderRadius: 16,
                    marginHorizontal: 16,
                    marginBottom: 16,
                    position: 'absolute',
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginBottom: 4,
                },
                headerShown: false,
            })}
        >
            <Tab.Screen
                name="Home"
                component={TestHomeScreen}
                options={{
                    title: 'Accueil',
                    tabBarLabel: 'Accueil'
                }}
            />
            <Tab.Screen
                name="Account"
                component={TestProfileScreen}
                options={{
                    title: 'Mon Compte',
                    tabBarLabel: 'Compte'
                }}
            />
        </Tab.Navigator>
    );
};

// Stack Navigator principal
const MainStack = () => (
    <Stack.Navigator
        screenOptions={{
            headerStyle: {
                backgroundColor: '#6366F1',
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
            headerTintColor: '#FFF',
            headerTitleStyle: {
                fontWeight: 'bold',
                fontSize: 18,
            },
            headerBackTitleVisible: false,
        }}
    >
        <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
        />
    </Stack.Navigator>
);

// Navigateur principal
const AppNavigator = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (user) {
        return <MainStack />;
    } else {
        return <AuthStack />;
    }
};

export default function App() {
    console.log('[App] BLOC 1 + 2 + 3 - Test des contextes + navigation + écrans');

    // État pour contrôler le chargement progressif
    const [isReady, setIsReady] = React.useState(false);
    const [loadingStep, setLoadingStep] = React.useState('Initialisation...');
    const [testResults, setTestResults] = React.useState<string[]>([]);

    React.useEffect(() => {
        const testScreens = async () => {
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

        const timeoutId = setTimeout(testScreens, 1000);
        return () => clearTimeout(timeoutId);
    }, []);

    // Écran de chargement
    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingTitle}>🧪 BLOC 1+2+3 - Test Écrans</Text>
                <Text style={styles.loadingStep}>{loadingStep}</Text>
                <ActivityIndicator size="large" color="#0F52BA" />
            </View>
        );
    }

    // Affichage des résultats
    return (
        <View style={styles.container}>
            <StatusBar style="auto" />
            <Text style={styles.title}>🧪 BLOC 1+2+3 - Résultats Tests</Text>
            <Text style={styles.subtitle}>Test des contextes + navigation + écrans</Text>

            <View style={styles.resultsContainer}>
                {testResults.map((result, index) => (
                    <Text key={index} style={styles.resultText}>
                        {result}
                    </Text>
                ))}
            </View>

            <Text style={styles.info}>
                Si tous les tests sont ✅, on passe au BLOC 4 (composants UI).
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
    fallbackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        padding: 20,
    },
    fallbackText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 20,
    },
    infoText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 10,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
});

