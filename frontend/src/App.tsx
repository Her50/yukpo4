// @ts-check
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
// CORRECTION CRITIQUE: Importer la configuration axios
import { FeatureFlagProvider } from '@/context';
import { DeliveryProvider } from '@/context/DeliveryContext';
import { ShoppingProvider } from '@/context/ShoppingContext';
import { Toaster } from 'react-hot-toast';
import RequireAuth from './components/auth/RequireAuth';
import GPSManager from './components/GPSManager';
import { GlobalIAStatsProvider } from './components/intelligence/GlobalIAStats';
import { IntelligentLanguageProvider } from './components/IntelligentLanguageProvider';
import RequireAdminPage from './components/security/RequireAdminPage';
import { ToasterProvider } from './components/ui/toaster';
import './config/axios';
import { AuthProvider } from './contexts/AuthContext';
import KYCVerificationPage from './pages/admin/KYCVerificationPage';
import AdminUserRolesPage from './pages/admin/AdminUserRolesPage';
import CourierAdminPage from './pages/admin/CourierAdminPage';
import { ROUTES } from './routes/AppRoutesRegistry';
// Pages essentielles
import ConfirmationPage from '@/pages/ConfirmationPage';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import PageNotFound from '@/pages/PageNotFound';
import RegisterPage from '@/pages/RegisterPage';
import PartnerRegisterPage from '@/pages/PartnerRegisterPage'; // ✅ NOUVEAU: Inscription partenaire
// Recherche & Cr+�ation service
import ServiceFormDynamic from "@/components/forms/ServiceFormDynamic";
import ChatDialog from '@/pages/ChatDialog';
import CreationService from "@/pages/CreationService";
import CreationSmartService from '@/pages/CreationSmartService';
import CourierDashboardPage from '@/pages/delivery/CourierDashboardPage';
import CourierMyDeliveriesPage from '@/pages/delivery/CourierMyDeliveriesPage';
import CourierRegistrationPage from '@/pages/delivery/CourierRegistrationPage';
import DeliveryPartnersAdminPage from '@/pages/delivery/DeliveryPartnersAdminPage';
import DeliveryHomePage from '@/pages/delivery/DeliveryHomePage';
import DeliveryParcelFlowPage from '@/pages/delivery/DeliveryParcelFlowPage';
import DeliveryShoppingFlowPage from '@/pages/delivery/DeliveryShoppingFlowPage';
import DeliveryTrackingPage from '@/pages/delivery/DeliveryTrackingPage';
import ShoppingBasketPage from '@/pages/delivery/ShoppingBasketPage';
import ShoppingBudgetPage from '@/pages/delivery/ShoppingBudgetPage';
import ShoppingPickupDropPage from '@/pages/delivery/ShoppingPickupDropPage';
import ShoppingSummaryPage from '@/pages/delivery/ShoppingSummaryPage';
import StorageLocationsPage from '@/pages/delivery/StorageLocationsPage';
import FormulaireServiceModerne from '@/pages/FormulaireServiceModerne';
import FormulaireYukpoIntelligent from '@/pages/FormulaireYukpoIntelligent';
import AjouterProduitSimple from '@/pages/AjouterProduitSimple';
import RechercheBesoin from '@/pages/RechercheBesoin';
import SoldeDetailPage from '@/pages/SoldeDetailPage';
import YukpoIaHub from '@/pages/YukpoIaHub';
// Services spécialisés
import ManageAgencySchedulesPage from '@/pages/agency/ManageAgencySchedulesPage';
// ✅ NOUVEAU Phase 2-4: Pages services spécialisés
import GestionServicesSpecialisesPage from '@/pages/specialized/GestionServicesSpecialisesPage';
import MesReservationsPage from '@/pages/specialized/MesReservationsPage';
import PrestataireReservationsPage from '@/pages/specialized/PrestataireReservationsPage';
import ReservationPage from '@/pages/specialized/ReservationPage';
import ServiceDetailPage from '@/pages/specialized/ServiceDetailPage';
import ServicesDashboardPage from '@/pages/specialized/ServicesDashboardPage';
import SpecializedSearchPage from '@/pages/specialized/SpecializedSearchPage';
import SpecializedServicesHubPage from '@/pages/specialized/SpecializedServicesHubPage';
// ✅ NOUVEAU: Pages banque de sang
import BloodDonationMatchesPage from '@/pages/specialized/BloodDonationMatchesPage';
import BloodDonationRequestPage from '@/pages/specialized/BloodDonationRequestPage';
import MyBloodDonationsPage from '@/pages/specialized/MyBloodDonationsPage';
// ✅ NOUVEAU: Pages tickets bus
import BusReturnRequestFormPage from '@/pages/specialized/BusReturnRequestFormPage';
import BusReturnRequestsPage from '@/pages/specialized/BusReturnRequestsPage';
import BusTicketBookingPage from '@/pages/specialized/BusTicketBookingPage';
import BusTicketDetailsPage from '@/pages/specialized/BusTicketDetailsPage';
import BusTicketSearchPage from '@/pages/specialized/BusTicketSearchPage';
// ✅ NOUVEAU: Pages taxi et covoiturage
import CovoiturageForm from '@/pages/specialized/CovoiturageForm';
import TaxiForm from '@/pages/specialized/TaxiForm';
// ✅ Phase 5: Pages recherche Taxi et Covoiturage
import CovoiturageDetailsPage from '@/pages/specialized/CovoiturageDetailsPage';
import CovoiturageListPage from '@/pages/specialized/CovoiturageListPage';
import CovoiturageSearchPage from '@/pages/specialized/CovoiturageSearchPage';
import MyTripsPage from '@/pages/specialized/MyTripsPage';
import TaxiAvailabilityPage from '@/pages/specialized/TaxiAvailabilityPage';
import TaxiDetailsPage from '@/pages/specialized/TaxiDetailsPage';
import TaxiListPage from '@/pages/specialized/TaxiListPage';
import TaxiSearchPage from '@/pages/specialized/TaxiSearchPage';
// ✅ Phase 4: Pages recherche Hôpitaux et Laboratoires
import HopitalDetailsPage from '@/pages/specialized/HopitalDetailsPage';
import HopitalListPage from '@/pages/specialized/HopitalListPage';
import HopitalSearchPage from '@/pages/specialized/HopitalSearchPage';
import LaboratoireDetailsPage from '@/pages/specialized/LaboratoireDetailsPage';
import LaboratoireListPage from '@/pages/specialized/LaboratoireListPage';
import LaboratoireSearchPage from '@/pages/specialized/LaboratoireSearchPage';
// ✅ NOUVEAU: Pages recherche Pharmacie, Banque de sang, Agence de voyage
import AgenceVoyageDetailsPage from '@/pages/specialized/AgenceVoyageDetailsPage';
import AgenceVoyageListPage from '@/pages/specialized/AgenceVoyageListPage';
import AgenceVoyageSearchPage from '@/pages/specialized/AgenceVoyageSearchPage';
import BanqueSangDetailsPage from '@/pages/specialized/BanqueSangDetailsPage';
import BanqueSangListPage from '@/pages/specialized/BanqueSangListPage';
import BanqueSangSearchPage from '@/pages/specialized/BanqueSangSearchPage';
import PharmacieDetailsPage from '@/pages/specialized/PharmacieDetailsPage';
import PharmacieListPage from '@/pages/specialized/PharmacieListPage';
import PharmacieSearchPage from '@/pages/specialized/PharmacieSearchPage';
// ✅ NOUVEAU: Pages services spécialisés - Formulaires
import AgenceVoyageForm from '@/pages/specialized/AgenceVoyageForm';
import BanqueSangForm from '@/pages/specialized/BanqueSangForm';
import HopitalForm from '@/pages/specialized/HopitalForm';
import LaboratoireForm from '@/pages/specialized/LaboratoireForm';
import PharmacieForm from '@/pages/specialized/PharmacieForm';
// ✅ NOUVEAU 2025-01-28: Pages Bourse du livre scolaire
import LivreScolaireDetailsPage from '@/pages/livres-scolaires/LivreScolaireDetailsPage';
import LivreScolaireFormPage from '@/pages/livres-scolaires/LivreScolaireFormPage';
import LivreScolaireListPage from '@/pages/livres-scolaires/LivreScolaireListPage';
import LivreScolaireSearchPage from '@/pages/livres-scolaires/LivreScolaireSearchPage';
import MesLivresPage from '@/pages/livres-scolaires/MesLivresPage';
import MesTrocsPage from '@/pages/trocs/MesTrocsPage';
import TrocDetailsPage from '@/pages/trocs/TrocDetailsPage';
import TrocLiveValidationPage from '@/pages/trocs/TrocLiveValidationPage';
import TrocMatchingPage from '@/pages/trocs/TrocMatchingPage';
// ✅ NOUVEAU 2025-01-28: Pages offres d'emploi
import MesCandidaturesPage from '@/pages/offres-emploi/MesCandidaturesPage';
import MesOffresPage from '@/pages/offres-emploi/MesOffresPage';
import OffreDetailsPage from '@/pages/offres-emploi/OffreDetailsPage';
import OffreListPage from '@/pages/offres-emploi/OffreListPage';
import OffreSearchPage from '@/pages/offres-emploi/OffreSearchPage';
import OffresEmploiHubPage from '@/pages/offres-emploi/OffresEmploiHubPage';
// ✅ NOUVEAU 2025-01-28: Pages orientation scolaire
import ConcoursEntreePage from '@/pages/orientation-scolaire/ConcoursEntreePage';
import ConferencesLivesPage from '@/pages/orientation-scolaire/ConferencesLivesPage';
import EtablissementDetailsPage from '@/pages/orientation-scolaire/EtablissementDetailsPage';
import EtablissementSearchPage from '@/pages/orientation-scolaire/EtablissementSearchPage';
import ExperiencesEtudiantsPage from '@/pages/orientation-scolaire/ExperiencesEtudiantsPage';
import FournituresScolairesPage from '@/pages/orientation-scolaire/FournituresScolairesPage';
import OrientationScolaireHubPage from '@/pages/orientation-scolaire/OrientationScolaireHubPage';
import ProgrammesScolairesPage from '@/pages/orientation-scolaire/ProgrammesScolairesPage';

// Dashboard pages
import LocationDisplayDemo from '@/components/location/LocationDisplayDemo';
import ExternalServiceShare from '@/components/sharing/ExternalServiceShare';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';
import CreatePublicitePage from '@/pages/CreatePublicitePage';
import Dashboard from '@/pages/Dashboard';
import AnalyticsDashboard from '@/pages/dashboard/AnalyticsDashboard';
import MesServices from '@/pages/dashboard/MesServices';
import MesProduits from '@/pages/dashboard/MesProduits';
import MonProfil from '@/pages/dashboard/MonProfil';
import DashboardPrestataire from '@/pages/DashboardPrestataire';
import GoLivePage from '@/pages/GoLivePage';
import LivesPage from '@/pages/LivesPage';
import LiveViewerPage from '@/pages/LiveViewerPage';
import PubliciteDashboardPage from '@/pages/PubliciteDashboardPage';
import RechargeTokensPage from '@/pages/RechargeTokensPage';
import ResultatBesoin from '@/pages/ResultatBesoin';
import ServicesInteragisPage from '@/pages/ServicesInteragisPage';
import ServicesPage from '@/pages/ServicesPage';
import { ServiceView } from '@/pages/ServiceView';
import TestResultatBesoin from '@/pages/TestResultatBesoin';
import UserSettingsPage from '@/pages/UserSettingsPage';
import ImmersiveVideoWizard from '@/pages/video/ImmersiveVideoWizard';
import VideoCall from '@/pages/VideoCall';
// 🛒 Nouvelles pages gestion commandes
import OrderManagementPage from '@/pages/OrderManagementPage';
import ProviderAnalyticsPage from '@/pages/ProviderAnalyticsPage';
import SimilarProductsPage from '@/pages/SimilarProductsPage';
function App() {
  return (
    <GPSManager>
      <ToasterProvider>
        <AuthProvider>
          <GlobalIAStatsProvider>
            <IntelligentLanguageProvider>
              <FeatureFlagProvider>
                <ShoppingProvider>
                  <DeliveryProvider>
                    <Router>
                      <Routes>
                        {/* ���� Pages publiques */}
                        <Route path={ROUTES.HOME} element={<HomePage />} />
                        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
                        <Route path={ROUTES.PARTNER_REGISTER} element={<PartnerRegisterPage />} /> {/* ✅ NOUVEAU: Inscription partenaire */}
                        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                        <Route path={ROUTES.CONFIRMATION} element={<ConfirmationPage />} />
                        <Route path={ROUTES.ABOUT} element={<AboutPage />} />
                        <Route path={ROUTES.CONTACT} element={<ContactPage />} />
                        <Route path={ROUTES.SERVICES} element={<ServicesPage />} />
                        <Route path={ROUTES.LIVES} element={<LivesPage />} />
                        <Route
                          path={ROUTES.LIVE_GO_LIVE}
                          element={
                            <RequireAuth>
                              <GoLivePage />
                            </RequireAuth>
                          }
                        />
                        <Route path={ROUTES.LIVE_VIEW} element={<LiveViewerPage />} />
                        {/* ���� Cr+�ation & recherche service */}
                        <Route path={ROUTES.SERVICE_CREATE} element={<CreationService />} />
                        <Route path={ROUTES.CREATION_SMART_SERVICE} element={<CreationSmartService />} />
                        <Route path={ROUTES.RECHERCHE_BESOIN} element={<RechercheBesoin />} />
                        <Route path={ROUTES.YUKPO_IA_HUB} element={<YukpoIaHub />} />
                        <Route
                          path={ROUTES.IMMERSIVE_VIDEO_WIZARD}
                          element={
                            <RequireAuth>
                              <ImmersiveVideoWizard />
                            </RequireAuth>
                          }
                        />
                        <Route path={ROUTES.CHAT_DIALOG} element={<ChatDialog />} />
                        <Route path="/chat/etablissement/:etablissementId" element={<ChatDialog />} />
                        <Route path={ROUTES.FORMULAIRE_YUKPO_INTELLIGENT} element={<FormulaireYukpoIntelligent />} />
                        <Route path={ROUTES.FORMULAIRE_SERVICE_MODERNE} element={<FormulaireServiceModerne />} />
                        <Route path={ROUTES.AJOUTER_PRODUIT_SIMPLE} element={
                          <RequireAuth>
                            <AjouterProduitSimple />
                          </RequireAuth>
                        } />
                        <Route
                          path="/formulaire-pre-rempli/:type"
                          element={
                            <RequireAuth>
                              <ServiceFormDynamic />
                            </RequireAuth>
                          }
                        />
                        {/* ԣ� Ajout de la page solde/historique IA */}
                        <Route path={ROUTES.MON_SOLDE} element={<SoldeDetailPage />} />
                // // RechargeTokensPage temporarily disabled temporarily disabled
                        {/* ��Ļ Dashboard routes */}
                        <Route path={ROUTES.DASHBOARD} element={
                          <RequireAuth>
                            <Dashboard />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.MES_SERVICES} element={
                          <RequireAuth>
                            <MesServices />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.MES_PRODUITS} element={
                          <RequireAuth>
                            <MesProduits />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.ANALYTICS_DASHBOARD} element={
                          <RequireAuth>
                            <AnalyticsDashboard />
                          </RequireAuth>
                        } />
                        <Route path="/dashboard-prestataire" element={
                          <RequireAuth>
                            <DashboardPrestataire />
                          </RequireAuth>
                        } />
                        <Route path="/services-interagis" element={
                          <RequireAuth>
                            <ServicesInteragisPage />
                          </RequireAuth>
                        } />
                        <Route path="/mon-compte" element={
                          <RequireAuth>
                            <UserSettingsPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.RECHARGE_TOKENS} element={
                          <RequireAuth>
                            <RechargeTokensPage />
                          </RequireAuth>
                        } />
                        <Route path="/dashboard/profil" element={
                          <RequireAuth>
                            <MonProfil />
                          </RequireAuth>
                        } />
                        {/* 📣 Publicité routes */}
                        <Route path="/creer-publicite" element={
                          <RequireAuth>
                            <CreatePublicitePage />
                          </RequireAuth>
                        } />
                        <Route path="/dashboard-publicite" element={
                          <RequireAuth>
                            <PubliciteDashboardPage />
                          </RequireAuth>
                        } />
                        {/* 🚚 Livraison & shopping */}
                        <Route path="/become-courier" element={
                          <RequireAuth>
                            <CourierRegistrationPage />
                          </RequireAuth>
                        } />
                        <Route path="/courier/my-deliveries" element={
                          <RequireAuth>
                            <CourierMyDeliveriesPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_HOME} element={
                          <RequireAuth>
                            <DeliveryHomePage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_SHOPPING_BASKET} element={
                          <RequireAuth>
                            <ShoppingBasketPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_SHOPPING_BUDGET} element={
                          <RequireAuth>
                            <ShoppingBudgetPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_SHOPPING_PICKUP_DROP} element={
                          <RequireAuth>
                            <ShoppingPickupDropPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_SHOPPING_SUMMARY} element={
                          <RequireAuth>
                            <ShoppingSummaryPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_SHOPPING_FLOW} element={
                          <RequireAuth>
                            <DeliveryShoppingFlowPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_PARCEL_FLOW} element={
                          <RequireAuth>
                            <DeliveryParcelFlowPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_TRACKING} element={
                          <RequireAuth>
                            <DeliveryTrackingPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_COURIER_DASHBOARD} element={
                          <RequireAuth>
                            <CourierDashboardPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.DELIVERY_STORAGE_LOCATIONS} element={
                          <RequireAuth>
                            <StorageLocationsPage />
                          </RequireAuth>
                        } />
                        <Route path="/admin/delivery-partners" element={
                          <RequireAuth>
                            <DeliveryPartnersAdminPage />
                          </RequireAuth>
                        } />
                        {/* 🛒 Gestion commandes et produits similaires */}
                        <Route path={ROUTES.SIMILAR_PRODUCTS} element={<SimilarProductsPage />} />
                        <Route path={ROUTES.ORDER_MANAGEMENT} element={
                          <RequireAuth>
                            <OrderManagementPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.PROVIDER_ANALYTICS} element={
                          <RequireAuth>
                            <ProviderAnalyticsPage />
                          </RequireAuth>
                        } />
                        {/*  R+sultats de recherche */}
                        <Route path="/resultat-besoin" element={<ResultatBesoin />} />
                        <Route path="/test-resultat-besoin" element={<TestResultatBesoin />} />
                        <Route path="/test-location-display" element={<LocationDisplayDemo />} />
                        {/* ��Ļ Page de visualisation de service public */}
                        <Route path="/service/:serviceId" element={<ServiceView />} />
                        {/* 🔗 Service partagé vers l'extérieur */}
                        <Route path="/shared-service" element={<ExternalServiceShare />} />
                        {/* ��Ƽ Chat entre utilisateurs */}
                        <Route path="/chat/:prestataireId" element={
                          <RequireAuth>
                            <ChatDialog />
                          </RequireAuth>
                        } />
                        {/* ���� Appels vid+�o */}
                        <Route path="/video-call" element={<VideoCall />} />
                        {/* 🚌 Gestion horaires agences */}
                        <Route path="/agency/schedules" element={
                          <RequireAuth>
                            <ManageAgencySchedulesPage />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU Phase 2-4: Services spécialisés */}
                        <Route path={ROUTES.SPECIALIZED_SERVICES_HUB} element={
                          <RequireAuth>
                            <SpecializedServicesHubPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.SPECIALIZED_SEARCH} element={
                          <RequireAuth>
                            <SpecializedSearchPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.SPECIALIZED_GESTION} element={
                          <RequireAuth>
                            <GestionServicesSpecialisesPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.SPECIALIZED_DASHBOARD} element={
                          <RequireAuth>
                            <ServicesDashboardPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.SPECIALIZED_RESERVATION} element={
                          <RequireAuth>
                            <ReservationPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.MES_RESERVATIONS} element={
                          <RequireAuth>
                            <MesReservationsPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.PRESTATAIRE_RESERVATIONS} element={
                          <RequireAuth>
                            <PrestataireReservationsPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.SERVICE_DETAIL_SPECIALIZED} element={
                          <RequireAuth>
                            <ServiceDetailPage />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU: Routes banque de sang */}
                        <Route path={ROUTES.BLOOD_DONATION_REQUEST} element={
                          <RequireAuth>
                            <BloodDonationRequestPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.BLOOD_DONATION_MATCHES} element={
                          <RequireAuth>
                            <BloodDonationMatchesPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.MY_BLOOD_DONATIONS} element={
                          <RequireAuth>
                            <MyBloodDonationsPage />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU: Routes tickets bus */}
                        <Route path={ROUTES.BUS_TICKET_SEARCH} element={
                          <RequireAuth>
                            <BusTicketSearchPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.BUS_TICKET_BOOKING} element={
                          <RequireAuth>
                            <BusTicketBookingPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.BUS_TICKET_DETAILS} element={
                          <RequireAuth>
                            <BusTicketDetailsPage />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU: Routes demandes de retour (aller-retour) */}
                        <Route path={ROUTES.BUS_RETURN_REQUESTS} element={
                          <RequireAuth>
                            <BusReturnRequestsPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.BUS_RETURN_REQUEST_FORM} element={
                          <RequireAuth>
                            <BusReturnRequestFormPage />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU: Routes taxi */}
                        <Route path={ROUTES.TAXI_FORM} element={
                          <RequireAuth>
                            <TaxiForm />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU: Routes covoiturage */}
                        <Route path={ROUTES.COVOITURAGE_FORM} element={
                          <RequireAuth>
                            <CovoiturageForm />
                          </RequireAuth>
                        } />
                        <Route path="/covoiturages/create" element={
                          <RequireAuth>
                            <CovoiturageForm />
                          </RequireAuth>
                        } />
                        <Route path="/specialized/covoiturage/create" element={
                          <RequireAuth>
                            <CovoiturageForm />
                          </RequireAuth>
                        } />
                        {/* ✅ Phase 5: Routes recherche Taxi et Covoiturage */}
                        <Route path="/taxis/search" element={<TaxiSearchPage />} />
                        <Route path="/taxis/list" element={<TaxiListPage />} />
                        <Route path="/taxis/:id" element={<TaxiDetailsPage />} />
                        <Route path="/taxis/:id/availability" element={
                          <RequireAuth>
                            <TaxiAvailabilityPage />
                          </RequireAuth>
                        } />
                        <Route path="/covoiturages/search" element={<CovoiturageSearchPage />} />
                        <Route path="/covoiturages/list" element={<CovoiturageListPage />} />
                        <Route path="/covoiturages/:id" element={<CovoiturageDetailsPage />} />
                        {/* ✅ Phase 6: Routes gestion */}
                        <Route path="/covoiturages/my-trips" element={
                          <RequireAuth>
                            <MyTripsPage />
                          </RequireAuth>
                        } />
                        {/* ✅ Phase 4: Routes recherche Hôpitaux */}
                        <Route path="/hopitaux/search" element={<HopitalSearchPage />} />
                        <Route path="/hopitaux/list" element={<HopitalListPage />} />
                        <Route path="/hopitaux/:id" element={<HopitalDetailsPage />} />
                        {/* ✅ Phase 4: Routes recherche Laboratoires */}
                        <Route path="/laboratoires/search" element={<LaboratoireSearchPage />} />
                        <Route path="/laboratoires/list" element={<LaboratoireListPage />} />
                        <Route path="/laboratoires/:id" element={<LaboratoireDetailsPage />} />
                        {/* ✅ NOUVEAU: Routes recherche Pharmacie */}
                        <Route path="/pharmacies/search" element={<PharmacieSearchPage />} />
                        <Route path="/pharmacies/list" element={<PharmacieListPage />} />
                        <Route path="/pharmacies/:id" element={<PharmacieDetailsPage />} />
                        {/* ✅ NOUVEAU: Routes recherche Banque de sang */}
                        <Route path="/banques-sang/search" element={<BanqueSangSearchPage />} />
                        <Route path="/banques-sang/list" element={<BanqueSangListPage />} />
                        <Route path="/banques-sang/:id" element={<BanqueSangDetailsPage />} />
                        {/* ✅ NOUVEAU: Routes recherche Agence de voyage */}
                        <Route path="/agences-voyage/search" element={<AgenceVoyageSearchPage />} />
                        <Route path="/agences-voyage/list" element={<AgenceVoyageListPage />} />
                        <Route path="/agences-voyage/:id" element={<AgenceVoyageDetailsPage />} />
                        {/* ✅ NOUVEAU: Routes services spécialisés - Formulaires */}
                        <Route path={ROUTES.PHARMACIE_FORM} element={
                          <RequireAuth>
                            <PharmacieForm />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.HOPITAL_FORM} element={
                          <RequireAuth>
                            <HopitalForm />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.LABORATOIRE_FORM} element={
                          <RequireAuth>
                            <LaboratoireForm />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.AGENCE_VOYAGE_FORM} element={
                          <RequireAuth>
                            <AgenceVoyageForm />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.BANQUE_SANG_FORM} element={
                          <RequireAuth>
                            <BanqueSangForm />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU 2025-01-28: Routes Bourse du livre scolaire */}
                        <Route path={ROUTES.LIVRES_SCOLAIRES_SEARCH} element={<LivreScolaireSearchPage />} />
                        <Route path={ROUTES.LIVRES_SCOLAIRES_LIST} element={<LivreScolaireListPage />} />
                        <Route path={ROUTES.LIVRES_SCOLAIRES_DETAILS} element={<LivreScolaireDetailsPage />} />
                        <Route path={ROUTES.LIVRES_SCOLAIRES_NEW} element={
                          <RequireAuth>
                            <LivreScolaireFormPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.LIVRES_SCOLAIRES_FORM} element={
                          <RequireAuth>
                            <LivreScolaireFormPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.MES_LIVRES} element={
                          <RequireAuth>
                            <MesLivresPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.TROC_MATCHING} element={
                          <RequireAuth>
                            <TrocMatchingPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.TROC_DETAILS} element={
                          <RequireAuth>
                            <TrocDetailsPage />
                          </RequireAuth>
                        } />
                        <Route path={ROUTES.TROC_LIVE_VALIDATION} element={
                          <RequireAuth>
                            <TrocLiveValidationPage />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU 2025-01-29: Route admin vérification KYC */}
                        <Route path={ROUTES.ADMIN_KYC_VERIFICATION} element={
                          <RequireAdminPage>
                            <KYCVerificationPage />
                          </RequireAdminPage>
                        } />
                        <Route path="/admin/user-roles" element={
                          <RequireAdminPage>
                            <AdminUserRolesPage />
                          </RequireAdminPage>
                        } />
                        <Route path="/admin/courier-applications" element={
                          <RequireAdminPage>
                            <CourierAdminPage />
                          </RequireAdminPage>
                        } />
                        <Route path={ROUTES.MES_TROCS} element={
                          <RequireAuth>
                            <MesTrocsPage />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU 2025-01-28: Routes offres d'emploi */}
                        <Route path="/offres-emploi" element={<OffresEmploiHubPage />} />
                        <Route path="/offres-emploi/search" element={<OffreSearchPage />} />
                        <Route path="/offres-emploi/list" element={<OffreListPage />} />
                        <Route path="/offres-emploi/:id" element={<OffreDetailsPage />} />
                        <Route path="/offres-emploi/mes-candidatures" element={
                          <RequireAuth>
                            <MesCandidaturesPage />
                          </RequireAuth>
                        } />
                        <Route path="/offres-emploi/mes-offres" element={
                          <RequireAuth>
                            <MesOffresPage />
                          </RequireAuth>
                        } />
                        {/* ✅ NOUVEAU 2025-01-28: Routes orientation scolaire */}
                        <Route path="/orientation-scolaire" element={<OrientationScolaireHubPage />} />
                        <Route path="/orientation-scolaire/:type/search" element={<EtablissementSearchPage />} />
                        <Route path="/orientation-scolaire/etablissements/:id" element={<EtablissementDetailsPage />} />
                        <Route path="/orientation-scolaire/primaire/search" element={<EtablissementSearchPage />} />
                        <Route path="/orientation-scolaire/secondaire/search" element={<EtablissementSearchPage />} />
                        <Route path="/orientation-scolaire/superieur/search" element={<EtablissementSearchPage />} />
                        <Route path="/orientation-scolaire/programmes/search" element={<ProgrammesScolairesPage />} />
                        <Route path="/orientation-scolaire/fournitures/search" element={<FournituresScolairesPage />} />
                        <Route path="/orientation-scolaire/concours/actifs" element={<ConcoursEntreePage />} />
                        <Route path="/orientation-scolaire/concours/search" element={<ConcoursEntreePage />} />
                        <Route path="/orientation-scolaire/experiences/search" element={<ExperiencesEtudiantsPage />} />
                        <Route path="/orientation-scolaire/conferences/programmees" element={<ConferencesLivesPage />} />
                        <Route path="/orientation-scolaire/conferences/search" element={<ConferencesLivesPage />} />
                        {/* Fallback */}
                        <Route path="*" element={<PageNotFound />} />
                      </Routes>
                      {/* ���� Statut WebSocket en temps r+�el - SUPPRIM+� */}
                      {/* <WebSocketStatusRealTime /> */}
                    </Router>
                  </DeliveryProvider>
                </ShoppingProvider>
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#363636',
                      color: '#fff',
                    },
                    success: {
                      duration: 5000,
                      iconTheme: {
                        primary: '#4ade80',
                        secondary: '#fff',
                      },
                    },
                    error: {
                      duration: 5000,
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                      },
                    },
                  }}
                />
              </FeatureFlagProvider>
            </IntelligentLanguageProvider>
          </GlobalIAStatsProvider>
        </AuthProvider>
      </ToasterProvider>
    </GPSManager>
  );
}
export default App;
