import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { Bell, Brain, ChatCircle, House, MagnifyingGlass, MapPin, Plus, User } from 'phosphor-react-native';

// BLOC 3 : Hooks et Services
import { useAIServices } from './src/hooks/useAIServices';
import { useLocation } from './src/hooks/useLocation';
import { useNearbyServices } from './src/hooks/useNearbyServices';
import { useWeather } from './src/hooks/useWeather';

// Écran d'accueil moderne et complet
const HomeScreen = () => {
    const { location, isLoading: locationLoading, errorMsg: locationError } = useLocation();
    const { weather, loading: weatherLoading, error: weatherError } = useWeather(
        location?.coords.latitude,
        location?.coords.longitude
    );
    const { services, loading: servicesLoading, error: servicesError } = useNearbyServices(
        location?.coords.latitude,
        location?.coords.longitude
    );

    return (
        <ScrollView style={styles.screenContainer} showsVerticalScrollIndicator={false}>
            {/* Header avec recherche */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Yukpomnang</Text>
                <TouchableOpacity style={styles.searchButton}>
                    <MagnifyingGlass size={24} color="#6366F1" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.notificationButton}>
                    <Bell size={24} color="#6366F1" />
                </TouchableOpacity>
            </View>

            {/* Localisation et météo */}
            <View style={styles.locationWeatherCard}>
                <View style={styles.locationSection}>
                    <Text style={styles.locationTitle}>📍 Ma position</Text>
                    {locationLoading ? (
                        <Text style={styles.loadingText}>Détection de votre position...</Text>
                    ) : location ? (
                        <Text style={styles.locationText}>
                            {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
                        </Text>
                    ) : (
                        <Text style={styles.errorText}>
                            {locationError || 'Position non disponible'}
                        </Text>
                    )}
                </View>

                <View style={styles.weatherSection}>
                    <Text style={styles.weatherTitle}>🌤️ Météo</Text>
                    {weatherLoading ? (
                        <ActivityIndicator size="small" color="#6366F1" />
                    ) : weather ? (
                        <View style={styles.weatherInfo}>
                            <Text style={styles.weatherTemp}>{weather.temperature}°C</Text>
                            <Text style={styles.weatherDesc}>{weather.description}</Text>
                            <Text style={styles.weatherDetails}>
                                💧 {weather.humidity}% • 💨 {weather.windSpeed} km/h
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.errorText}>
                            {weatherError || 'Météo non disponible'}
                        </Text>
                    )}
                </View>
            </View>

            {/* Services à proximité */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>🏪 Services à proximité</Text>
                    <TouchableOpacity style={styles.seeAllButton}>
                        <Text style={styles.seeAllText}>Voir tout</Text>
                    </TouchableOpacity>
                </View>

                {servicesLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={styles.loadingText}>Recherche de services...</Text>
                    </View>
                ) : services.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesScroll}>
                        {services.slice(0, 5).map((service) => (
                            <TouchableOpacity key={service.id} style={styles.serviceCard}>
                                <Text style={styles.serviceName}>{service.name}</Text>
                                <Text style={styles.serviceDescription}>{service.description}</Text>
                                <View style={styles.serviceFooter}>
                                    <Text style={styles.serviceDistance}>📍 {service.distance}m</Text>
                                    <Text style={styles.serviceRating}>⭐ {service.rating}/5</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={styles.noServicesContainer}>
                        <Text style={styles.noServicesText}>
                            {servicesError || 'Aucun service trouvé à proximité'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Actions rapides */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚡ Actions rapides</Text>
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.actionButton}>
                        <Plus size={24} color="#fff" />
                        <Text style={styles.actionText}>Créer un service</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                        <MagnifyingGlass size={24} color="#fff" />
                        <Text style={styles.actionText}>Rechercher</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};

// Écran des services avec liste complète
const ServicesScreen = () => {
    const { location } = useLocation();
    const { services, loading, error } = useNearbyServices(
        location?.coords.latitude,
        location?.coords.longitude
    );

    return (
        <View style={styles.screenContainer}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Services</Text>
                <TouchableOpacity style={styles.filterButton}>
                    <Text style={styles.filterText}>Filtrer</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6366F1" />
                    <Text style={styles.loadingText}>Chargement des services...</Text>
                </View>
            ) : (
                <ScrollView style={styles.servicesList}>
                    {services.map((service) => (
                        <TouchableOpacity key={service.id} style={styles.serviceListItem}>
                            <View style={styles.serviceListContent}>
                                <Text style={styles.serviceListName}>{service.name}</Text>
                                <Text style={styles.serviceListDescription}>{service.description}</Text>
                                <View style={styles.serviceListFooter}>
                                    <Text style={styles.serviceListCategory}>{service.category}</Text>
                                    <Text style={styles.serviceListDistance}>📍 {service.distance}m</Text>
                                    <Text style={styles.serviceListRating}>⭐ {service.rating}/5</Text>
                                </View>
                                {service.address && (
                                    <Text style={styles.serviceListAddress}>📍 {service.address}</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    );
};

// Écran IA avec chat fonctionnel
const AIScreen = () => {
    const { askAI, loading, error } = useAIServices();
    const [question, setQuestion] = React.useState('');
    const [response, setResponse] = React.useState<string | null>(null);
    const [chatHistory, setChatHistory] = React.useState<Array<{ type: 'user' | 'ai', message: string }>>([]);

    const handleAskAI = async () => {
        if (question.trim()) {
            const userMessage = question.trim();
            setChatHistory(prev => [...prev, { type: 'user', message: userMessage }]);
            setQuestion('');

            const aiResponse = await askAI(userMessage);
            if (aiResponse) {
                setResponse(aiResponse.message);
                setChatHistory(prev => [...prev, { type: 'ai', message: aiResponse.message }]);
            }
        }
    };

    return (
        <View style={styles.screenContainer}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>🤖 Assistant IA</Text>
            </View>

            {/* Historique du chat */}
            <ScrollView style={styles.chatContainer}>
                {chatHistory.map((msg, index) => (
                    <View key={index} style={[
                        styles.chatMessage,
                        msg.type === 'user' ? styles.userMessage : styles.aiMessage
                    ]}>
                        <Text style={[
                            styles.chatText,
                            msg.type === 'user' ? styles.userText : styles.aiText
                        ]}>
                            {msg.message}
                        </Text>
                    </View>
                ))}
                {loading && (
                    <View style={styles.aiMessage}>
                        <Text style={styles.aiText}>L'IA réfléchit...</Text>
                    </View>
                )}
            </ScrollView>

            {/* Zone de saisie */}
            <View style={styles.chatInputContainer}>
                <View style={styles.chatInput}>
                    <TextInput
                        style={styles.chatInputText}
                        placeholder="Posez votre question..."
                        value={question}
                        onChangeText={setQuestion}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                    onPress={handleAskAI}
                    disabled={loading || !question.trim()}
                >
                    <ChatCircle size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </View>
    );
};

// Écran de profil utilisateur
const ProfileScreen = () => {
    const { user } = useAuth();

    return (
        <ScrollView style={styles.screenContainer}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mon Profil</Text>
            </View>

            {/* Informations utilisateur */}
            <View style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                    <User size={48} color="#6366F1" />
                </View>
                <Text style={styles.profileName}>
                    {user ? user.email : 'Utilisateur'}
                </Text>
                <Text style={styles.profileStatus}>
                    {user ? 'Connecté' : 'Non connecté'}
                </Text>
            </View>

            {/* Menu du profil */}
            <View style={styles.section}>
                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>📝 Mes services</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>⭐ Mes avis</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>🔔 Notifications</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>⚙️ Paramètres</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem}>
                    <Text style={styles.menuText}>❓ Aide</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

// Écrans d'authentification
const LoginScreen = () => (
    <View style={styles.screenContainer}>
        <View style={styles.authContainer}>
            <Text style={styles.authTitle}>🔐 Connexion</Text>
            <Text style={styles.authSubtitle}>Connectez-vous à votre compte Yukpomnang</Text>
            <TouchableOpacity style={styles.authButton}>
                <Text style={styles.authButtonText}>Se connecter</Text>
            </TouchableOpacity>
        </View>
    </View>
);

const RegisterScreen = () => (
    <View style={styles.screenContainer}>
        <View style={styles.authContainer}>
            <Text style={styles.authTitle}>📝 Inscription</Text>
            <Text style={styles.authSubtitle}>Créez votre compte Yukpomnang</Text>
            <TouchableOpacity style={styles.authButton}>
                <Text style={styles.authButtonText}>S'inscrire</Text>
            </TouchableOpacity>
        </View>
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
    console.log('[App] 🚀 Yukpomnang - Application complète de production');

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
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    searchButton: {
        padding: 8,
    },
    notificationButton: {
        padding: 8,
    },
    locationWeatherCard: {
        backgroundColor: '#fff',
        margin: 20,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    locationSection: {
        marginBottom: 15,
    },
    locationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 5,
    },
    locationText: {
        fontSize: 14,
        color: '#6b7280',
    },
    weatherSection: {
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 15,
    },
    weatherTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 10,
    },
    weatherInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    weatherTemp: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    weatherDesc: {
        fontSize: 14,
        color: '#6b7280',
        textTransform: 'capitalize',
    },
    weatherDetails: {
        fontSize: 12,
        color: '#9ca3af',
    },
    section: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    seeAllButton: {
        padding: 5,
    },
    seeAllText: {
        fontSize: 14,
        color: '#6366F1',
        fontWeight: '600',
    },
    servicesScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    serviceCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginRight: 12,
        width: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 5,
    },
    serviceDescription: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 10,
    },
    serviceFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceDistance: {
        fontSize: 11,
        color: '#9ca3af',
    },
    serviceRating: {
        fontSize: 11,
        color: '#9ca3af',
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        backgroundColor: '#6366F1',
        borderRadius: 12,
        padding: 16,
        flex: 1,
        marginHorizontal: 5,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    actionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    servicesList: {
        flex: 1,
    },
    serviceListItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    serviceListContent: {
        flex: 1,
    },
    serviceListName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 5,
    },
    serviceListDescription: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 10,
    },
    serviceListFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    serviceListCategory: {
        fontSize: 12,
        color: '#6366F1',
        backgroundColor: '#e0e7ff',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    serviceListDistance: {
        fontSize: 12,
        color: '#9ca3af',
    },
    serviceListRating: {
        fontSize: 12,
        color: '#9ca3af',
    },
    serviceListAddress: {
        fontSize: 12,
        color: '#9ca3af',
        fontStyle: 'italic',
    },
    chatContainer: {
        flex: 1,
        padding: 20,
    },
    chatMessage: {
        marginBottom: 15,
        maxWidth: '80%',
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#6366F1',
        borderRadius: 16,
        padding: 12,
    },
    aiMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#f3f4f6',
        borderRadius: 16,
        padding: 12,
    },
    chatText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userText: {
        color: '#fff',
    },
    aiText: {
        color: '#1f2937',
    },
    chatInputContainer: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    chatInput: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 10,
    },
    chatInputText: {
        fontSize: 16,
        color: '#1f2937',
    },
    sendButton: {
        backgroundColor: '#6366F1',
        borderRadius: 20,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#9ca3af',
    },
    profileCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        margin: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    profileAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#e0e7ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    profileName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 5,
    },
    profileStatus: {
        fontSize: 14,
        color: '#6b7280',
    },
    menuItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    menuText: {
        fontSize: 16,
        color: '#1f2937',
    },
    authContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    authTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 10,
    },
    authSubtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 30,
    },
    authButton: {
        backgroundColor: '#6366F1',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        alignItems: 'center',
    },
    authButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    filterButton: {
        padding: 8,
    },
    filterText: {
        fontSize: 14,
        color: '#6366F1',
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
    },
    errorContainer: {
        backgroundColor: '#fef2f2',
        borderRadius: 8,
        padding: 16,
        margin: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
    },
    errorText: {
        fontSize: 14,
        color: '#dc2626',
    },
    noServicesContainer: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    noServicesText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
});