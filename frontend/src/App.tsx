// @ts-check
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ROUTES } from '@/routes/AppRoutesRegistry';
import RequireAuth from '@/components/auth/RequireAuth';
import { GlobalIAStatsProvider } from '@/components/intelligence/GlobalIAStats';
import { ToasterProvider } from '@/components/ui/toaster';
import { Toaster } from 'react-hot-toast';
import GPSManager from './components/GPSManager';
import WebSocketStatusRealTime from '@/components/websocket/WebSocketStatusRealTime';


// Pages essentielles
import HomePage from '@/pages/HomePage';
import RegisterPage from '@/pages/RegisterPage';
import LoginPage from '@/pages/LoginPage';
import ConfirmationPage from '@/pages/ConfirmationPage';
import PageNotFound from '@/pages/PageNotFound';

// Recherche & Création service
import CreationService from "@/pages/CreationService";
import CreationSmartService from '@/pages/CreationSmartService';
import RechercheBesoin from '@/pages/RechercheBesoin';
import YukpoIaHub from '@/pages/YukpoIaHub';
import ChatDialog from '@/pages/ChatDialog';
import ServiceFormDynamic from "@/components/forms/ServiceFormDynamic";
import SoldeDetailPage from '@/pages/SoldeDetailPage';
import FormulaireYukpoIntelligent from '@/pages/FormulaireYukpoIntelligent';
import FormulaireServiceModerne from '@/pages/FormulaireServiceModerne';
import RechargeTokensPage from '@/pages/RechargeTokensPage';

// Dashboard pages
import MesServices from '@/pages/dashboard/MesServices';
import ResultatBesoin from '@/pages/ResultatBesoin';
import TestResultatBesoin from '@/pages/TestResultatBesoin';
import LocationDisplayDemo from '@/components/location/LocationDisplayDemo';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';
import ServicesPage from '@/pages/ServicesPage';
import Dashboard from '@/pages/Dashboard';
import MonProfil from '@/pages/dashboard/MonProfil';
import { ServiceView } from '@/pages/ServiceView';
import VideoCall from '@/pages/VideoCall';

function App() {
  return (
    <GPSManager>
      <ToasterProvider>
        <GlobalIAStatsProvider>
          <Router>
              <Routes>
                {/* 🌐 Pages publiques */}
                <Route path={ROUTES.HOME} element={<HomePage />} />
                <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
                <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                <Route path={ROUTES.CONFIRMATION} element={<ConfirmationPage />} />
                <Route path={ROUTES.ABOUT} element={<AboutPage />} />
                <Route path={ROUTES.CONTACT} element={<ContactPage />} />
                <Route path={ROUTES.SERVICES} element={<ServicesPage />} />

                {/* 🚀 Création & recherche service */}
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
                {/* ✅ Ajout de la page solde/historique IA */}
                <Route path={ROUTES.MON_SOLDE} element={<SoldeDetailPage />} />
                <Route path={ROUTES.RECHARGE_TOKENS} element={<RechargeTokensPage />} />

                {/* 🎯 Dashboard routes */}
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
                <Route path="/dashboard/profil" element={
                  <RequireAuth>
                    <MonProfil />
                  </RequireAuth>
                } />
                
                {/* 📊 Résultats de recherche */}
                <Route path="/resultat-besoin" element={<ResultatBesoin />} />
                <Route path="/test-resultat-besoin" element={<TestResultatBesoin />} />
                <Route path="/test-location-display" element={<LocationDisplayDemo />} />

                {/* 🎯 Page de visualisation de service public */}
                <Route path="/service/:serviceId" element={<ServiceView />} />

                {/* 💬 Chat entre utilisateurs */}
                <Route path="/chat/:prestataireId" element={
                  <RequireAuth>
                    <ChatDialog />
                  </RequireAuth>
                } />

                {/* 📹 Appels vidéo */}
                <Route path="/video-call" element={<VideoCall />} />

                {/* Fallback */}
                <Route path="*" element={<PageNotFound />} />
              </Routes>
              
              {/* 🔌 Statut WebSocket en temps réel - SUPPRIMÉ */}
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
        </GlobalIAStatsProvider>
      </ToasterProvider>
    </GPSManager>
  );
}

export default App;
