import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts - SANS LocationContext
import ErrorBoundary from './src/components/ErrorBoundary';
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';
import { AuthProvider, useAuth } from './src/contexts/AuthContext-simple';

// Theme
import { theme } from './src/theme/theme';

// Navigation simplifiée SANS GPS
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { House, User } from 'phosphor-react-native';

// Screens - Import sécurisé
let ModernHomeScreen: any;
let ProfileScreen: any;
let LoginScreen: any;
let RegisterScreen: any;

try {
    ModernHomeScreen = require('./src/screens/ModernHomeScreen').default;
} catch (error) {
    console.warn('[App] ModernHomeScreen non disponible:', error);
    ModernHomeScreen = () => (
        <View style={styles.fallbackContainer}>
            <Text style={styles.fallbackText}>🏠 Écran d'accueil</Text>
        </View>
    );
}

try {
    ProfileScreen = require('./src/screens/ProfileScreen').default;
} catch (error) {
    console.warn('[App] ProfileScreen non disponible:', error);
    ProfileScreen = () => (
        <View style={styles.fallbackContainer}>
            <Text style={styles.fallbackText}>👤 Profil</Text>
        </View>
    );
}

try {
    LoginScreen = require('./src/screens/auth/LoginScreen').default;
} catch (error) {
    console.warn('[App] LoginScreen non disponible:', error);
    LoginScreen = () => (
        <View style={styles.fallbackContainer}>
            <Text style={styles.fallbackText}>🔐 Connexion</Text>
        </View>
    );
}

try {
    RegisterScreen = require('./src/screens/auth/RegisterScreen').default;
} catch (error) {
    console.warn('[App] RegisterScreen non disponible:', error);
    RegisterScreen = () => (
        <View style={styles.fallbackContainer}>
            <Text style={styles.fallbackText}>📝 Inscription</Text>
        </View>
    );
}

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
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
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
                component={ModernHomeScreen}
                options={{
                    title: 'Accueil',
                    tabBarLabel: 'Accueil'
                }}
            />
            <Tab.Screen
                name="Account"
                component={ProfileScreen}
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
    console.log('[App] Démarrage de l\'application Yukpomnang - SANS GPS');

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

                console.log('[App] Étape 2: Test des composants (sans GPS)');
                setLoadingStep('Test des composants...');

                // Test des composants critiques
                try {
                    require('react-native-paper');
                    require('react-native-safe-area-context');
                    require('react-native-gesture-handler');
                    require('@react-navigation/native');
                    console.log('[App] ✅ Dépendances de base disponibles');
                } catch (depError) {
                    console.error('[App] ❌ Dépendance manquante:', depError);
                }

                console.log('[App] Étape 3: Finalisation');
                setLoadingStep('Finalisation...');
                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('[App] ✅ Application prête - SANS GPS');
                setIsReady(true);

            } catch (error) {
                console.error('[App] ❌ Erreur d\'initialisation:', error);
            }
        };

        const timeoutId = setTimeout(initializeApp, 500);
        return () => clearTimeout(timeoutId);
    }, []);

    // Écran de chargement
    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingTitle}>🚀 Yukpomnang (Sans GPS)</Text>
                <Text style={styles.loadingStep}>{loadingStep}</Text>
                <ActivityIndicator size="large" color="#0F52BA" />
            </View>
        );
    }

    // Application principale - SANS LocationContext
    console.log('[App] 🎯 Rendu de l\'application principale - SANS GPS');

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
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
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
    },
});
