// Navigation SÉCURISÉE qui préserve la logique existante
// Version minimaliste mais avec TOUS les écrans de la logique partnerFormMap

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

// Imports essentiels
import { useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { LocationProvider } from '../contexts/LocationContext';

// Écrans d'auth
import LoginScreen from '../screens/auth/LoginScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import PartnerRegisterScreen from '../screens/auth/PartnerRegisterScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Écrans principaux
import HomeScreen from '../screens/HomeScreen';
import MesInteractionsScreen from '../screens/MesInteractionsScreen';
import MesServicesScreen from '../screens/MesServicesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ContactScreen from '../screens/ContactScreen';
import NavigationScreen from '../screens/NavigationScreen';

// Services spécialisés
import GestionServicesSpecialisesScreen from '../screens/specialized/GestionServicesSpecialisesScreen';
import ServicesDashboard from '../screens/specialized/ServicesDashboard';

// ✅ ÉCRANS RÉFÉRENCÉS DANS LA LOGIQUE EXISTANTE (partnerFormMap)
import PharmacieFormScreen from '../screens/specialized/PharmacieFormScreen';
import TaxiFormScreen from '../screens/specialized/TaxiFormScreen';
import HopitalFormScreen from '../screens/specialized/HopitalFormScreen';
import ImmobilierFormScreen from '../screens/specialized/ImmobilierFormScreen';
import LaboratoireFormScreen from '../screens/specialized/LaboratoireFormScreen';
import AgenceVoyageFormScreen from '../screens/specialized/AgenceVoyageFormScreen';
import BanqueSangFormScreen from '../screens/specialized/BanqueSangFormScreen';
import CovoiturageFormScreen from '../screens/specialized/CovoiturageFormScreen';
import SpecializedServicesHubScreen from '../screens/SpecializedServicesHubScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Loading
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#6366F1" />
    <Text style={styles.loadingText}>Chargement...</Text>
  </View>
);

// Tab Navigator - LOGIQUE PRINCIPALE PRÉSERVÉE
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

// Stack principal - LOGIQUE DE NAVIGATION COMPLÈTE PRÉSERVÉE
const MainStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />
      
      {/* ✅ TOUS LES ÉCRANS DE LA LOGIQUE PARTNERFORMMAP - PRÉSERVATION COMPLÈTE */}
      <Stack.Screen name="PharmacieForm" component={PharmacieFormScreen} options={{ title: 'Pharmacie' }} />
      <Stack.Screen name="TaxiForm" component={TaxiFormScreen} options={{ title: 'Taxi' }} />
      <Stack.Screen name="HopitalForm" component={HopitalFormScreen} options={{ title: 'Hôpital' }} />
      <Stack.Screen name="ImmobilierForm" component={ImmobilierFormScreen} options={{ title: 'Immobilier' }} />
      <Stack.Screen name="LaboratoireForm" component={LaboratoireFormScreen} options={{ title: 'Laboratoire' }} />
      <Stack.Screen name="AgenceVoyageForm" component={AgenceVoyageFormScreen} options={{ title: 'Agence de voyage' }} />
      <Stack.Screen name="BanqueSangForm" component={BanqueSangFormScreen} options={{ title: 'Banque de sang' }} />
      <Stack.Screen name="CovoiturageForm" component={CovoiturageFormScreen} options={{ title: 'Covoiturage' }} />
      <Stack.Screen name="SpecializedServicesHub" component={SpecializedServicesHubScreen} options={{ title: 'Services spécialisés' }} />
    </Stack.Navigator>
  );
};

// Stack auth - LOGIQUE D'AUTHENTIFICATION PRÉSERVÉE
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

// App Navigator principal - LOGIQUE PRINCIPALE PRÉSERVÉE
const AppNavigator = () => {
  const { user, loading } = useAuth();

  console.log('[AppNavigator Sécurisé] 🚀 Démarrage - Logique préservée', { user: !!user, loading });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('[AppNavigator Sécurisé] 📱 Mode Non-Connecté');
    return <AuthStackNavigator />;
  }

  console.log('[AppNavigator Sécurisé] 👤 Mode Connecté - Logique complète préservée');
  return (
    <LanguageProvider>
      <LocationProvider>
        <MainStackNavigator />
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
