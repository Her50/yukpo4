// Navigation ULTRA-SIMPLIFIÉE avec TOUS les providers nécessaires
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';

// ✅ Context minimal au démarrage
import { useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { LocationProvider } from '../contexts/LocationContext';
import { useDeepLinkRedirect } from '../hooks/useDeepLinkRedirect';

// ✅ IMPORTS DIRECTS - Écrans d'authentification
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// ✅ IMPORTS DIRECTS - Écrans principaux
import HomeScreen from '../screens/HomeScreen';
import MesInteractionsScreen from '../screens/MesInteractionsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ServicesScreen from '../screens/ServicesScreen';

// ✅ IMPORTS DIRECTS - Écrans secondaires
import AjouterProduitSimpleScreen from '../screens/AjouterProduitSimpleScreen';
import ContactScreen from '../screens/ContactScreen';
import CreatePubliciteScreen from '../screens/CreatePubliciteScreen';
import EnhancedSettingsScreen from '../screens/EnhancedSettingsScreen';
import FormulaireYukpoIntelligentScreen from '../screens/FormulaireYukpoIntelligentScreen';
import MesProduitsScreen from '../screens/MesProduitsScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import PubliciteDashboardScreen from '../screens/PubliciteDashboardScreen';
import RechargeTokensScreen from '../screens/RechargeTokensScreen';
import ResultatBesoinScreen from '../screens/ResultatBesoinScreen';
import ServiceDetailSharedScreen from '../screens/ServiceDetailSharedScreen';
import SoldeDetailScreen from '../screens/SoldeDetailScreen';
import YukpoServicePlaceholderScreen from '../screens/YukpoServicePlaceholderScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Composant de chargement
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={modernColors.primary} />
    <Text style={styles.loadingText}>Chargement...</Text>
  </View>
);

// Icône de tab simple
const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const icons: { [key: string]: string } = {
    'home': '🏠',
    'services': '🛍️',
    'dashboard': '📊',
    'history': '📋',
    'profile': '👤',
  };

  return (
    <Text style={[styles.tabIcon, { color: focused ? modernColors.primary : modernColors.textSecondary }]}>
      {icons[name] || '❓'}
    </Text>
  );
};

// Stack d'authentification - Très léger
const AuthStack = () => {
  console.log('[AppNavigator] 📱 Rendu AuthStack');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
};

// Tabs principaux
const MainStack = () => {
  console.log('[AppNavigator] 📱 Rendu MainStack');
  return (
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
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingHorizontal: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Accueil' }} />
      <Tab.Screen name="Services" component={MesProduitsScreen} options={{
        tabBarLabel: 'Mes Services',
        title: 'Gestion Produits'
      }} />
      <Tab.Screen name="History" component={MesInteractionsScreen} options={{ tabBarLabel: 'Historique' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Mon Compte' }} />
    </Tab.Navigator>
  );
};

// Composant wrapper pour gérer les deep links après connexion
const DeepLinkHandler = ({ children }: { children: React.ReactNode }) => {
  useDeepLinkRedirect(); // ✅ Hook pour redirection automatique après login/register
  return <>{children}</>;
};

// Stack secondaire avec toutes les routes
const SecondaryStack = () => {
  console.log('[AppNavigator] 📱 Rendu SecondaryStack');
  return (
    <DeepLinkHandler>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainStack} />
        <Stack.Screen name="Contact" component={ContactScreen} />
        <Stack.Screen name="Settings" component={EnhancedSettingsScreen} />
        <Stack.Screen name="RechargeTokens" component={RechargeTokensScreen} />
        <Stack.Screen name="FormulaireYukpoIntelligent" component={FormulaireYukpoIntelligentScreen} />
        <Stack.Screen name="AjouterProduitSimple" component={AjouterProduitSimpleScreen} />
        <Stack.Screen name="MesProduits" component={MesProduitsScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="ServiceDetailShared" component={ServiceDetailSharedScreen} />
        <Stack.Screen name="ResultatBesoin" component={ResultatBesoinScreen} />
        <Stack.Screen name="CreatePublicite" component={CreatePubliciteScreen} />
        <Stack.Screen name="PubliciteDashboard" component={PubliciteDashboardScreen} />
        <Stack.Screen name="SoldeDetail" component={SoldeDetailScreen} />
        <Stack.Screen name="YukpoServicePlaceholder" component={YukpoServicePlaceholderScreen} />
      </Stack.Navigator>
    </DeepLinkHandler>
  );
};

// Composant wrapper avec TOUS les providers nécessaires
const AuthenticatedApp = () => {
  const [providersReady, setProvidersReady] = React.useState(false);

  React.useEffect(() => {
    // Petit délai pour afficher le loading puis charger tous les providers
    const timer = setTimeout(() => {
      console.log('[AppNavigator] 📦 Chargement de TOUS les providers nécessaires...');
      setProvidersReady(true);
    }, 50); // Juste 50ms pour smooth UX

    return () => clearTimeout(timer);
  }, []);

  if (!providersReady) {
    return <LoadingScreen />;
  }

  // ✅ TOUS les providers essentiels chargés AVANT l'affichage des écrans
  console.log('[AppNavigator] ✅ Providers chargés: Language + Location');
  return (
    <LanguageProvider>
      <LocationProvider>
        <SecondaryStack />
      </LocationProvider>
    </LanguageProvider>
  );
};

// Composant principal ULTRA-SIMPLIFIÉ
const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  console.log('[AppNavigator] 🚀 Rendu principal', { user: !!user, loading });

  // Affichage du loading
  if (loading) {
    return <LoadingScreen />;
  }

  // ✅ Si NON connecté: Seulement Login/Register
  if (!user) {
    console.log('[AppNavigator] 📱 Mode Non-Connecté');
    return <AuthStack />;
  }

  // ✅ Si connecté: Charger TOUS les providers nécessaires
  console.log('[AppNavigator] 👤 Mode Connecté - Chargement des providers');
  return <AuthenticatedApp />;
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