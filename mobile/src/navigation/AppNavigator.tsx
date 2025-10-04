// Navigation ultra-moderne avec Phosphor Icons et gradients
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Bell, Briefcase, House, MagnifyingGlass, Plus, User } from 'phosphor-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

// Contexts
import { useAuth } from '../contexts/AuthContext';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RechargeTokensScreen from '../screens/RechargeTokensScreen';
import ServicesScreen from '../screens/ServicesScreen';
import ServicesListScreen from '../screens/ServicesListScreen';
import ContactScreen from '../screens/ContactScreen';

// Autres écrans (pour la navigation secondaire)
import SettingsScreen from '../screens/SettingsScreen';
import SoldeDetailScreen from '../screens/SoldeDetailScreen';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Theme

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Composant de chargement
const LoadingScreen = () => {
  const [dots, setDots] = React.useState('');

  React.useEffect(() => {
    console.log('[LoadingScreen] LoadingScreen affiché');

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => {
      console.log('[LoadingScreen] LoadingScreen démonté');
      clearInterval(interval);
    };
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6366F1" />
      <Text style={styles.loadingText}>Chargement{dots}</Text>
      <Text style={styles.loadingSubtext}>Connexion en cours...</Text>
    </View>
  );
};

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

// Tab Navigator moderne avec 5 onglets (aligné sur frontend)
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }: any) => ({
        tabBarIcon: ({ focused, color, size }: any) => {
          // Icônes Phosphor ultra-modernes avec poids dynamique
          const iconProps = {
            size: size,
            color: color,
            weight: (focused ? 'fill' : 'regular') as any,
            style: { marginBottom: focused ? 2 : 0 }
          };

          switch (route.name) {
            case 'Home':
              return <House {...iconProps} />;
            case 'MesServices':
              return <Briefcase {...iconProps} />;
            case 'Dashboard':
              return <Bell {...iconProps} />;
            case 'Historique':
              return <MagnifyingGlass {...iconProps} />;
            case 'MonCompte':
              return <User {...iconProps} />;
            default:
              return <House {...iconProps} />;
          }
        },
        tabBarActiveTintColor: modernColors.primary,
        tabBarInactiveTintColor: modernColors.textTertiary,
        tabBarStyle: {
          backgroundColor: modernColors.surface,
          borderTopWidth: 0,
          paddingBottom: 12,
          paddingTop: 12,
          height: 85,
          ...modernStyles.shadowMedium,
          borderRadius: modernStyles.borderRadius.large,
          marginHorizontal: modernStyles.spacing.md,
          marginBottom: modernStyles.spacing.md,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 2,
          marginTop: 2,
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
        name="MesServices"
        component={ServicesScreen}
        options={{
          title: 'Mes Services',
          tabBarLabel: 'Mes Services'
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard'
        }}
      />
      <Tab.Screen
        name="Historique"
        component={SoldeDetailScreen}
        options={{
          title: 'Mon historique',
          tabBarLabel: 'Historique'
        }}
      />
      <Tab.Screen
        name="MonCompte"
        component={ProfileScreen}
        options={{
          title: 'Mon Compte',
          tabBarLabel: 'Compte'
        }}
      />
    </Tab.Navigator>
  );
};

// Stack Navigator principal avec toutes les routes
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

    {/* Pages secondaires accessibles depuis la navigation */}
    <Stack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ title: 'Paramètres' }}
    />
    <Stack.Screen
      name="Contact"
      component={ContactScreen}
      options={{ title: 'Contact' }}
    />
    <Stack.Screen
      name="Services"
      component={ServicesListScreen}
      options={{ title: 'Catalogue Services' }}
    />
    <Stack.Screen
      name="RechargeTokens"
      component={RechargeTokensScreen}
      options={{ title: 'Recharger Tokens' }}
    />
  </Stack.Navigator>
);

// Navigateur principal de l'application - VERSION ROBUSTE
const AppNavigator = () => {
  const { user, loading } = useAuth();

  // Log détaillé avec le logger centralisé
  console.log('[AppNavigator] Render - État actuel', {
    loading,
    userConnected: !!user,
    userId: user?.id,
    userEmail: user?.email,
    userRole: user?.role,
    userCredits: user?.credits
  });

  // Afficher l'écran de chargement pendant l'initialisation
  if (loading) {
    console.log('[AppNavigator] ⏳ LOADING = TRUE → Affichage LoadingScreen');
    return <LoadingScreen />;
  }

  // Si l'utilisateur est connecté, afficher l'application principale
  if (user && user.id) {
    console.log('[AppNavigator] ✅ USER DÉFINI → Navigation vers MainStack', {
      email: user.email,
      id: user.id
    });
    return <MainStack />;
  }

  // Sinon, afficher l'écran de connexion
  console.log('[AppNavigator] 🔐 USER = NULL → Affichage AuthStack');
  return <AuthStack />;
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
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default AppNavigator;

