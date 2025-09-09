import React, { useEffect, useState } from 'react';
import { gpsTrackingService } from '../services/gpsTrackingService';
import { useUserContext } from '../context/UserContext';

interface GPSAutoTrackerProps {
  autoStart?: boolean;
  showStatus?: boolean;
}

const GPSAutoTracker: React.FC<GPSAutoTrackerProps> = ({ 
  autoStart = true, 
  showStatus = true 
}) => {
  const { user } = useUserContext();
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (autoStart && user) {
      startGPSTracking();
    }

    return () => {
      if (isTracking) {
        gpsTrackingService.stopTracking();
      }
    };
  }, [user, autoStart]);

  const startGPSTracking = async () => {
    try {
      console.log('🚀 Démarrage du tracking GPS automatique...');
      
      // Démarrer le service de tracking
      gpsTrackingService.startTracking();
      setIsTracking(true);

      // Obtenir la position actuelle
      await getCurrentLocation();

      // Écouter les mises à jour de position
      const interval = setInterval(async () => {
        try {
          const newLocation = await gpsTrackingService.getCurrentLocation();
          if (newLocation) {
            const coords = `${newLocation.latitude.toFixed(6)},${newLocation.longitude.toFixed(6)}`;
            setCurrentLocation(coords);
            setLastUpdate(new Date());
            
            console.log(`📍 Position GPS mise à jour: ${coords}`);
            
            // Envoyer au backend
            await updateBackendGPS(newLocation.latitude, newLocation.longitude);
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors de la mise à jour GPS:', error);
        }
      }, 5 * 60 * 1000); // Mise à jour toutes les 5 minutes

      return () => clearInterval(interval);
    } catch (error) {
      console.error('❌ Erreur lors du démarrage du tracking GPS:', error);
      setIsTracking(false);
    }
  };

  const stopGPSTracking = () => {
    gpsTrackingService.stopTracking();
    setIsTracking(false);
    console.log('🛑 Tracking GPS arrêté');
  };

  const getCurrentLocation = async () => {
    try {
      const location = await gpsTrackingService.getCurrentLocation();
      if (location) {
        const coords = `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
        setCurrentLocation(coords);
        setLastUpdate(new Date());
        
        console.log(`📍 Position GPS actuelle: ${coords}`);
        
        // Envoyer au backend
        await updateBackendGPS(location.latitude, location.longitude);
        
        return coords;
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la position:', error);
    }
    return null;
  };

  const updateBackendGPS = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch('/api/user/me/gps_location', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy: 10, // Précision par défaut
        }),
      });

      if (response.ok) {
        console.log('✅ Position GPS mise à jour dans le backend');
      } else {
        console.warn('⚠️ Erreur lors de la mise à jour GPS dans le backend');
      }
    } catch (error) {
      console.error('❌ Erreur réseau lors de la mise à jour GPS:', error);
    }
  };

  const getLocationString = () => {
    if (!currentLocation) return '';
    return currentLocation;
  };

  if (!showStatus) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          📍 Tracking GPS
        </h3>
        <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      
      <div className="space-y-2 text-xs">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Statut:</span>
          <span className={`ml-2 font-medium ${isTracking ? 'text-green-600' : 'text-red-600'}`}>
            {isTracking ? 'Actif' : 'Inactif'}
          </span>
        </div>
        
        {currentLocation && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Position:</span>
            <span className="ml-2 font-mono text-gray-900 dark:text-white">
              {currentLocation}
            </span>
          </div>
        )}
        
        {lastUpdate && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Dernière mise à jour:</span>
            <span className="ml-2 text-gray-900 dark:text-white">
              {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
      
      <div className="flex space-x-2 mt-3">
        {!isTracking ? (
          <button
            onClick={startGPSTracking}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
          >
            Démarrer
          </button>
        ) : (
          <button
            onClick={stopGPSTracking}
            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
          >
            Arrêter
          </button>
        )}
        
        <button
          onClick={getCurrentLocation}
          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
        >
          Actualiser
        </button>
      </div>
    </div>
  );
};

export default GPSAutoTracker; 