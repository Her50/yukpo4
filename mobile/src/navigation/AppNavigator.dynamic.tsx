// Navigation avec Dynamic Loading pour React Native
// Les écrans spécialisés sont chargés à la demande

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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

// ✅ DYNAMIC LOADING - Composants qui chargent les écrans spécialisés à la demande
// Compatible React Native (pas de React.lazy)

const DynamicPharmacieForm = (props: any) => {
  const [PharmacieFormScreen, setPharmacieFormScreen] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadScreen = async () => {
      try {
        const module = await import('../screens/specialized/PharmacieFormScreen');
        setPharmacieFormScreen(module.default);
      } catch (error) {
        console.error('Erreur chargement PharmacieForm:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadScreen();
  }, []);

  if (isLoading || !PharmacieFormScreen) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement de Pharmacie...</Text>
      </View>
    );
  }

  return <PharmacieFormScreen {...props} />;
};

const DynamicTaxiForm = (props: any) => {
  const [TaxiFormScreen, setTaxiFormScreen] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadScreen = async () => {
      try {
        const module = await import('../screens/specialized/TaxiFormScreen');
        setTaxiFormScreen(module.default);
      } catch (error) {
        console.error('Erreur chargement TaxiForm:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadScreen();
  }, []);

  if (isLoading || !TaxiFormScreen) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement de Taxi...</Text>
      </View>
    );
  }

  return <TaxiFormScreen {...props} />;
};

const DynamicHopitalForm = (props: any) => {
  const [HopitalFormScreen, setHopitalFormScreen] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadScreen = async () => {
      try {
        const module = await import('../screens/specialized/HopitalFormScreen');
        setHopitalFormScreen(module.default);
      } catch (error) {
        console.error('Erreur chargement HopitalForm:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadScreen();
  }, []);

  if (isLoading || !HopitalFormScreen) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement de Hôpital...</Text>
      </View>
    );
  }

  return <HopitalFormScreen {...props} />;
};

const DynamicLaboratoireForm = (props: any) => {
  const [LaboratoireFormScreen, setLaboratoireFormScreen] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadScreen = async () => {
      try {
        const module = await import('../screens/specialized/LaboratoireFormScreen');
        setLaboratoireFormScreen(module.default);
      } catch (error) {
        console.error('Erreur chargement LaboratoireForm:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadScreen();
  }, []);

  if (isLoading || !LaboratoireFormScreen) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement de Laboratoire...</Text>
      </View>
    );
  }

  return <LaboratoireFormScreen {...props} />;
};

const DynamicImmobilierForm = (props: any) => {
  const [ImmobilierFormScreen, setImmobilierFormScreen] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadScreen = async () => {
      try {
        const module = await import('../screens/specialized/ImmobilierFormScreen');
        setImmobilierFormScreen(module.default);
      } catch (error) {
        console.error('Erreur chargement ImmobilierForm:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadScreen();
  }, []);

  if (isLoading || !ImmobilierFormScreen) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Chargement de Immobilier...</Text>
      </View>
    );
  }

  return <ImmobilierFormScreen {...props} />;
};

// Stack principal avec dynamic loading pour les écrans spécialisés
const MainStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />
      
      {/* ✅ ÉCRANS SPÉCIALISÉS EN DYNAMIC LOADING */}
      <Stack.Screen 
        name="PharmacieForm" 
        component={DynamicPharmacieForm}
        options={{ title: 'Pharmacie' }}
      />

      <Stack.Screen 
        name="TaxiForm" 
        component={DynamicTaxiForm}
        options={{ title: 'Taxi' }}
      />

      <Stack.Screen 
        name="HopitalForm" 
        component={DynamicHopitalForm}
        options={{ title: 'Hôpital' }}
      />

      <Stack.Screen 
        name="LaboratoireForm" 
        component={DynamicLaboratoireForm}
        options={{ title: 'Laboratoire' }}
      />

      <Stack.Screen 
        name="ImmobilierForm" 
        component={DynamicImmobilierForm}
        options={{ title: 'Immobilier' }}
      />
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
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color }}>🏠</Text>,
        }}
      />
      <Tab.Screen 
        name="Services" 
        component={MesServicesScreen}
        options={{
          tabBarLabel: 'Services',
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color }}>🔧</Text>,
        }}
      />
      <Tab.Screen 
        name="Interactions" 
        component={MesInteractionsScreen}
        options={{
          tabBarLabel: 'Interactions',
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color }}>💬</Text>,
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color }}>👤</Text>,
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

  console.log('[AppNavigator avec Dynamic Loading] 🚀 Démarrage', { user: !!user, loading });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('[AppNavigator avec Dynamic Loading] 📱 Mode Non-Connecté');
    return <AuthStackNavigator />;
  }

  console.log('[AppNavigator avec Dynamic Loading] 👤 Mode Connecté');
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
