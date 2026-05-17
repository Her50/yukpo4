import React from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToasterProvider } from './components/ui/toaster';
import BourseNav from './components/nav/BourseNav';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import './config/axios';

// Auth
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ConfirmationPage from './pages/ConfirmationPage';

// Bourse du Livre
import LivreScolaireHomePage from './pages/livres-scolaires/LivreScolaireHomePage';
import LivreScolaireSearchPage from './pages/livres-scolaires/LivreScolaireSearchPage';
import EtablissementScolaireFormPage from './pages/livres-scolaires/EtablissementScolaireFormPage';
import LivreurDashboardPage from './pages/livres-scolaires/LivreurDashboardPage';
import LivreScolaireListPage from './pages/livres-scolaires/LivreScolaireListPage';
import LivreScolaireDetailsPage from './pages/livres-scolaires/LivreScolaireDetailsPage';
import LivreScolaireFormPage from './pages/livres-scolaires/LivreScolaireFormPage';
import MesLivresPage from './pages/livres-scolaires/MesLivresPage';
import ParentDashboardPage from './pages/livres-scolaires/ParentDashboardPage';
import ReferralPage from './pages/livres-scolaires/ReferralPage'; // ✅ 2026-05-15
import ParentSelectionPage from './pages/livres-scolaires/ParentSelectionPage';
import ScanProgrammePage from './pages/livres-scolaires/ScanProgrammePage';
import RecapAchatPage from './pages/livres-scolaires/RecapAchatPage';
import RentreeCenterPage from './pages/livres-scolaires/RentreeCenterPage';
import LibrairieBulkUploadPage from './pages/livres-scolaires/LibrairieBulkUploadPage';
import BrowseProgrammeByEtablissementPage from './pages/livres-scolaires/BrowseProgrammeByEtablissementPage';
import CahiersAccessoiresPage from './pages/livres-scolaires/CahiersAccessoiresPage';
import DeliveryLocationOnboardingPage from './pages/livres-scolaires/DeliveryLocationOnboardingPage';
import VendreLivresPage from './pages/livres-scolaires/VendreLivresPage';
import MesCommandesPage from './pages/livres-scolaires/MesCommandesPage';
import CommandeDetailPage from './pages/livres-scolaires/CommandeDetailPage';
import { LibrairieDashboardPage, LibrairieCommandeDetailPage } from './pages/livres-scolaires/LibrairiePortalPage';
import LibrairieMarcheBoursePage from './pages/livres-scolaires/LibrairieMarcheBoursePage';
import EcoleSearchPage from './pages/livres-scolaires/EcoleSearchPage';
import {
  EcoleDecisionPage,
  EcoleSelectClassePage,
  EcoleListeScolairePage,
  EcoleInfosPage,
} from './pages/livres-scolaires/EcolePublicPage';
import {
  EtablissementPortalHomePage,
  EtablissementDashboardPage,
} from './pages/livres-scolaires/EtablissementPortalPage';
import EtablissementListeScolairePage from './pages/livres-scolaires/EtablissementListeScolairePage';
import AdminProgrammeNationalImportPage from './pages/livres-scolaires/AdminProgrammeNationalImportPage';
import TeamInvitationAcceptPage from './pages/livres-scolaires/TeamInvitationAcceptPage';
import ComptePage from './pages/ComptePage';
import RechargePage from './pages/RechargePage';

// Troc
import TrocMatchingPage from './pages/trocs/TrocMatchingPage';
import TrocDetailsPage from './pages/trocs/TrocDetailsPage';
import TrocLiveValidationPage from './pages/trocs/TrocLiveValidationPage';
import MesTrocsPage from './pages/trocs/MesTrocsPage';

import RequireAuth from './components/auth/RequireAuth';
import PartnerRegisterPage from './pages/PartnerRegisterPage';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const e = this.state.error as Error;
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: 'red' }}>
          <h2>Erreur de rendu</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{e.message}{'\n'}{e.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function BourseLayout({ children }: { children: React.ReactNode }) {
  // ✅ 2026-05-08 v3 : philosophie finale — tous les parents doivent créer
  // un compte au 1er accès. Une fois connecté, le token JWT persiste dans
  // localStorage donc ils ne se reconnectent pas à chaque visite. Pas de
  // compte invité silencieux. La connexion est obligatoire pour TOUTES les
  // pages de la Bourse du Livre (parent + partenaires).
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {children}
      <BourseNav />
      <PWAInstallPrompt
        appName="Bourse du Livre"
        themeColor="#d97706"
        storageKey="yukpo_pwa_bourse"
      />
    </div>
  );
}

function AppBourse() {
  return (
    <ErrorBoundary>
      <ToasterProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Auth */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register/confirmation" element={<ConfirmationPage />} />
              {/* Inscription partenaire (établissement scolaire, libraire, etc.) */}
              <Route path="/partner-register" element={<PartnerRegisterPage />} />
              <Route path="/register/partner" element={<PartnerRegisterPage />} />

              {/* Home */}
              <Route path="/" element={<BourseLayout><LivreScolaireHomePage /></BourseLayout>} />

              {/* Parcours parent */}
              <Route path="/parent-selection" element={<BourseLayout><ParentSelectionPage /></BourseLayout>} />
              <Route path="/scan-programme" element={<BourseLayout><ScanProgrammePage /></BourseLayout>} />
              <Route path="/programme-ecole" element={<BourseLayout><BrowseProgrammeByEtablissementPage /></BourseLayout>} />
              <Route path="/cahiers-accessoires" element={<BourseLayout><CahiersAccessoiresPage /></BourseLayout>} />
              <Route path="/onboarding/livraison" element={<DeliveryLocationOnboardingPage />} />
              {/* Routes Bourse du Livre accessibles sans login : auth demandée
                  uniquement au moment de la finalisation (POST commande / vente).
                  Cohérent avec une utilisation périodique de la rentrée scolaire. */}
              {/* ✅ 2026-05-10 : /troc-prep est déprécié — le troc se fait désormais
                  article-par-article depuis /rentree. On redirige les anciens
                  liens (bookmarks parents) vers le Centre de Rentrée. */}
              <Route path="/troc-prep" element={<Navigate to="/rentree" replace />} />
              {/* /vendre nécessite une session auth (POST /api/bourse-livre/v2/sessions
                  est protégé par JWT). Sans RequireAuth, le bouton scan restait
                  désactivé silencieusement après un 401. */}
              <Route path="/vendre" element={<BourseLayout><RequireAuth><VendreLivresPage /></RequireAuth></BourseLayout>} />
              <Route path="/mes-commandes" element={<BourseLayout><MesCommandesPage /></BourseLayout>} />
              <Route path="/mes-commandes/:id" element={<BourseLayout><RequireAuth><CommandeDetailPage /></RequireAuth></BourseLayout>} />
              <Route path="/recap" element={<BourseLayout><RecapAchatPage /></BourseLayout>} />
              {/* ✅ 2026-05-10 : Centre de Rentrée — UX unique parent-centric, classe tabs, école partenaire prioritaire, troc article-par-article */}
              <Route path="/rentree" element={<BourseLayout><RentreeCenterPage /></BourseLayout>} />

              {/* Livres */}
              <Route path="/search" element={<BourseLayout><LivreScolaireSearchPage /></BourseLayout>} />
              <Route path="/list" element={<BourseLayout><LivreScolaireListPage /></BourseLayout>} />
              <Route path="/nouveau" element={<BourseLayout><RequireAuth><LivreScolaireFormPage /></RequireAuth></BourseLayout>} />
              <Route path="/mes-livres" element={<BourseLayout><RequireAuth><MesLivresPage /></RequireAuth></BourseLayout>} />
              <Route path="/:id/modifier" element={<BourseLayout><RequireAuth><LivreScolaireFormPage /></RequireAuth></BourseLayout>} />
              <Route path="/:id" element={<BourseLayout><LivreScolaireDetailsPage /></BourseLayout>} />

              {/* Yukpo Librairie — portail libraire (login obligatoire, pas guest) */}
              <Route path="/librairie" element={<BourseLayout><RequireAuth><LibrairieDashboardPage /></RequireAuth></BourseLayout>} />
              <Route path="/librairie/commandes/:commandeId" element={<BourseLayout><RequireAuth><LibrairieCommandeDetailPage /></RequireAuth></BourseLayout>} />
              <Route path="/librairie/marche-bourse" element={<BourseLayout><RequireAuth><LibrairieMarcheBoursePage /></RequireAuth></BourseLayout>} />

              {/* ✅ 2026-05-07 : Pages Officielles Établissements */}
              {/* Côté parent (mode invité OK) */}
              <Route path="/recherche-ecole" element={<BourseLayout><EcoleSearchPage /></BourseLayout>} />
              <Route path="/ecole/:slug" element={<BourseLayout><EcoleDecisionPage /></BourseLayout>} />
              <Route path="/ecole/:slug/commander" element={<BourseLayout><EcoleSelectClassePage /></BourseLayout>} />
              <Route path="/ecole/:slug/commander/:classe" element={<BourseLayout><EcoleListeScolairePage /></BourseLayout>} />
              <Route path="/ecole/:slug/infos" element={<BourseLayout><EcoleInfosPage /></BourseLayout>} />

              {/* Côté admin établissement (login requis) */}
              <Route path="/etablissement-portal" element={<BourseLayout><RequireAuth><EtablissementPortalHomePage /></RequireAuth></BourseLayout>} />
              <Route path="/etablissement-portal/:etabId" element={<BourseLayout><RequireAuth><EtablissementDashboardPage /></RequireAuth></BourseLayout>} />
              <Route path="/etablissement-portal/:etabId/liste-scolaire" element={<BourseLayout><RequireAuth><EtablissementListeScolairePage /></RequireAuth></BourseLayout>} />
              <Route path="/admin-yukpo/programme-national/import" element={<BourseLayout><RequireAuth><AdminProgrammeNationalImportPage /></RequireAuth></BourseLayout>} />
              {/* Compte / profil parent — accès au solde de crédits, recharge, infos compte */}
              <Route path="/compte" element={<BourseLayout><RequireAuth><ComptePage /></RequireAuth></BourseLayout>} />
              <Route path="/profil" element={<BourseLayout><RequireAuth><ComptePage /></RequireAuth></BourseLayout>} />
              <Route path="/recharge" element={<BourseLayout><RequireAuth><RechargePage /></RequireAuth></BourseLayout>} />
              {/* Tableau de bord parent — solde Yukpo + crédit estimé/libéré + commandes + colis */}
              <Route path="/tableau-de-bord" element={<BourseLayout><RequireAuth><ParentDashboardPage /></RequireAuth></BourseLayout>} />

              {/* ✅ 2026-05-15 — Page parrainage dédiée et partageable.
                  PAS DE RequireAuth : si un filleul arrive ici via le lien
                  partagé (avec ?ref=XXX), il voit le pitch d'invitation
                  avant de s'inscrire. Si user connecté, il voit sa propre
                  carte parrainage + retrait cash. */}
              <Route path="/parrainage" element={<BourseLayout><ReferralPage /></BourseLayout>} />

              {/* Acceptation d'invitation d'équipe (lien WhatsApp) */}
              <Route path="/team/accept" element={<TeamInvitationAcceptPage />} />

              {/* Rôles secondaires */}
              <Route path="/etablissement" element={<BourseLayout><EtablissementScolaireFormPage /></BourseLayout>} />
              <Route path="/livreur" element={<BourseLayout><RequireAuth><LivreurDashboardPage /></RequireAuth></BourseLayout>} />
              <Route path="/libraire/bulk-upload" element={<BourseLayout><RequireAuth><LibrairieBulkUploadPage /></RequireAuth></BourseLayout>} />

              {/* Troc */}
              <Route path="/trocs/mes-trocs" element={<BourseLayout><RequireAuth><MesTrocsPage /></RequireAuth></BourseLayout>} />
              <Route path="/trocs/:trocId" element={<BourseLayout><RequireAuth><TrocDetailsPage /></RequireAuth></BourseLayout>} />
              <Route path="/trocs/:trocId/validation" element={<BourseLayout><RequireAuth><TrocLiveValidationPage /></RequireAuth></BourseLayout>} />
              <Route path="/:id/matching" element={<BourseLayout><RequireAuth><TrocMatchingPage /></RequireAuth></BourseLayout>} />

              {/* Compat anciennes URLs */}
              <Route path="/livres-scolaires" element={<Navigate to="/" replace />} />
              <Route path="/livres-scolaires/*" element={<Navigate to="/" replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </ToasterProvider>
    </ErrorBoundary>
  );
}

export default AppBourse;
