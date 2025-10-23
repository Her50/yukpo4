// Navigation simplifiée et sécurisée
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';

// Contexts - seulement AuthContext pour éviter les conflits
import { useAuth } from '../contexts/AuthContext';

// ✅ OPTIMISATION: Providers chargés progressivement après authentification
import DeferredProviders from '../components/DeferredProviders';
import LazyManagers from '../components/LazyManagers';
import { LanguageProvider } from '../contexts/LanguageContext';

// ✅ OPTIMISATION: Import direct (pas de lazy loading) pour éviter les problèmes
// Auth screens - Direct import (essentiels au démarrage)
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Écrans principaux - Direct import (chargés uniquement après login)
import ContactScreen from '../screens/ContactScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RechargeTokensScreen from '../screens/RechargeTokensScreen';
import ServicesListScreen from '../screens/ServicesListScreen';
import ServicesScreen from '../screens/ServicesScreen';

// Autres écrans - Direct import
import CreatePubliciteScreen from '../screens/CreatePubliciteScreen';
import EnhancedSettingsScreen from '../screens/EnhancedSettingsScreen';
import FormulaireYukpoIntelligentScreen from '../screens/FormulaireYukpoIntelligentScreen';
import MesInteractionsScreen from '../screens/MesInteractionsScreen';
import PubliciteDashboardScreen from '../screens/PubliciteDashboardScreen';
import ResultatBesoinScreen from '../screens/ResultatBesoinScreen';
import ServiceDetailSharedScreen from '../screens/ServiceDetailSharedScreen';
import SoldeDetailScreen from '../screens/SoldeDetailScreen';
import YukpoServicePlaceholderScreen from '../screens/YukpoServicePlaceholderScreen';

// Theme

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Composant de chargement simple
const LoadingScreen = () => {
  const [dots, setDots] = React.useState('');

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={modernColors.primary} />
      <Text style={styles.loadingText}>Chargement{dots}</Text>
    </View>
  );
};

// Composant d'icône de tab sécurisé
const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const getIcon = () => {
    const iconMap: { [key: string]: string } = {
      'home': '🏠',
      'services': '🛍️',
      'dashboard': '📊',
      'history': '📋',
      'profile': '👤',
      'settings': '⚙️',
      'tokens': '💰',
    };
    return iconMap[name] || '❓';
  };

  return (
    <Text style={[
      styles.tabIcon,
      { color: focused ? modernColors.primary : modernColors.textSecondary }
    ]}>
      {getIcon()}
    </Text>
  );
};

// Stack d'authentification
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

// Stack principal avec tabs
const MainStack = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused }) => (
        <TabIcon name={route.name.toLowerCase()} focused={focused} />
      ),
      tabBarActiveTintColor: modernColors.primary,
      tabBarInactiveTintColor: modernColors.textSecondary,
      tabBarStyle: {
        backgroundColor: modernColors.background,
        borderTopColor: modernColors.border,
        borderTopWidth: 1,
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '600',
      },
    })}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{ tabBarLabel: 'Accueil' }}
    />
    <Tab.Screen
      name="Services"
      component={ServicesScreen}
      options={{ tabBarLabel: 'Boutique' }}
    />
    <Tab.Screen
      name="Dashboard"
      component={ServicesListScreen}
      options={{ tabBarLabel: 'Mes Services' }}
    />
    <Tab.Screen
      name="History"
      component={MesInteractionsScreen}
      options={{ tabBarLabel: 'Historique' }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ tabBarLabel: 'Mon Compte' }}
    />
  </Tab.Navigator>
);

// Stack de navigation secondaire
const SecondaryStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Main" component={MainStack} />
    <Stack.Screen name="Contact" component={ContactScreen} />
    <Stack.Screen name="Settings" component={EnhancedSettingsScreen} />
    <Stack.Screen name="RechargeTokens" component={RechargeTokensScreen} />
    <Stack.Screen name="FormulaireYukpoIntelligent" component={FormulaireYukpoIntelligentScreen} />
    <Stack.Screen name="ServiceDetailShared" component={ServiceDetailSharedScreen} />
    <Stack.Screen name="ResultatBesoin" component={ResultatBesoinScreen} />
    <Stack.Screen name="CreatePublicite" component={CreatePubliciteScreen} />
    <Stack.Screen name="PubliciteDashboard" component={PubliciteDashboardScreen} />
    <Stack.Screen name="SoldeDetail" component={SoldeDetailScreen} />
    <Stack.Screen name="YukpoServicePlaceholder" component={YukpoServicePlaceholderScreen} />
  </Stack.Navigator>
);

// Composant principal de navigation OPTIMISÉ
const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  // Affichage du loading pendant la vérification de l'authentification
  if (loading) {
    return <LoadingScreen />;
  }

  // ✅ OPTIMISATION CRITIQUE: Si NON connecté, AUCUN provider lourd
  if (!user) {
    return <AuthStack />;
  }

  // ✅ CHARGEMENT PROGRESSIF OPTIMAL pour utilisateurs connectés
  // Phase 1 (0ms): Écran visible immédiatement avec Language
  // Phase 2 (+500ms): LocationProvider en arrière-plan
  // Phase 3 (+1000ms): GlobalIAStats en arrière-plan
  // Phase 4 (+2000ms): GPS et Push à la demande
  return (
    <LanguageProvider>
      <DeferredProviders>
        <LazyManagers />
        <SecondaryStack />
      </DeferredProviders>
    </LanguageProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: modernColors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: modernColors.text,
    fontWeight: '500',
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
});

export default AppNavigator;