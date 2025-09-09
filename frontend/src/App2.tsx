// @ts-check
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ROUTES } from '@/routes/AppRoutesRegistry';
import ProtectedRouteByPlanAndRole from '@/routes/ProtectedRouteByPlanAndRole';
import RequireAuth from '@/components/auth/RequireAuth';

// Pages publiques
import HomePage from '@/pages/HomePage';
import LandingPage from '@/pages/LandingPage';
import LandingPage_FR from '@/pages/landing/LandingPage_fr';
import LandingPage_EN from '@/pages/landing/LandingPage_en';
import LandingPage_FF from '@/pages/landing/LandingPage_ff';
import ApiDocs from '@/pages/docs/ApiDocs';
import LegalNotice from '@/pages/legal/LegalNotice';
import PrivacyPage from '@/pages/legal/PrivacyPage';
import CookiePage from '@/pages/legal/CookiePage';
import AboutPage from '@/pages/AboutPage';
import ServicesPage from '@/pages/ServicesPage';
import ContactPage from '@/pages/ContactPage';
import PlansPage from '@/pages/PlansPage';
import RegisterPage from '@/pages/RegisterPage';
import LoginPage from '@/pages/LoginPage';
import ConfirmationPage from '@/pages/ConfirmationPage';
import CreateService from '@/pages/CreationService';
import VoicePanel from '@/pages/VoicePanel';
import MonEspace from '@/pages/MonEspace';
import PaiementProPage from '@/pages/PaiementProPage';
import PaiementPlanPage from '@/pages/PaiementPlanPage';
import MatchPage from '@/pages/MatchPage';
import SingleServicePage from '@/pages/SingleServicePage';
import SuggestionsContextuelles from '@/components/services/SuggestionsContextuelles';
import CataloguePage from '@/pages/CataloguePage';
import StartPage from '@/pages/StartPage';
import CreationSmartService from '@/pages/CreationSmartService';
import RechercheBesoin from '@/pages/RechercheBesoin';
import YukpoIaHub from '@/pages/YukpoIaHub';
import ChatDialog from '@/pages/ChatDialog';
import VideoIntelligencePage from '@/pages/VideoIntelligencePage';
import TranslateTestPanel from '@/pages/TranslateTestPanel';

// Plans
import PlanFreePage from '@/pages/plans/FreePlanPage';
import PlanProPage from '@/pages/plans/ProPlanPage';
import PlanEnterprisePage from '@/pages/plans/EnterprisePlanPage';

// Dashboards
import Dashboard from '@/pages/Dashboard';
import ApiDashboardPage from '@/pages/ApiDashboardPage';
import AdminAccessAudit from '@/pages/admin/AdminAccessAudit';
import MesOpportunitesPage from '@/pages/dashboard/MesOpportunites';
import MesServicesPage from '@/pages/dashboard/MesServices';
import PrestataireDashboard from '@/pages/PrestataireDashboard';
import MatchingHistoryDashboard from '@/pages/admin/MatchingHistoryDashboard';
import AdminTopTagsPanel from '@/pages/admin/AdminTopTagsPanel';
import AdminActionsPanel from '@/pages/admin/AdminActionsPanel';
import PageNotFound from '@/pages/PageNotFound';
import IADashboardPanel from '@/pages/admin/IADashboardPanel';
import IATestPanel from '@/pages/admin/IATestPanel';
import IAStatusPanel from '@/pages/admin/IAStatusPanel';
import AdminUserPlans from '@/pages/admin/AdminUserPlans';
import AdminExpirationsPanel from '@/pages/admin/AdminExpirationsPanel';
import TranslateTestAdmin from '@/pages/admin/TranslateTestAdmin';
import ModerationPanel from '@/pages/admin/ModerationPanel';
import LoadTestDashboard from '@/pages/admin/LoadTestDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* 🌐 Pages publiques */}
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={ROUTES.LANDING} element={<LandingPage />} />
        <Route path={ROUTES.LANDING_FR} element={<LandingPage_FR />} />
        <Route path={ROUTES.LANDING_EN} element={<LandingPage_EN />} />
        <Route path={ROUTES.LANDING_FF} element={<LandingPage_FF />} />
        <Route path={ROUTES.DOCS} element={<ApiDocs />} />
        <Route path={ROUTES.LEGAL_NOTICE} element={<LegalNotice />} />
        <Route path={ROUTES.PRIVACY} element={<PrivacyPage />} />
        <Route path={ROUTES.COOKIES} element={<CookiePage />} />
        <Route path={ROUTES.ABOUT} element={<AboutPage />} />
        <Route path={ROUTES.CONTACT} element={<ContactPage />} />
        <Route path={ROUTES.PLANS} element={<PlansPage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.CONFIRMATION} element={<ConfirmationPage />} />
        <Route path={ROUTES.SERVICES} element={<ServicesPage />} />
        <Route path={ROUTES.SERVICE_CREATE} element={<CreateService />} />
        <Route path={ROUTES.VOICE_ASSISTANT} element={<VoicePanel />} />
        <Route path={ROUTES.ESPACE} element={<MonEspace />} />
        <Route path={ROUTES.PAIEMENTPRO} element={<PaiementProPage />} />
        <Route path={ROUTES.PAYMENT_PLAN} element={<PaiementPlanPage />} />
        <Route path={ROUTES.TRANSLATE_TEST} element={<TranslateTestPanel />} />
        <Route path={ROUTES.SUGGESTIONS_TEST} element={<SuggestionsContextuelles serviceId={1} />} />
        <Route path={ROUTES.PLAN_FREE} element={<PlanFreePage />} />
        <Route path={ROUTES.PLAN_PRO} element={<PlanProPage />} />
        <Route path={ROUTES.PLAN_ENTERPRISE} element={<PlanEnterprisePage />} />
        <Route path={ROUTES.CATALOGUE} element={<CataloguePage />} />
        <Route path="/video-intelligence" element={<VideoIntelligencePage />} />
        <Route path={ROUTES.START} element={<StartPage />} />
        <Route path={ROUTES.CREATION_SMART_SERVICE} element={<CreationSmartService />} />
        <Route path={ROUTES.RECHERCHE_BESOIN} element={<RechercheBesoin />} />
        <Route path={ROUTES.YUKPO_IA_HUB} element={<YukpoIaHub />} />
        <Route path={ROUTES.CHAT_DIALOG} element={<ChatDialog />} />

        {/* 🔐 Zones protégées */}
        <Route
          path="/services/:id"
          element={
            <ProtectedRouteByPlanAndRole allowedPlans={['free', 'pro', 'enterprise']}>
              <SingleServicePage />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path={ROUTES.DASHBOARD_ADMIN_API}
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <ApiDashboardPage />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path={ROUTES.DASHBOARD_ADMIN_AUDIT}
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <AdminAccessAudit />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/matching-history"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <MatchingHistoryDashboard />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/tags/top"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <AdminTopTagsPanel />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/actions"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <AdminActionsPanel />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/ia/dashboard"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <IADashboardPanel />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/ia/test"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <IATestPanel />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/ia/status"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <IAStatusPanel />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/users/plan"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <AdminUserPlans />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/expirations"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <AdminExpirationsPanel />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/translate/test"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <TranslateTestAdmin />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/moderation"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <ModerationPanel />
            </ProtectedRouteByPlanAndRole>
          }
        />
        <Route
          path="/admin/load-test"
          element={
            <ProtectedRouteByPlanAndRole allowedRoles={['admin']} allowedPlans={['enterprise']}>
              <LoadTestDashboard />
            </ProtectedRouteByPlanAndRole>
          }
        />

        {/* Utilisateurs connectés */}
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.MATCH}
          element={
            <RequireAuth>
              <MatchPage />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.MES_OPPORTUNITES}
          element={
            <RequireAuth>
              <MesOpportunitesPage />
            </RequireAuth>
          }
        />
        <Route
          path={ROUTES.MES_SERVICES}
          element={
            <RequireAuth>
              <MesServicesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/prestataire"
          element={
            <RequireAuth>
              <PrestataireDashboard />
            </RequireAuth>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<PageNotFound />} />
      </Routes>

      <ToastContainer />
    </Router>
  );
}

export default App;
