// Gestionnaires chargés à la demande (GPS et Push Notifications)
// Se chargent APRÈS que l'utilisateur ait commencé à utiliser l'app
import React, { Component, useEffect, useState } from 'react';
import BloodDonationAlertManager from './BloodDonationAlertManager';
import GPSTrackingManager from './GPSTrackingManager';
import PushNotificationManager from './PushNotificationManager';
import { useLanguageSafe } from '../contexts/LanguageContext';

// ✅ ErrorBoundary spécifique pour les Managers
class ManagerErrorBoundary extends Component<
  { children: React.ReactNode; managerName: string },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error(`[${this.name}] Erreur capturée:`, error);
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`[ManagerErrorBoundary] ${this.props.managerName} a crashé:`, error, errorInfo);
    // Le manager crash silencieusement sans bloquer l'app
  }

  render() {
    if (this.state.hasError) {
      console.warn(`[ManagerErrorBoundary] ${this.props.managerName} désactivé suite à une erreur`);
      return null; // Ne rien afficher si le manager crash
    }
    return this.props.children;
  }
}

/**
 * Charge les managers lourds de manière différée :
 * - Attend 2 secondes après le montage de lt('lazyManagers.ecranPrincipalOuSeChargeQuand')utilisateur interagit avec une feature qui en a besoin
 */
const LazyManagers: React.FC = () => {
      const { t } = useLanguageSafe();
const [loadManagers, setLoadManagers] = useState(false);

  useEffect(() => {
    // Charger après 5 secondes (l'utilisateur a bien vu l'écran et interagi)
    // Délai augmenté pour éviter la surcharge au démarrage
    const timer = setTimeout(() => {
      console.log('[LazyManagers] 🔔 Chargement GPS et Push Notifications...');
      setLoadManagers(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!loadManagers) {
    return null; // Ne rien afficher pendant le délai
  }

  console.log('[LazyManagers] ✅ Managers actifs');
  return (
    <>
      <ManagerErrorBoundary managerName="GPSTrackingManager">
        <GPSTrackingManager />
      </ManagerErrorBoundary>

      <ManagerErrorBoundary managerName="PushNotificationManager">
        <PushNotificationManager />
      </ManagerErrorBoundary>

      <ManagerErrorBoundary managerName="BloodDonationAlertManager">
        <BloodDonationAlertManager />
      </ManagerErrorBoundary>
    </>
  );
};

export default LazyManagers;

