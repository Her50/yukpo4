// @ts-nocheck
// ============================================================================
// AppNavigator - 273 écrans avec chargement progressif
// Imports statiques: auth + tabs + core navigation (12 écrans)
// Imports dynamiques: tout le reste, chargé à la demande (247 écrans)
// Chaque écran est isolé : si un écran plante, les autres continuent
// ============================================================================

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { OfflineIndicator } from '../components/ux/OfflineIndicator';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useDeepLinkRedirect } from '../hooks/useDeepLinkRedirect';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

// ============================================================================
// IMPORTS STATIQUES - Écrans essentiels toujours chargés au démarrage
// ============================================================================

// Auth
import LoginScreen from '../screens/auth/LoginScreen';

// ============================================================================
// NAVIGATEURS
// ============================================================================

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// ============================================================================
// COMPOSANTS UTILITAIRES
// ============================================================================

const ScreenLoader = memo(() => {
  const { t } = useLanguageSafe();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#6366F1" />
      <Text style={styles.loadingText}>{t('message.loading')}</Text>
    </View>
  );
});

const ScreenError = memo(({ name }: { name: string }) => {
  const { t } = useLanguageSafe();
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
      <Text style={styles.errorTitle}>{t('errors.screenUnavailable') || 'Écran indisponible'}</Text>
      <Text style={styles.errorSub}>« {name} » {t('errors.couldNotLoad') || "n'a pas pu être chargé"}</Text>
    </View>
  );
});

// ============================================================================
// FACTORY LAZY SCREEN
// Cache global : chaque module n'est chargé qu'une seule fois
// Si un écran plante au chargement, seul cet écran affiche une erreur
// ============================================================================

const _cache = new Map<string, React.ComponentType<any>>();

function createLazy(importFn: () => Promise<any>, name: string): React.FC<any> {
  const Lazy: React.FC<any> = (props) => {
    const [Comp, setComp] = useState<React.ComponentType<any> | null>(
      () => _cache.get(name) || null
    );
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      if (_cache.has(name)) {
        setComp(() => _cache.get(name)!);
        return;
      }
      let alive = true;
      importFn()
        .then((mod) => {
          const c = mod?.default || mod;
          _cache.set(name, c);
          if (alive) setComp(() => c);
        })
        .catch((err) => {
          console.warn(`[AppNav] Échec chargement écran "${name}":`, err?.message || err);
          if (alive) setFailed(true);
        });
      return () => { alive = false; };
    }, []);

    if (failed) return <ScreenError name={name} />;
    if (!Comp) return <ScreenLoader />;
    return <Comp {...props} />;
  };
  Lazy.displayName = `Lazy(${name})`;
  return Lazy;
}

// ============================================================================
// REGISTRE DES ÉCRANS LAZY (247 écrans)
// Chaque appel à reg() crée un composant lazy indépendant
// ============================================================================

const S: Record<string, React.ComponentType<any>> = {};
function reg(name: string, imp: () => Promise<any>) {
  S[name] = createLazy(imp, name);
}

const loadScreen = (path: string, name?: string): React.ComponentType<any> => {
  try {
    return require(path).default;
  } catch (error) {
    console.error(`[AppNav] ❌ Impossible de charger le module ${name || path}:`, error);
    return () => <ScreenError name={name || path} />;
  }
};

// ---------------------------------------------------------------------------
// Écrans racine (69)
// ---------------------------------------------------------------------------
reg('About', () => import('../screens/AboutScreen'));
reg('AcquisitionTracker', () => import('../screens/AcquisitionTracker'));
reg('AffinerBesoinPanel', () => import('../screens/AffinerBesoinPanel'));
reg('AgencyAnalyticsDashboard', () => import('../screens/AgencyAnalyticsDashboard'));
reg('AgencyTicketManagement', () => import('../screens/AgencyTicketManagementScreen'));
reg('AjouterProduitSimple', () => import('../screens/AjouterProduitSimpleScreen'));
reg('Blog', () => import('../screens/BlogScreen'));
reg('BloodGroupManagement', () => import('../screens/BloodGroupManagementScreen'));
reg('BourseLivre', () => import('../screens/specialized/LivreScolaireHomeScreen'));
reg('LibrairieRegistration', () => import('../screens/LibrairieRegistrationScreen'));
reg('QRCodeShare', () => import('../screens/QRCodeShareScreen'));
reg('BusBoardingManagement', () => import('../screens/BusBoardingManagementScreen'));
reg('Catalogue', () => import('../screens/CatalogueScreen'));
reg('Confirmation', () => import('../screens/ConfirmationScreen'));
reg('ConnectionTest', () => import('../screens/ConnectionTestScreen'));
reg('Contact', () => import('../screens/ContactScreen'));
reg('CreateFlashPromo', () => import('../screens/CreateFlashPromoScreen'));
reg('CreatePublicite', () => import('../screens/CreatePubliciteScreen'));
reg('CreationService', () => import('../screens/CreationService'));
reg('CreationServiceEtape1', () => import('../screens/CreationServiceEtape1'));
reg('CreatorAnalytics', () => import('../screens/CreatorAnalyticsScreen'));
reg('DashboardPrestataire', () => import('../screens/DashboardPrestataireScreen'));
reg('Dashboard', () => import('../screens/DashboardScreen'));
reg('WalletFinancial', () => import('../screens/WalletFinancialScreen'));
reg('EnhancedSettings', () => import('../screens/EnhancedSettingsScreen'));
reg('Error', () => import('../screens/ErrorScreen'));
reg('FlashPromosActive', () => import('../screens/FlashPromosActiveScreen'));
reg('FlashSale', () => import('../screens/FlashSaleScreen'));
reg('FormulaireYukpoIntelligent', () => import('../screens/FormulaireYukpoIntelligentScreen'));
reg('GlobalPromoCatalog', () => import('../screens/GlobalPromoCatalogScreen'));
reg('HashtagDiscovery', () => import('../screens/HashtagDiscoveryScreen'));
reg('HistoriqueProduitsConsultes', () => import('../screens/HistoriqueProduitsConsultesScreen'));
reg('LiveHost', () => import('../screens/LiveHostScreen'));
reg('LivesList', () => import('../screens/LivesListScreen'));
reg('LiveViewer', () => import('../screens/LiveViewerScreen'));
reg('ManageAgencySchedules', () => import('../screens/ManageAgencySchedulesScreen'));
reg('ManageBusSeats', () => import('../screens/ManageBusSeatsScreen'));
reg('Match', () => import('../screens/MatchScreen'));
reg('MesEquipes', () => import('../screens/MesEquipesScreen'));
reg('MesProduits', () => import('../screens/MesProduitsScreen'));
reg('MesServices', () => import('../screens/MesServices'));
reg('MesServicesSpecialises', () => import('../screens/MesServicesSpecialisesScreen'));
reg('MesSuivis', () => import('../screens/MesSuivisScreen'));
reg('ModernHome', () => import('../screens/ModernHomeScreen'));
reg('MonEspace', () => import('../screens/MonEspace'));
reg('MonProfilPage', () => import('../screens/MonProfil'));
reg('MonProfil', () => import('../screens/MonProfilScreen'));
reg('MyBusTickets', () => import('../screens/MyBusTicketsScreen'));
reg('Navigation', () => import('../screens/NavigationScreen'));
reg('OrderStatus', () => import('../screens/OrderStatusScreen'));
reg('PaiementPlan', () => import('../screens/PaiementPlanScreen'));
reg('PlatformPaymentSettings', () => import('../screens/PlatformPaymentSettingsScreen'));
reg('Plans', () => import('../screens/PlansScreen'));
reg('PrestataireBoutique', () => import('../screens/PrestataireBoutiqueScreen'));
reg('ProductDetail', () => import('../screens/ProductDetailScreen'));
reg('ProductStats', () => import('../screens/ProductStatsScreen'));
reg('ProviderOrderManagement', () => import('../screens/ProviderOrderManagementScreen'));
reg('PubliciteDashboard', () => import('../screens/PubliciteDashboardScreen'));
reg('RechargeTokens', () => import('../screens/RechargeTokensScreen'));
reg('ResultatBesoin', () => import('../screens/ResultatBesoinScreen'));
reg('ServiceDetailShared', () => import('../screens/ServiceDetailSharedScreen'));
reg('ServicesInteragis', () => import('../screens/ServicesInteragisScreen'));
reg('ServicesList', () => import('../screens/ServicesListScreen'));
reg('Services', () => import('../screens/ServicesScreen'));
reg('Settings', () => import('../screens/SettingsScreen'));
reg('SimpleError', () => import('../screens/SimpleErrorScreen'));
reg('SoldeDetail', () => import('../screens/SoldeDetailScreen'));
reg('SpecializedSearch', () => import('../screens/SpecializedSearchScreen'));
reg('SpecializedServicesHub', () => import('../screens/SpecializedServicesHubScreen'));
reg('StartLive', () => import('../screens/StartLiveScreen'));
reg('ChangePassword', () => import('../screens/ChangePasswordScreen'));
reg('Start', () => import('../screens/StartScreen'));
reg('VideoAnalytics', () => import('../screens/VideoAnalyticsScreen'));
reg('VideoFeed', () => import('../screens/VideoFeedScreen'));
reg('YukAIGateway', () => import('../screens/YukAIGateway'));
reg('YukpoServicePlaceholder', () => import('../screens/YukpoServicePlaceholderScreen'));

// ---------------------------------------------------------------------------
// Admin (1)
// ---------------------------------------------------------------------------
reg('UserRoleManagement', () => import('../screens/admin/UserRoleManagementScreen'));

// ---------------------------------------------------------------------------
// AI (2)
// ---------------------------------------------------------------------------
reg('AIChat', () => import('../screens/ai/AIChatScreen'));
reg('AIHub', () => import('../screens/ai/AIHubScreen'));

// ---------------------------------------------------------------------------
// Dashboard (2)
// ---------------------------------------------------------------------------
reg('AnalyticsDashboard', () => import('../screens/dashboard/AnalyticsDashboardScreen'));
reg('DashboardMonProfil', () => import('../screens/dashboard/MonProfilScreen'));

// ---------------------------------------------------------------------------
// Delivery (18)
// ---------------------------------------------------------------------------
reg('CourierAdmin', () => import('../screens/delivery/CourierAdminScreen'));
reg('FleetDashboard', () => import('../screens/delivery/FleetDashboardScreen'));
reg('CourierDashboard', () => import('../screens/delivery/CourierDashboardScreen'));
reg('CourierRegistration', () => import('../screens/delivery/CourierRegistrationScreen'));
reg('CourierVerificationCode', () => import('../screens/delivery/CourierVerificationCodeScreen'));
reg('DeliveryCommissionsAdmin', () => import('../screens/delivery/DeliveryCommissionsAdminScreen'));
reg('DeliveryHome', () => import('../screens/delivery/DeliveryHomeScreen'));
reg('DeliveryParcelFlowNew', () => import('../screens/delivery/DeliveryParcelFlowNewScreen'));
reg('DeliveryParcelFlowScreen', () => import('../screens/delivery/DeliveryParcelFlowScreen'));
reg('DeliveryPartnersAdmin', () => import('../screens/delivery/DeliveryPartnersAdminScreen'));
reg('DeliveryProof', () => import('../screens/delivery/DeliveryProofScreen'));
reg('DeliveryShoppingFlow', () => import('../screens/delivery/DeliveryShoppingFlowScreen'));
reg('DeliveryShoppingFlowNew', () => import('../screens/delivery/DeliveryShoppingFlowNew'));
reg('DeliveryShoppingTracking', () => import('../screens/delivery/DeliveryShoppingTrackingScreen'));
reg('ProviderCourierVerification', () => import('../screens/delivery/ProviderCourierVerificationScreen'));
reg('ShoppingBasket', () => import('../screens/delivery/ShoppingBasketScreen'));
reg('ShoppingBudget', () => import('../screens/delivery/ShoppingBudgetScreen'));
reg('ShoppingPickupDrop', () => import('../screens/delivery/ShoppingPickupDropScreen'));
reg('ShoppingSummary', () => import('../screens/delivery/ShoppingSummaryScreen'));
reg('StorageLocations', () => import('../screens/delivery/StorageLocationsScreen'));
reg('ExternalProvidersAdmin', () => import('../screens/delivery/ExternalProvidersAdminScreen'));
reg('CourierHistory', () => import('../screens/delivery/CourierHistoryScreen'));
reg('CourierWithdrawal', () => import('../screens/delivery/CourierWithdrawalScreen'));

// ---------------------------------------------------------------------------
// Offres d'emploi (14)
// ---------------------------------------------------------------------------
reg('AICVAnalysis', () => import('../screens/offres-emploi/AICVAnalysisScreen'));
reg('AISalaryPrediction', () => import('../screens/offres-emploi/AISalaryPredictionScreen'));
reg('AISuggestFormations', () => import('../screens/offres-emploi/AISuggestFormationsScreen'));
reg('AlertesEmploi', () => import('../screens/offres-emploi/AlertesEmploiScreen'));
reg('AnalyseCV', () => import('../screens/offres-emploi/AnalyseCVScreen'));
reg('CreateOffre', () => import('../screens/offres-emploi/CreateOffreScreen'));
reg('MesOffres', () => import('../screens/offres-emploi/MesOffresScreen'));
reg('OffreCandidatures', () => import('../screens/offres-emploi/OffreCandidaturesScreen'));
reg('OffreDetails', () => import('../screens/offres-emploi/OffreDetailsScreen'));
reg('OffreList', () => import('../screens/offres-emploi/OffreListScreen'));
reg('OffreSearch', () => import('../screens/offres-emploi/OffreSearchScreen'));
reg('OffresEmploiHome', () => import('../screens/offres-emploi/OffresEmploiHomeScreen'));
reg('OffresEmploiHub', () => import('../screens/offres-emploi/OffresEmploiHubScreen'));
reg('ProfilCandidat', () => import('../screens/offres-emploi/ProfilCandidatScreen'));

// ---------------------------------------------------------------------------
// Orientation scolaire (14)
// ---------------------------------------------------------------------------
reg('ConcoursEntree', () => import('../screens/orientation/ConcoursEntreeScreen'));
reg('ConferencesLives', () => import('../screens/orientation/ConferencesLivesScreen'));
reg('CreateEtablissement', () => import('../screens/orientation/CreateEtablissementScreen'));
reg('EtablissementDetails', () => import('../screens/orientation/EtablissementDetailsScreen'));
reg('EtablissementSearch', () => import('../screens/orientation/EtablissementSearchScreen'));
reg('ExperiencesEtudiants', () => import('../screens/orientation/ExperiencesEtudiantsScreen'));
reg('FournituresScolaires', () => import('../screens/orientation/FournituresScolairesScreen'));
reg('OrientationAIComparePrograms', () => import('../screens/orientation/OrientationAICompareProgramsScreen'));
reg('OrientationAIProfileAnalysis', () => import('../screens/orientation/OrientationAIProfileAnalysisScreen'));
reg('OrientationAIRecommendations', () => import('../screens/orientation/OrientationAIRecommendationsScreen'));
reg('OrientationScolaireHome', () => import('../screens/orientation/OrientationScolaireHomeScreen'));
reg('OrientationScolaireHub', () => import('../screens/orientation/OrientationScolaireHubScreen'));
reg('ProfilEtudiant', () => import('../screens/orientation/ProfilEtudiantScreen'));
reg('ProgrammesScolaires', () => import('../screens/orientation/ProgrammesScolairesScreen'));

// ---------------------------------------------------------------------------
// Promos (2)
// ---------------------------------------------------------------------------
reg('GlobalPromoManager', () => import('../screens/promo/GlobalPromoManagerScreen'));
reg('GlobalPromoSubmission', () => import('../screens/promo/GlobalPromoSubmissionScreen'));

// ---------------------------------------------------------------------------
// Service (4)
// ---------------------------------------------------------------------------
reg('CreateService', () => import('../screens/service/CreateServiceScreen'));
reg('ServiceMesServices', () => import('../screens/service/MesServicesScreen'));
reg('MyServices', () => import('../screens/service/MyServicesScreen'));
reg('ServiceDetail', () => import('../screens/service/ServiceDetailScreen'));

// ---------------------------------------------------------------------------
// Specialized - Agences de voyage (4)
// ---------------------------------------------------------------------------
reg('AgenceVoyageDetails', () => import('../screens/specialized/AgenceVoyageDetailsScreen'));
reg('AgenceVoyageForm', () => import('../screens/specialized/AgenceVoyageFormScreen'));
reg('AgenceVoyageList', () => import('../screens/specialized/AgenceVoyageListScreen'));
reg('AgenceVoyageSearch', () => import('../screens/specialized/AgenceVoyageSearchScreen'));

// ---------------------------------------------------------------------------
// Specialized - Assurance (5)
// ---------------------------------------------------------------------------
reg('AssuranceDashboard', () => import('../screens/specialized/AssuranceDashboardScreen'));
reg('DeclarationSinistre', () => import('../screens/specialized/DeclarationSinistreScreen'));
reg('InsuranceQuoteRequest', () => import('../screens/specialized/InsuranceQuoteRequestScreen'));
reg('InsuranceServicesResults', () => import('../screens/specialized/InsuranceServicesResultsScreen'));
reg('InsuranceServicesSearch', () => import('../screens/specialized/InsuranceServicesSearchScreen'));
reg('MesPolicesAssurance', () => import('../screens/specialized/MesPolicesAssuranceScreen'));
reg('SuiviSinistre', () => import('../screens/specialized/SuiviSinistreScreen'));

// ---------------------------------------------------------------------------
// Specialized - Automobile (4)
// ---------------------------------------------------------------------------
reg('AutomobileDashboard', () => import('../screens/specialized/AutomobileDashboardScreen'));
reg('AutoServicesResults', () => import('../screens/specialized/AutoServicesResultsScreen'));
reg('AutoServicesSearch', () => import('../screens/specialized/AutoServicesSearchScreen'));

// ---------------------------------------------------------------------------
// Specialized - Banque de sang (7)
// ---------------------------------------------------------------------------
reg('BanqueSangDetails', () => import('../screens/specialized/BanqueSangDetailsScreen'));
reg('BanqueSangForm', () => import('../screens/specialized/BanqueSangFormScreen'));
reg('BanqueSangList', () => import('../screens/specialized/BanqueSangListScreen'));
reg('BanqueSangSearch', () => import('../screens/specialized/BanqueSangSearchScreen'));
reg('BloodDonationMatches', () => import('../screens/specialized/BloodDonationMatchesScreen'));
reg('BloodDonationRequest', () => import('../screens/specialized/BloodDonationRequestScreen'));
reg('BloodDonation', () => import('../screens/specialized/BloodDonationScreen'));
reg('MyBloodDonations', () => import('../screens/specialized/MyBloodDonationsScreen'));

// ---------------------------------------------------------------------------
// Specialized - Bayam Selam (2)
// ---------------------------------------------------------------------------
reg('BayamSelamResults', () => import('../screens/specialized/BayamSelamResultsScreen'));
reg('BayamSelamSearch', () => import('../screens/specialized/BayamSelamSearchScreen'));

// ---------------------------------------------------------------------------
// Specialized - Bus / Tickets de voyage (10)
// ---------------------------------------------------------------------------
reg('BusReturnRequestForm', () => import('../screens/specialized/BusReturnRequestFormScreen'));
reg('BusReturnRequests', () => import('../screens/specialized/BusReturnRequestsScreen'));
reg('BusTicketBooking', () => import('../screens/specialized/BusTicketBookingScreen'));
reg('BusTicketCredits', () => import('../screens/specialized/BusTicketCreditsScreen'));
reg('BusTicketDetails', () => import('../screens/specialized/BusTicketDetailsScreen'));
reg('BusTicketPayment', () => import('../screens/specialized/BusTicketPaymentScreen'));
reg('BusTicketQRScanner', () => import('../screens/specialized/BusTicketQRScannerScreen'));
reg('BusTicketQR', () => import('../screens/specialized/BusTicketQRScreen'));
reg('BusTicketSearch', () => import('../screens/specialized/BusTicketSearchScreen'));
reg('TicketVoyageHome', () => import('../screens/specialized/TicketVoyageHomeScreen'));
reg('MyTrips', () => import('../screens/specialized/MyTripsScreen'));

// ---------------------------------------------------------------------------
// Specialized - Covoiturage (8)
// ---------------------------------------------------------------------------
reg('CovoiturageBooking', () => import('../screens/specialized/CovoiturageBookingScreen'));
reg('CovoiturageDetails', () => import('../screens/specialized/CovoiturageDetailsScreen'));
reg('CovoiturageForm', () => import('../screens/specialized/CovoiturageFormScreen'));
reg('CovoiturageHome', () => import('../screens/specialized/CovoiturageHomeScreen'));
reg('CovoiturageIntelligentSearch', () => import('../screens/specialized/CovoiturageIntelligentSearchScreen'));
reg('CovoiturageList', () => import('../screens/specialized/CovoiturageListScreen'));
reg('CovoiturageSearch', () => import('../screens/specialized/CovoiturageSearchScreen'));
reg('MesReservationsCovoiturage', () => import('../screens/specialized/MesReservationsCovoiturageScreen'));

// ---------------------------------------------------------------------------
// Specialized - Famille (1)
// ---------------------------------------------------------------------------
reg('FamilyProfile', () => import('../screens/specialized/FamilyProfileScreen'));

// ---------------------------------------------------------------------------
// Specialized - Santé / Hôpital (8)
// ---------------------------------------------------------------------------
reg('HealthServicesHub', () => import('../screens/specialized/HealthServicesHubScreen'));
reg('HopitalDetails', () => import('../screens/specialized/HopitalDetailsScreen'));
reg('HopitalForm', () => import('../screens/specialized/HopitalFormScreen'));
reg('HopitalHome', () => import('../screens/specialized/HopitalHomeScreen'));
reg('HopitalList', () => import('../screens/specialized/HopitalListScreen'));
reg('HopitalSearch', () => import('../screens/specialized/HopitalSearchScreen'));
reg('HospitalAIRecommendations', () => import('../screens/specialized/HospitalAIRecommendationsScreen'));
reg('HospitalAnalytics', () => import('../screens/specialized/HospitalAnalyticsScreen'));
reg('BookAppointment', () => import('../screens/specialized/BookAppointmentScreen'));
reg('MyConsultations', () => import('../screens/specialized/MyConsultationsScreen'));

// ---------------------------------------------------------------------------
// Specialized - Hôtel / Immobilier (12)
// ---------------------------------------------------------------------------
reg('HotelBookingPayment', () => import('../screens/specialized/HotelBookingPaymentScreen'));
reg('HotelBooking', () => import('../screens/specialized/HotelBookingScreen'));
reg('HotelDashboard', () => import('../screens/specialized/HotelDashboardScreen'));
reg('HotelQRScanner', () => import('../screens/specialized/HotelQRScannerScreen'));
reg('ImmobilierBooking', () => import('../screens/specialized/ImmobilierBookingScreen'));
reg('ImmobilierCompare', () => import('../screens/specialized/ImmobilierCompareScreen'));
reg('ImmobilierDetails', () => import('../screens/specialized/ImmobilierDetailsScreen'));
reg('ImmobilierForm', () => import('../screens/specialized/ImmobilierFormScreen'));
reg('ImmobilierHome', () => import('../screens/specialized/ImmobilierHomeScreen'));
reg('ImmobilierList', () => import('../screens/specialized/ImmobilierListScreen'));
reg('ImmobilierPriceAlerts', () => import('../screens/specialized/ImmobilierPriceAlertsScreen'));
reg('ImmobilierSearch', () => import('../screens/specialized/ImmobilierSearchScreen'));
reg('MesReservations', () => import('../screens/specialized/MesReservationsScreen'));
reg('HotelMeubleHome', () => import('../screens/specialized/HotelMeubleHomeScreen'));

// ---------------------------------------------------------------------------
// Specialized - Laboratoire (7)
// ---------------------------------------------------------------------------
reg('LabAIAnalysis', () => import('../screens/specialized/LabAIAnalysisScreen'));
reg('LabAnalytics', () => import('../screens/specialized/LabAnalyticsScreen'));
reg('LaboratoireDetails', () => import('../screens/specialized/LaboratoireDetailsScreen'));
reg('LaboratoireForm', () => import('../screens/specialized/LaboratoireFormScreen'));
reg('LaboratoireHome', () => import('../screens/specialized/LaboratoireHomeScreen'));
reg('LaboratoireList', () => import('../screens/specialized/LaboratoireListScreen'));
reg('LaboratoireSearch', () => import('../screens/specialized/LaboratoireSearchScreen'));
reg('MyLabExaminations', () => import('../screens/specialized/MyLabExaminationsScreen'));

// ---------------------------------------------------------------------------
// Specialized - Livres scolaires (6)
// ---------------------------------------------------------------------------
reg('LivreScolaireDetails', () => import('../screens/specialized/LivreScolaireDetailsScreen'));
reg('LivreScolaireForm', () => import('../screens/specialized/LivreScolaireFormScreen'));
reg('LivreScolaireHome', () => import('../screens/specialized/LivreScolaireHomeScreen'));
reg('LivreScolaireList', () => import('../screens/specialized/LivreScolaireListScreen'));
reg('LivreScolaireSearch', () => import('../screens/specialized/LivreScolaireSearchScreen'));
reg('MesLivres', () => import('../screens/specialized/MesLivresScreen'));
// ✅ V2 Bourse du Livre (8)
reg('BookUploadV2', () => import('../screens/specialized/BookUploadV2Screen'));
reg('BookRecapV2', () => import('../screens/specialized/BookRecapV2Screen'));
reg('BookPackages', () => import('../screens/specialized/BookPackagesScreen'));
reg('BookBuyDirect', () => import('../screens/bourse-livre/BookBuyDirectScreen'));
reg('AdminProgrammeUpload', () => import('../screens/bourse-livre/AdminProgrammeUploadScreen'));
reg('BookDeliveryTracking', () => import('../screens/specialized/BookDeliveryTrackingScreen'));
reg('NewBooks', () => import('../screens/specialized/NewBooksScreen'));
reg('MesBesoinsLivres', () => import('../screens/specialized/MesBesoinsLivresScreen'));
reg('AdminDonations', () => import('../screens/specialized/AdminDonationsScreen'));

// ---------------------------------------------------------------------------
// Specialized - Menu / Recettes (4)
// ---------------------------------------------------------------------------
reg('MenuPlanningHub', () => import('../screens/specialized/MenuPlanningHubScreen'));
reg('MenuWeekCalendar', () => import('../screens/specialized/MenuWeekCalendarScreen'));
reg('RecipeDetails', () => import('../screens/specialized/RecipeDetailsScreen'));
reg('RecipeSearch', () => import('../screens/specialized/RecipeSearchScreen'));
reg('ShoppingList', () => import('../screens/specialized/ShoppingListScreen'));

// ---------------------------------------------------------------------------
// Specialized - Pharmacie (7)
// ---------------------------------------------------------------------------
reg('PharmacieDetails', () => import('../screens/specialized/PharmacieDetailsScreen'));
reg('PharmacieForm', () => import('../screens/specialized/PharmacieFormScreen'));
reg('PharmacieHome', () => import('../screens/specialized/PharmacieHomeScreen'));
reg('PharmacieList', () => import('../screens/specialized/PharmacieListScreen'));
reg('PharmacieSearch', () => import('../screens/specialized/PharmacieSearchScreen'));
reg('PharmacyAIInteractions', () => import('../screens/specialized/PharmacyAIInteractionsScreen'));
reg('PharmacyAnalytics', () => import('../screens/specialized/PharmacyAnalyticsScreen'));
reg('MyPharmacyOrders', () => import('../screens/specialized/MyPharmacyOrdersScreen'));

// ---------------------------------------------------------------------------
// Specialized - Taxi (9)
// ---------------------------------------------------------------------------
reg('TaxiAvailability', () => import('../screens/specialized/TaxiAvailabilityScreen'));
reg('TaxiBooking', () => import('../screens/specialized/TaxiBookingScreen'));
reg('TaxiDetails', () => import('../screens/specialized/TaxiDetailsScreen'));
reg('TaxiForm', () => import('../screens/specialized/TaxiFormScreen'));
reg('TaxiHome', () => import('../screens/specialized/TaxiHomeScreen'));
reg('TaxiIntelligentSearch', () => import('../screens/specialized/TaxiIntelligentSearchScreen'));
reg('TaxiList', () => import('../screens/specialized/TaxiListScreen'));
reg('TaxiSearch', () => import('../screens/specialized/TaxiSearchScreen'));
reg('TaxiTracking', () => import('../screens/specialized/TaxiTrackingScreen'));
reg('MesTaxis', () => import('../screens/specialized/MesTaxisScreen'));

// ---------------------------------------------------------------------------
// Specialized - Troc (4)
// ---------------------------------------------------------------------------
reg('TrocDetails', () => import('../screens/specialized/TrocDetailsScreen'));
reg('TrocLiveValidation', () => import('../screens/specialized/TrocLiveValidationScreen'));
reg('TrocMatching', () => import('../screens/specialized/TrocMatchingScreen'));
reg('MesTrocs', () => import('../screens/specialized/MesTrocsScreen'));

// ---------------------------------------------------------------------------
// Specialized - Supermarché / Restaurant (3)
// ---------------------------------------------------------------------------
reg('SupermarketHome', () => import('../screens/specialized/SupermarketHomeScreen'));
reg('SupermarketPartnerDashboard', () => import('../screens/specialized/SupermarketPartnerDashboardScreen'));
reg('RestaurantDashboard', () => import('../screens/specialized/RestaurantDashboardScreen'));

// ---------------------------------------------------------------------------
// Specialized - Autres (7)
// ---------------------------------------------------------------------------
reg('MyFavorites', () => import('../screens/specialized/MyFavoritesScreen'));
reg('OffresEmploiForm', () => import('../screens/specialized/OffresEmploiFormScreen'));
reg('OrientationPartnerDashboard', () => import('../screens/specialized/OrientationPartnerDashboardScreen'));
reg('PrestataireReservations', () => import('../screens/specialized/PrestataireReservationsScreen'));
reg('Reservation', () => import('../screens/specialized/ReservationScreen'));
reg('ServiceDetailSpecialized', () => import('../screens/specialized/ServiceDetailScreen'));
reg('SlotManagement', () => import('../screens/specialized/SlotManagementScreen'));

// ---------------------------------------------------------------------------
// Vidéo (3)
// ---------------------------------------------------------------------------
reg('VideoCreationIntro', () => import('../screens/video/VideoCreationIntroScreen'));
reg('VideoCreationWizard', () => import('../screens/video/VideoCreationWizardScreen'));
reg('VideoGenerationResult', () => import('../screens/video/VideoGenerationResultScreen'));

// ============================================================================
// ALIASES - Rétrocompatibilité avec les anciens noms de routes navigate()
// ============================================================================

S['Delivery'] = S['DeliveryHome'];
S['HotelReservationQR'] = S['HotelQRScanner'];
S['MedicalServicesList'] = S['HealthServicesHub'];
S['PharmacyDetail'] = S['PharmacieDetails'];
S['BloodBankDetails'] = S['BanqueSangDetails'];
S['CarpoolDetail'] = S['CovoiturageDetails'];
S['ProfilePrestataire'] = S['DashboardPrestataire'];
S['ConcoursList'] = S['ConcoursEntree'];
S['ConferencesList'] = S['ConferencesLives'];
S['ExperiencesList'] = S['ExperiencesEtudiants'];
S['FournituresList'] = S['FournituresScolaires'];
S['ProgrammesList'] = S['ProgrammesScolaires'];
S['RechercheBesoin'] = S['ResultatBesoin'];
S['Search'] = S['SpecializedSearch'];
S['Videos'] = S['VideoFeed'];
S['LiveViewerScreen'] = S['LiveViewer'];
S['Payment'] = S['PaiementPlan'];
S['HotelSearch'] = S['HotelMeubleHome'];
S['MeubleSearch'] = S['HotelMeubleHome'];
S['NavigationScreen'] = S['Navigation'];
S['LivreScolaireSearchAdvanced'] = S['LivreScolaireSearch'];

// ============================================================================
// TAB NAVIGATOR - 5 onglets principaux (restauré depuis version originale)
// Accueil | Mes Services | Créer (+) | Vidéos | Mon Compte
// + Mes Courses pour les coursiers
// ============================================================================

// Types de partenaires qui doivent être BLOQUÉS du homescreen (services spécialisés uniquement)
const SPECIALIZED_SERVICES_TYPES = [
  'pharmacie', 'hopital', 'laboratoire',
  'agence de voyage', 'agencevoyage', 'agence_voyage', 'agencedevoyage', 'agence_de_voyage',
  'banquesang', 'banque_sang', 'transfusion sanguine',
  'hotel', 'meuble', 'immobilier',
  'supermarche', 'restaurant',
  'livrescolaire', 'livre_scolaire', 'libraire', 'librairie',
  'assureur', 'assurance',
  'etablissementscolaire', 'etablissement_scolaire',
  'offre_emploi', 'offreemploi', 'recruteur', 'employeur',
  'telecom', 'ecommerce', 'prestataire', 'service',
  'fleet', // Fleet management (entreprise de transport/livraison)
  'automobile', // Concessionnaires/prestataires auto
];

// Types de transport/livraison INDIVIDUELS qui DOIVENT garder accès au homescreen
// (chauffeurs indépendants, taxis indépendants, covoitureurs individuels)
const TRANSPORT_DELIVERY_TYPES = [
  'covoiturage', 'taxi', 'chauffeur', // Transport de personnes individuel
  'livraison', 'livraison_courses_marche', 'demenagement', 'transport', // Livraison individuelle
];

// Liste combinée pour la gestion (maintenir compatibilité)
const GESTION_SUPPORTED_TYPES = [
  ...SPECIALIZED_SERVICES_TYPES,
  ...TRANSPORT_DELIVERY_TYPES,
];

// ✅ Mapping partner_type → écran spécialisé (utilisé par PartnerDashboardTab dans les onglets)
const getPartnerDashboardScreen = (partnerType: string | undefined): string | null => {
  if (!partnerType) return null;
  const map: Record<string, string> = {
    'pharmacie': 'PharmacieForm',
    'hopital': 'HopitalForm',
    'laboratoire': 'LaboratoireForm',
    'banquesang': 'BanqueSangForm',
    'banque_sang': 'BanqueSangForm',
    'agence_voyage': 'AgenceVoyageForm',
    'agencedevoyage': 'AgenceVoyageForm',
    'agencevoyage': 'AgenceVoyageForm',
    'agence_de_voyage': 'AgenceVoyageForm', // ✅ AJOUT: normalisation depuis "agence de voyage"
    'covoiturage': 'CovoiturageForm',
    'taxi': 'TaxiForm',
    'chauffeur': 'FleetDashboard',
    'hotel': 'HotelDashboard',
    'meuble': 'HotelDashboard',
    'immobilier': 'ImmobilierForm',
    'fleet': 'FleetDashboard', // Fleet management (entreprise)
    'supermarche': 'SupermarketPartnerDashboard',
    'restaurant': 'RestaurantDashboard',
    'offre_emploi': 'OffresEmploiHub',
    'offreemploi': 'OffresEmploiHub',
    'recruteur': 'OffresEmploiHub',
    'employeur': 'OffresEmploiHub',
    'assureur': 'AssuranceDashboard',
    'assurance': 'AssuranceDashboard',
    'etablissementscolaire': 'OrientationPartnerDashboard',
    'etablissement_scolaire': 'OrientationPartnerDashboard',
    'livrescolaire': 'LivreScolaireForm',
    'livre_scolaire': 'LivreScolaireForm',
    'libraire': 'LivreScolaireForm',
    'librairie': 'LivreScolaireForm',
    // Autres types avec espaces (normalisation)
    'livraison': 'FleetDashboard',
    'livraison_courses_marche': 'FleetDashboard',
    'demenagement': 'FleetDashboard',
    'transport': 'FleetDashboard',
    'telecom': 'GestionServicesSpecialises',
    'ecommerce': 'GestionServicesSpecialises',
    'prestataire': 'GestionServicesSpecialises',
    'service': 'GestionServicesSpecialises',
    'automobile': 'AutomobileDashboard',
  };
  const normalized = partnerType.toLowerCase().trim().replace(/\s+/g, '');
  const normalizedNoUnderscore = partnerType.toLowerCase().trim().replace(/[\s_]+/g, '');
  return map[partnerType] || map[normalized] || map[normalizedNoUnderscore] || null;
};

// ============================================================================
// PARTNER DASHBOARD TAB - Renders the correct specialized screen per partner_type
// Instead of always showing GestionServicesSpecialisesScreen (generic flat list),
// this dynamically loads the partner's ACTUAL dashboard/form screen.
// ============================================================================

const PartnerDashboardTab: React.FC<any> = (props) => {
  const { user } = useAuth();
  const partnerType = (user as any)?.partner_type;
  const screenName = getPartnerDashboardScreen(partnerType);

  // If we have a specific dashboard screen mapped AND it exists in the lazy registry, render it directly
  if (screenName && screenName !== 'GestionServicesSpecialises' && S[screenName]) {
    const TargetScreen = S[screenName];
    return <TargetScreen {...props} />;
  }

  // Fallback: generic GestionServicesSpecialisesScreen for unmapped or generic partner types
  const GenericPartnerScreen = loadScreen(
    '../screens/specialized/GestionServicesSpecialisesScreen',
    'GestionServicesSpecialises'
  );
  return <GenericPartnerScreen {...props} />;
};

function MainTabNavigator() {
  const { user } = useAuth();
  const { t } = useLanguageSafe();
  const [isCourier, setIsCourier] = useState(false);

  // ✅ FIX CRITIQUE: Calcul SYNCHRONE de hasSpecializedServices (pas useEffect)
  // L'ancien useEffect ne s'exécutait qu'APRÈS le premier rendu, donc initialRouteName
  // était toujours 'Home' au premier rendu, même pour les partenaires.
  const isPartner = (user as any)?.role === 'partenaire' && !!(user as any)?.partner_type;
  const hasSpecializedServices = React.useMemo(() => {
    const pt = (user as any)?.partner_type;
    const role = (user as any)?.role;
    if (role === 'partenaire' && pt) {
      const normalized = pt.toLowerCase().trim().replace(/\s+/g, '');
      const normalizedNoUnderscore = pt.toLowerCase().trim().replace(/[\s_]+/g, '');
      // ✅ SEULEMENT les services spécialisés bloquent l'accès homescreen
      // Les transporteurs/livreurs gardent accès au homescreen
      return SPECIALIZED_SERVICES_TYPES.includes(pt)
        || SPECIALIZED_SERVICES_TYPES.includes(normalized)
        || SPECIALIZED_SERVICES_TYPES.includes(normalizedNoUnderscore);
    }
    return false;
  }, [user?.id, (user as any)?.partner_type, (user as any)?.role]);

  // Détecter si l'utilisateur est coursier
  useEffect(() => {
    if (!user?.id) { setIsCourier(false); return; }
    const check = async () => {
      try {
        const res: any = await apiGet('/api/delivery/courier/status');
        const data = res?.data || res;
        setIsCourier(data?.is_courier || false);
      } catch {
        setIsCourier(false);
      }
    };
    const timer = setTimeout(check, 100);
    return () => clearTimeout(timer);
  }, [user?.id]);

  return (
    <Tab.Navigator
      initialRouteName={isPartner && hasSpecializedServices ? 'GestionServicesSpecialises' : 'Home'}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: modernColors.primary,
        tabBarInactiveTintColor: modernColors.textSecondary,
        tabBarStyle: {
          backgroundColor: modernColors.background,
          borderTopColor: modernColors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          paddingTop: 5,
          height: Platform.OS === 'ios' ? 85 : 60,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* Onglet 1: Accueil - MASQUÉ pour les partenaires de services spécialisés */}
      {!hasSpecializedServices && (
        <Tab.Screen
          name="Home"
          getComponent={() => loadScreen('../screens/HomeScreen', 'Home')}
          options={{
            tabBarLabel: t('tabs.home'),
            tabBarIcon: ({ focused, color, size }) => (
              <SafeIcon name="home" size={size} color={focused ? modernColors.primary : color} type="lucide" />
            ),
          }}
        />
      )}

      {/* Onglet 2: Mes Services (conditionnel: écran spécialisé pour partenaires, MesProduits sinon) */}
      {hasSpecializedServices ? (
        <Tab.Screen
          name="GestionServicesSpecialises"
          component={PartnerDashboardTab}
          options={{
            tabBarLabel: t('tabs.partnerSpace') || 'Mon Espace',
            title: t('tabs.partnerSpace') || 'Mon Espace Partenaire',
            tabBarIcon: ({ focused, color, size }) => (
              <SafeIcon name="briefcase" size={size} color={focused ? modernColors.primary : color} type="lucide" />
            ),
          }}
        />
      ) : (
        <Tab.Screen
          name="Services"
          component={S['MesServices'] || loadScreen('../screens/MesServicesScreen', 'MesServices')}
          options={{
            tabBarLabel: t('tabs.services'),
            tabBarIcon: ({ focused, color, size }) => (
              <SafeIcon name="shopping-bag" size={size} color={focused ? modernColors.primary : color} type="lucide" />
            ),
          }}
        />
      )}

      {/* Onglet 3: Créer (+) - masqué pour les coursiers */}
      {!isCourier && (
        <Tab.Screen
          name="VideoCreationIntro"
          component={S['VideoCreationIntro'] || loadScreen('../screens/video/VideoCreationIntroScreen', 'VideoCreationIntro')}
          options={{
            tabBarLabel: t('tabs.create') || 'Créer',
            tabBarIcon: ({ focused, color, size }) => (
              <SafeIcon name="plus" size={size} color={focused ? modernColors.primary : color} type="lucide" />
            ),
          }}
        />
      )}

      {/* Onglet 4: Vidéos (feed) */}
      <Tab.Screen
        name="Videos"
        component={S['VideoFeed'] || loadScreen('../screens/MesInteractionsScreen', 'MesInteractions')}
        options={{
          tabBarLabel: t('tabs.videos') || 'Vidéos',
          tabBarIcon: ({ focused, color, size }) => (
            <SafeIcon name="play" size={size} color={focused ? modernColors.primary : color} type="lucide" />
          ),
        }}
      />

      {/* Onglet Coursier: Mes Courses (uniquement pour les coursiers) */}
      {isCourier && (
        <Tab.Screen
          name="CourierDashboard"
          component={S['CourierDashboard'] || loadScreen('../screens/delivery/CourierDashboardScreen', 'CourierDashboard')}
          options={{
            tabBarLabel: t('tabs.myCourses') || 'Mes Courses',
            tabBarIcon: ({ focused, color, size }) => (
              <SafeIcon name="truck" size={size} color={focused ? modernColors.primary : color} type="lucide" />
            ),
          }}
        />
      )}

      {/* Onglet 5: Mon Compte */}
      <Tab.Screen
        name="Profile"
        getComponent={() => loadScreen('../screens/ProfileScreen', 'Profile')}
        options={{
          tabBarLabel: t('tabs.account'),
          tabBarIcon: ({ focused, color, size }) => (
            <SafeIcon name="user" size={size} color={focused ? modernColors.primary : color} type="lucide" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ============================================================================
// AUTH STACK - Écrans d'authentification
// ============================================================================

function AuthStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="Register"
        getComponent={() => require('../screens/auth/RegisterScreen').default}
      />
      <Stack.Screen
        name="PartnerRegister"
        getComponent={() => require('../screens/auth/PartnerRegisterScreen').default}
      />
      <Stack.Screen
        name="OtpVerification"
        getComponent={() => require('../screens/auth/OtpVerificationScreen').default}
      />
    </Stack.Navigator>
  );
}

// ============================================================================
// MAIN STACK - Navigation principale (tous les écrans)
// ============================================================================

function MainStackNavigator() {
  // ✅ Deep links uniquement (la redirection partenaire est gérée par initialRouteName + PartnerDashboardTab)
  useDeepLinkRedirect();

  // ✅ Tracking passif automatique des déplacements (background)
  // Démarre au montage + redémarre quand l'app revient au premier plan
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    // Démarrage initial
    const getTracker = () => {
      try {
        const module = require('../services/PassiveActivityTracker');
        return module?.PassiveActivityTracker || module?.default;
      } catch (error) {
        console.warn('[AppNav] ⚠️ PassiveActivityTracker indisponible:', error);
        return null;
      }
    };
    const tracker = getTracker();
    if (tracker?.resumeIfEnabled && tracker?.start) {
      tracker.resumeIfEnabled().then(() => {
        tracker.start().then((ok: boolean) => {
          if (ok) console.log('[AppNav] ✅ Tracking passif activé');
        });
      });
    }

    // ✅ Listener AppState: redémarrer le tracking quand l'app revient au foreground
    // Android peut tuer la tâche background — ce listener la relance automatiquement
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[AppNav] 📱 App revenue au premier plan, vérification tracking...');
        const tracker = getTracker();
        tracker?.resumeIfEnabled?.().catch(() => { });
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* === Onglets principaux === */}
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />

      {/* === Écrans statiques (toujours disponibles) === */}
      <Stack.Screen
        name="Contact"
        getComponent={() => loadScreen('../screens/ContactScreen', 'Contact')}
      />
      <Stack.Screen
        name="Navigation"
        component={S['Navigation'] || loadScreen('../screens/NavigationScreen', 'Navigation')}
      />
      <Stack.Screen
        name="GestionServicesSpecialises"
        getComponent={() =>
          loadScreen('../screens/specialized/GestionServicesSpecialisesScreen', 'GestionServicesSpecialises')
        }
      />
      <Stack.Screen
        name="ServicesDashboard"
        getComponent={() => loadScreen('../screens/specialized/ServicesDashboard', 'ServicesDashboard')}
      />

      {/* === Tous les écrans lazy (chargés à la demande) === */}
      {Object.entries(S).map(([name, component]) => {
        if (!component) return null;
        if (name === 'Contact' || name === 'Navigation' || name === 'GestionServicesSpecialises' || name === 'ServicesDashboard') return null;
        return <Stack.Screen key={name} name={name} component={component} />;
      })}
    </Stack.Navigator>
  );
}

const SCREENS_HIDE_FAB = ['ChatModalMobile', 'Login', 'Register', 'PartnerRegister', 'OtpVerification'];

function getActiveRouteName(state: any): string {
  if (!state?.routes) return 'Unknown';
  const route = state.routes[state.index ?? 0];
  if (route.state) return getActiveRouteName(route.state);
  return route.name || 'Unknown';
}

function MainStackWithDeepLinks() {
  const { user } = useAuth();
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  // Keep startup stable: this component is mounted before any parent navigator
  // provides state context, so avoid useNavigationState here.
  const currentScreen = 'Home';

  const showIntelligentChat = useCallback((message?: string) => {
    setChatMessage(message || '');
    setChatVisible(true);
  }, []);

  useEffect(() => {
    if (typeof global !== 'undefined') {
      (global as any).showIntelligentChat = showIntelligentChat;
    }
  }, [showIntelligentChat]);

  const fabVisible = !chatVisible && !SCREENS_HIDE_FAB.includes(currentScreen);
  const IntelligentChatFab = loadScreen('../components/IntelligentChatFab');
  const IntelligentChat = loadScreen('../components/IntelligentChat');

  return (
    <View style={{ flex: 1 }}>
      <MainStackNavigator />

      {fabVisible && (
        <IntelligentChatFab
          onPress={() => showIntelligentChat()}
          screenName={currentScreen}
          hideOnScreens={SCREENS_HIDE_FAB}
        />
      )}

      <IntelligentChat
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        initialMessage={chatMessage}
      />
    </View>
  );
}

// ============================================================================
// ROOT NAVIGATOR
// ============================================================================

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Yukpo</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1 }}>
        <OfflineIndicator />
        <AuthStackNavigator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineIndicator />
      <MainStackWithDeepLinks />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 4,
  },
  errorSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default AppNavigator;
