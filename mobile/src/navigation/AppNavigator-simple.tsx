import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { House, User } from 'phosphor-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// Contexts
import { useAuth } from '../contexts/AuthContext-simple';

// Screens - Import simplifié
import ModernHomeScreen from '../screens/ModernHomeScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

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
    <Stack.Navigator
        screenOptions={{
            headerShown: false,
        }}
    >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
);

// Tab Navigator simplifié avec 2 onglets
const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }: any) => ({
                tabBarIcon: ({ focused, color, size }: any) => {
                    const iconProps = {
                        size: size,
                        color: color,
                        weight: (focused ? 'fill' : 'regular') as any,
                        style: { marginBottom: focused ? 2 : 0 }
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

// Navigateur principal de l'application
const AppNavigator = () => {
    const { user, loading } = useAuth();

    // Debug minimal en développement
    if (process.env.NODE_ENV === 'development') {
        console.log('[AppNavigator] user:', !!user, 'loading:', loading);
    }

    if (loading) {
        return <LoadingScreen />;
    }

    if (user) {
        return <MainStack />;
    } else {
        return <AuthStack />;
    }
};

// Styles
const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
});

export default AppNavigator;
