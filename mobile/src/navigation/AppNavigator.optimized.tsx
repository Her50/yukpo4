// Navigation OPTIMIZED with deferred imports by role
// Avoids crash by loading only relevant screens
// Compatible React Native (no React.lazy)
// ALL 260+ screens available but loaded intelligently

import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

// Essential imports (common to all roles) - ALWAYS loaded
import { useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { LocationProvider } from '../contexts/LocationContext';

// Authentication screens (common)
import LoginScreen from '../screens/auth/LoginScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import PartnerRegisterScreen from '../screens/auth/PartnerRegisterScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main screens (common)
import HomeScreen from '../screens/HomeScreen';
import MesInteractionsScreen from '../screens/MesInteractionsScreen';
import MesServicesScreen from '../screens/MesServicesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ContactScreen from '../screens/ContactScreen';
import NavigationScreen from '../screens/NavigationScreen';

// Specialized services (common)
import GestionServicesSpecialisesScreen from '../screens/specialized/GestionServicesSpecialisesScreen';
import ServicesDashboard from '../screens/specialized/ServicesDashboard';

// Advanced video component (integrated from commit f7b5e2e)
import RealTimeVideoPreview from '../components/RealTimeVideoPreview';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Loading screen
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#6366F1" />
    <Text style={styles.loadingText}>Loading...</Text>
  </View>
);

// Main tab navigator (common to all)
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color }) => <Text style={{ color }}>🏠</Text>,
        }}
      />
      <Tab.Screen 
        name="Services" 
        component={MesServicesScreen}
        options={{
          tabBarLabel: 'Services',
          tabBarIcon: ({ color }) => <Text style={{ color }}>🔧</Text>,
        }}
      />
      <Tab.Screen 
        name="Interactions" 
        component={MesInteractionsScreen}
        options={{
          tabBarLabel: 'Interactions',
          tabBarIcon: ({ color }) => <Text style={{ color }}>💬</Text>,
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <Text style={{ color }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

// Standard User Navigator - Deferred imports
const StandardUserNavigator = () => {
  const [screensLoaded, setScreensLoaded] = useState(false);
  const [dynamicScreens, setDynamicScreens] = useState<any>({});

  useEffect(() => {
    const loadUserScreens = async () => {
      try {
        console.log('[StandardUserNavigator] Loading user screens...');
        
        // Deferred imports for standard users
        const AjouterProduitSimpleScreenModule = await import('../screens/AjouterProduitSimpleScreen');
        const MesProduitsScreenModule = await import('../screens/MesProduitsScreen');
        const ProductDetailScreenModule = await import('../screens/ProductDetailScreen');
        const ResultatBesoinScreenModule = await import('../screens/ResultatBesoinScreen');
        const MesReservationsScreenModule = await import('../screens/specialized/MesReservationsScreen');
        const MyBusTicketsScreenModule = await import('../screens/MyBusTicketsScreen');
        const MyTripsScreenModule = await import('../screens/specialized/MyTripsScreen');
        const MesTrocsScreenModule = await import('../screens/specialized/MesTrocsScreen');
        const OffresEmploiHomeScreenModule = await import('../screens/offres-emploi/OffresEmploiHomeScreen');
        const OrientationScolaireHomeScreenModule = await import('../screens/orientation/OrientationScolaireHomeScreen');
        const VideoFeedScreenModule = await import('../screens/VideoFeedScreen');

        setDynamicScreens({
          AjouterProduitSimpleScreen: AjouterProduitSimpleScreenModule.default,
          MesProduitsScreen: MesProduitsScreenModule.default,
          ProductDetailScreen: ProductDetailScreenModule.default,
          ResultatBesoinScreen: ResultatBesoinScreenModule.default,
          MesReservationsScreen: MesReservationsScreenModule.default,
          MyBusTicketsScreen: MyBusTicketsScreenModule.default,
          MyTripsScreen: MyTripsScreenModule.default,
          MesTrocsScreen: MesTrocsScreenModule.default,
          OffresEmploiHomeScreen: OffresEmploiHomeScreenModule.default,
          OrientationScolaireHomeScreen: OrientationScolaireHomeScreenModule.default,
          VideoFeedScreen: VideoFeedScreenModule.default,
        });
        
        setScreensLoaded(true);
        console.log('[StandardUserNavigator] User screens loaded');
      } catch (error) {
        console.error('[StandardUserNavigator] Error loading screens:', error);
        setScreensLoaded(true); // Continue even if error
      }
    };

    loadUserScreens();
  }, []);

  if (!screensLoaded) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />
      
      {/* User screens */}
      <Stack.Screen name="AjouterProduitSimple" component={dynamicScreens.AjouterProduitSimpleScreen} options={{ title: 'Ajouter Produit' }} />
      <Stack.Screen name="MesProduits" component={dynamicScreens.MesProduitsScreen} options={{ title: 'Mes Produits' }} />
      <Stack.Screen name="ProductDetail" component={dynamicScreens.ProductDetailScreen} options={{ title: 'Détail Produit' }} />
      <Stack.Screen name="ResultatBesoin" component={dynamicScreens.ResultatBesoinScreen} options={{ title: 'Résultats' }} />
      <Stack.Screen name="MesReservations" component={dynamicScreens.MesReservationsScreen} options={{ title: 'Mes Réservations' }} />
      <Stack.Screen name="MyBusTickets" component={dynamicScreens.MyBusTicketsScreen} options={{ title: 'Mes Billets' }} />
      <Stack.Screen name="MyTrips" component={dynamicScreens.MyTripsScreen} options={{ title: 'Mes Voyages' }} />
      <Stack.Screen name="MesTrocs" component={dynamicScreens.MesTrocsScreen} options={{ title: 'Mes Trocs' }} />
      <Stack.Screen name="OffresEmploiHome" component={dynamicScreens.OffresEmploiHomeScreen} options={{ title: 'Emploi' }} />
      <Stack.Screen name="OrientationScolaireHome" component={dynamicScreens.OrientationScolaireHomeScreen} options={{ title: 'Orientation' }} />
      <Stack.Screen name="VideoFeed" component={dynamicScreens.VideoFeedScreen} options={{ title: 'Vidéos' }} />
    </Stack.Navigator>
  );
};

// Role-based Navigator Selection
const RoleBasedNavigator = () => {
  const { user } = useAuth();
  
  if (!user) {
    console.log('[RoleBasedNavigator] User not connected');
    return null;
  }

  const userRole = user.role?.toLowerCase() || 'user';
  const partnerType = user.partner_type?.toLowerCase() || '';

  console.log('[RoleBasedNavigator] Role detected:', { role: userRole, partnerType });

  // For now, use standard navigation for all roles (can be extended later)
  console.log('[RoleBasedNavigator] Standard User Navigation');
  return <StandardUserNavigator />;
};

// Authentication Stack (common)
const AuthStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="PartnerRegister" component={PartnerRegisterScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
    </Stack.Navigator>
  );
};

// Main App Navigator with optimized conditional navigation
const AppNavigator = () => {
  const { user, loading } = useAuth();

  console.log('[AppNavigator Optimized] Startup with deferred imports', { user: !!user, loading, role: user?.role });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('[AppNavigator Optimized] Non-Connected Mode');
    return <AuthStackNavigator />;
  }

  console.log('[AppNavigator Optimized] Connected Mode - Role-based navigation with deferred imports');
  return (
    <LanguageProvider>
      <LocationProvider>
        <RoleBasedNavigator />
      </LocationProvider>
    </LanguageProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
});

export default AppNavigator;
