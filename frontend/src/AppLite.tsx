import React from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToasterProvider } from './components/ui/toaster';
import LiteBottomNav from './components/LiteBottomNav';

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
import './config/axios';

// Auth
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ConfirmationPage from './pages/ConfirmationPage';

// Pharmacie
import PharmacieHomePage from './pages/specialized/PharmacieHomePage';
import PharmacieSearchPage from './pages/specialized/PharmacieSearchPage';
import PharmacieListPage from './pages/specialized/PharmacieListPage';
import PharmacieDetailsPage from './pages/specialized/PharmacieDetailsPage';

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
import TrocMatchingPage from './pages/trocs/TrocMatchingPage';
import TrocDetailsPage from './pages/trocs/TrocDetailsPage';
import TrocLiveValidationPage from './pages/trocs/TrocLiveValidationPage';
import MesTrocsPage from './pages/trocs/MesTrocsPage';

// Restaurant (nouvelles pages)
import RestaurantListPage from './pages/restaurant/RestaurantListPage';
import RestaurantMenuPage from './pages/restaurant/RestaurantMenuPage';

import RequireAuth from './components/auth/RequireAuth';

function LiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {children}
      <LiteBottomNav />
    </div>
  );
}

function App() {
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

            {/* ── Pharmacie ── */}
            <Route path="/pharmacies" element={<LiteLayout><PharmacieHomePage /></LiteLayout>} />
            <Route path="/pharmacies/search" element={<LiteLayout><PharmacieSearchPage /></LiteLayout>} />
            <Route path="/pharmacies/list" element={<LiteLayout><PharmacieListPage /></LiteLayout>} />
            <Route path="/pharmacies/:id" element={<LiteLayout><PharmacieDetailsPage /></LiteLayout>} />

            {/* ── Bourse du Livre ── */}
            <Route path="/livres-scolaires" element={<LiteLayout><LivreScolaireHomePage /></LiteLayout>} />
            <Route path="/livres-scolaires/search" element={<LiteLayout><LivreScolaireSearchPage /></LiteLayout>} />
            <Route path="/livres-scolaires/etablissement" element={<LiteLayout><EtablissementScolaireFormPage /></LiteLayout>} />
            <Route path="/livres-scolaires/livreur" element={<LiteLayout><RequireAuth><LivreurDashboardPage /></RequireAuth></LiteLayout>} />
            <Route path="/livres-scolaires/list" element={<LiteLayout><LivreScolaireListPage /></LiteLayout>} />
            <Route path="/livres-scolaires/:id" element={<LiteLayout><LivreScolaireDetailsPage /></LiteLayout>} />
            <Route path="/livres-scolaires/nouveau" element={<LiteLayout><RequireAuth><LivreScolaireFormPage /></RequireAuth></LiteLayout>} />
            <Route path="/livres-scolaires/:id/modifier" element={<LiteLayout><RequireAuth><LivreScolaireFormPage /></RequireAuth></LiteLayout>} />
            <Route path="/livres-scolaires/mes-livres" element={<LiteLayout><RequireAuth><MesLivresPage /></RequireAuth></LiteLayout>} />
            <Route path="/livres-scolaires/parent-selection" element={<LiteLayout><ParentSelectionPage /></LiteLayout>} />
            <Route path="/livres-scolaires/scan-programme" element={<LiteLayout><ScanProgrammePage /></LiteLayout>} />
            <Route path="/livres-scolaires/recap" element={<LiteLayout><RecapAchatPage /></LiteLayout>} />

            {/* Troc */}
            <Route path="/livres-scolaires/:id/matching" element={<LiteLayout><RequireAuth><TrocMatchingPage /></RequireAuth></LiteLayout>} />
            <Route path="/trocs/mes-trocs" element={<LiteLayout><RequireAuth><MesTrocsPage /></RequireAuth></LiteLayout>} />
            <Route path="/trocs/:trocId" element={<LiteLayout><RequireAuth><TrocDetailsPage /></RequireAuth></LiteLayout>} />
            <Route path="/trocs/:trocId/validation" element={<LiteLayout><RequireAuth><TrocLiveValidationPage /></RequireAuth></LiteLayout>} />

            {/* ── Restaurant ── */}
            <Route path="/restaurant" element={<LiteLayout><RestaurantListPage /></LiteLayout>} />
            <Route path="/restaurant/:serviceId/menu" element={<LiteLayout><RestaurantMenuPage /></LiteLayout>} />

            {/* Redirection par défaut */}
            <Route path="*" element={<Navigate to="/pharmacies" replace />} />
          </Routes>
        </Router>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </AuthProvider>
    </ToasterProvider>
    </ErrorBoundary>
  );
}

export default App;
