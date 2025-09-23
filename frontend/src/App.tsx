// @ts-check
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
// CORRECTION CRITIQUE: Importer la configuration axios
import { Toaster } from 'react-hot-toast';
import RequireAuth from './components/auth/RequireAuth';
import GPSManager from './components/GPSManager';
import { GlobalIAStatsProvider } from './components/intelligence/GlobalIAStats';
import { IntelligentLanguageProvider } from './components/IntelligentLanguageProvider';
import { ToasterProvider } from './components/ui/toaster';
import './config/axios';
import { ROUTES } from './routes/AppRoutesRegistry';
// Pages essentielles
import ConfirmationPage from '@/pages/ConfirmationPage';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import PageNotFound from '@/pages/PageNotFound';
import RegisterPage from '@/pages/RegisterPage';
// Recherche & Cr+�ation service
import ServiceFormDynamic from "@/components/forms/ServiceFormDynamic";
import ChatDialog from '@/pages/ChatDialog';
import CreationService from "@/pages/CreationService";
import CreationSmartService from '@/pages/CreationSmartService';
import FormulaireServiceModerne from '@/pages/FormulaireServiceModerne';
import FormulaireYukpoIntelligent from '@/pages/FormulaireYukpoIntelligent';
import RechercheBesoin from '@/pages/RechercheBesoin';
import SoldeDetailPage from '@/pages/SoldeDetailPage';
import YukpoIaHub from '@/pages/YukpoIaHub';

// Dashboard pages
import LocationDisplayDemo from '@/components/location/LocationDisplayDemo';
import ExternalServiceShare from '@/components/sharing/ExternalServiceShare';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';
import Dashboard from '@/pages/Dashboard';
import MesServices from '@/pages/dashboard/MesServices';
import MonProfil from '@/pages/dashboard/MonProfil';
import DashboardPrestataire from '@/pages/DashboardPrestataire';
import RechargeTokensPage from '@/pages/RechargeTokensPage';
import ResultatBesoin from '@/pages/ResultatBesoin';
import ServicesInteragisPage from '@/pages/ServicesInteragisPage';
import ServicesPage from '@/pages/ServicesPage';
import { ServiceView } from '@/pages/ServiceView';
import TestResultatBesoin from '@/pages/TestResultatBesoin';
import UserSettingsPage from '@/pages/UserSettingsPage';
import VideoCall from '@/pages/VideoCall';
function App() {
  return (
    <GPSManager>
      <ToasterProvider>
        <GlobalIAStatsProvider>
          <IntelligentLanguageProvider>
            <Router>
              <Routes>
                {/* ���� Pages publiques */}
                <Route path={ROUTES.HOME} element={<HomePage />} />
                <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
                <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                <Route path={ROUTES.CONFIRMATION} element={<ConfirmationPage />} />
                <Route path={ROUTES.ABOUT} element={<AboutPage />} />
                <Route path={ROUTES.CONTACT} element={<ContactPage />} />
                <Route path={ROUTES.SERVICES} element={<ServicesPage />} />
                {/* ���� Cr+�ation & recherche service */}
                <Route path={ROUTES.SERVICE_CREATE} element={<CreationService />} />
                <Route path={ROUTES.CREATION_SMART_SERVICE} element={<CreationSmartService />} />
                <Route path={ROUTES.RECHERCHE_BESOIN} element={<RechercheBesoin />} />
                <Route path={ROUTES.YUKPO_IA_HUB} element={<YukpoIaHub />} />
                <Route path={ROUTES.CHAT_DIALOG} element={<ChatDialog />} />
                <Route path={ROUTES.FORMULAIRE_YUKPO_INTELLIGENT} element={<FormulaireYukpoIntelligent />} />
                <Route path={ROUTES.FORMULAIRE_SERVICE_MODERNE} element={<FormulaireServiceModerne />} />
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
                {/* ���� R+�sultats de recherche */}
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
                {/* Fallback */}
                <Route path="*" element={<PageNotFound />} />
              </Routes>
              {/* ���� Statut WebSocket en temps r+�el - SUPPRIM+� */}
              {/* <WebSocketStatusRealTime /> */}
            </Router>
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
          </IntelligentLanguageProvider>
        </GlobalIAStatsProvider>
      </ToasterProvider>
    </GPSManager>
  );
}
export default App;
