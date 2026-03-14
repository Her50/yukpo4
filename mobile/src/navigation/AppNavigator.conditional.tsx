// @ts-nocheck
// Navigation CONDITIONNELLE par rôle - Évite le crash en chargeant seulement les écrans pertinents
// TOUS les 260+ écrans sont disponibles mais chargés intelligemment selon le rôle utilisateur

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// Imports essentiels (communs à tous les rôles)
import { useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { LocationProvider } from '../contexts/LocationContext';

// Écrans d'authentification (communs)
import LoginScreen from '../screens/auth/LoginScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import PartnerRegisterScreen from '../screens/auth/PartnerRegisterScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Écrans principaux (communs)
import ContactScreen from '../screens/ContactScreen';
import HomeScreen from '../screens/HomeScreen';
import MesInteractionsScreen from '../screens/MesInteractionsScreen';
import MesServicesScreen from '../screens/MesServicesScreen';
import NavigationScreen from '../screens/NavigationScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Services spécialisés (communs)
import GestionServicesSpecialisesScreen from '../screens/specialized/GestionServicesSpecialisesScreen';
import ServicesDashboard from '../screens/specialized/ServicesDashboard';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Loading
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#6366F1" />
    <Text style={styles.loadingText}>Chargement...</Text>
  </View>
);

// Tab Navigator principal (commun à tous)
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

// ✅ NAVIGATION POUR UTILISATEURS STANDARD
const StandardUserNavigator = () => {
  // Imports pour utilisateurs standard
  const AjouterProduitSimpleScreen = React.lazy(() => import('../screens/AjouterProduitSimpleScreen'));
  const MesProduitsScreen = React.lazy(() => import('../screens/MesProduitsScreen'));
  const ProductDetailScreen = React.lazy(() => import('../screens/ProductDetailScreen'));
  const ResultatBesoinScreen = React.lazy(() => import('../screens/ResultatBesoinScreen'));
  const MesReservationsScreen = React.lazy(() => import('../screens/specialized/MesReservationsScreen'));
  const MyBusTicketsScreen = React.lazy(() => import('../screens/MyBusTicketsScreen'));
  const MyTripsScreen = React.lazy(() => import('../screens/specialized/MyTripsScreen'));
  const MesTrocsScreen = React.lazy(() => import('../screens/specialized/MesTrocsScreen'));
  const OffresEmploiHomeScreen = React.lazy(() => import('../screens/offres-emploi/OffresEmploiHomeScreen'));
  const OrientationScolaireHomeScreen = React.lazy(() => import('../screens/orientation/OrientationScolaireHomeScreen'));
  const VideoFeedScreen = React.lazy(() => import('../screens/VideoFeedScreen'));

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />

      {/* Écrans utilisateurs standard */}
      <Stack.Screen name="AjouterProduitSimple" component={AjouterProduitSimpleScreen} options={{ title: 'Ajouter Produit' }} />
      <Stack.Screen name="MesProduits" component={MesProduitsScreen} options={{ title: 'Mes Produits' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Détail Produit' }} />
      <Stack.Screen name="ResultatBesoin" component={ResultatBesoinScreen} options={{ title: 'Résultats' }} />
      <Stack.Screen name="MesReservations" component={MesReservationsScreen} options={{ title: 'Mes Réservations' }} />
      <Stack.Screen name="MyBusTickets" component={MyBusTicketsScreen} options={{ title: 'Mes Billets' }} />
      <Stack.Screen name="MyTrips" component={MyTripsScreen} options={{ title: 'Mes Voyages' }} />
      <Stack.Screen name="MesTrocs" component={MesTrocsScreen} options={{ title: 'Mes Trocs' }} />
      <Stack.Screen name="OffresEmploiHome" component={OffresEmploiHomeScreen} options={{ title: 'Emploi' }} />
      <Stack.Screen name="OrientationScolaireHome" component={OrientationScolaireHomeScreen} options={{ title: 'Orientation' }} />
      <Stack.Screen name="VideoFeed" component={VideoFeedScreen} options={{ title: 'Vidéos' }} />
    </Stack.Navigator>
  );
};

// ✅ NAVIGATION POUR COURSIERS
const CourierNavigator = () => {
  // Imports pour coursiers
  const CourierDashboardScreen = React.lazy(() => import('../screens/delivery/CourierDashboardScreen'));
  const CourierRegistrationScreen = React.lazy(() => import('../screens/delivery/CourierRegistrationScreen'));
  const DeliveryHomeScreen = React.lazy(() => import('../screens/delivery/DeliveryHomeScreen'));
  const DeliveryShoppingFlowScreen = React.lazy(() => import('../screens/delivery/DeliveryShoppingFlowScreen'));
  const DeliveryShoppingTrackingScreen = React.lazy(() => import('../screens/delivery/DeliveryShoppingTrackingScreen'));
  const ProviderCourierVerificationScreen = React.lazy(() => import('../screens/delivery/ProviderCourierVerificationScreen'));
  const MyTripsScreen = React.lazy(() => import('../screens/specialized/MyTripsScreen'));
  const MesReservationsScreen = React.lazy(() => import('../screens/specialized/MesReservationsScreen'));

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />

      {/* Écrans spécialisés coursiers */}
      <Stack.Screen name="CourierDashboard" component={CourierDashboardScreen} options={{ title: 'Dashboard Coursier' }} />
      <Stack.Screen name="CourierRegistration" component={CourierRegistrationScreen} options={{ title: 'Inscription Coursier' }} />
      <Stack.Screen name="DeliveryHome" component={DeliveryHomeScreen} options={{ title: 'Livraison' }} />
      <Stack.Screen name="DeliveryShoppingFlow" component={DeliveryShoppingFlowScreen} options={{ title: 'Courses' }} />
      <Stack.Screen name="DeliveryShoppingTracking" component={DeliveryShoppingTrackingScreen} options={{ title: 'Suivi Livraison' }} />
      <Stack.Screen name="ProviderCourierVerification" component={ProviderCourierVerificationScreen} options={{ title: 'Vérification' }} />
      <Stack.Screen name="MyTrips" component={MyTripsScreen} options={{ title: 'Mes Livraisons' }} />
      <Stack.Screen name="MesReservations" component={MesReservationsScreen} options={{ title: 'Mes Réservations' }} />
    </Stack.Navigator>
  );
};

// ✅ NAVIGATION POUR SERVICES DE SANTÉ
const HealthServicesNavigator = () => {
  // Imports pour services de santé
  const PharmacieFormScreen = React.lazy(() => import('../screens/specialized/PharmacieFormScreen'));
  const HopitalFormScreen = React.lazy(() => import('../screens/specialized/HopitalFormScreen'));
  const LaboratoireFormScreen = React.lazy(() => import('../screens/specialized/LaboratoireFormScreen'));
  const BanqueSangFormScreen = React.lazy(() => import('../screens/specialized/BanqueSangFormScreen'));
  const HealthServicesHubScreen = React.lazy(() => import('../screens/specialized/HealthServicesHubScreen'));
  const HospitalAIRecommendationsScreen = React.lazy(() => import('../screens/specialized/HospitalAIRecommendationsScreen'));
  const LabAIAnalysisScreen = React.lazy(() => import('../screens/specialized/LabAIAnalysisScreen'));
  const PharmacyAIInteractionsScreen = React.lazy(() => import('../screens/specialized/PharmacyAIInteractionsScreen'));
  const MyConsultationsScreen = React.lazy(() => import('../screens/specialized/MyConsultationsScreen'));
  const MyLabExaminationsScreen = React.lazy(() => import('../screens/specialized/MyLabExaminationsScreen'));
  const MyPharmacyOrdersScreen = React.lazy(() => import('../screens/specialized/MyPharmacyOrdersScreen'));

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />

      {/* Écrans santé */}
      <Stack.Screen name="PharmacieForm" component={PharmacieFormScreen} options={{ title: 'Pharmacie' }} />
      <Stack.Screen name="HopitalForm" component={HopitalFormScreen} options={{ title: 'Hôpital' }} />
      <Stack.Screen name="LaboratoireForm" component={LaboratoireFormScreen} options={{ title: 'Laboratoire' }} />
      <Stack.Screen name="BanqueSangForm" component={BanqueSangFormScreen} options={{ title: 'Banque de sang' }} />
      <Stack.Screen name="HealthServicesHub" component={HealthServicesHubScreen} options={{ title: 'Services Santé' }} />
      <Stack.Screen name="HospitalAIRecommendations" component={HospitalAIRecommendationsScreen} options={{ title: 'IA Hôpital' }} />
      <Stack.Screen name="LabAIAnalysis" component={LabAIAnalysisScreen} options={{ title: 'IA Labo' }} />
      <Stack.Screen name="PharmacyAIInteractions" component={PharmacyAIInteractionsScreen} options={{ title: 'IA Pharmacie' }} />
      <Stack.Screen name="MyConsultations" component={MyConsultationsScreen} options={{ title: 'Consultations' }} />
      <Stack.Screen name="MyLabExaminations" component={MyLabExaminationsScreen} options={{ title: 'Analyses' }} />
      <Stack.Screen name="MyPharmacyOrders" component={MyPharmacyOrdersScreen} options={{ title: 'Commandes Pharmacie' }} />
    </Stack.Navigator>
  );
};

// ✅ NAVIGATION POUR TRANSPORT
const TransportNavigator = () => {
  // Imports pour transport
  const TaxiFormScreen = React.lazy(() => import('../screens/specialized/TaxiFormScreen'));
  const CovoiturageFormScreen = React.lazy(() => import('../screens/specialized/CovoiturageFormScreen'));
  const AgenceVoyageFormScreen = React.lazy(() => import('../screens/specialized/AgenceVoyageFormScreen'));
  const BusTicketBookingScreen = React.lazy(() => import('../screens/specialized/BusTicketBookingScreen'));
  const HotelBookingScreen = React.lazy(() => import('../screens/specialized/HotelBookingScreen'));
  const ImmobilierFormScreen = React.lazy(() => import('../screens/specialized/ImmobilierFormScreen'));
  const CovoiturageIntelligentSearchScreen = React.lazy(() => import('../screens/specialized/CovoiturageIntelligentSearchScreen'));
  const TaxiIntelligentSearchScreen = React.lazy(() => import('../screens/specialized/TaxiIntelligentSearchScreen'));
  const MyBusTicketsScreen = React.lazy(() => import('../screens/MyBusTicketsScreen'));
  const MyTripsScreen = React.lazy(() => import('../screens/specialized/MyTripsScreen'));

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />

      {/* Écrans transport */}
      <Stack.Screen name="TaxiForm" component={TaxiFormScreen} options={{ title: 'Taxi' }} />
      <Stack.Screen name="CovoiturageForm" component={CovoiturageFormScreen} options={{ title: 'Covoiturage' }} />
      <Stack.Screen name="AgenceVoyageForm" component={AgenceVoyageFormScreen} options={{ title: 'Agence de voyage' }} />
      <Stack.Screen name="BusTicketBooking" component={BusTicketBookingScreen} options={{ title: 'Billet Bus' }} />
      <Stack.Screen name="HotelBooking" component={HotelBookingScreen} options={{ title: 'Hôtel' }} />
      <Stack.Screen name="ImmobilierForm" component={ImmobilierFormScreen} options={{ title: 'Immobilier' }} />
      <Stack.Screen name="CovoiturageIntelligentSearch" component={CovoiturageIntelligentSearchScreen} options={{ title: 'IA Covoiturage' }} />
      <Stack.Screen name="TaxiIntelligentSearch" component={TaxiIntelligentSearchScreen} options={{ title: 'IA Taxi' }} />
      <Stack.Screen name="MyBusTickets" component={MyBusTicketsScreen} options={{ title: 'Mes Billets' }} />
      <Stack.Screen name="MyTrips" component={MyTripsScreen} options={{ title: 'Mes Voyages' }} />
    </Stack.Navigator>
  );
};

// ✅ NAVIGATION POUR PARTENAIRES COMMERCIAUX
const PartnerNavigator = () => {
  // Imports pour partenaires commerciaux
  const CreateFlashPromoScreen = React.lazy(() => import('../screens/CreateFlashPromoScreen'));
  const FlashPromosActiveScreen = React.lazy(() => import('../screens/FlashPromosActiveScreen'));
  const CreatePubliciteScreen = React.lazy(() => import('../screens/CreatePubliciteScreen'));
  const PubliciteDashboardScreen = React.lazy(() => import('../screens/PubliciteDashboardScreen'));
  const AjouterProduitSimpleScreen = React.lazy(() => import('../screens/AjouterProduitSimpleScreen'));
  const MesProduitsScreen = React.lazy(() => import('../screens/MesProduitsScreen'));
  const PrestataireBoutiqueScreen = React.lazy(() => import('../screens/PrestataireBoutiqueScreen'));
  const AnalyticsDashboardScreen = React.lazy(() => import('../screens/dashboard/AnalyticsDashboardScreen'));
  const ProductStatsScreen = React.lazy(() => import('../screens/ProductStatsScreen'));
  const AgencyAnalyticsDashboardScreen = React.lazy(() => import('../screens/AgencyAnalyticsDashboard'));

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />

      {/* Écrans partenaires */}
      <Stack.Screen name="CreateFlashPromo" component={CreateFlashPromoScreen} options={{ title: 'Promo Flash' }} />
      <Stack.Screen name="FlashPromosActive" component={FlashPromosActiveScreen} options={{ title: 'Promos Actives' }} />
      <Stack.Screen name="CreatePublicite" component={CreatePubliciteScreen} options={{ title: 'Publicité' }} />
      <Stack.Screen name="PubliciteDashboard" component={PubliciteDashboardScreen} options={{ title: 'Dashboard Pub' }} />
      <Stack.Screen name="AjouterProduitSimple" component={AjouterProduitSimpleScreen} options={{ title: 'Ajouter Produit' }} />
      <Stack.Screen name="MesProduits" component={MesProduitsScreen} options={{ title: 'Mes Produits' }} />
      <Stack.Screen name="PrestataireBoutique" component={PrestataireBoutiqueScreen} options={{ title: 'Boutique' }} />
      <Stack.Screen name="AnalyticsDashboard" component={AnalyticsDashboardScreen} options={{ title: 'Analytics' }} />
      <Stack.Screen name="ProductStats" component={ProductStatsScreen} options={{ title: 'Stats Produits' }} />
      <Stack.Screen name="AgencyAnalyticsDashboard" component={AgencyAnalyticsDashboard} options={{ title: 'Analytics Agence' }} />
    </Stack.Navigator>
  );
};

// ✅ NAVIGATION POUR ADMINISTRATEURS
const AdminNavigator = () => {
  // Imports pour administrateurs
  const UserRoleManagementScreen = React.lazy(() => import('../screens/admin/UserRoleManagementScreen'));
  const AgencyTicketManagementScreen = React.lazy(() => import('../screens/AgencyTicketManagementScreen'));
  const CourierAdminScreen = React.lazy(() => import('../screens/delivery/CourierAdminScreen'));
  const DeliveryPartnersAdminScreen = React.lazy(() => import('../screens/delivery/DeliveryPartnersAdminScreen'));
  const AnalyticsDashboardScreen = React.lazy(() => import('../screens/dashboard/AnalyticsDashboardScreen'));
  const DashboardScreen = React.lazy(() => import('../screens/DashboardScreen'));
  const BloodGroupManagementScreen = React.lazy(() => import('../screens/BloodGroupManagementScreen'));
  const ManageBusSeatsScreen = React.lazy(() => import('../screens/ManageBusSeatsScreen'));
  const ManageAgencySchedulesScreen = React.lazy(() => import('../screens/ManageAgencySchedulesScreen'));

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />

      {/* Écrans admin */}
      <Stack.Screen name="UserRoleManagement" component={UserRoleManagementScreen} options={{ title: 'Gestion Rôles' }} />
      <Stack.Screen name="AgencyTicketManagement" component={AgencyTicketManagementScreen} options={{ title: 'Tickets Agence' }} />
      <Stack.Screen name="CourierAdmin" component={CourierAdminScreen} options={{ title: 'Admin Coursiers' }} />
      <Stack.Screen name="DeliveryPartnersAdmin" component={DeliveryPartnersAdminScreen} options={{ title: 'Admin Partenaires' }} />
      <Stack.Screen name="AnalyticsDashboard" component={AnalyticsDashboardScreen} options={{ title: 'Analytics' }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard Principal' }} />
      <Stack.Screen name="BloodGroupManagement" component={BloodGroupManagementScreen} options={{ title: 'Groupes Sanguins' }} />
      <Stack.Screen name="ManageBusSeats" component={ManageBusSeatsScreen} options={{ title: 'Sièges Bus' }} />
      <Stack.Screen name="ManageAgencySchedules" component={ManageAgencySchedulesScreen} options={{ title: 'Horaires Agence' }} />
    </Stack.Navigator>
  );
};

// ✅ SÉLECTION DU NAVIGATEUR SELON LE RÔLE
const RoleBasedNavigator = () => {
  const { user } = useAuth();

  if (!user) {
    console.log('[RoleBasedNavigator] ❌ Utilisateur non connecté');
    return null;
  }

  const userRole = user.role?.toLowerCase() || 'user';
  const partnerType = user.partner_type?.toLowerCase() || '';

  console.log('[RoleBasedNavigator] 👤 Rôle détecté:', { role: userRole, partnerType });

  // Logique de sélection du navigateur selon le rôle
  if (userRole === 'admin' || userRole === 'administrateur') {
    console.log('[RoleBasedNavigator] 🛡️ Navigation Administrateur');
    return <AdminNavigator />;
  }

  if (userRole === 'partenaire' || userRole === 'partner') {
    // Navigation selon le type de partenaire
    if (partnerType.includes('chauffeur') || partnerType.includes('coursier')) {
      console.log('[RoleBasedNavigator] 🚗 Navigation Coursier');
      return <CourierNavigator />;
    }

    if (partnerType.includes('pharmacie') || partnerType.includes('hopital') ||
      partnerType.includes('laboratoire') || partnerType.includes('banquesang') ||
      partnerType.includes('santé')) {
      console.log('[RoleBasedNavigator] 🏥 Navigation Santé');
      return <HealthServicesNavigator />;
    }

    if (partnerType.includes('taxi') || partnerType.includes('covoiturage') ||
      partnerType.includes('agence de voyage') || partnerType.includes('hotel') ||
      partnerType.includes('immobilier')) {
      console.log('[RoleBasedNavigator] 🚗 Navigation Transport');
      return <TransportNavigator />;
    }

    // Par défaut pour les autres partenaires
    console.log('[RoleBasedNavigator] 💼 Navigation Partenaire Commercial');
    return <PartnerNavigator />;
  }

  // Navigation par défaut pour les utilisateurs standards
  console.log('[RoleBasedNavigator] 👤 Navigation Utilisateur Standard');
  return <StandardUserNavigator />;
};

// Stack authentification (commun)
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

// App Navigator principal avec navigation conditionnelle
const AppNavigator = () => {
  const { user, loading } = useAuth();

  console.log('[AppNavigator Conditionnel] 🚀 Démarrage', { user: !!user, loading, role: user?.role });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('[AppNavigator Conditionnel] 📱 Mode Non-Connecté');
    return <AuthStackNavigator />;
  }

  console.log('[AppNavigator Conditionnel] 👤 Mode Connecté - Navigation par rôle activée');
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
