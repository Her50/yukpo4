// Navigation ultra-simplifiée pour éviter les crashes
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { SafeNativeView } from '../components/SafeNativeView';
import { withNavigatorSafeArea } from './withNavigatorSafeArea';

// Écrans de base seulement
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

const LoginScreenWithSafeArea = withNavigatorSafeArea(LoginScreen);
const RegisterScreenWithSafeArea = withNavigatorSafeArea(RegisterScreen);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Écran de chargement
const LoadingScreen = () => (
    <SafeNativeView style={styles.loadingContainer} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement...</Text>
    </SafeNativeView>
);

// Écran d'accueil minimal
const SimpleHomeScreen = () => (
    <SafeNativeView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.title}>🏠 Accueil Yukpo</Text>
        <Text style={styles.subtitle}>Application en cours de stabilisation</Text>
        <Text style={styles.info}>
            Les fonctionnalités seront réactivées progressivement
        </Text>
    </SafeNativeView>
);

// Tab Navigator minimal
const MainTabs = () => (
    <Tab.Navigator
        screenOptions={{
            tabBarIcon: ({ route }: any) => {
                const getIcon = (routeName: string) => {
                    switch (routeName) {
                        case 'Home': return '🏠';
                        case 'Services': return '🛍️';
                        case 'Account': return '👤';
                        default: return '🏠';
                    }
                };
                return <Text style={{ fontSize: 20 }}>{getIcon(route.name)}</Text>;
            },
            tabBarActiveTintColor: '#6366F1',
            tabBarInactiveTintColor: '#9CA3AF',
            headerShown: false,
        }}
    >
        <Tab.Screen name="Home" component={SimpleHomeScreen} />
        <Tab.Screen name="Services" component={SimpleHomeScreen} />
        <Tab.Screen name="Account" component={SimpleHomeScreen} />
    </Tab.Navigator>
);

// Stack Navigator pour l'authentification
const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreenWithSafeArea} />
        <Stack.Screen name="Register" component={RegisterScreenWithSafeArea} />
    </Stack.Navigator>
);

// Navigateur principal simplifié
const SimpleNavigator = () => {
    const { user, loading } = useAuth();

    console.log('[SimpleNavigator] État:', { loading, userConnected: !!user });

    if (loading) {
        return <LoadingScreen />;
    }

    if (user && user.id) {
        return <MainTabs />;
    }

    return <AuthStack />;
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 18,
        color: '#333',
        fontWeight: '600',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    info: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
});

export default SimpleNavigator;
