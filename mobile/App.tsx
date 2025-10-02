import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// BLOC 1 : Contexts de base
import ErrorBoundary from './src/components/ErrorBoundary';
import { GlobalIAStatsProvider } from './src/components/intelligence/GlobalIAStats';
import { AuthProvider, useAuth } from './src/contexts/AuthContext-simple';
import { LocationProvider } from './src/contexts/LocationContext';
import { theme } from './src/theme/theme';

// BLOC 2 : Navigation
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Brain, House, MapPin, User } from 'phosphor-react-native';

// BLOC 3 : Hooks et Services
import { useAIServices } from './src/hooks/useAIServices';
import { useLocation } from './src/hooks/useLocation';
import { useNearbyServices } from './src/hooks/useNearbyServices';
import { useWeather } from './src/hooks/useWeather';

// Écrans principaux
const HomeScreen = () => {
    const { location, isLoading: locationLoading } = useLocation();
    const { weather, loading: weatherLoading } = useWeather(
        location?.coords.latitude,
        location?.coords.longitude
    );
    const { services, loading: servicesLoading } = useNearbyServices(
        location?.coords.latitude,
        location?.coords.longitude
    );

    return (
        <View style={styles.screenContainer}>
            <Text style={styles.screenTitle}>🏠 Accueil Yukpomnang</Text>

            <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>📍 Localisation</Text>
                {locationLoading ? (
                    <Text style={styles.loadingText}>Chargement de la position...</Text>
                ) : location ? (
                    <Text style={styles.infoText}>
                        Lat: {location.coords.latitude.toFixed(4)},
                        Lng: {location.coords.longitude.toFixed(4)}
                    </Text>
                ) : (
                    <Text style={styles.errorText}>Position non disponible</Text>
                )}
            </View>

            <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>🌤️ Météo</Text>
                {weatherLoading ? (
                    <Text style={styles.loadingText}>Chargement de la météo...</Text>
                ) : weather ? (
                    <Text style={styles.infoText}>
                        {weather.temperature}°C - {weather.description}
                    </Text>
                ) : (
                    <Text style={styles.errorText}>Météo non disponible</Text>
                )}
            </View>

            <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>🏪 Services à proximité</Text>
                {servicesLoading ? (
                    <Text style={styles.loadingText}>Chargement des services...</Text>
                ) : services.length > 0 ? (
                    <Text style={styles.infoText}>
                        {services.length} service(s) trouvé(s)
                    </Text>
                ) : (
                    <Text style={styles.errorText}>Aucun service trouvé</Text>
                )}
            </View>
        </View>
    );
};

const ServicesScreen = () => {
    const { location } = useLocation();
    const { services, loading } = useNearbyServices(
        location?.coords.latitude,
        location?.coords.longitude
    );

    return (
        <View style={styles.screenContainer}>
            <Text style={styles.screenTitle}>🏪 Services</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#6366F1" />
            ) : (
                <View style={styles.servicesList}>
                    {services.map((service) => (
                        <View key={service.id} style={styles.serviceCard}>
                            <Text style={styles.serviceName}>{service.name}</Text>
                            <Text style={styles.serviceDescription}>{service.description}</Text>
                            <Text style={styles.serviceDistance}>
                                📍 {service.distance}m - ⭐ {service.rating}/5
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const AIScreen = () => {
    const { askAI, loading, error } = useAIServices();
    const [question, setQuestion] = React.useState('');
    const [response, setResponse] = React.useState<string | null>(null);

    const handleAskAI = async () => {
        if (question.trim()) {
            const aiResponse = await askAI(question);
            if (aiResponse) {
                setResponse(aiResponse.message);
            }
        }
    };

    return (
        <View style={styles.screenContainer}>
            <Text style={styles.screenTitle}>🤖 IA Yukpomnang</Text>

            <View style={styles.aiCard}>
                <Text style={styles.cardTitle}>Posez votre question :</Text>
                <Text style={styles.infoText}>
                    L'IA est prête à vous aider ! (Simulation)
                </Text>
                {response && (
                    <View style={styles.responseCard}>
                        <Text style={styles.responseText}>{response}</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const ProfileScreen = () => {
    const { user } = useAuth();

    return (
        <View style={styles.screenContainer}>
            <Text style={styles.screenTitle}>👤 Mon Profil</Text>

            <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Utilisateur</Text>
                <Text style={styles.infoText}>
                    {user ? `Connecté en tant que ${user.email}` : 'Non connecté'}
                </Text>
            </View>
        </View>
    );
};

const LoginScreen = () => (
    <View style={styles.screenContainer}>
        <Text style={styles.screenTitle}>🔐 Connexion</Text>
        <Text style={styles.infoText}>Écran de connexion (simulation)</Text>
    </View>
);

const RegisterScreen = () => (
    <View style={styles.screenContainer}>
        <Text style={styles.screenTitle}>📝 Inscription</Text>
        <Text style={styles.infoText}>Écran d'inscription (simulation)</Text>
    </View>
);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Composant de chargement
const LoadingScreen = () => (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement de Yukpomnang...</Text>
    </View>
);

// Stack Navigator pour l'authentification
const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
);

// Tab Navigator principal
const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    const iconProps = {
                        size: size,
                        color: color,
                        weight: (focused ? 'fill' : 'regular') as any,
                    };

                    switch (route.name) {
                        case 'Home':
                            return <House {...iconProps} />;
                        case 'Services':
                            return <MapPin {...iconProps} />;
                        case 'AI':
                            return <Brain {...iconProps} />;
                        case 'Profile':
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
                component={HomeScreen}
                options={{
                    title: 'Accueil',
                    tabBarLabel: 'Accueil'
                }}
            />
            <Tab.Screen
                name="Services"
                component={ServicesScreen}
                options={{
                    title: 'Services',
                    tabBarLabel: 'Services'
                }}
            />
            <Tab.Screen
                name="AI"
                component={AIScreen}
                options={{
                    title: 'IA',
                    tabBarLabel: 'IA'
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: 'Profil',
                    tabBarLabel: 'Profil'
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
    console.log('[App] 🚀 Yukpomnang - Application complète restaurée');

    return (
        <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <PaperProvider theme={theme}>
                        <AuthProvider>
                            <LocationProvider>
                                <GlobalIAStatsProvider>
                                    <NavigationContainer>
                                        <StatusBar style="auto" />
                                        <AppNavigator />
                                    </NavigationContainer>
                                </GlobalIAStatsProvider>
                            </LocationProvider>
                        </AuthProvider>
                    </PaperProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 20,
        paddingTop: 60,
    },
    screenTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0F52BA',
        textAlign: 'center',
        marginBottom: 30,
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    infoText: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
    },
    loadingText: {
        fontSize: 16,
        color: '#999',
        fontStyle: 'italic',
    },
    errorText: {
        fontSize: 16,
        color: '#e74c3c',
        fontStyle: 'italic',
    },
    servicesList: {
        flex: 1,
    },
    serviceCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    serviceName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    serviceDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    serviceDistance: {
        fontSize: 12,
        color: '#999',
    },
    aiCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    responseCard: {
        backgroundColor: '#f0f8ff',
        borderRadius: 8,
        padding: 16,
        marginTop: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#6366F1',
    },
    responseText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 24,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
});