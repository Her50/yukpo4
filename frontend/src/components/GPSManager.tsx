import React, { useEffect } from 'react';
import { useAutoGPSTracking } from '../hooks/useAutoGPSTracking';
import { useUserContext } from '../context/UserContext';

interface GPSManagerProps {
  children: React.ReactNode;
}

const GPSManager: React.FC<GPSManagerProps> = ({ children }) => {
  const { user } = useUserContext();
  const { startTracking, stopTracking, isTracking } = useAutoGPSTracking();

  // Effet pour démarrer le tracking quand l'utilisateur se connecte
  useEffect(() => {
    if (user && !isTracking) {
      console.log('👤 Utilisateur connecté, démarrage du tracking GPS...');
      startTracking();
    }
  }, [user, isTracking, startTracking]);

  // Effet pour nettoyer le tracking lors du démontage
  useEffect(() => {
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [isTracking, stopTracking]);

  // Retourner seulement les enfants sans interface de debug
  return <>{children}</>;
};

export default GPSManager; 