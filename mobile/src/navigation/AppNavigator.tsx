// Navigation ULTRA-SIMPLIFIÉE avec TOUS les providers nécessaires
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';
import { modernColors } from '../theme/modernTheme';
import { markNavigatorSafeAreaHandled, withNavigatorSafeArea } from './withNavigatorSafeArea';

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
import MesServicesScreen from '../screens/MesServicesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import GestionServicesSpecialisesScreen from '../screens/specialized/GestionServicesSpecialisesScreen';

// ✅ IMPORTS DIRECTS - Écrans secondaires
import AgencyTicketManagementScreen from '../screens/AgencyTicketManagementScreen';
import AjouterProduitSimpleScreen from '../screens/AjouterProduitSimpleScreen';
import BloodGroupManagementScreen from '../screens/BloodGroupManagementScreen';
import BusBoardingManagementScreen from '../screens/BusBoardingManagementScreen';
import ContactScreen from '../screens/ContactScreen';
import CreatePubliciteScreen from '../screens/CreatePubliciteScreen';
import AnalyticsDashboardScreen from '../screens/dashboard/AnalyticsDashboardScreen'; // ✅ Phase 10 - Analytics Dashboard
import DashboardPrestataireScreen from '../screens/DashboardPrestataireScreen'; // ✅ Dashboard Prestataire
import DashboardScreen from '../screens/DashboardScreen'; // ✅ Ancien Dashboard
import DeliveryHomeScreen from '../screens/delivery/DeliveryHomeScreen';
import DeliveryParcelFlowScreen from '../screens/delivery/DeliveryParcelFlowScreen';
import DeliveryShoppingFlowScreen from '../screens/delivery/DeliveryShoppingFlowScreen';
import DeliveryShoppingTrackingScreen from '../screens/delivery/DeliveryShoppingTrackingScreen';
import ShoppingBasketScreen from '../screens/delivery/ShoppingBasketScreen';
import ShoppingBudgetScreen from '../screens/delivery/ShoppingBudgetScreen';
import ShoppingPickupDropScreen from '../screens/delivery/ShoppingPickupDropScreen';
import ShoppingSummaryScreen from '../screens/delivery/ShoppingSummaryScreen';
import StorageLocationsScreen from '../screens/delivery/StorageLocationsScreen';
import EnhancedSettingsScreen from '../screens/EnhancedSettingsScreen';
import FormulaireYukpoIntelligentScreen from '../screens/FormulaireYukpoIntelligentScreen';
import ManageBusSeatsScreen from '../screens/ManageBusSeatsScreen';
import MesProduitsScreen from '../screens/MesProduitsScreen';
import MesServicesSpecialisesScreen from '../screens/MesServicesSpecialisesScreen';
import MyBusTicketsScreen from '../screens/MyBusTicketsScreen';
import OrderStatusScreen from '../screens/OrderStatusScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import GlobalPromoManagerScreen from '../screens/promo/GlobalPromoManagerScreen';
import GlobalPromoSubmissionScreen from '../screens/promo/GlobalPromoSubmissionScreen';
import ProviderOrderManagementScreen from '../screens/ProviderOrderManagementScreen';
import PubliciteDashboardScreen from '../screens/PubliciteDashboardScreen';
import RechargeTokensScreen from '../screens/RechargeTokensScreen';
import ResultatBesoinScreen from '../screens/ResultatBesoinScreen';
import ServiceDetailSharedScreen from '../screens/ServiceDetailSharedScreen';
import SoldeDetailScreen from '../screens/SoldeDetailScreen';
import AgenceVoyageFormScreen from '../screens/specialized/AgenceVoyageFormScreen';
import BanqueSangFormScreen from '../screens/specialized/BanqueSangFormScreen';
import CovoiturageFormScreen from '../screens/specialized/CovoiturageFormScreen';
import HopitalFormScreen from '../screens/specialized/HopitalFormScreen';
import LaboratoireFormScreen from '../screens/specialized/LaboratoireFormScreen';
import PharmacieFormScreen from '../screens/specialized/PharmacieFormScreen';
import TaxiFormScreen from '../screens/specialized/TaxiFormScreen';
import VideoCreationIntroScreen from '../screens/video/VideoCreationIntroScreen';
import VideoCreationWizardScreen from '../screens/video/VideoCreationWizardScreen';
import VideoGenerationResultScreen from '../screens/video/VideoGenerationResultScreen';
import VideoAnalyticsScreen from '../screens/VideoAnalyticsScreen';
import VideoFeedScreen from '../screens/VideoFeedScreen';
import YukpoServicePlaceholderScreen from '../screens/YukpoServicePlaceholderScreen';

markNavigatorSafeAreaHandled(HomeScreen as any);
markNavigatorSafeAreaHandled(ContactScreen as any);

const LoginScreenWithSafeArea = withNavigatorSafeArea(LoginScreen);
const RegisterScreenWithSafeArea = withNavigatorSafeArea(RegisterScreen);
const HomeScreenWithSafeArea = withNavigatorSafeArea(HomeScreen);
const MesInteractionsScreenWithSafeArea = withNavigatorSafeArea(MesInteractionsScreen);
const MesServicesScreenWithSafeArea = withNavigatorSafeArea(MesServicesScreen);
const ProfileScreenWithSafeArea = withNavigatorSafeArea(ProfileScreen);
const GestionServicesSpecialisesScreenWithSafeArea = withNavigatorSafeArea(GestionServicesSpecialisesScreen);
const MesProduitsScreenWithSafeArea = withNavigatorSafeArea(MesProduitsScreen);
const ContactScreenWithSafeArea = withNavigatorSafeArea(ContactScreen);
const EnhancedSettingsScreenWithSafeArea = withNavigatorSafeArea(EnhancedSettingsScreen);
const RechargeTokensScreenWithSafeArea = withNavigatorSafeArea(RechargeTokensScreen);
const FormulaireYukpoIntelligentWithSafeArea = withNavigatorSafeArea(FormulaireYukpoIntelligentScreen);
const AjouterProduitSimpleWithSafeArea = withNavigatorSafeArea(AjouterProduitSimpleScreen);
const ProductDetailScreenWithSafeArea = withNavigatorSafeArea(ProductDetailScreen);
const ServiceDetailSharedScreenWithSafeArea = withNavigatorSafeArea(ServiceDetailSharedScreen);
const ResultatBesoinScreenWithSafeArea = withNavigatorSafeArea(ResultatBesoinScreen);
const OrderStatusScreenWithSafeArea = withNavigatorSafeArea(OrderStatusScreen);
const ProviderOrderManagementScreenWithSafeArea = withNavigatorSafeArea(ProviderOrderManagementScreen);
const CreatePubliciteScreenWithSafeArea = withNavigatorSafeArea(CreatePubliciteScreen);
const PubliciteDashboardScreenWithSafeArea = withNavigatorSafeArea(PubliciteDashboardScreen);
const SoldeDetailScreenWithSafeArea = withNavigatorSafeArea(SoldeDetailScreen);
const YukpoServicePlaceholderScreenWithSafeArea = withNavigatorSafeArea(YukpoServicePlaceholderScreen);
const MesServicesSpecialisesScreenWithSafeArea = withNavigatorSafeArea(MesServicesSpecialisesScreen);
const PharmacieFormScreenWithSafeArea = withNavigatorSafeArea(PharmacieFormScreen);
const HopitalFormScreenWithSafeArea = withNavigatorSafeArea(HopitalFormScreen);
const LaboratoireFormScreenWithSafeArea = withNavigatorSafeArea(LaboratoireFormScreen);
const BanqueSangFormScreenWithSafeArea = withNavigatorSafeArea(BanqueSangFormScreen);
const AgenceVoyageFormScreenWithSafeArea = withNavigatorSafeArea(AgenceVoyageFormScreen);
const CovoiturageFormScreenWithSafeArea = withNavigatorSafeArea(CovoiturageFormScreen);
const TaxiFormScreenWithSafeArea = withNavigatorSafeArea(TaxiFormScreen);
const VideoFeedScreenWithSafeArea = withNavigatorSafeArea(VideoFeedScreen);
const VideoAnalyticsScreenWithSafeArea = withNavigatorSafeArea(VideoAnalyticsScreen);
const VideoCreationIntroScreenWithSafeArea = withNavigatorSafeArea(VideoCreationIntroScreen);
const VideoCreationWizardScreenWithSafeArea = withNavigatorSafeArea(VideoCreationWizardScreen);
const VideoGenerationResultScreenWithSafeArea = withNavigatorSafeArea(VideoGenerationResultScreen);
const GlobalPromoSubmissionScreenWithSafeArea = withNavigatorSafeArea(GlobalPromoSubmissionScreen);
const GlobalPromoManagerScreenWithSafeArea = withNavigatorSafeArea(GlobalPromoManagerScreen);
const DeliveryHomeScreenWithSafeArea = withNavigatorSafeArea(DeliveryHomeScreen);
const ShoppingBasketScreenWithSafeArea = withNavigatorSafeArea(ShoppingBasketScreen);
const ShoppingBudgetScreenWithSafeArea = withNavigatorSafeArea(ShoppingBudgetScreen);
const ShoppingPickupDropScreenWithSafeArea = withNavigatorSafeArea(ShoppingPickupDropScreen);
const ShoppingSummaryScreenWithSafeArea = withNavigatorSafeArea(ShoppingSummaryScreen);
const DeliveryShoppingTrackingScreenWithSafeArea = withNavigatorSafeArea(DeliveryShoppingTrackingScreen);
const StorageLocationsScreenWithSafeArea = withNavigatorSafeArea(StorageLocationsScreen);
const DashboardScreenWithSafeArea = withNavigatorSafeArea(DashboardScreen);
const DashboardPrestataireScreenWithSafeArea = withNavigatorSafeArea(DashboardPrestataireScreen);
const CourierDashboardScreenWithSafeArea = withNavigatorSafeArea(require('../screens/delivery/CourierDashboardScreen').default);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const DeliveryShoppingStack = createStackNavigator();

// Composant de chargement
const LoadingScreen = () => (
  <SafeNativeView style={styles.loadingContainer} edges={['top', 'bottom']}>
    <ActivityIndicator size="large" color={modernColors.primary} />
    <Text style={styles.loadingText}>Chargement...</Text>
  </SafeNativeView>
);

// Icône de tab simple
const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const icons: { [key: string]: string } = {
    'home': '🏠',
    'delivery': '🚚',
    'video': '🎬',
    'services': '🛍️',
    'dashboard': '📊',
    'history': '📋',
    'profile': '👤',
    'courierdashboard': '🚴',
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
      <Stack.Screen name="Login" component={LoginScreenWithSafeArea} />
      <Stack.Screen name="Register" component={RegisterScreenWithSafeArea} />
    </Stack.Navigator>
  );
};

// Tabs principaux
const MainStack = () => {
  console.log('[AppNavigator] 📱 Rendu MainStack');
  const { user } = useAuth();
  const [isCourier, setIsCourier] = useState(false);
  const [hasSpecializedServices, setHasSpecializedServices] = useState(false);

  // ✅ NOUVEAU : Vérifier si l'utilisateur est coursier
  useEffect(() => {
    const checkCourierStatus = async () => {
      if (!user?.id) {
        setIsCourier(false);
        return;
      }

      try {
        const { deliveryApi } = require('../services/api');
        const response = await deliveryApi.getMyCourierStatus();
        const data = response.data || response;
        setIsCourier(data.is_courier || false);
      } catch (error) {
        console.error('[AppNavigator] Erreur vérification coursier:', error);
        setIsCourier(false);
      }
    };

    checkCourierStatus();
  }, [user?.id]);

  // ✅ NOUVEAU 2025-11-26 : Vérifier si l'utilisateur a des services spécialisés
  useEffect(() => {
    const checkSpecializedServices = async () => {
      if (!user?.id) {
        setHasSpecializedServices(false);
        return;
      }

      try {
        const { apiGet } = require('../services/api');
        // Vérifier si l'utilisateur a au moins un service spécialisé
        const [pharmacies, hopitaux, laboratoires, banques_sang, agences, covoiturages, taxis] = await Promise.all([
          apiGet('/api/pharmacies').catch(() => ({ success: false, data: [] })),
          apiGet('/api/hopitaux').catch(() => ({ success: false, data: [] })),
          apiGet('/api/laboratoires').catch(() => ({ success: false, data: [] })),
          apiGet('/api/banques-sang').catch(() => ({ success: false, data: [] })),
          apiGet('/api/agences-voyage').catch(() => ({ success: false, data: [] })),
          apiGet('/api/covoiturages').catch(() => ({ success: false, data: [] })),
          apiGet('/api/taxis').catch(() => ({ success: false, data: [] })),
        ]);

        const hasAny =
          (pharmacies.success && Array.isArray(pharmacies.data) && pharmacies.data.length > 0) ||
          (hopitaux.success && Array.isArray(hopitaux.data) && hopitaux.data.length > 0) ||
          (laboratoires.success && Array.isArray(laboratoires.data) && laboratoires.data.length > 0) ||
          (banques_sang.success && Array.isArray(banques_sang.data) && banques_sang.data.length > 0) ||
          (agences.success && Array.isArray(agences.data) && agences.data.length > 0) ||
          (covoiturages.success && Array.isArray(covoiturages.data) && covoiturages.data.length > 0) ||
          (taxis.success && Array.isArray(taxis.data) && taxis.data.length > 0);

        setHasSpecializedServices(hasAny);
      } catch (error) {
        console.error('[AppNavigator] Erreur vérification services spécialisés:', error);
        setHasSpecializedServices(false);
      }
    };

    checkSpecializedServices();
  }, [user?.id]);

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
      <Tab.Screen name="Home" component={HomeScreenWithSafeArea} options={{ tabBarLabel: 'Accueil' }} />
      <Tab.Screen
        name="Video"
        component={VideoCreationIntroScreenWithSafeArea}
        options={{
          tabBarLabel: 'Vidéo',
        }}
      />
      {/* ✅ NOUVEAU 2025-11-26 : Remplacer "Mes Services" par "Gestion Services Spécialisés" si l'utilisateur en a */}
      {hasSpecializedServices ? (
        <Tab.Screen
          name="GestionServicesSpecialises"
          component={GestionServicesSpecialisesScreenWithSafeArea}
          options={{
            tabBarLabel: 'Mes Services',
            title: 'Gestion Services Spécialisés',
          }}
        />
      ) : (
        <Tab.Screen
          name="Services"
          component={MesProduitsScreenWithSafeArea}
          options={{
            tabBarLabel: 'Mes Services',
            title: 'Mes Services',
          }}
        />
      )}
      {/* ✅ NOUVEAU : Masquer l'onglet Historique si l'utilisateur est coursier */}
      {!isCourier && (
        <Tab.Screen name="History" component={MesInteractionsScreenWithSafeArea} options={{ tabBarLabel: 'Historique' }} />
      )}
      {/* ✅ NOUVEAU : Ajouter onglet "Suivre mes courses" pour les coursiers */}
      {isCourier && (
        <Tab.Screen
          name="CourierDashboard"
          component={CourierDashboardScreenWithSafeArea}
          options={{ tabBarLabel: 'Mes Courses' }}
        />
      )}
      <Tab.Screen name="Profile" component={ProfileScreenWithSafeArea} options={{ tabBarLabel: 'Mon Compte' }} />
    </Tab.Navigator>
  );
};

const DeliveryShoppingFlow = () => {
  return (
    <DeliveryShoppingStack.Navigator screenOptions={{ headerShown: false }}>
      <DeliveryShoppingStack.Screen
        name="ShoppingBasket"
        component={ShoppingBasketScreenWithSafeArea}
      />
      <DeliveryShoppingStack.Screen
        name="ShoppingBudget"
        component={ShoppingBudgetScreenWithSafeArea}
      />
      <DeliveryShoppingStack.Screen
        name="ShoppingPickupDrop"
        component={ShoppingPickupDropScreenWithSafeArea}
      />
      <DeliveryShoppingStack.Screen
        name="ShoppingSummary"
        component={ShoppingSummaryScreenWithSafeArea}
      />
    </DeliveryShoppingStack.Navigator>
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
        <Stack.Screen name="Contact" component={ContactScreenWithSafeArea} />
        <Stack.Screen name="MesServicesSpecialises" component={MesServicesSpecialisesScreenWithSafeArea} />
        <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreenWithSafeArea} />
        <Stack.Screen name="PharmacieForm" component={PharmacieFormScreenWithSafeArea} />
        <Stack.Screen name="HopitalForm" component={HopitalFormScreenWithSafeArea} />
        <Stack.Screen name="LaboratoireForm" component={LaboratoireFormScreenWithSafeArea} />
        <Stack.Screen name="BanqueSangForm" component={BanqueSangFormScreenWithSafeArea} />
        <Stack.Screen name="AgenceVoyageForm" component={AgenceVoyageFormScreenWithSafeArea} />
        <Stack.Screen name="CovoiturageForm" component={CovoiturageFormScreenWithSafeArea} />
        <Stack.Screen name="TaxiForm" component={TaxiFormScreenWithSafeArea} />
        <Stack.Screen name="MyBusTickets" component={withNavigatorSafeArea(MyBusTicketsScreen)} />
        <Stack.Screen name="BloodGroupManagement" component={withNavigatorSafeArea(BloodGroupManagementScreen)} />
        <Stack.Screen name="AgencyTicketManagement" component={withNavigatorSafeArea(AgencyTicketManagementScreen)} />
        <Stack.Screen name="BusBoardingManagement" component={withNavigatorSafeArea(BusBoardingManagementScreen)} />
        <Stack.Screen name="ManageBusSeats" component={withNavigatorSafeArea(ManageBusSeatsScreen)} />
        <Stack.Screen name="Settings" component={EnhancedSettingsScreenWithSafeArea} />
        <Stack.Screen name="RechargeTokens" component={RechargeTokensScreenWithSafeArea} />
        <Stack.Screen name="FormulaireYukpoIntelligent" component={FormulaireYukpoIntelligentWithSafeArea} />
        <Stack.Screen name="AjouterProduitSimple" component={AjouterProduitSimpleWithSafeArea} />
        <Stack.Screen name="MesProduits" component={MesProduitsScreenWithSafeArea} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreenWithSafeArea} />
        <Stack.Screen name="ServiceDetail" component={ServiceDetailSharedScreenWithSafeArea} />
        <Stack.Screen name="ServiceDetailShared" component={ServiceDetailSharedScreenWithSafeArea} />
        <Stack.Screen name="ResultatBesoin" component={ResultatBesoinScreenWithSafeArea} />
        <Stack.Screen name="CreatePublicite" component={CreatePubliciteScreenWithSafeArea} />
        <Stack.Screen name="PubliciteDashboard" component={PubliciteDashboardScreenWithSafeArea} />
        <Stack.Screen name="SoldeDetail" component={SoldeDetailScreenWithSafeArea} />
        <Stack.Screen name="YukpoServicePlaceholder" component={YukpoServicePlaceholderScreenWithSafeArea} />
        <Stack.Screen name="VideoFeed" component={VideoFeedScreenWithSafeArea} />
        <Stack.Screen name="VideoAnalytics" component={VideoAnalyticsScreenWithSafeArea} />
        <Stack.Screen name="VideoCreationIntro" component={VideoCreationIntroScreenWithSafeArea} />
        <Stack.Screen name="VideoCreationWizard" component={VideoCreationWizardScreenWithSafeArea} />
        <Stack.Screen name="VideoGenerationResult" component={VideoGenerationResultScreenWithSafeArea} />
        <Stack.Screen name="Delivery" component={DeliveryHomeScreenWithSafeArea} />
        <Stack.Screen name="DeliveryHome" component={DeliveryHomeScreenWithSafeArea} />
        <Stack.Screen name="DeliveryShoppingFlow" component={DeliveryShoppingFlow} />
        <Stack.Screen name="DeliveryShoppingFlowNew" component={withNavigatorSafeArea(DeliveryShoppingFlowScreen)} />
        <Stack.Screen name="DeliveryParcelFlow" component={withNavigatorSafeArea(DeliveryParcelFlowScreen)} />
        <Stack.Screen
          name="DeliveryShoppingTracking"
          component={DeliveryShoppingTrackingScreenWithSafeArea}
        />
        <Stack.Screen
          name="StorageLocations"
          component={StorageLocationsScreenWithSafeArea}
        />
        <Stack.Screen
          name="GlobalPromoSubmission"
          component={GlobalPromoSubmissionScreenWithSafeArea}
        />
        <Stack.Screen
          name="GlobalPromoManager"
          component={GlobalPromoManagerScreenWithSafeArea}
        />
        <Stack.Screen
          name="AnalyticsDashboard"
          component={withNavigatorSafeArea(AnalyticsDashboardScreen)}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreenWithSafeArea}
        />
        <Stack.Screen
          name="DashboardPrestataire"
          component={DashboardPrestataireScreenWithSafeArea}
        />
        <Stack.Screen
          name="CourierRegistration"
          component={withNavigatorSafeArea(require('../screens/delivery/CourierRegistrationScreen').default)}
        />
        <Stack.Screen
          name="CourierDashboard"
          component={withNavigatorSafeArea(require('../screens/delivery/CourierDashboardScreen').default)}
        />
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