import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../screens/LoadingScreen';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main Screens
import DashboardScreen from '../screens/DashboardScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import ServicesScreen from '../screens/ServicesScreen';

// Service Screens
import CreateServiceScreen from '../screens/service/CreateServiceScreen';
import MyServicesScreen from '../screens/service/MyServicesScreen';
import ServiceDetailScreen from '../screens/service/ServiceDetailScreen';

// AI Screens
import AIChatScreen from '../screens/ai/AIChatScreen';
import AIHubScreen from '../screens/ai/AIHubScreen';

// Other Screens
import AboutScreen from '../screens/AboutScreen';
import ContactScreen from '../screens/ContactScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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

const MainTabs = () => (
    <Tab.Navigator
        screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
                let iconName: keyof typeof Ionicons.glyphMap;

                if (route.name === 'Home') {
                    iconName = focused ? 'home' : 'home-outline';
                } else if (route.name === 'Services') {
                    iconName = focused ? 'business' : 'business-outline';
                } else if (route.name === 'Search') {
                    iconName = focused ? 'search' : 'search-outline';
                } else if (route.name === 'Dashboard') {
                    iconName = focused ? 'grid' : 'grid-outline';
                } else if (route.name === 'Profile') {
                    iconName = focused ? 'person' : 'person-outline';
                } else {
                    iconName = 'help-outline';
                }

                return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: 'gray',
            headerShown: false,
        })}
    >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Services" component={ServicesScreen} />
        <Tab.Screen name="Search" component={SearchScreen} />
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
);

const AppStack = () => (
    <Stack.Navigator
        screenOptions={{
            headerShown: false,
        }}
    >
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* Service Screens */}
        <Stack.Screen
            name="CreateService"
            component={CreateServiceScreen}
            options={{ title: 'Créer un service' }}
        />
        <Stack.Screen
            name="ServiceDetail"
            component={ServiceDetailScreen}
            options={{ title: 'Détails du service' }}
        />
        <Stack.Screen
            name="MyServices"
            component={MyServicesScreen}
            options={{ title: 'Mes services' }}
        />

        {/* AI Screens */}
        <Stack.Screen
            name="AIChat"
            component={AIChatScreen}
            options={{ title: 'Chat IA' }}
        />
        <Stack.Screen
            name="AIHub"
            component={AIHubScreen}
            options={{ title: 'Hub IA' }}
        />

        {/* Other Screens */}
        <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Paramètres' }}
        />
        <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{ title: 'À propos' }}
        />
        <Stack.Screen
            name="Contact"
            component={ContactScreen}
            options={{ title: 'Contact' }}
        />
    </Stack.Navigator>
);

const AppNavigator = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            {user ? (
                <Stack.Screen name="App" component={AppStack} />
            ) : (
                <Stack.Screen name="Auth" component={AuthStack} />
            )}
        </Stack.Navigator>
    );
};

export default AppNavigator;

