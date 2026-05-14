import React from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToasterProvider } from './components/ui/toaster';
import AdaptivePartnerNav from './components/nav/AdaptivePartnerNav';
import PartnerFAB from './components/nav/PartnerFAB';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import './config/axios';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PartnerRegisterPage from './pages/PartnerRegisterPage';
import ConfirmationPage from './pages/ConfirmationPage';
import ComptePage from './pages/ComptePage';
import WalletPage from './pages/WalletPage';
import WalletHistoryPage from './pages/WalletHistoryPage';
import RechargePage from './pages/RechargePage';

import PharmacieHomePage from './pages/specialized/PharmacieHomePage';
import PharmacieSearchPage from './pages/specialized/PharmacieSearchPage';
import PharmacieListPage from './pages/specialized/PharmacieListPage';
import PharmacieDetailsPage from './pages/specialized/PharmacieDetailsPage';
import MyPharmacyOrdersPage from './pages/specialized/MyPharmacyOrdersPage';
import PharmacieDashboardPage from './pages/partner/PharmacieDashboardPage';
import PharmacieConsentGate from './pages/specialized/pharmacie/PharmacieConsentGate';

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

function PharmacieLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {children}
      <PartnerFAB />
      <AdaptivePartnerNav />
      <PWAInstallPrompt
        appName="Yukpo Pharmacie"
        themeColor="#059669"
        storageKey="yukpo_pwa_pharmacie"
      />
    </div>
  );
}

function AppPharmacie() {
  return (
    <ErrorBoundary>
      <ToasterProvider>
        <AuthProvider>
          <Router>
            {/* ⚠️ Consentement utilisateur obligatoire avant utilisation
                des fonctions IA (posologie, interactions, alternatives) —
                voir PharmacieConsentGate.tsx pour le détail réglementaire. */}
            <PharmacieConsentGate>
            <Routes>
              {/* Auth */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register/partner" element={<PartnerRegisterPage />} />
              <Route path="/partenaire/inscription" element={<PartnerRegisterPage />} />
              <Route path="/register/confirmation" element={<ConfirmationPage />} />

              {/* Espace partenaire */}
              <Route path="/dashboard" element={<PharmacieLayout><PharmacieDashboardPage /></PharmacieLayout>} />
              <Route path="/dashboard/commandes" element={<PharmacieLayout><PharmacieDashboardPage /></PharmacieLayout>} />
              <Route path="/dashboard/produits" element={<PharmacieLayout><PharmacieDashboardPage /></PharmacieLayout>} />
              <Route path="/dashboard/stats" element={<PharmacieLayout><PharmacieDashboardPage /></PharmacieLayout>} />
              <Route path="/dashboard/qr" element={<PharmacieLayout><PharmacieDashboardPage /></PharmacieLayout>} />
              <Route path="/dashboard/finances" element={<PharmacieLayout><PharmacieDashboardPage /></PharmacieLayout>} />

              {/* Client : mes commandes */}
              <Route path="/commandes" element={<PharmacieLayout><MyPharmacyOrdersPage /></PharmacieLayout>} />

              {/* Compte + Wallet (commun client + partenaire) */}
              <Route path="/compte" element={<PharmacieLayout><ComptePage /></PharmacieLayout>} />
              <Route path="/wallet" element={<PharmacieLayout><WalletPage /></PharmacieLayout>} />
              <Route path="/wallet/history" element={<PharmacieLayout><WalletHistoryPage /></PharmacieLayout>} />
              <Route path="/recharge" element={<PharmacieLayout><RechargePage /></PharmacieLayout>} />

              {/* Public client */}
              <Route path="/" element={<PharmacieLayout><PharmacieHomePage /></PharmacieLayout>} />
              <Route path="/search" element={<PharmacieLayout><PharmacieSearchPage /></PharmacieLayout>} />
              <Route path="/list" element={<PharmacieLayout><PharmacieListPage /></PharmacieLayout>} />
              <Route path="/:id" element={<PharmacieLayout><PharmacieDetailsPage /></PharmacieLayout>} />

              {/* Compat anciennes URLs */}
              <Route path="/pharmacies" element={<Navigate to="/" replace />} />
              <Route path="/pharmacies/*" element={<Navigate to="/" replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </PharmacieConsentGate>
          </Router>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </ToasterProvider>
    </ErrorBoundary>
  );
}

export default AppPharmacie;
