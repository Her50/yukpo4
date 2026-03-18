// @ts-nocheck
import * as React from "react";
import { useEffect } from 'react';
import { Text } from 'react-native';
import { useUserContext } from '../context/UserContext';
import { useAutoGPSTracking } from '../hooks/useAutoGPSTracking';

interface GPSManagerProps {
  children: React.ReactNode;
}

const GPSManager: React.FC<GPSManagerProps> = ({ children }) => {
  const { user } = useUserContext();
  const { startTracking, stopTracking, isTracking } = useAutoGPSTracking();

  // Effet pour démarrer le tracking quand l'utilisateur se connecte
  useEffect(() => {
    if (user && !isTracking) {
      console.log('\uD83D\uDC64 Utilisateur connecté, démarrage du tracking GPS...');
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

  // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
  const safeChildren = React.Children.map(children, (child, index) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return <Text key={index}>{String(child)}</Text>;
    }
    if (child == null) {
      return null;
    }
    return child;
  });
  return <>{safeChildren}</>;
};

export default GPSManager;




