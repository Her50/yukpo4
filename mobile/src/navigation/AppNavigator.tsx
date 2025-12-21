// Navigation ULTRA-SIMPLIFIÉE avec TOUS les providers nécessaires
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
// ✅ RÉACTIVÉ: react-native-reanimated avec configuration correcte
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { modernColors } from '../theme/modernTheme';
import SafeStorage from '../utils/safeStorage';
import { defaultScreenOptions, transitionConfig } from './transitions'; // ✅ PHASE 3: Transitions personnalisées
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
import ServicesDashboard from '../screens/specialized/ServicesDashboard';

// ✅ IMPORTS DIRECTS - Écrans Flash Sales et Promos
import FlashPromosActiveScreen from '../screens/FlashPromosActiveScreen';
import FlashSaleScreen from '../screens/FlashSaleScreen';
import GlobalPromoCatalogScreen from '../screens/GlobalPromoCatalogScreen';
import CreateFlashPromoScreen from '../screens/CreateFlashPromoScreen';

// ✅ IMPORTS DIRECTS - Écrans secondaires
import AgencyTicketManagementScreen from '../screens/AgencyTicketManagementScreen';
import AjouterProduitSimpleScreen from '../screens/AjouterProduitSimpleScreen';
import BloodGroupManagementScreen from '../screens/BloodGroupManagementScreen';
import BusBoardingManagementScreen from '../screens/BusBoardingManagementScreen';
import ContactScreen from '../screens/ContactScreen';
import CreatePubliciteScreen from '../screens/CreatePubliciteScreen';
import CreatorAnalyticsScreen from '../screens/CreatorAnalyticsScreen';
import AnalyticsDashboardScreen from '../screens/dashboard/AnalyticsDashboardScreen'; // ✅ Phase 10 - Analytics Dashboard
import DashboardPrestataireScreen from '../screens/DashboardPrestataireScreen'; // ✅ Dashboard Prestataire
import DashboardScreen from '../screens/DashboardScreen'; // ✅ Ancien Dashboard
import CourierAdminScreen from '../screens/delivery/CourierAdminScreen';
import UserRoleManagementScreen from '../screens/admin/UserRoleManagementScreen';
import DeliveryHomeScreen from '../screens/delivery/DeliveryHomeScreen';
import DeliveryParcelFlowScreen from '../screens/delivery/DeliveryParcelFlowScreen';
import DeliveryParcelFlowNewScreen from '../screens/delivery/DeliveryParcelFlowNewScreen';
import DeliveryShoppingFlowScreen from '../screens/delivery/DeliveryShoppingFlowScreen';
import DeliveryShoppingTrackingScreen from '../screens/delivery/DeliveryShoppingTrackingScreen';
import ShoppingBasketScreen from '../screens/delivery/ShoppingBasketScreen';
import ShoppingBudgetScreen from '../screens/delivery/ShoppingBudgetScreen';
import ShoppingPickupDropScreen from '../screens/delivery/ShoppingPickupDropScreen';
import ShoppingSummaryScreen from '../screens/delivery/ShoppingSummaryScreen';
import StorageLocationsScreen from '../screens/delivery/StorageLocationsScreen';
import EnhancedSettingsScreen from '../screens/EnhancedSettingsScreen';
import FormulaireYukpoIntelligentScreen from '../screens/FormulaireYukpoIntelligentScreen';
import HashtagDiscoveryScreen from '../screens/HashtagDiscoveryScreen';
import ManageAgencySchedulesScreen from '../screens/ManageAgencySchedulesScreen';
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
import CovoiturageBookingScreen from '../screens/specialized/CovoiturageBookingScreen';
import CovoiturageDetailsScreen from '../screens/specialized/CovoiturageDetailsScreen';
import CovoiturageFormScreen from '../screens/specialized/CovoiturageFormScreen';
import CovoiturageListScreen from '../screens/specialized/CovoiturageListScreen';
import CovoiturageSearchScreen from '../screens/specialized/CovoiturageSearchScreen';
import HopitalFormScreen from '../screens/specialized/HopitalFormScreen';
import LaboratoireFormScreen from '../screens/specialized/LaboratoireFormScreen';
import MesReservationsScreen from '../screens/specialized/MesReservationsScreen';
import MesTaxisScreen from '../screens/specialized/MesTaxisScreen';
import MyTripsScreen from '../screens/specialized/MyTripsScreen';
import PharmacieFormScreen from '../screens/specialized/PharmacieFormScreen';
import PrestataireReservationsScreen from '../screens/specialized/PrestataireReservationsScreen';
import ReservationScreen from '../screens/specialized/ReservationScreen';
import ServiceDetailScreen from '../screens/specialized/ServiceDetailScreen';
import TaxiAvailabilityScreen from '../screens/specialized/TaxiAvailabilityScreen';
import TaxiBookingScreen from '../screens/specialized/TaxiBookingScreen';
import TaxiDetailsScreen from '../screens/specialized/TaxiDetailsScreen';
import TaxiFormScreen from '../screens/specialized/TaxiFormScreen';
import { TaxiIntelligentSearchScreen } from '../screens/specialized/TaxiIntelligentSearchScreen';
import TaxiListScreen from '../screens/specialized/TaxiListScreen';
import TaxiSearchScreen from '../screens/specialized/TaxiSearchScreen';
// ✅ Phase 3: Hôpitaux et Laboratoires
import HopitalDetailsScreen from '../screens/specialized/HopitalDetailsScreen';
import HopitalListScreen from '../screens/specialized/HopitalListScreen';
import HopitalSearchScreen from '../screens/specialized/HopitalSearchScreen';
import LaboratoireDetailsScreen from '../screens/specialized/LaboratoireDetailsScreen';
import LaboratoireListScreen from '../screens/specialized/LaboratoireListScreen';
import LaboratoireSearchScreen from '../screens/specialized/LaboratoireSearchScreen';
// ✅ NOUVEAU: Écrans Pharmacie
import PharmacieDetailsScreen from '../screens/specialized/PharmacieDetailsScreen';
import PharmacieListScreen from '../screens/specialized/PharmacieListScreen';
import PharmacieSearchScreen from '../screens/specialized/PharmacieSearchScreen';
// ✅ NOUVEAU: Écrans Banque de sang
import BanqueSangDetailsScreen from '../screens/specialized/BanqueSangDetailsScreen';
import BanqueSangListScreen from '../screens/specialized/BanqueSangListScreen';
import BanqueSangSearchScreen from '../screens/specialized/BanqueSangSearchScreen';
// ✅ NOUVEAU: Hub services de santé
import HealthServicesHubScreen from '../screens/specialized/HealthServicesHubScreen';
// ✅ NOUVEAU: Écrans Agence de voyage
import AgenceVoyageDetailsScreen from '../screens/specialized/AgenceVoyageDetailsScreen';
import AgenceVoyageListScreen from '../screens/specialized/AgenceVoyageListScreen';
import AgenceVoyageSearchScreen from '../screens/specialized/AgenceVoyageSearchScreen';
// ✅ NOUVEAU: Écrans Immobilier
import ImmobilierBookingScreen from '../screens/specialized/ImmobilierBookingScreen';
import ImmobilierCompareScreen from '../screens/specialized/ImmobilierCompareScreen';
import ImmobilierDetailsScreen from '../screens/specialized/ImmobilierDetailsScreen';
import ImmobilierListScreen from '../screens/specialized/ImmobilierListScreen';
import ImmobilierPriceAlertsScreen from '../screens/specialized/ImmobilierPriceAlertsScreen';
import ImmobilierSearchScreen from '../screens/specialized/ImmobilierSearchScreen';
import MyFavoritesScreen from '../screens/specialized/MyFavoritesScreen';
import SpecializedSearchScreen from '../screens/SpecializedSearchScreen';
import SpecializedServicesHubScreen from '../screens/SpecializedServicesHubScreen';
// ✅ NOUVEAU: Écrans banque de sang
import BloodDonationMatchesScreen from '../screens/specialized/BloodDonationMatchesScreen';
import BloodDonationRequestScreen from '../screens/specialized/BloodDonationRequestScreen';
import MyBloodDonationsScreen from '../screens/specialized/MyBloodDonationsScreen';
// ✅ NOUVEAU: Écrans tickets bus
import BusTicketBookingScreen from '../screens/specialized/BusTicketBookingScreen';
import BusTicketDetailsScreen from '../screens/specialized/BusTicketDetailsScreen';
import BusTicketSearchScreen from '../screens/specialized/BusTicketSearchScreen';
// ✅ NOUVEAU: Écrans retour bus (aller-retour)
import BusReturnRequestFormScreen from '../screens/specialized/BusReturnRequestFormScreen';
import BusReturnRequestsScreen from '../screens/specialized/BusReturnRequestsScreen';
// ✅ NOUVEAU 2025-01-28: Écrans Bourse du livre scolaire
import LivreScolaireDetailsScreen from '../screens/specialized/LivreScolaireDetailsScreen';
import LivreScolaireFormScreen from '../screens/specialized/LivreScolaireFormScreen';
import LivreScolaireListScreen from '../screens/specialized/LivreScolaireListScreen';
import LivreScolaireSearchScreen from '../screens/specialized/LivreScolaireSearchScreen';
import MesLivresScreen from '../screens/specialized/MesLivresScreen';
// ✅ NOUVEAU 2025-01-28: Écrans Orientation scolaire
import ConcoursEntreeScreen from '../screens/orientation/ConcoursEntreeScreen';
import ConferencesLivesScreen from '../screens/orientation/ConferencesLivesScreen';
import EtablissementDetailsScreen from '../screens/orientation/EtablissementDetailsScreen';
import EtablissementSearchScreen from '../screens/orientation/EtablissementSearchScreen';
import ExperiencesEtudiantsScreen from '../screens/orientation/ExperiencesEtudiantsScreen';
import FournituresScolairesScreen from '../screens/orientation/FournituresScolairesScreen';
import OrientationScolaireHubScreen from '../screens/orientation/OrientationScolaireHubScreen';
import ProgrammesScolairesScreen from '../screens/orientation/ProgrammesScolairesScreen';
import MesTrocsScreen from '../screens/specialized/MesTrocsScreen';
import TrocDetailsScreen from '../screens/specialized/TrocDetailsScreen';
import TrocLiveValidationScreen from '../screens/specialized/TrocLiveValidationScreen';
import TrocMatchingScreen from '../screens/specialized/TrocMatchingScreen';
// ✅ NOUVEAU 2025-01-28: Écrans offres d'emploi
import CreateOffreScreen from '../screens/offres-emploi/CreateOffreScreen';
import OffreSearchScreen from '../screens/offres-emploi/OffreSearchScreen';
import OffresEmploiHubScreen from '../screens/offres-emploi/OffresEmploiHubScreen';
import ProfilCandidatScreen from '../screens/offres-emploi/ProfilCandidatScreen';
// ✅ NOUVEAU 2025-01-27: Écran Bourse du Livre avec IA
import BourseLivreScreen from '../screens/BourseLivreScreen';
// ✅ NOUVEAU 2025-01-27: Écrans Planification Menus
import MenuPlanningHubScreen from '../screens/specialized/MenuPlanningHubScreen';
// ✅ NOUVEAU: Écrans BayamSelam, Automobile, Assurance
import BayamSelamSearchScreen from '../screens/specialized/BayamSelamSearchScreen';
import AutoServicesSearchScreen from '../screens/specialized/AutoServicesSearchScreen';
import InsuranceServicesSearchScreen from '../screens/specialized/InsuranceServicesSearchScreen';
import MenuWeekCalendarScreen from '../screens/specialized/MenuWeekCalendarScreen';
import RecipeDetailsScreen from '../screens/specialized/RecipeDetailsScreen';
import ShoppingListScreen from '../screens/specialized/ShoppingListScreen';
import VideoCreationIntroScreen from '../screens/video/VideoCreationIntroScreen';
import VideoCreationWizardScreen from '../screens/video/VideoCreationWizardScreen';
import VideoGenerationResultScreen from '../screens/video/VideoGenerationResultScreen';
import VideoAnalyticsScreen from '../screens/VideoAnalyticsScreen';
import ErrorBoundary from '../components/ErrorBoundary';
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
const ServicesDashboardWithSafeArea = withNavigatorSafeArea(ServicesDashboard);
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
const TaxiSearchScreenWithSafeArea = withNavigatorSafeArea(TaxiSearchScreen);
const TaxiIntelligentSearchScreenWithSafeArea = withNavigatorSafeArea(TaxiIntelligentSearchScreen);
const TaxiListScreenWithSafeArea = withNavigatorSafeArea(TaxiListScreen);
const TaxiDetailsScreenWithSafeArea = withNavigatorSafeArea(TaxiDetailsScreen);
const TaxiBookingScreenWithSafeArea = withNavigatorSafeArea(TaxiBookingScreen);
const TaxiAvailabilityScreenWithSafeArea = withNavigatorSafeArea(TaxiAvailabilityScreen);
const MesTaxisScreenWithSafeArea = withNavigatorSafeArea(MesTaxisScreen);
const MyTripsScreenWithSafeArea = withNavigatorSafeArea(MyTripsScreen);
// ✅ Phase 3: Hôpitaux et Laboratoires
const HopitalSearchScreenWithSafeArea = withNavigatorSafeArea(HopitalSearchScreen);
const HopitalListScreenWithSafeArea = withNavigatorSafeArea(HopitalListScreen);
const HopitalDetailsScreenWithSafeArea = withNavigatorSafeArea(HopitalDetailsScreen);
const LaboratoireSearchScreenWithSafeArea = withNavigatorSafeArea(LaboratoireSearchScreen);
const LaboratoireListScreenWithSafeArea = withNavigatorSafeArea(LaboratoireListScreen);
const LaboratoireDetailsScreenWithSafeArea = withNavigatorSafeArea(LaboratoireDetailsScreen);
// ✅ NOUVEAU: Pharmacie
const PharmacieSearchScreenWithSafeArea = withNavigatorSafeArea(PharmacieSearchScreen);
const PharmacieListScreenWithSafeArea = withNavigatorSafeArea(PharmacieListScreen);
const PharmacieDetailsScreenWithSafeArea = withNavigatorSafeArea(PharmacieDetailsScreen);
// ✅ NOUVEAU: Banque de sang
const BanqueSangSearchScreenWithSafeArea = withNavigatorSafeArea(BanqueSangSearchScreen);
const HealthServicesHubScreenWithSafeArea = withNavigatorSafeArea(HealthServicesHubScreen);
const BanqueSangListScreenWithSafeArea = withNavigatorSafeArea(BanqueSangListScreen);
const BanqueSangDetailsScreenWithSafeArea = withNavigatorSafeArea(BanqueSangDetailsScreen);
// ✅ NOUVEAU: Agence de voyage
const AgenceVoyageSearchScreenWithSafeArea = withNavigatorSafeArea(AgenceVoyageSearchScreen);
const AgenceVoyageListScreenWithSafeArea = withNavigatorSafeArea(AgenceVoyageListScreen);
const AgenceVoyageDetailsScreenWithSafeArea = withNavigatorSafeArea(AgenceVoyageDetailsScreen);
const CovoiturageSearchScreenWithSafeArea = withNavigatorSafeArea(CovoiturageSearchScreen);
const CovoiturageListScreenWithSafeArea = withNavigatorSafeArea(CovoiturageListScreen);
const CovoiturageBookingScreenWithSafeArea = withNavigatorSafeArea(CovoiturageBookingScreen);
const CovoiturageDetailsScreenWithSafeArea = withNavigatorSafeArea(CovoiturageDetailsScreen);
const SpecializedSearchScreenWithSafeArea = withNavigatorSafeArea(SpecializedSearchScreen);
const SpecializedServicesHubScreenWithSafeArea = withNavigatorSafeArea(SpecializedServicesHubScreen);
// ✅ NOUVEAU 2025-01-28: Bourse du livre scolaire
const LivreScolaireSearchScreenWithSafeArea = withNavigatorSafeArea(LivreScolaireSearchScreen);
const LivreScolaireListScreenWithSafeArea = withNavigatorSafeArea(LivreScolaireListScreen);
const LivreScolaireDetailsScreenWithSafeArea = withNavigatorSafeArea(LivreScolaireDetailsScreen);
const LivreScolaireFormScreenWithSafeArea = withNavigatorSafeArea(LivreScolaireFormScreen);
// ✅ NOUVEAU 2025-01-28: Orientation scolaire avec SafeArea
const OrientationScolaireHubScreenWithSafeArea = withNavigatorSafeArea(OrientationScolaireHubScreen);
const EtablissementSearchScreenWithSafeArea = withNavigatorSafeArea(EtablissementSearchScreen);
const EtablissementDetailsScreenWithSafeArea = withNavigatorSafeArea(EtablissementDetailsScreen);
const ProgrammesScolairesScreenWithSafeArea = withNavigatorSafeArea(ProgrammesScolairesScreen);
const FournituresScolairesScreenWithSafeArea = withNavigatorSafeArea(FournituresScolairesScreen);
const ConcoursEntreeScreenWithSafeArea = withNavigatorSafeArea(ConcoursEntreeScreen);
const ExperiencesEtudiantsScreenWithSafeArea = withNavigatorSafeArea(ExperiencesEtudiantsScreen);
const ConferencesLivesScreenWithSafeArea = withNavigatorSafeArea(ConferencesLivesScreen);
const MesLivresScreenWithSafeArea = withNavigatorSafeArea(MesLivresScreen);
const TrocMatchingScreenWithSafeArea = withNavigatorSafeArea(TrocMatchingScreen);
const TrocDetailsScreenWithSafeArea = withNavigatorSafeArea(TrocDetailsScreen);
const TrocLiveValidationScreenWithSafeArea = withNavigatorSafeArea(TrocLiveValidationScreen);
const MesTrocsScreenWithSafeArea = withNavigatorSafeArea(MesTrocsScreen);
// ✅ NOUVEAU: Immobilier
const ImmobilierSearchScreenWithSafeArea = withNavigatorSafeArea(ImmobilierSearchScreen);
const ImmobilierListScreenWithSafeArea = withNavigatorSafeArea(ImmobilierListScreen);
const ImmobilierDetailsScreenWithSafeArea = withNavigatorSafeArea(ImmobilierDetailsScreen);
const ImmobilierBookingScreenWithSafeArea = withNavigatorSafeArea(ImmobilierBookingScreen);
const ImmobilierCompareScreenWithSafeArea = withNavigatorSafeArea(ImmobilierCompareScreen);
const MyFavoritesScreenWithSafeArea = withNavigatorSafeArea(MyFavoritesScreen);
const ImmobilierPriceAlertsScreenWithSafeArea = withNavigatorSafeArea(ImmobilierPriceAlertsScreen);
// ✅ NOUVEAU 2025-01-28: Offres d'emploi avec SafeArea
const OffresEmploiHubScreenWithSafeArea = withNavigatorSafeArea(OffresEmploiHubScreen);
const OffreSearchScreenWithSafeArea = withNavigatorSafeArea(OffreSearchScreen);
const CreateOffreScreenWithSafeArea = withNavigatorSafeArea(CreateOffreScreen);
const ProfilCandidatScreenWithSafeArea = withNavigatorSafeArea(ProfilCandidatScreen);
// ✅ NOUVEAU 2025-01-27: Bourse du Livre avec SafeArea
const BourseLivreScreenWithSafeArea = withNavigatorSafeArea(BourseLivreScreen);
// ✅ NOUVEAU: BayamSelam, Automobile, Assurance avec SafeArea
const BayamSelamSearchScreenWithSafeArea = withNavigatorSafeArea(BayamSelamSearchScreen);
const AutoServicesSearchScreenWithSafeArea = withNavigatorSafeArea(AutoServicesSearchScreen);
const InsuranceServicesSearchScreenWithSafeArea = withNavigatorSafeArea(InsuranceServicesSearchScreen);
const ReservationScreenWithSafeArea = withNavigatorSafeArea(ReservationScreen);
const MesReservationsScreenWithSafeArea = withNavigatorSafeArea(MesReservationsScreen);
const PrestataireReservationsScreenWithSafeArea = withNavigatorSafeArea(PrestataireReservationsScreen);
const ServiceDetailScreenWithSafeArea = withNavigatorSafeArea(ServiceDetailScreen);
// ✅ SÉCURITÉ: Wrapper VideoFeedScreen avec ErrorBoundary pour éviter les crashes
const VideoFeedScreenWithErrorBoundary = (props: any) => (
    <ErrorBoundary
        fallback={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
                <Text style={{ color: '#FFF', fontSize: 16, marginBottom: 20 }}>
                    Impossible de charger le feed vidéo
                </Text>
                <TouchableOpacity
                    style={{ backgroundColor: modernColors.primary, padding: 12, borderRadius: 8 }}
                    onPress={() => {
                        // Réessayer en naviguant à nouveau
                        (props.navigation as any)?.navigate('Videos');
                    }}
                >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Réessayer</Text>
                </TouchableOpacity>
            </View>
        }
    >
        <VideoFeedScreen {...props} />
    </ErrorBoundary>
);

const VideoFeedScreenWithSafeArea = withNavigatorSafeArea(VideoFeedScreenWithErrorBoundary);
const HashtagDiscoveryScreenWithSafeArea = withNavigatorSafeArea(HashtagDiscoveryScreen);
const CreatorAnalyticsScreenWithSafeArea = withNavigatorSafeArea(CreatorAnalyticsScreen);
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
// ✅ NOUVEAU 2025-01-27: Planification Menus
const MenuPlanningHubScreenWithSafeArea = withNavigatorSafeArea(MenuPlanningHubScreen);
const MenuWeekCalendarScreenWithSafeArea = withNavigatorSafeArea(MenuWeekCalendarScreen);
const ShoppingListScreenWithSafeArea = withNavigatorSafeArea(ShoppingListScreen);
const RecipeDetailsScreenWithSafeArea = withNavigatorSafeArea(RecipeDetailsScreen);

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
// ✅ RÉACTIVÉ: TabIcon avec react-native-reanimated (configuration correcte)
const TabIcon: React.FC<{ name: string; focused: boolean; badgeCount?: number }> = React.memo(({ name, focused, badgeCount }) => {
  // ✅ RÉACTIVÉ: Utiliser useSharedValue de reanimated
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  // ✅ RÉACTIVÉ: useEffect avec reanimated
  useEffect(() => {
    try {
      scale.value = withSpring(focused ? 1.15 : 1, { damping: 10, stiffness: 200 });
      opacity.value = withTiming(focused ? 1 : 0.6, { duration: 200 });
    } catch (error) {
      console.warn('[TabIcon] Erreur animation:', error);
    }
  }, [focused]); // ✅ IMPORTANT: Ne pas inclure scale et opacity (SharedValues sont stables)

  // ✅ RÉACTIVÉ: useAnimatedStyle avec worklet
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const icons: { [key: string]: string } = {
    'home': '🏠',
    'delivery': '🚚',
    'video': '➕',
    'create': '➕',
    'videocreationintro': '➕', // ✅ NOUVEAU: Bouton création vidéo
    'videos': '📹',
    'videosfeed': '📹',
    'services': '📦', // ✅ MODIFIÉ: Icône package pour Mes Services
    'mesproduits': '📦', // ✅ NOUVEAU: Alias pour Mes Services
    'dashboard': '📊',
    'history': '📋',
    'profile': '👤',
    'courierdashboard': '🚴',
  };

  return (
    <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={animatedStyle}>
        <Text style={[styles.tabIcon, { color: focused ? modernColors.primary : modernColors.textSecondary }]}>
          {icons[name] || '❓'}
        </Text>
      </Animated.View>
      {/* ✅ NOUVEAU: Badge notifications */}
      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={{
          position: 'absolute',
          top: -4,
          right: -8,
          backgroundColor: '#EF4444',
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          paddingHorizontal: 4,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: modernColors.background,
        }}>
          <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>
            {badgeCount > 99 ? '99+' : String(badgeCount)}
          </Text>
        </View>
      )}
    </View>
  );
});

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

  // ✅ CORRECTION CRASH: Vérifier si l'utilisateur est coursier avec timeout, délai et cache
  useEffect(() => {
    const checkCourierStatus = async () => {
      if (!user?.id) {
        setIsCourier(false);
        return;
      }

      // ✅ OPTIMISATION: Vérifier le cache (durée de validité: 5 minutes)
      const cacheKey = `courier_status_${user.id}`;
      try {
        const cached = await SafeStorage.getItem(cacheKey);
        if (cached) {
          const { value, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

          if (cacheAge < CACHE_DURATION) {
            setIsCourier(value);
            return; // Utiliser le cache, pas besoin de requête API
          }
        }
      } catch (cacheError) {
        // Ignorer les erreurs de cache, continuer avec la requête API
      }

      // ✅ CORRIGÉ: Supprimer le délai bloquant - faire la vérification en arrière-plan
      // Ne pas bloquer le démarrage de l'app

      // ✅ CORRIGÉ: Utiliser requestIdleCallback ou setTimeout pour ne pas bloquer
      setTimeout(async () => {
        try {
          const { deliveryApi } = require('../services/api');

          // ✅ CORRIGÉ: Timeout réduit de 3s à 2s pour éviter les blocages
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 2000)
          );

          let response: any;
          try {
            response = await Promise.race([
              deliveryApi.getMyCourierStatus(),
              timeoutPromise
            ]);
          } catch (timeoutError) {
            console.warn('[AppNavigator] Timeout vérification coursier');
            setIsCourier(false);
            return;
          }

          const data = response.data || response;
          const isCourierValue = data.is_courier || false;
          setIsCourier(isCourierValue);

          // ✅ OPTIMISATION: Mettre en cache le résultat
          try {
            await SafeStorage.setItem(cacheKey, JSON.stringify({
              value: isCourierValue,
              timestamp: Date.now()
            }));
          } catch (cacheError) {
            // Ignorer les erreurs de sauvegarde du cache
          }
        } catch (error) {
          console.error('[AppNavigator] Erreur vérification coursier:', error);
          // ✅ En cas d'erreur, continuer sans bloquer l'app
          setIsCourier(false);
        }
      }, 100); // ✅ CORRIGÉ: Délai minimal de 100ms au lieu de 1000ms
    };

    // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
    checkCourierStatus().catch(error => {
      console.error('[AppNavigator] Erreur checkCourierStatus:', error);
    });

    // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
    return undefined;
  }, [user?.id]);

  // ✅ NOUVEAU: État pour vérifier si l'utilisateur a des services/produits
  const [hasServicesOrProducts, setHasServicesOrProducts] = React.useState(false);

  // ✅ CORRECTION CRASH: Vérifier si l'utilisateur a des services spécialisés avec timeout, délai et cache
  useEffect(() => {
    const checkSpecializedServices = async () => {
      if (!user?.id) {
        setHasSpecializedServices(false);
        setHasServicesOrProducts(false);
        return;
      }

      // ✅ OPTIMISATION: Vérifier le cache (durée de validité: 5 minutes)
      const cacheKey = `specialized_services_${user.id}`;
      try {
        const cached = await SafeStorage.getItem(cacheKey);
        if (cached) {
          const { hasSpecialized: cachedHasSpecialized, hasAny: cachedHasAny, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

          if (cacheAge < CACHE_DURATION) {
            setHasSpecializedServices(cachedHasSpecialized);
            setHasServicesOrProducts(cachedHasAny);
            return; // Utiliser le cache, pas besoin de requête API
          }
        }
      } catch (cacheError) {
        // Ignorer les erreurs de cache, continuer avec la requête API
      }

      // ✅ CORRIGÉ: Supprimer le délai bloquant - faire la vérification en arrière-plan
      // Ne pas bloquer le démarrage de l'app

      // ✅ CORRIGÉ: Utiliser setTimeout pour ne pas bloquer
      setTimeout(async () => {
        try {
          const { apiGet, servicesApi } = require('../services/api');

          // ✅ CORRIGÉ: Timeout réduit de 3s à 2s pour éviter les blocages
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 2000)
          );

          // Vérifier si l'utilisateur a au moins un service spécialisé
          const apiCalls = Promise.all([
            apiGet('/api/pharmacies').catch(() => ({ success: false, data: [] })),
            apiGet('/api/hopitaux').catch(() => ({ success: false, data: [] })),
            apiGet('/api/laboratoires').catch(() => ({ success: false, data: [] })),
            apiGet('/api/banques-sang').catch(() => ({ success: false, data: [] })),
            apiGet('/api/agences-voyage').catch(() => ({ success: false, data: [] })),
            apiGet('/api/covoiturages').catch(() => ({ success: false, data: [] })),
            apiGet('/api/taxis').catch(() => ({ success: false, data: [] })),
            // ✅ NOUVEAU: Vérifier aussi les services et produits généraux
            servicesApi.getUserServices().catch(() => ({ success: false, data: [] })),
            apiGet(`/api/products/user/${user.id}`).catch(() => ({ success: false, data: [] })),
          ]);

          let results: any[];
          try {
            results = await Promise.race([apiCalls, timeoutPromise]);
          } catch (timeoutError) {
            console.warn('[AppNavigator] Timeout vérification services spécialisés');
            setHasSpecializedServices(false);
            setHasServicesOrProducts(false);
            return;
          }

          const [pharmacies, hopitaux, laboratoires, banques_sang, agences, covoiturages, taxis, userServices, userProducts] = results;

          const hasSpecialized =
            (pharmacies.success && Array.isArray(pharmacies.data) && pharmacies.data.length > 0) ||
            (hopitaux.success && Array.isArray(hopitaux.data) && hopitaux.data.length > 0) ||
            (laboratoires.success && Array.isArray(laboratoires.data) && laboratoires.data.length > 0) ||
            (banques_sang.success && Array.isArray(banques_sang.data) && banques_sang.data.length > 0) ||
            (agences.success && Array.isArray(agences.data) && agences.data.length > 0) ||
            (covoiturages.success && Array.isArray(covoiturages.data) && covoiturages.data.length > 0) ||
            (taxis.success && Array.isArray(taxis.data) && taxis.data.length > 0);

          // ✅ NOUVEAU: Vérifier si l'utilisateur a des services ou produits
          const hasServices = userServices?.success && Array.isArray(userServices?.data) && userServices.data.length > 0;
          const hasProducts = userProducts?.success && Array.isArray(userProducts?.data) && userProducts.data.length > 0;
          const hasAny = hasSpecialized || hasServices || hasProducts;

          setHasSpecializedServices(hasSpecialized);
          setHasServicesOrProducts(hasAny);

          // ✅ OPTIMISATION: Mettre en cache le résultat
          try {
            await SafeStorage.setItem(cacheKey, JSON.stringify({
              hasSpecialized,
              hasAny,
              timestamp: Date.now()
            }));
          } catch (cacheError) {
            // Ignorer les erreurs de sauvegarde du cache
          }
        } catch (error) {
          console.error('[AppNavigator] Erreur vérification services spécialisés:', error);
          // ✅ En cas d'erreur, continuer sans bloquer l'app
          setHasSpecializedServices(false);
          setHasServicesOrProducts(false);
        }
      }, 200); // ✅ CORRIGÉ: Délai minimal de 200ms au lieu de 1000ms
    };

    // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
    checkSpecializedServices().catch(error => {
      console.error('[AppNavigator] Erreur checkSpecializedServices:', error);
    });

    // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
    return undefined;
  }, [user?.id]);

  // ✅ NOUVEAU: État pour badges notifications (à connecter avec votre système de notifications)
  const [notificationBadges, setNotificationBadges] = React.useState<Record<string, number>>({
    'home': 0,
    'videos': 0,
    'history': 0,
  });

  // ✅ NOUVEAU: Haptic feedback sur changement de tab
  const handleTabPress = (routeName: string) => {
    const { hapticPress } = require('../utils/hapticFeedback');
    hapticPress();
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon
            name={route.name.toLowerCase()}
            focused={focused}
            badgeCount={notificationBadges[route.name.toLowerCase()]}
          />
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
          // ✅ NOUVEAU: Ombre pour effet premium
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
        tabBarItemStyle: {
          paddingHorizontal: 2,
        },
        // ✅ CORRIGÉ: Animation de transition entre tabs avec gestion d'erreur
        tabBarButton: (props) => {
          // ✅ CRITIQUE: S'assurer que props.onPress est toujours appelé en premier
          const handlePress = (e: any) => {
            try {
              // ✅ CRITIQUE: Appeler props.onPress en premier pour la navigation
              if (props.onPress && typeof props.onPress === 'function') {
                props.onPress(e);
              }
              // ✅ Ensuite, ajouter le haptic feedback
              handleTabPress(route.name);
            } catch (error) {
              console.error('[AppNavigator] Erreur navigation TabBar:', error);
              // ✅ FALLBACK: Réessayer la navigation en cas d'erreur
              if (props.onPress && typeof props.onPress === 'function') {
                props.onPress(e);
              }
            }
          };

          return (
            <TouchableOpacity
              {...props}
              onPress={handlePress}
              activeOpacity={0.7}
              disabled={false} // ✅ CORRIGÉ: Ne jamais désactiver les boutons de la TabBar
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreenWithSafeArea} options={{ tabBarLabel: 'Accueil' }} />
      {/* ✅ MODIFIÉ: Onglet "Mes Services" toujours visible - entre Accueil et Vidéo */}
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
      {/* ✅ REMPLACÉ: Onglet Services Spécialisés par bouton création vidéo */}
      <Tab.Screen
        name="VideoCreationIntro"
        component={VideoCreationIntroScreenWithSafeArea}
        options={{
          tabBarLabel: 'Créer',
          tabBarIcon: ({ focused, color, size }) => (
            <SafeIcon name="plus" size={size} color={focused ? modernColors.primary : color} type="lucide" />
          ),
        }}
      />
      {/* ✅ NOUVEAU: Onglet feed vidéos (lecture/visualisation) */}
      <Tab.Screen
        name="Videos"
        component={VideoFeedScreenWithSafeArea}
        options={{
          tabBarLabel: 'Vidéos',
        }}
      />
      {/* ✅ SUPPRIMÉ: Onglet Historique (déjà accessible dans Mon Compte) */}
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
      <Stack.Navigator
        screenOptions={defaultScreenOptions} // ✅ PHASE 3: Transitions personnalisées par défaut
      >
        <Stack.Screen
          name="Main"
          component={MainStack}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.fade, // Transition fade pour l'écran principal
          }}
        />
        <Stack.Screen
          name="Contact"
          component={ContactScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.fade, // Transition fade pour Contact
          }}
        />
        <Stack.Screen name="SpecializedSearch" component={SpecializedSearchScreenWithSafeArea} />
        <Stack.Screen name="SpecializedServicesHub" component={SpecializedServicesHubScreenWithSafeArea} />
        <Stack.Screen name="MesServicesSpecialises" component={MesServicesSpecialisesScreenWithSafeArea} />
        <Stack.Screen name="GestionServicesSpecialises" component={GestionServicesSpecialisesScreenWithSafeArea} />
        <Stack.Screen name="ServicesDashboard" component={ServicesDashboardWithSafeArea} />
        <Stack.Screen name="PharmacieForm" component={PharmacieFormScreenWithSafeArea} />
        <Stack.Screen name="HopitalForm" component={HopitalFormScreenWithSafeArea} />
        <Stack.Screen name="LaboratoireForm" component={LaboratoireFormScreenWithSafeArea} />
        <Stack.Screen name="BanqueSangForm" component={BanqueSangFormScreenWithSafeArea} />
        <Stack.Screen name="AgenceVoyageForm" component={AgenceVoyageFormScreenWithSafeArea} />
        <Stack.Screen name="CovoiturageForm" component={CovoiturageFormScreenWithSafeArea} />
        <Stack.Screen name="TaxiForm" component={TaxiFormScreenWithSafeArea} />
        {/* ✅ Phase 3: Routes recherche Taxi et Covoiturage */}
        <Stack.Screen name="TaxiSearch" component={TaxiSearchScreenWithSafeArea} />
        <Stack.Screen name="TaxiIntelligentSearch" component={TaxiIntelligentSearchScreenWithSafeArea} />
        <Stack.Screen name="TaxiList" component={TaxiListScreenWithSafeArea} />
        <Stack.Screen name="TaxiDetails" component={TaxiDetailsScreenWithSafeArea} />
        <Stack.Screen name="TaxiBooking" component={TaxiBookingScreenWithSafeArea} />
        <Stack.Screen name="TaxiAvailability" component={TaxiAvailabilityScreenWithSafeArea} />
        <Stack.Screen name="MesTaxis" component={MesTaxisScreenWithSafeArea} />
        {/* ✅ Phase 3: Hôpitaux */}
        <Stack.Screen name="HopitalSearch" component={HopitalSearchScreenWithSafeArea} />
        {/* ✅ NOUVEAU: Routes Immobilier */}
        <Stack.Screen name="ImmobilierSearch" component={ImmobilierSearchScreenWithSafeArea} />
        <Stack.Screen name="ImmobilierList" component={ImmobilierListScreenWithSafeArea} />
        <Stack.Screen name="ImmobilierDetails" component={ImmobilierDetailsScreenWithSafeArea} />
        <Stack.Screen name="ImmobilierBooking" component={ImmobilierBookingScreenWithSafeArea} />
        <Stack.Screen name="ImmobilierCompare" component={ImmobilierCompareScreenWithSafeArea} />
        <Stack.Screen name="MyFavorites" component={MyFavoritesScreenWithSafeArea} />
        <Stack.Screen name="ImmobilierPriceAlerts" component={ImmobilierPriceAlertsScreenWithSafeArea} />
        <Stack.Screen name="HopitalList" component={HopitalListScreenWithSafeArea} />
        <Stack.Screen name="HopitalDetails" component={HopitalDetailsScreenWithSafeArea} />
        {/* ✅ Phase 3: Laboratoires */}
        <Stack.Screen name="LaboratoireSearch" component={LaboratoireSearchScreenWithSafeArea} />
        <Stack.Screen name="LaboratoireList" component={LaboratoireListScreenWithSafeArea} />
        <Stack.Screen name="LaboratoireDetails" component={LaboratoireDetailsScreenWithSafeArea} />
        {/* ✅ NOUVEAU: Pharmacie */}
        <Stack.Screen name="PharmacieSearch" component={PharmacieSearchScreenWithSafeArea} />
        <Stack.Screen name="PharmacieList" component={PharmacieListScreenWithSafeArea} />
        <Stack.Screen name="PharmacieDetails" component={PharmacieDetailsScreenWithSafeArea} />
        {/* ✅ NOUVEAU: Hub services de santé */}
        <Stack.Screen name="HealthServicesHub" component={HealthServicesHubScreenWithSafeArea} />
        {/* ✅ NOUVEAU: Banque de sang */}
        <Stack.Screen name="BanqueSangSearch" component={BanqueSangSearchScreenWithSafeArea} />
        <Stack.Screen name="BanqueSangList" component={BanqueSangListScreenWithSafeArea} />
        <Stack.Screen name="BanqueSangDetails" component={BanqueSangDetailsScreenWithSafeArea} />
        {/* ✅ NOUVEAU: Agence de voyage */}
        <Stack.Screen name="AgenceVoyageSearch" component={AgenceVoyageSearchScreenWithSafeArea} />
        <Stack.Screen name="AgenceVoyageList" component={AgenceVoyageListScreenWithSafeArea} />
        <Stack.Screen name="AgenceVoyageDetails" component={AgenceVoyageDetailsScreenWithSafeArea} />
        <Stack.Screen name="CovoiturageSearch" component={CovoiturageSearchScreenWithSafeArea} />
        <Stack.Screen name="CovoiturageList" component={CovoiturageListScreenWithSafeArea} />
        <Stack.Screen name="CovoiturageDetails" component={CovoiturageDetailsScreenWithSafeArea} />
        <Stack.Screen name="CovoiturageBooking" component={CovoiturageBookingScreenWithSafeArea} />
        <Stack.Screen name="MyTrips" component={MyTripsScreenWithSafeArea} />
        {/* ✅ NOUVEAU 2025-01-28: Routes Bourse du livre scolaire */}
        <Stack.Screen
          name="LivreScolaireSearch"
          component={LivreScolaireSearchScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Rechercher un livre',
          }}
        />
        <Stack.Screen
          name="LivreScolaireList"
          component={LivreScolaireListScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Livres trouvés',
          }}
        />
        <Stack.Screen
          name="LivreScolaireDetails"
          component={LivreScolaireDetailsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Détails du livre',
          }}
        />
        <Stack.Screen
          name="LivreScolaireForm"
          component={LivreScolaireFormScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Créer/Modifier un livre',
          }}
        />
        <Stack.Screen
          name="MesLivres"
          component={MesLivresScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Mes Livres',
          }}
        />
        <Stack.Screen
          name="TrocMatching"
          component={TrocMatchingScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Matchings trouvés',
          }}
        />
        <Stack.Screen
          name="TrocDetails"
          component={TrocDetailsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Détails du troc',
          }}
        />
        <Stack.Screen
          name="TrocLiveValidation"
          component={TrocLiveValidationScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Validation vidéo',
          }}
        />
        <Stack.Screen
          name="MesTrocs"
          component={MesTrocsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Mes Troc',
          }}
        />
        {/* ✅ NOUVEAU 2025-01-28: Orientation scolaire */}
        <Stack.Screen
          name="OrientationScolaireHub"
          component={OrientationScolaireHubScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Orientation Scolaire',
          }}
        />
        <Stack.Screen
          name="EtablissementSearch"
          component={EtablissementSearchScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Rechercher un établissement',
          }}
        />
        <Stack.Screen
          name="EtablissementDetails"
          component={EtablissementDetailsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Détails établissement',
          }}
        />
        <Stack.Screen
          name="ProgrammesList"
          component={ProgrammesScolairesScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Programmes Scolaires',
          }}
        />
        <Stack.Screen
          name="FournituresList"
          component={FournituresScolairesScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Fournitures Scolaires',
          }}
        />
        <Stack.Screen
          name="ConcoursList"
          component={ConcoursEntreeScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Concours d\'Entrée',
          }}
        />
        <Stack.Screen
          name="ExperiencesList"
          component={ExperiencesEtudiantsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Expériences Étudiants',
          }}
        />
        <Stack.Screen
          name="ConferencesList"
          component={ConferencesLivesScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Conférences & Lives',
          }}
        />
        {/* ✅ NOUVEAU 2025-01-27: Routes Bourse du Livre avec IA */}
        <Stack.Screen
          name="BourseLivre"
          component={BourseLivreScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Bourse du Livre',
          }}
        />
        {/* ✅ NOUVEAU 2025-01-27: Routes Planification Menus */}
        <Stack.Screen
          name="MenuPlanningHub"
          component={MenuPlanningHubScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Planification Menus',
          }}
        />
        <Stack.Screen
          name="MenuWeekCalendar"
          component={MenuWeekCalendarScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Menu de la Semaine',
          }}
        />
        <Stack.Screen
          name="ShoppingList"
          component={ShoppingListScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Liste de Courses',
          }}
        />
        <Stack.Screen
          name="RecipeDetails"
          component={RecipeDetailsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Détails Recette',
          }}
        />
        {/* ✅ NOUVEAU: Écrans Orientation Scolaire IA */}
        <Stack.Screen
          name="ProfilEtudiant"
          component={withNavigatorSafeArea(require('../screens/orientation/ProfilEtudiantScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Mon Profil Étudiant',
          }}
        />
        <Stack.Screen
          name="OrientationAIProfileAnalysis"
          component={withNavigatorSafeArea(require('../screens/orientation/OrientationAIProfileAnalysisScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Analyse Profil IA',
          }}
        />
        <Stack.Screen
          name="OrientationAIRecommendations"
          component={withNavigatorSafeArea(require('../screens/orientation/OrientationAIRecommendationsScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Recommandations Programmes',
          }}
        />
        <Stack.Screen
          name="OrientationAIComparePrograms"
          component={withNavigatorSafeArea(require('../screens/orientation/OrientationAICompareProgramsScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Comparer Programmes',
          }}
        />
        {/* ✅ NOUVEAU: Écrans Offres d'Emploi IA */}
        <Stack.Screen
          name="AICVAnalysis"
          component={withNavigatorSafeArea(require('../screens/offres-emploi/AnalyseCVScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Analyse CV IA',
          }}
        />
        <Stack.Screen
          name="AISalaryPrediction"
          component={withNavigatorSafeArea(require('../screens/offres-emploi/AISalaryPredictionScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Prédiction Salaire IA',
          }}
        />
        <Stack.Screen
          name="AISuggestFormations"
          component={withNavigatorSafeArea(require('../screens/offres-emploi/AISuggestFormationsScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Suggestions Formations IA',
          }}
        />
        {/* ✅ NOUVEAU 2025-01-28: Routes offres d'emploi */}
        <Stack.Screen
          name="OffresEmploiHub"
          component={OffresEmploiHubScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Offres d\'Emploi',
          }}
        />
        <Stack.Screen
          name="OffreSearch"
          component={OffreSearchScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Rechercher une offre',
          }}
        />
        <Stack.Screen
          name="OffreList"
          component={withNavigatorSafeArea(require('../screens/offres-emploi/OffreListScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Résultats de recherche',
          }}
        />
        <Stack.Screen
          name="OffreDetails"
          component={withNavigatorSafeArea(require('../screens/offres-emploi/OffreDetailsScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Détails de l\'offre',
          }}
        />
        <Stack.Screen
          name="CreateOffre"
          component={CreateOffreScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Publier une offre',
          }}
        />
        <Stack.Screen
          name="ProfilCandidat"
          component={ProfilCandidatScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Mon Profil Candidat',
          }}
        />
        <Stack.Screen
          name="Reservation"
          component={ReservationScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Réservation',
          }}
        />
        <Stack.Screen
          name="MesReservations"
          component={MesReservationsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Mes Réservations',
          }}
        />
        <Stack.Screen
          name="MesReservationsCovoiturage"
          component={withNavigatorSafeArea(require('../screens/specialized/MesReservationsCovoiturageScreen').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Mes Réservations Covoiturage',
          }}
        />
        <Stack.Screen
          name="PrestataireReservations"
          component={PrestataireReservationsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            title: 'Réservations Reçues',
          }}
        />
        <Stack.Screen
          name="ServiceDetailSpecialized"
          component={ServiceDetailScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideUp,
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen name="MyBusTickets" component={withNavigatorSafeArea(MyBusTicketsScreen)} />
        <Stack.Screen name="BloodGroupManagement" component={withNavigatorSafeArea(BloodGroupManagementScreen)} />
        <Stack.Screen name="AgencyTicketManagement" component={withNavigatorSafeArea(AgencyTicketManagementScreen)} />
        <Stack.Screen name="BusBoardingManagement" component={withNavigatorSafeArea(BusBoardingManagementScreen)} />
        <Stack.Screen name="ManageBusSeats" component={withNavigatorSafeArea(ManageBusSeatsScreen)} />
        <Stack.Screen name="ManageAgencySchedules" component={withNavigatorSafeArea(ManageAgencySchedulesScreen)} />
        {/* ✅ NOUVEAU: Écrans banque de sang */}
        <Stack.Screen
          name="BloodDonationRequest"
          component={withNavigatorSafeArea(BloodDonationRequestScreen)}
          options={{ title: 'Créer demande de don' }}
        />
        <Stack.Screen
          name="BloodDonationMatches"
          component={withNavigatorSafeArea(BloodDonationMatchesScreen)}
          options={{ title: 'Matches donneurs' }}
        />
        <Stack.Screen
          name="MyBloodDonations"
          component={withNavigatorSafeArea(MyBloodDonationsScreen)}
          options={{ title: 'Mes dons de sang' }}
        />
        {/* ✅ NOUVEAU: Écrans tickets bus */}
        <Stack.Screen
          name="BusTicketSearch"
          component={withNavigatorSafeArea(BusTicketSearchScreen)}
          options={{ title: 'Rechercher un trajet' }}
        />
        {/* ✅ NOUVEAU: BayamSelam, Automobile, Assurance */}
        <Stack.Screen
          name="BayamSelamSearch"
          component={BayamSelamSearchScreenWithSafeArea}
          options={{ title: 'BayamSelam - Comparateur de prix' }}
        />
        <Stack.Screen
          name="AutoServicesSearch"
          component={AutoServicesSearchScreenWithSafeArea}
          options={{ title: 'Rechercher un véhicule' }}
        />
        <Stack.Screen
          name="InsuranceServicesSearch"
          component={InsuranceServicesSearchScreenWithSafeArea}
          options={{ title: 'Rechercher une assurance' }}
        />
        <Stack.Screen
          name="BusTicketBooking"
          component={withNavigatorSafeArea(BusTicketBookingScreen)}
          options={{ title: 'Réserver des places' }}
        />
        <Stack.Screen
          name="BusTicketPayment"
          component={withNavigatorSafeArea(require('../screens/specialized/BusTicketPaymentScreen').default)}
          options={{ title: 'Paiement ticket' }}
        />
        <Stack.Screen
          name="BusTicketDetails"
          component={withNavigatorSafeArea(BusTicketDetailsScreen)}
          options={{ title: 'Mon ticket' }}
        />
        {/* ✅ NOUVEAU: Routes demandes de retour (aller-retour) */}
        <Stack.Screen
          name="BusReturnRequests"
          component={withNavigatorSafeArea(BusReturnRequestsScreen)}
          options={{ title: 'Mes demandes de retour' }}
        />
        <Stack.Screen
          name="BusReturnRequestForm"
          component={withNavigatorSafeArea(BusReturnRequestFormScreen)}
          options={{ title: 'Créer demande de retour' }}
        />
        <Stack.Screen
          name="Settings"
          component={EnhancedSettingsScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.fade, // ✅ PHASE 3: Transition fade pour settings
          }}
        />
        <Stack.Screen
          name="RechargeTokens"
          component={RechargeTokensScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideUp, // ✅ PHASE 3: Transition slideUp pour recharge tokens
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen name="FormulaireYukpoIntelligent" component={FormulaireYukpoIntelligentWithSafeArea} />
        <Stack.Screen name="AjouterProduitSimple" component={AjouterProduitSimpleWithSafeArea} />
        <Stack.Screen name="MesProduits" component={MesProduitsScreenWithSafeArea} />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideUp, // ✅ PHASE 3: Transition slideUp pour détails produit
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="ServiceDetail"
          component={ServiceDetailSharedScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideUp, // ✅ PHASE 3: Transition slideUp pour détails service
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="ServiceDetailShared"
          component={ServiceDetailSharedScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideUp, // ✅ PHASE 3: Transition slideUp pour détails service partagé
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="ResultatBesoin"
          component={ResultatBesoinScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.scale, // ✅ PHASE 3: Transition scale pour résultats
          }}
        />
        <Stack.Screen
          name="CreatePublicite"
          component={CreatePubliciteScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideUp, // ✅ PHASE 3: Transition slideUp pour création publicité
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="PubliciteDashboard"
          component={PubliciteDashboardScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideHorizontal, // ✅ PHASE 3: Transition slideHorizontal pour dashboard
          }}
        />
        <Stack.Screen
          name="SoldeDetail"
          component={SoldeDetailScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.fade, // ✅ PHASE 3: Transition fade pour détails solde
          }}
        />
        <Stack.Screen name="YukpoServicePlaceholder" component={YukpoServicePlaceholderScreenWithSafeArea} />
        <Stack.Screen 
          name="VideoFeed" 
          component={VideoFeedScreenWithSafeArea}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="HashtagDiscovery" component={HashtagDiscoveryScreenWithSafeArea} />
        <Stack.Screen name="CreatorAnalytics" component={CreatorAnalyticsScreenWithSafeArea} />
        <Stack.Screen name="VideoAnalytics" component={VideoAnalyticsScreenWithSafeArea} />
        <Stack.Screen name="VideoCreationIntro" component={VideoCreationIntroScreenWithSafeArea} />
        <Stack.Screen
          name="FlashSale"
          component={withNavigatorSafeArea(FlashSaleScreen)}
          options={{
            ...defaultScreenOptions,
            title: '🔥 Ventes Flash',
          }}
        />
        <Stack.Screen
          name="FlashPromosActive"
          component={withNavigatorSafeArea(FlashPromosActiveScreen)}
          options={{
            ...defaultScreenOptions,
            title: '⚡ Flash Promotionnels',
          }}
        />
        <Stack.Screen
          name="CreateFlashPromo"
          component={withNavigatorSafeArea(CreateFlashPromoScreen)}
          options={{
            ...defaultScreenOptions,
            title: '⚡ Créer Flash Promo',
          }}
        />
        <Stack.Screen
          name="GlobalPromoCatalog"
          component={withNavigatorSafeArea(GlobalPromoCatalogScreen)}
          options={{
            ...defaultScreenOptions,
            title: '🛍️ Black Friday',
          }}
        />
        <Stack.Screen name="VideoCreationWizard" component={VideoCreationWizardScreenWithSafeArea} />
        <Stack.Screen name="VideoGenerationResult" component={VideoGenerationResultScreenWithSafeArea} />
        <Stack.Screen name="Delivery" component={DeliveryHomeScreenWithSafeArea} />
        <Stack.Screen name="DeliveryHome" component={DeliveryHomeScreenWithSafeArea} />
        <Stack.Screen name="DeliveryShoppingFlow" component={DeliveryShoppingFlow} />
        <Stack.Screen name="DeliveryShoppingFlowNew" component={withNavigatorSafeArea(DeliveryShoppingFlowScreen)} />
        <Stack.Screen name="DeliveryParcelFlow" component={withNavigatorSafeArea(DeliveryParcelFlowScreen)} />
        <Stack.Screen name="DeliveryParcelFlowNew" component={withNavigatorSafeArea(DeliveryParcelFlowNewScreen)} />
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
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideUp, // ✅ PHASE 3: Transition slideUp pour soumission promo
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="GlobalPromoManager"
          component={GlobalPromoManagerScreenWithSafeArea}
          options={{
            ...defaultScreenOptions,
            ...transitionConfig.slideUp, // ✅ PHASE 3: Transition slideUp pour gestion promo
            gestureDirection: 'vertical',
          }}
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
          name="AgencyAnalyticsDashboard"
          component={withNavigatorSafeArea(require('../screens/AgencyAnalyticsDashboard').default)}
          options={{
            ...defaultScreenOptions,
            title: 'Analytics Agence',
          }}
        />
        <Stack.Screen
          name="CourierRegistration"
          component={withNavigatorSafeArea(require('../screens/delivery/CourierRegistrationScreen').default)}
        />
        <Stack.Screen
          name="CourierDashboard"
          component={withNavigatorSafeArea(require('../screens/delivery/CourierDashboardScreen').default)}
        />
        <Stack.Screen
          name="CourierAdmin"
          component={withNavigatorSafeArea(CourierAdminScreen)}
          options={{
            ...defaultScreenOptions,
            title: 'Gestion des coursiers',
          }}
        />
        <Stack.Screen
          name="UserRoleManagement"
          component={withNavigatorSafeArea(UserRoleManagementScreen)}
          options={{
            ...defaultScreenOptions,
            title: 'Gestion des rôles',
          }}
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