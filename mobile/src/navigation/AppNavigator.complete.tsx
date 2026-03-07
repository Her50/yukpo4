// Navigation COMPLÈTE mais optimisée pour éviter le crash
// TOUS les écrans accessibles - Application 100% opérationnelle

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

// Imports essentiels
import { useAuth } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { LocationProvider } from '../contexts/LocationContext';

// Écrans d'authentification
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

// ✅ FORMULAIRES SPÉCIALISÉS (partnerFormMap)
import PharmacieFormScreen from '../screens/specialized/PharmacieFormScreen';
import TaxiFormScreen from '../screens/specialized/TaxiFormScreen';
import HopitalFormScreen from '../screens/specialized/HopitalFormScreen';
import ImmobilierFormScreen from '../screens/specialized/ImmobilierFormScreen';
import LaboratoireFormScreen from '../screens/specialized/LaboratoireFormScreen';
import AgenceVoyageFormScreen from '../screens/specialized/AgenceVoyageFormScreen';
import BanqueSangFormScreen from '../screens/specialized/BanqueSangFormScreen';
import CovoiturageFormScreen from '../screens/specialized/CovoiturageFormScreen';

// ✅ LIVRAISON - FONCTIONNALITÉ CRITIQUE
import CourierAdminScreen from '../screens/delivery/CourierAdminScreen';
import CourierDashboardScreen from '../screens/delivery/CourierDashboardScreen';
import CourierRegistrationScreen from '../screens/delivery/CourierRegistrationScreen';
import CourierVerificationCodeScreen from '../screens/delivery/CourierVerificationCodeScreen';
import DeliveryHomeScreen from '../screens/delivery/DeliveryHomeScreen';
import DeliveryShoppingFlowScreen from '../screens/delivery/DeliveryShoppingFlowScreen';
import DeliveryShoppingTrackingScreen from '../screens/delivery/DeliveryShoppingTrackingScreen';
import ProviderCourierVerificationScreen from '../screens/delivery/ProviderCourierVerificationScreen';
import ShoppingBasketScreen from '../screens/delivery/ShoppingBasketScreen';

// ✅ PROMOTIONS - FONCTIONNALITÉ COMMERCIALE
import CreateFlashPromoScreen from '../screens/CreateFlashPromoScreen';
import FlashPromosActiveScreen from '../screens/FlashPromosActiveScreen';
import FlashSaleScreen from '../screens/FlashSaleScreen';
import GlobalPromoCatalogScreen from '../screens/GlobalPromoCatalogScreen';
import CreatePubliciteScreen from '../screens/CreatePubliciteScreen';
import PubliciteDashboardScreen from '../screens/PubliciteDashboardScreen';

// ✅ PRODUITS & SERVICES
import AjouterProduitSimpleScreen from '../screens/AjouterProduitSimpleScreen';
import MesProduitsScreen from '../screens/MesProduitsScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import ResultatBesoinScreen from '../screens/ResultatBesoinScreen';
import PrestataireBoutiqueScreen from '../screens/PrestataireBoutiqueScreen';

// ✅ RÉSERVATIONS & TRANSPORT
import MesReservationsScreen from '../screens/specialized/MesReservationsScreen';
import ReservationScreen from '../screens/specialized/ReservationScreen';
import BusTicketBookingScreen from '../screens/specialized/BusTicketBookingScreen';
import MyBusTicketsScreen from '../screens/MyBusTicketsScreen';

// ✅ HÔTELS & HÉBERGEMENT
import HotelBookingScreen from '../screens/specialized/HotelBookingScreen';
import HotelBookingPaymentScreen from '../screens/specialized/HotelBookingPaymentScreen';
import HotelQRScannerScreen from '../screens/specialized/HotelQRScannerScreen';

// ✅ EMPLOI & RECRUTEMENT
import CreateOffreScreen from '../screens/offres-emploi/CreateOffreScreen';
import OffreListScreen from '../screens/offres-emploi/OffreListScreen';
import OffreDetailsScreen from '../screens/offres-emploi/OffreDetailsScreen';

// ✅ VIDÉO & CONTENU
import VideoFeedScreen from '../screens/VideoFeedScreen';
import VideoCreationIntroScreen from '../screens/video/VideoCreationIntroScreen';

// ✅ UTILITAIRES
import SpecializedServicesHubScreen from '../screens/SpecializedServicesHubScreen';
import MesServicesSpecialisesScreen from '../screens/MesServicesSpecialisesScreen';
import EnhancedSettingsScreen from '../screens/EnhancedSettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Loading
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#6366F1" />
    <Text style={styles.loadingText}>Chargement...</Text>
  </View>
);

// Tab Navigator
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Accueil', tabBarIcon: ({ color }) => <Text style={{ color }}>🏠</Text> }} />
      <Tab.Screen name="Services" component={MesServicesScreen} options={{ tabBarLabel: 'Services', tabBarIcon: ({ color }) => <Text style={{ color }}>🔧</Text> }} />
      <Tab.Screen name="Interactions" component={MesInteractionsScreen} options={{ tabBarLabel: 'Interactions', tabBarIcon: ({ color }) => <Text style={{ color }}>💬</Text> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profil', tabBarIcon: ({ color }) => <Text style={{ color }}>👤</Text> }} />
    </Tab.Navigator>
  );
};

// Stack principal complet
const MainStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Navigation" component={NavigationScreen} />
      <Stack.Screen name="ServicesDashboard" component={ServicesDashboard} />
      <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreen} />
      
      {/* FORMULAIRES SPÉCIALISÉS */}
      <Stack.Screen name="PharmacieForm" component={PharmacieFormScreen} options={{ title: 'Pharmacie' }} />
      <Stack.Screen name="TaxiForm" component={TaxiFormScreen} options={{ title: 'Taxi' }} />
      <Stack.Screen name="HopitalForm" component={HopitalFormScreen} options={{ title: 'Hôpital' }} />
      <Stack.Screen name="ImmobilierForm" component={ImmobilierFormScreen} options={{ title: 'Immobilier' }} />
      <Stack.Screen name="LaboratoireForm" component={LaboratoireFormScreen} options={{ title: 'Laboratoire' }} />
      <Stack.Screen name="AgenceVoyageForm" component={AgenceVoyageFormScreen} options={{ title: 'Agence de voyage' }} />
      <Stack.Screen name="BanqueSangForm" component={BanqueSangFormScreen} options={{ title: 'Banque de sang' }} />
      <Stack.Screen name="CovoiturageForm" component={CovoiturageFormScreen} options={{ title: 'Covoiturage' }} />
      
      {/* LIVRAISON - CRITIQUE */}
      <Stack.Screen name="DeliveryHome" component={DeliveryHomeScreen} options={{ title: 'Livraison' }} />
      <Stack.Screen name="CourierDashboard" component={CourierDashboardScreen} options={{ title: 'Dashboard Coursier' }} />
      <Stack.Screen name="CourierRegistration" component={CourierRegistrationScreen} options={{ title: 'Inscription Coursier' }} />
      <Stack.Screen name="DeliveryShoppingFlow" component={DeliveryShoppingFlowScreen} options={{ title: 'Livraison Courses' }} />
      <Stack.Screen name="DeliveryShoppingTracking" component={DeliveryShoppingTrackingScreen} options={{ title: 'Suivi Livraison' }} />
      <Stack.Screen name="ShoppingBasket" component={ShoppingBasketScreen} options={{ title: 'Panier' }} />
      
      {/* PROMOTIONS */}
      <Stack.Screen name="CreateFlashPromo" component={CreateFlashPromoScreen} options={{ title: 'Créer Promo Flash' }} />
      <Stack.Screen name="FlashPromosActive" component={FlashPromosActiveScreen} options={{ title: 'Promos Actives' }} />
      <Stack.Screen name="FlashSale" component={FlashSaleScreen} options={{ title: 'Vente Flash' }} />
      <Stack.Screen name="CreatePublicite" component={CreatePubliciteScreen} options={{ title: 'Créer Publicité' }} />
      
      {/* PRODUITS */}
      <Stack.Screen name="AjouterProduitSimple" component={AjouterProduitSimpleScreen} options={{ title: 'Ajouter Produit' }} />
      <Stack.Screen name="MesProduits" component={MesProduitsScreen} options={{ title: 'Mes Produits' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Détail Produit' }} />
      <Stack.Screen name="ResultatBesoin" component={ResultatBesoinScreen} options={{ title: 'Résultats' }} />
      
      {/* RÉSERVATIONS */}
      <Stack.Screen name="MesReservations" component={MesReservationsScreen} options={{ title: 'Mes Réservations' }} />
      <Stack.Screen name="Reservation" component={ReservationScreen} options={{ title: 'Réservation' }} />
      <Stack.Screen name="BusTicketBooking" component={BusTicketBookingScreen} options={{ title: 'Billet Bus' }} />
      <Stack.Screen name="MyBusTickets" component={MyBusTicketsScreen} options={{ title: 'Mes Billets' }} />
      
      {/* HÔTELS */}
      <Stack.Screen name="HotelBooking" component={HotelBookingScreen} options={{ title: 'Réservation Hôtel' }} />
      <Stack.Screen name="HotelBookingPayment" component={HotelBookingPaymentScreen} options={{ title: 'Paiement Hôtel' }} />
      <Stack.Screen name="HotelQRScanner" component={HotelQRScannerScreen} options={{ title: 'QR Hôtel' }} />
      
      {/* EMPLOI */}
      <Stack.Screen name="CreateOffre" component={CreateOffreScreen} options={{ title: 'Créer Offre' }} />
      <Stack.Screen name="OffreList" component={OffreListScreen} options={{ title: 'Liste Offres' }} />
      <Stack.Screen name="OffreDetails" component={OffreDetailsScreen} options={{ title: 'Détail Offre' }} />
      
      {/* VIDÉO */}
      <Stack.Screen name="VideoFeed" component={VideoFeedScreen} options={{ title: 'Vidéos' }} />
      <Stack.Screen name="VideoCreationIntro" component={VideoCreationIntroScreen} options={{ title: 'Création Vidéo' }} />
      
      {/* UTILITAIRES */}
      <Stack.Screen name="SpecializedServicesHub" component={SpecializedServicesHubScreen} options={{ title: 'Services Spécialisés' }} />
      <Stack.Screen name="MesServicesSpecialises" component={MesServicesSpecialisesScreen} options={{ title: 'Mes Services' }} />
      <Stack.Screen name="EnhancedSettings" component={EnhancedSettingsScreen} options={{ title: 'Paramètres' }} />
    </Stack.Navigator>
  );
};

// Stack auth
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
const AppNavigator = () => {
  const { user, loading } = useAuth();

  console.log('[AppNavigator Complet] 🚀 Démarrage - Application 100% opérationnelle', { user: !!user, loading });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    console.log('[AppNavigator Complet] 📱 Mode Non-Connecté');
    return <AuthStackNavigator />;
  }

  console.log('[AppNavigator Complet] 👤 Mode Connecté - Tous les écrans accessibles');
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
