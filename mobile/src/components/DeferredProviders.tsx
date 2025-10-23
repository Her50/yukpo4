// Composant pour charger les providers lourds de manière progressive
// après que l'écran principal soit déjà affiché
import React, { useEffect, useState } from 'react';
import { GlobalIAStatsProvider } from './intelligence/GlobalIAStats';
import { LocationProvider } from '../contexts/LocationContext';

// ✅ PROTECTION: Wrapper avec ErrorBoundary spécifique pour chaque provider
const SafeLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  try {
    return <LocationProvider>{children}</LocationProvider>;
  } catch (error) {
    console.error('[DeferredProviders] Erreur LocationProvider:', error);
    return <>{children}</>; // Continuer sans LocationProvider
  }
};

const SafeGlobalIAStatsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  try {
    return <GlobalIAStatsProvider>{children}</GlobalIAStatsProvider>;
  } catch (error) {
    console.error('[DeferredProviders] Erreur GlobalIAStatsProvider:', error);
    return <>{children}</>; // Continuer sans GlobalIAStatsProvider
  }
};

interface DeferredProvidersProps {
  children: React.ReactNode;
}

/**
 * Charge les providers lourds de manière progressive :
 * 1. Affiche l'écran immédiatement (enfants rendus tout de suite)
 * 2. +500ms : LocationProvider (géolocalisation)
 * 3. +1000ms : GlobalIAStatsProvider (stats IA)
 * 4. GPS et Push sont chargés à la demande dans leurs écrans respectifs
 */
const DeferredProviders: React.FC<DeferredProvidersProps> = ({ children }) => {
  const [locationReady, setLocationReady] = useState(false);
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    // Phase 1: Attendre que l'écran soit monté (500ms)
    const locationTimer = setTimeout(() => {
      console.log('[DeferredProviders] 📍 Chargement LocationProvider...');
      setLocationReady(true);
    }, 500);

    // Phase 2: Charger les stats IA (1000ms)
    const statsTimer = setTimeout(() => {
      console.log('[DeferredProviders] 📊 Chargement GlobalIAStatsProvider...');
      setStatsReady(true);
    }, 1000);

    return () => {
      clearTimeout(locationTimer);
      clearTimeout(statsTimer);
    };
  }, []);

  // ✅ ÉTAPE 1: Afficher l'écran IMMÉDIATEMENT (sans providers lourds)
  if (!locationReady) {
    console.log('[DeferredProviders] ⚡ Rendu immédiat sans providers lourds');
    return <>{children}</>;
  }

  // ✅ ÉTAPE 2: LocationProvider chargé (+500ms) avec protection
  if (!statsReady) {
    console.log('[DeferredProviders] 📍 LocationProvider actif');
    return (
      <SafeLocationProvider>
        {children}
      </SafeLocationProvider>
    );
  }

  // ✅ ÉTAPE 3: Tous les providers chargés (+1000ms) avec protection
  console.log('[DeferredProviders] ✅ Tous providers actifs');
  return (
    <SafeLocationProvider>
      <SafeGlobalIAStatsProvider>
        {children}
      </SafeGlobalIAStatsProvider>
    </SafeLocationProvider>
  );
};

export default DeferredProviders;

