import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// Contexts
import { useAuth } from '../contexts/AuthContext';

// Screens
import AboutScreen from '../screens/AboutScreen';
import ContactScreen from '../screens/ContactScreen';
import DashboardPrestataireScreen from '../screens/DashboardPrestataireScreen';
import FormulaireYukpoIntelligentScreen from '../screens/FormulaireYukpoIntelligentScreen';
import HomeScreen from '../screens/HomeScreen';
import MesServicesScreen from '../screens/MesServicesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RechargeTokensScreen from '../screens/RechargeTokensScreen';
import RechercheBesoinScreen from '../screens/RechercheBesoinScreen';
import ResultatBesoinScreen from '../screens/ResultatBesoinScreen';
import ServicesScreen from '../screens/ServicesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SoldeDetailScreen from '../screens/SoldeDetailScreen';
import AIChatScreen from '../screens/ai/AIChatScreen';
import AIHubScreen from '../screens/ai/AIHubScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import CreateServiceScreen from '../screens/service/CreateServiceScreen';
import ServiceDetailScreen from '../screens/service/ServiceDetailScreen';
// Composant de chargement simple
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={theme.colors.primary} />
    <Text style={styles.loadingText}>Chargement...</Text>
  </View>
);

// Components
import QuickActionsMenu from '../components/QuickActionsMenu';

// Theme
import { logNavigation } from '../config/appConfig';
import { theme } from '../theme/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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

// Tab Navigator pour l'application principale
const MainTabs = () => {
  const [showQuickMenu, setShowQuickMenu] = React.useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }: any) => ({
          tabBarIcon: ({ focused, color, size }: any) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'QuickMenu') {
              iconName = focused ? 'menu' : 'menu-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            } else {
              iconName = 'help-outline';
            }

            return <Ionicons name={iconName as any} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopColor: theme.colors.border,
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Accueil' }}
        />
        <Tab.Screen
          name="QuickMenu"
          component={() => null}
          options={{ title: 'Menu' }}
          listeners={{
            tabPress: (e: { preventDefault: () => void }) => {
              e.preventDefault();
              setShowQuickMenu(true);
            },
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profil' }}
        />
      </Tab.Navigator>

      {/* Menu déroulant des actions rapides */}
      <QuickActionsMenu
        isVisible={showQuickMenu}
        onClose={() => setShowQuickMenu(false)}
      />
    </>
  );
};

// Stack Navigator principal
const MainStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: theme.colors.primary,
      },
      headerTintColor: 'white',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    }}
  >
    <Stack.Screen
      name="MainTabs"
      component={MainTabs}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="CreateService"
      component={CreateServiceScreen}
      options={{ title: 'Créer un Service' }}
    />
    <Stack.Screen
      name="ServiceDetail"
      component={ServiceDetailScreen}
      options={{ title: 'Détails du Service' }}
    />
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
    <Stack.Screen
      name="RechargeTokens"
      component={RechargeTokensScreen}
      options={{ title: 'Recharger Tokens' }}
    />
    <Stack.Screen
      name="SoldeDetail"
      component={SoldeDetailScreen}
      options={{ title: 'Historique de Consommation' }}
    />
    <Stack.Screen
      name="Dashboard"
      component={DashboardPrestataireScreen}
      options={{ title: 'Dashboard' }}
    />
    <Stack.Screen
      name="MyServices"
      component={MesServicesScreen}
      options={{ title: 'Mes Services' }}
    />
    <Stack.Screen
      name="ServicesInteragis"
      component={ServicesScreen}
      options={{ title: 'Historique Interactions' }}
    />
    <Stack.Screen
      name="FormulaireYukpoIntelligent"
      component={FormulaireYukpoIntelligentScreen}
      options={{ title: 'Formulaire Intelligent' }}
    />
    <Stack.Screen
      name="RechercheBesoin"
      component={RechercheBesoinScreen}
      options={{ title: 'Recherche de Besoin' }}
    />
    <Stack.Screen
      name="ResultatBesoin"
      component={ResultatBesoinScreen}
      options={{ title: 'Résultats de Recherche' }}
    />
  </Stack.Navigator>
);

// Navigateur principal de l'application
const AppNavigator = () => {
  const { user, loading } = useAuth();

  logNavigation('État actuel', {
    user: !!user,
    loading,
    userId: user?.id,
    userEmail: user?.email,
    userName: user?.name,
    userObject: user
  });

  // État pour suivre les changements d'utilisateur
  const [userState, setUserState] = React.useState(user);

  React.useEffect(() => {
    if (user !== userState) {
      logNavigation('Changement d\'utilisateur détecté');
      setUserState(user);
    }
  }, [user, userState]);

  if (loading) {
    logNavigation('Affichage LoadingScreen');
    return <LoadingScreen />;
  }

  if (user) {
    logNavigation('Utilisateur connecté, affichage MainStack');
    return <MainStack />;
  } else {
    logNavigation('Utilisateur non connecté, affichage AuthStack');
    return <AuthStack />;
  }
};

// Styles pour le composant de chargement
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
});

export default AppNavigator;




