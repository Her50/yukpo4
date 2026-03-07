// Navigation avec Lazy Loading pour éviter le crash au démarrage
// Les écrans spécialisés sont chargés à la demande uniquement

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

// ✅ IMPORTS ESSENTIELS UNIQUEMENT (toujours chargés)
import { useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { LocationProvider } from '../contexts/LocationContext';

// ✅ ÉCRANS D'AUTHENTIFICATION (toujours chargés)
import LoginScreen from '../screens/auth/LoginScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import PartnerRegisterScreen from '../screens/auth/PartnerRegisterScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// ✅ ÉCRANS PRINCIPAUX (toujours chargés)
import HomeScreen from '../screens/HomeScreen';
import MesInteractionsScreen from '../screens/MesInteractionsScreen';
import MesServicesScreen from '../screens/MesServicesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ContactScreen from '../screens/ContactScreen';
import NavigationScreen from '../screens/NavigationScreen';

// ✅ ÉCRANS SPÉCIALISÉS essentiels (toujours chargés)
import GestionServicesSpecialisesScreen from '../screens/specialized/GestionServicesSpecialisesScreen';
import ServicesDashboard from '../screens/specialized/ServicesDashboard';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Écran de chargement
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#6366F1" />
    <Text style={styles.loadingText}>Chargement...</Text>
  </View>
);

// ✅ LAZY LOADING - Composants qui chargent les écrans spécialisés à la demande
const LazyPharmacieForm = React.lazy(() => import('../screens/specialized/PharmacieFormScreen'));
const LazyTaxiForm = React.lazy(() => import('../screens/specialized/TaxiFormScreen'));
const LazyHopitalForm = React.lazy(() => import('../screens/specialized/HopitalFormScreen'));
const LazyLaboratoireForm = React.lazy(() => import('../screens/specialized/LaboratoireFormScreen'));
const LazyImmobilierForm = React.lazy(() => import('../screens/specialized/ImmobilierFormScreen'));
const LazyAgenceVoyageForm = React.lazy(() => import('../screens/specialized/AgenceVoyageFormScreen'));
const LazyBanqueSangForm = React.lazy(() => import('../screens/specialized/BanqueSangFormScreen'));
const LazyCovoiturageForm = React.lazy(() => import('../screens/specialized/CovoiturageFormScreen'));

// Wrapper pour le lazy loading avec indicateur de chargement
const LazyScreenWrapper = ({ children, title }: { children: React.ReactNode; title: string }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simuler le chargement de l'écran
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement de {title}...</Text>
      </View>
    );
  }

  return <>{children}</>;
};

// Stack principal avec lazy loading pour les écrans spécialisés
const MainStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />
      
      {/* ✅ ÉCRANS SPÉCIALISÉS EN LAZY LOADING */}
      <Stack.Screen 
        name="PharmacieForm" 
        options={{ title: 'Pharmacie' }}
      >
        {(props) => (
          <LazyScreenWrapper title="Pharmacie">
            <LazyPharmacieForm {...props} />
          </LazyScreenWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen 
        name="TaxiForm" 
        options={{ title: 'Taxi' }}
      >
        {(props) => (
          <LazyScreenWrapper title="Taxi">
            <LazyTaxiForm {...props} />
          </LazyScreenWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen 
        name="HopitalForm" 
        options={{ title: 'Hôpital' }}
      >
        {(props) => (
          <LazyScreenWrapper title="Hôpital">
            <LazyHopitalForm {...props} />
          </LazyScreenWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen 
        name="LaboratoireForm" 
        options={{ title: 'Laboratoire' }}
      >
        {(props) => (
          <LazyScreenWrapper title="Laboratoire">
            <LazyLaboratoireForm {...props} />
          </LazyScreenWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen 
        name="ImmobilierForm" 
        options={{ title: 'Immobilier' }}
      >
        {(props) => (
          <LazyScreenWrapper title="Immobilier">
            <LazyImmobilierForm {...props} />
          </LazyScreenWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen 
        name="AgenceVoyageForm" 
        options={{ title: 'Agence de voyage' }}
      >
        {(props) => (
          <LazyScreenWrapper title="Agence de voyage">
            <LazyAgenceVoyageForm {...props} />
          </LazyScreenWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen 
        name="BanqueSangForm" 
        options={{ title: 'Banque de sang' }}
      >
        {(props) => (
          <LazyScreenWrapper title="Banque de sang">
            <LazyBanqueSangForm {...props} />
          </LazyScreenWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen 
        name="CovoiturageForm" 
        options={{ title: 'Covoiturage' }}
      >
        {(props) => (
          <LazyScreenWrapper title="Covoiturage">
            <LazyCovoiturageForm {...props} />
          </LazyScreenWrapper>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

// Onglets principaux
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

// Stack d'authentification
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

// App Navigator principal
const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  console.log('[AppNavigator avec Lazy Loading] 🚀 Démarrage', { user: !!user, loading });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('[AppNavigator avec Lazy Loading] 📱 Mode Non-Connecté');
    return <AuthStackNavigator />;
  }

  console.log('[AppNavigator avec Lazy Loading] 👤 Mode Connecté');
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
