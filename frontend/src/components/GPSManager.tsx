import React, { useEffect, useCallback } from 'react';
import { useAutoGPSTracking } from '../hooks/useAutoGPSTracking';
import { useUserContext } from '../context/UserContext';
import { gpsTrackingService } from '../services/gpsTrackingService';

interface GPSManagerProps {
  children: React.ReactNode;
}

const GPSManager: React.FC<GPSManagerProps> = ({ children }) => {
  const { user } = useUserContext();
  const { startTracking, stopTracking, isTracking } = useAutoGPSTracking();

  // Détecter les interactions utilisateur pour autoriser le GPS
  const handleUserInteraction = useCallback(() => {
    console.log('👤 Interaction utilisateur détectée, autorisation GPS...');
    gpsTrackingService.markUserInteraction();
    
    // Démarrer le tracking après interaction
    if (user && !isTracking) {
      console.log('👤 Utilisateur connecté, démarrage du tracking GPS après interaction...');
      startTracking();
    }
  }, [user, isTracking, startTracking]);

  // Écouter les interactions utilisateur
  useEffect(() => {
    const events = ['click', 'touchstart', 'keydown', 'scroll'];
    
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [handleUserInteraction]);

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