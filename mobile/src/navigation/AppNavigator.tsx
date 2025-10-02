// Navigation ultra-moderne avec Phosphor Icons et gradients
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Briefcase, ChartBar, Clock, House, User } from 'phosphor-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

// Contexts
import { useAuth } from '../contexts/AuthContext';

// Screens
import DashboardPrestataireScreen from '../screens/DashboardPrestataireScreen';
import ModernHomeScreen from '../screens/ModernHomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RechargeTokensScreen from '../screens/RechargeTokensScreen';
import MyServicesScreen from '../screens/service/MyServicesScreen';

// Autres écrans (pour la navigation secondaire)
import AboutScreen from '../screens/AboutScreen';
import AIChatScreen from '../screens/ai/AIChatScreen';
import AIHubScreen from '../screens/ai/AIHubScreen';
import ContactScreen from '../screens/ContactScreen';
import FormulaireYukpoIntelligentScreen from '../screens/FormulaireYukpoIntelligentScreen';
import RechercheBesoinScreen from '../screens/RechercheBesoinScreen';
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
            case 'MyServices':
              return <Briefcase {...iconProps} />;
            case 'History':
              return <Clock {...iconProps} />;
            case 'Dashboard':
              return <ChartBar {...iconProps} />;
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
        name="MyServices"
        component={MyServicesScreen}
        options={{
          title: 'Mes Services',
          tabBarLabel: 'Mes Services'
        }}
      />
      <Tab.Screen
        name="History"
        component={SoldeDetailScreen}
        options={{
          title: 'Mon Historique',
          tabBarLabel: 'Historique'
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardPrestataireScreen}
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard'
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

    {/* Création de service */}
    <Stack.Screen
      name="CreateService"
      component={CreateServiceScreen}
      options={{ title: 'Créer un Service' }}
    />
    <Stack.Screen
      name="FormulaireYukpoIntelligent"
      component={FormulaireYukpoIntelligentScreen}
      options={{ title: 'Formulaire Intelligent' }}
    />

    {/* Détails et recherche */}
    <Stack.Screen
      name="ServiceDetail"
      component={ServiceDetailScreen}
      options={{ title: 'Détails du Service' }}
    />
    <Stack.Screen
      name="RechercheBesoin"
      component={RechercheBesoinScreen}
      options={{ title: 'Recherche' }}
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

// Navigateur principal de l'application - DÉSACTIVÉ
// La navigation principale est maintenant dans App.tsx
const AppNavigator = () => {
  // Cette navigation est maintenant gérée par App.tsx
  // Gardé pour compatibilité avec les imports existants
  return null;
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

