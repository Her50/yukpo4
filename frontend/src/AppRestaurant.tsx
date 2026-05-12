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

import RestaurantListPage from './pages/restaurant/RestaurantListPage';
import RestaurantMenuPage from './pages/restaurant/RestaurantMenuPage';
import MyRestaurantOrdersPage from './pages/restaurant/MyRestaurantOrdersPage';
import RestaurantDashboardPage from './pages/partner/RestaurantDashboardPage';

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

function RestaurantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {children}
      <PartnerFAB />
      <AdaptivePartnerNav />
      <PWAInstallPrompt
        appName="Yukpo Restaurant"
        themeColor="#dc2626"
        storageKey="yukpo_pwa_restaurant"
      />
    </div>
  );
}

function AppRestaurant() {
  return (
    <ErrorBoundary>
      <ToasterProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Auth */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register/partner" element={<PartnerRegisterPage />} />
              <Route path="/partenaire/inscription" element={<PartnerRegisterPage />} />
              <Route path="/register/confirmation" element={<ConfirmationPage />} />

              {/* Espace partenaire */}
              <Route path="/dashboard" element={<RestaurantLayout><RestaurantDashboardPage /></RestaurantLayout>} />

              {/* Compte + Wallet */}
              <Route path="/compte" element={<RestaurantLayout><ComptePage /></RestaurantLayout>} />
              <Route path="/wallet" element={<RestaurantLayout><WalletPage /></RestaurantLayout>} />
              <Route path="/wallet/history" element={<RestaurantLayout><WalletHistoryPage /></RestaurantLayout>} />
              <Route path="/recharge" element={<RestaurantLayout><RechargePage /></RestaurantLayout>} />

              {/* Public client */}
              <Route path="/" element={<RestaurantLayout><RestaurantListPage /></RestaurantLayout>} />
              <Route path="/search" element={<RestaurantLayout><RestaurantListPage /></RestaurantLayout>} />
              <Route path="/commandes" element={<RestaurantLayout><MyRestaurantOrdersPage /></RestaurantLayout>} />
              <Route path="/:serviceId/menu" element={<RestaurantLayout><RestaurantMenuPage /></RestaurantLayout>} />

              {/* Compat anciennes URLs */}
              <Route path="/restaurant" element={<Navigate to="/" replace />} />
              <Route path="/restaurant/*" element={<Navigate to="/" replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </AuthProvider>
      </ToasterProvider>
    </ErrorBoundary>
  );
}

export default AppRestaurant;
