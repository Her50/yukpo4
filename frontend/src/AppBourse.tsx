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
import ParentSelectionPage from './pages/livres-scolaires/ParentSelectionPage';
import ScanProgrammePage from './pages/livres-scolaires/ScanProgrammePage';
import RecapAchatPage from './pages/livres-scolaires/RecapAchatPage';
import LibrairieBulkUploadPage from './pages/livres-scolaires/LibrairieBulkUploadPage';

// Troc
import TrocMatchingPage from './pages/trocs/TrocMatchingPage';
import TrocDetailsPage from './pages/trocs/TrocDetailsPage';
import TrocLiveValidationPage from './pages/trocs/TrocLiveValidationPage';
import MesTrocsPage from './pages/trocs/MesTrocsPage';

import RequireAuth from './components/auth/RequireAuth';

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

              {/* Home */}
              <Route path="/" element={<BourseLayout><LivreScolaireHomePage /></BourseLayout>} />

              {/* Parcours parent */}
              <Route path="/parent-selection" element={<BourseLayout><ParentSelectionPage /></BourseLayout>} />
              <Route path="/scan-programme" element={<BourseLayout><ScanProgrammePage /></BourseLayout>} />
              <Route path="/recap" element={<BourseLayout><RecapAchatPage /></BourseLayout>} />

              {/* Livres */}
              <Route path="/search" element={<BourseLayout><LivreScolaireSearchPage /></BourseLayout>} />
              <Route path="/list" element={<BourseLayout><LivreScolaireListPage /></BourseLayout>} />
              <Route path="/nouveau" element={<BourseLayout><RequireAuth><LivreScolaireFormPage /></RequireAuth></BourseLayout>} />
              <Route path="/mes-livres" element={<BourseLayout><RequireAuth><MesLivresPage /></RequireAuth></BourseLayout>} />
              <Route path="/:id/modifier" element={<BourseLayout><RequireAuth><LivreScolaireFormPage /></RequireAuth></BourseLayout>} />
              <Route path="/:id" element={<BourseLayout><LivreScolaireDetailsPage /></BourseLayout>} />

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
