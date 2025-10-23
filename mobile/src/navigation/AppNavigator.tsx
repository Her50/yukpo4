// Navigation simplifiée et sécurisée
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

// Contexts - seulement AuthContext pour éviter les conflits
import { useAuth } from '../contexts/AuthContext';

// ✅ OPTIMISATION: Providers chargés après authentification
import GPSTrackingManager from '../components/GPSTrackingManager';
import PushNotificationManager from '../components/PushNotificationManager';
import { GlobalIAStatsProvider } from '../components/intelligence/GlobalIAStats';
import { LanguageProvider } from '../contexts/LanguageContext';
import { LocationProvider } from '../contexts/LocationContext';

// ✅ CORRECTION CRITIQUE: Chargement différé des écrans pour éviter les crashes
// Screens - Lazy loading pour éviter les imports problématiques
const ContactScreen = React.lazy(() => import('../screens/ContactScreen'));
const HomeScreen = React.lazy(() => import('../screens/HomeScreen'));
const ProfileScreen = React.lazy(() => import('../screens/ProfileScreen'));
const RechargeTokensScreen = React.lazy(() => import('../screens/RechargeTokensScreen'));
const ServicesListScreen = React.lazy(() => import('../screens/ServicesListScreen'));
const ServicesScreen = React.lazy(() => import('../screens/ServicesScreen'));

// Autres écrans (pour la navigation secondaire) - Lazy loading
const CreatePubliciteScreen = React.lazy(() => import('../screens/CreatePubliciteScreen'));
const EnhancedSettingsScreen = React.lazy(() => import('../screens/EnhancedSettingsScreen'));
const FormulaireYukpoIntelligentScreen = React.lazy(() => import('../screens/FormulaireYukpoIntelligentScreen'));
const MesInteractionsScreen = React.lazy(() => import('../screens/MesInteractionsScreen'));
const PubliciteDashboardScreen = React.lazy(() => import('../screens/PubliciteDashboardScreen'));
const ResultatBesoinScreen = React.lazy(() => import('../screens/ResultatBesoinScreen'));
const ServiceDetailSharedScreen = React.lazy(() => import('../screens/ServiceDetailSharedScreen'));
const SoldeDetailScreen = React.lazy(() => import('../screens/SoldeDetailScreen'));
const YukpoServicePlaceholderScreen = React.lazy(() => import('../screens/YukpoServicePlaceholderScreen'));

// Auth screens - Lazy loading
const LoginScreen = React.lazy(() => import('../screens/auth/LoginScreen'));
const RegisterScreen = React.lazy(() => import('../screens/auth/RegisterScreen'));

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
      <Text style={styles.loadingText}>Chargement{String(dots)}</Text>
      <Text style={styles.loadingSubtext}>Connexion en cours...</Text>
    </View>
  );
};

// ✅ CORRECTION CRITIQUE: Wrapper pour écrans avec lazy loading
const SafeScreen = ({ children }: { children: React.ReactNode }) => (
  <React.Suspense fallback={<LoadingScreen />}>
    {children}
  </React.Suspense>
);

// Stack Navigator pour l'authentification
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="Login">
      {() => (
        <SafeScreen>
          <LoginScreen />
        </SafeScreen>
      )}
    </Stack.Screen>
    <Stack.Screen name="Register">
      {() => (
        <SafeScreen>
          <RegisterScreen />
        </SafeScreen>
      )}
    </Stack.Screen>
  </Stack.Navigator>
);

// Tab Navigator simplifié
const MainTabs = () => {
  // Fonction de traduction simplifiée
  const t = (key: string) => {
    const translations: { [key: string]: string } = {
      'home.title': 'Accueil',
      'services.title': 'Boutique | Services', // ✅ Modifié
      'activity.title': 'Activité',
      'tokens.history': 'Historique',
      'tokens.recharge': 'Recharge',
      'account.title': 'Compte',
      'settings.title': 'Paramètres',
    };
    return translations[key] || key;
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }: any) => ({
        tabBarIcon: ({ focused, color, size }: any) => {
          // Icônes simplifiées avec emojis pour éviter les problèmes d'import
          const getIcon = (routeName: string) => {
            switch (routeName) {
              case 'Home': return '🏠';
              case 'MesServices': return '🛍️';
              case 'Dashboard': return '📊';
              case 'Historique': return '🕒';
              case 'RechargeTokens': return '💳';
              case 'MonCompte': return '👤';
              case 'Settings': return '⚙️';
              default: return '🏠';
            }
          };

          return (
            <Text style={{ fontSize: size, color }}>
              {String(getIcon(route.name))}
            </Text>
          );
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
        options={{
          title: t('home.title'),
          tabBarLabel: t('home.title')
        }}
      >
        {() => {
          try {
            return (
              <SafeScreen>
                <HomeScreen />
              </SafeScreen>
            );
          } catch (error) {
            console.error('[AppNavigator] ❌ ERREUR CRITIQUE HomeScreen:', error);
            return (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#FFF' }}>
                <Text style={{ fontSize: 24, marginBottom: 10 }}>⚠️</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#1F2937' }}>Erreur de chargement</Text>
                <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
                  L'écran d'accueil ne peut pas être chargé.{'\n'}Veuillez redémarrer l'application.
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
                  Erreur: {String(error?.message || 'Inconnue')}
                </Text>
              </View>
            );
          }
        }}
      </Tab.Screen>
      <Tab.Screen
        name="MesServices"
        options={{
          title: t('services.title'),
          tabBarLabel: t('services.title')
        }}
      >
        {() => (
          <SafeScreen>
            <ServicesScreen />
          </SafeScreen>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Dashboard"
        options={{
          title: t('activity.title'),
          tabBarLabel: t('activity.title')
        }}
      >
        {() => (
          <SafeScreen>
            <MesInteractionsScreen />
          </SafeScreen>
        )}
      </Tab.Screen>
      {/* ✅ SUPPRIMÉ: Onglet Historique */}
      <Tab.Screen
        name="RechargeTokens"
        options={{
          title: t('tokens.recharge'),
          tabBarLabel: t('tokens.recharge')
        }}
      >
        {() => (
          <SafeScreen>
            <RechargeTokensScreen />
          </SafeScreen>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="MonCompte"
        options={{
          title: t('account.title'),
          tabBarLabel: t('account.title')
        }}
      >
        {() => (
          <SafeScreen>
            <ProfileScreen />
          </SafeScreen>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        options={{
          title: t('settings.title'),
          tabBarLabel: t('settings.title')
        }}
      >
        {() => (
          <SafeScreen>
            <EnhancedSettingsScreen />
          </SafeScreen>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

// Stack Navigator principal simplifié
const MainStack = () => {
  // Fonction de traduction simplifiée
  const t = (key: string) => {
    const translations: { [key: string]: string } = {
      'contact.title': 'Contact',
      'services.catalog': 'Catalogue Services',
      'search.results': 'Résultats de recherche',
      'service.create': 'Création de service',
      'service.shared': 'Service partagé',
      'tokens.history': 'Historique de Consommation',
      'publicite.create': 'Créer une publicité',
      'publicite.dashboard': 'Dashboard Publicité',
    };
    return translations[key] || key;
  };

  return (
    <>
      {/* ✅ OPTIMISATION: Providers chargés APRÈS authentification */}
      <LanguageProvider>
        <LocationProvider>
          <GlobalIAStatsProvider>
            {/* Tracking GPS automatique (seulement si connecté) */}
            <GPSTrackingManager />
            {/* Push notifications (seulement si connecté) */}
            <PushNotificationManager />

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

              {/* Pages secondaires accessibles depuis la navigation - Lazy Loading */}
              <Stack.Screen
                name="Contact"
                options={{ title: t('contact.title') || 'Contact' }}
              >
                {() => (
                  <SafeScreen>
                    <ContactScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
              <Stack.Screen
                name="Services"
                options={{ title: t('services.catalog') || 'Catalogue Services' }}
              >
                {() => (
                  <SafeScreen>
                    <ServicesListScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
              <Stack.Screen
                name="ResultatBesoin"
                options={{ title: t('search.results') || 'Résultats de recherche' }}
              >
                {() => (
                  <SafeScreen>
                    <ResultatBesoinScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
              <Stack.Screen
                name="FormulaireYukpoIntelligent"
                options={{ title: t('service.create') || 'Création de service' }}
              >
                {() => (
                  <SafeScreen>
                    <FormulaireYukpoIntelligentScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
              <Stack.Screen
                name="ServiceDetailShared"
                options={{ title: t('service.shared') || 'Service partagé', headerShown: false }}
              >
                {() => (
                  <SafeScreen>
                    <ServiceDetailSharedScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
              <Stack.Screen
                name="SoldeDetail"
                options={{ title: t('tokens.history') || 'Historique de Consommation' }}
              >
                {() => (
                  <SafeScreen>
                    <SoldeDetailScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
              <Stack.Screen
                name="YukpoService"
                options={{ headerShown: false }}
              >
                {() => (
                  <SafeScreen>
                    <YukpoServicePlaceholderScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
              <Stack.Screen
                name="CreatePublicite"
                options={{ title: t('publicite.create') || 'Créer une publicité', headerShown: false }}
              >
                {() => (
                  <SafeScreen>
                    <CreatePubliciteScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
              <Stack.Screen
                name="PubliciteDashboard"
                options={{ title: t('publicite.dashboard') || 'Dashboard Publicité', headerShown: false }}
              >
                {() => (
                  <SafeScreen>
                    <PubliciteDashboardScreen />
                  </SafeScreen>
                )}
              </Stack.Screen>
            </Stack.Navigator>
          </GlobalIAStatsProvider>
        </LocationProvider>
      </LanguageProvider>
    </>
  );
};

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

