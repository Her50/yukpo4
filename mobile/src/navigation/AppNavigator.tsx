// Navigation ultra-moderne avec Phosphor Icons et gradients
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Bell, Brain, Briefcase, House, MagnifyingGlass, Plus, User } from 'phosphor-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

// Contexts
import { useAuth } from '../contexts/AuthContext';

// Screens
import ModernHomeScreen from '../screens/ModernHomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RechargeTokensScreen from '../screens/RechargeTokensScreen';
import RechercheBesoinScreen from '../screens/RechercheBesoinScreen';
import ServicesScreen from '../screens/ServicesScreen';

// Autres écrans (pour la navigation secondaire)
import AboutScreen from '../screens/AboutScreen';
import AIChatScreen from '../screens/ai/AIChatScreen';
import AIHubScreen from '../screens/ai/AIHubScreen';
import BlogScreen from '../screens/BlogScreen';
import ContactScreen from '../screens/ContactScreen';
import DebugScreen from '../screens/DebugScreen';
import FormulaireYukpoIntelligentScreen from '../screens/FormulaireYukpoIntelligentScreen';
import ResultatBesoinScreen from '../screens/ResultatBesoinScreen';
import CreateServiceScreen from '../screens/service/CreateServiceScreen';
import ServiceDetailScreen from '../screens/service/ServiceDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SoldeDetailScreen from '../screens/SoldeDetailScreen';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Theme

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

// Tab Navigator moderne avec 5 onglets
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
            case 'Services':
              return <Briefcase {...iconProps} />;
            case 'Search':
              return <MagnifyingGlass {...iconProps} />;
            case 'Create':
              return <Plus {...iconProps} />;
            case 'AI':
              return <Brain {...iconProps} />;
            case 'Finance':
              return <Bell {...iconProps} />;
            case 'Account':
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
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
          ...modernStyles.shadowMedium,
          borderRadius: modernStyles.borderRadius.large,
          marginHorizontal: modernStyles.spacing.md,
          marginBottom: modernStyles.spacing.md,
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
        name="Services"
        component={ServicesScreen}
        options={{
          title: 'Services',
          tabBarLabel: 'Services'
        }}
      />
      <Tab.Screen
        name="Search"
        component={RechercheBesoinScreen}
        options={{
          title: 'Recherche',
          tabBarLabel: 'Recherche'
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateServiceScreen}
        options={{
          title: 'Créer',
          tabBarLabel: 'Créer'
        }}
      />
      <Tab.Screen
        name="AI"
        component={AIChatScreen}
        options={{
          title: 'IA Yukpo',
          tabBarLabel: 'IA Yukpo'
        }}
      />
      <Tab.Screen
        name="Finance"
        component={RechargeTokensScreen}
        options={{
          title: 'Finance',
          tabBarLabel: 'Finance'
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

    {/* Création de service - Éviter les conflits avec les onglets */}
    <Stack.Screen
      name="FormulaireYukpoIntelligent"
      component={FormulaireYukpoIntelligentScreen}
      options={{ title: 'Formulaire Intelligent' }}
    />

    {/* Détails et recherche - Éviter les conflits avec les onglets */}
    <Stack.Screen
      name="ServiceDetail"
      component={ServiceDetailScreen}
      options={{ title: 'Détails du Service' }}
    />
    <Stack.Screen
      name="ResultatBesoin"
      component={ResultatBesoinScreen}
      options={{ title: 'Résultats' }}
    />

    {/* IA */}
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

    {/* Recharge - Accessible depuis Compte */}
    <Stack.Screen
      name="RechargeTokens"
      component={RechargeTokensScreen}
      options={{ title: 'Recharger Tokens' }}
    />

    {/* Paramètres et informations */}
    <Stack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ title: 'Paramètres' }}
    />
    <Stack.Screen
      name="SoldeDetail"
      component={SoldeDetailScreen}
      options={{ title: 'Historique' }}
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

// Navigateur principal de l'application - VERSION ULTRA-MODERNE
const AppNavigator = () => {
  const [navigationKey, setNavigationKey] = React.useState(0);
  const [hasError, setHasError] = React.useState(false);

  // Gestion d'erreur robuste
  const { user, loading } = useAuth();

  // Debug minimal en développement
  if (false) { // FORCÉ EN MODE PRODUCTION
    console.log('[AppNavigator] user:', !!user, 'loading:', loading);
  }

  // Détecter les changements d'utilisateur
  React.useEffect(() => {
    try {
      if (user) {
        setNavigationKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('[AppNavigator] Erreur détection utilisateur:', error);
      setHasError(true);
    }
  }, [user]);

  // Gestion d'erreur
  if (hasError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Erreur de navigation</Text>
      </View>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  try {
    if (user) {
      return <MainStack key={`main-${navigationKey}`} />;
    } else {
      return <AuthStack key={`auth-${navigationKey}`} />;
    }
  } catch (error) {
    console.error('[AppNavigator] Erreur navigation:', error);
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Erreur de navigation</Text>
      </View>
    );
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

